import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function notifyDataChanged(tableName?: string) {
  if (typeof window !== 'undefined') {
    const detail = tableName ? { table: tableName } : {};
    window.dispatchEvent(new CustomEvent('app-data-updated', { detail }));
    window.dispatchEvent(new CustomEvent('app:data-updated', { detail }));
  }
}

export interface UseLiveAutoRefreshOptions {
  tables?: string[];   // Specific Supabase tables to listen for
  enabled?: boolean;   // Conditionally enable/disable (default true)
}

/**
 * Table-specific Supabase Realtime auto-refresh hook.
 * Replaces global 5s polling with event-driven Supabase Realtime subscriptions.
 */
export function useLiveAutoRefresh(
  refreshCallback: (payload?: any) => void | Promise<void>,
  deps: any[] = [],
  options: UseLiveAutoRefreshOptions | string[] = {}
) {
  // Support passing tables array directly as 3rd arg OR options object
  const normalizedOptions: UseLiveAutoRefreshOptions = Array.isArray(options)
    ? { tables: options }
    : options;

  const { tables = [], enabled = true } = normalizedOptions;
  const callbackRef = useRef(refreshCallback);

  useEffect(() => {
    callbackRef.current = refreshCallback;
  }, [refreshCallback]);

  useEffect(() => {
    if (!enabled) return;

    let isSubscribed = true;

    const safeExecute = async (payload?: any) => {
      if (!isSubscribed) return;
      try {
        await callbackRef.current(payload);
      } catch (e) {
        console.warn('[Realtime Auto Refresh] Error executing callback:', e);
      }
    };

    // 1. Initial execution on component mount
    safeExecute();

    // 2. Custom Event Listener for local table updates
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const changedTable = customEvent.detail?.table;

      if (changedTable && tables.length > 0) {
        // Only refresh if this hook listens to the specific table that changed
        if (tables.includes(changedTable)) {
          safeExecute();
        }
      } else {
        // If no specific table was provided in the event or hook has no table filter
        safeExecute();
      }
    };

    window.addEventListener('app-data-updated', handleCustomEvent);
    window.addEventListener('app:data-updated', handleCustomEvent);

    // 3. Supabase Realtime Postgres Changes Listener (NO setInterval POLLING)
    let channel: any = null;
    if (supabase) {
      try {
        const uniqueId = Math.random().toString(36).substring(2, 7);
        const channelName = tables.length > 0
          ? `rt-${tables.slice().sort().join('_')}-${uniqueId}`
          : `rt-all-${uniqueId}`;

        channel = supabase.channel(channelName);

        if (tables.length > 0) {
          // Listen ONLY to changes on the specified tables
          tables.forEach((t) => {
            channel = channel.on(
              'postgres_changes',
              { event: '*', schema: 'public', table: t },
              (payload: any) => {
                safeExecute(payload);
              }
            );
          });
        } else {
          // Fallback if no tables provided: listen to public schema changes
          channel = channel.on(
            'postgres_changes',
            { event: '*', schema: 'public' },
            (payload: any) => {
              safeExecute(payload);
            }
          );
        }

        channel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            // Channel subscribed successfully
          } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
            // Re-sync on connection recovery
            safeExecute();
          }
        });
      } catch (err) {
        console.warn('[Realtime Auto Refresh] Channel setup failed:', err);
      }
    }

    return () => {
      isSubscribed = false;
      window.removeEventListener('app-data-updated', handleCustomEvent);
      window.removeEventListener('app:data-updated', handleCustomEvent);
      if (channel && supabase) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [enabled, JSON.stringify(tables), ...deps]);
}
