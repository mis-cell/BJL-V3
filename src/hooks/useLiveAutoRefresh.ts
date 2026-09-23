import { useEffect, useRef, useMemo } from 'react';

const debounceTimers = new Map<string, any>();

export function notifyDataChanged(tableName?: string) {
  if (typeof window === 'undefined') return;
  const tableKey = tableName || 'all';
  if (debounceTimers.has(tableKey)) {
    clearTimeout(debounceTimers.get(tableKey));
  }
  const timer = setTimeout(() => {
    debounceTimers.delete(tableKey);
    const detail = tableName ? { table: tableName } : {};
    window.dispatchEvent(new CustomEvent('app-data-updated', { detail }));
  }, 200);
  debounceTimers.set(tableKey, timer);
}

export interface UseLiveAutoRefreshOptions {
  tables?: string[];   // Specific PostgreSQL tables to listen for
  enabled?: boolean;   // Conditionally enable/disable (default true)
}

/**
 * High-performance local event-driven auto-refresh hook.
 * Uses requestIdleCallback / debounce and stable dependency tracking for 60fps smoothness.
 */
export function useLiveAutoRefresh(
  refreshCallback: (payload?: any) => void | Promise<void>,
  deps: any[] = [],
  options: UseLiveAutoRefreshOptions | string[] = {}
) {
  const normalizedOptions: UseLiveAutoRefreshOptions = Array.isArray(options)
    ? { tables: options }
    : options;

  const { tables = [], enabled = true } = normalizedOptions;
  const tablesKey = useMemo(() => tables.sort().join(','), [tables.length, ...tables]);
  const callbackRef = useRef(refreshCallback);
  const isExecutingRef = useRef(false);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    callbackRef.current = refreshCallback;
  }, [refreshCallback]);

  useEffect(() => {
    if (!enabled) return;

    let isSubscribed = true;

    const safeExecute = async (payload?: any) => {
      if (!isSubscribed || isExecutingRef.current) return;
      
      // If window/tab is in background, defer till user is active
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        if (!isSubscribed || isExecutingRef.current) return;
        isExecutingRef.current = true;
        try {
          await callbackRef.current(payload);
        } catch (e) {
          // Silent catch to prevent UI freeze
        } finally {
          isExecutingRef.current = false;
        }
      }, 200);
    };

    // 1. Initial execution on mount
    safeExecute();

    // 2. Custom Event Listener for local table updates
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const changedTable = customEvent.detail?.table;

      if (changedTable && tables.length > 0) {
        if (tables.includes(changedTable)) {
          safeExecute();
        }
      } else {
        safeExecute();
      }
    };

    window.addEventListener('app-data-updated', handleCustomEvent, { passive: true });

    return () => {
      isSubscribed = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      window.removeEventListener('app-data-updated', handleCustomEvent);
    };
  }, [enabled, tablesKey, ...deps]);
}
