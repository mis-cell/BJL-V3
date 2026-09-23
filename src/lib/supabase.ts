// ============================================================================
// 100% LOCAL NATIVE POSTGRESQL 18 CLIENT (bjcl_db) - HIGH PERFORMANCE ADAPTER
// ============================================================================

import { getApiUrl } from './utils';

// High-speed RAM Query Cache & Request Deduplication
interface CacheEntry {
  data: any;
  timestamp: number;
}
const queryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 3000; // 3 seconds ultra-fast SWR cache

function invalidateTableCache(table: string) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(`${table}:`) || key === table) {
      queryCache.delete(key);
    }
  }
}

// Central debounced event dispatcher to prevent socket resource exhaustion
const updateDebounceTimers = new Map<string, any>();

function dispatchTableUpdated(table: string) {
  if (typeof window === 'undefined') return;
  invalidateTableCache(table);
  
  if (updateDebounceTimers.has(table)) {
    clearTimeout(updateDebounceTimers.get(table));
  }
  const timer = setTimeout(() => {
    updateDebounceTimers.delete(table);
    window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table } }));
  }, 250);
  updateDebounceTimers.set(table, timer);
}

// Channel & Realtime listener manager for local app event synchronization
export class LocalRealtimeChannel {
  name: string;
  private listeners: Array<{ table?: string; cb: (...args: any[]) => void; handler: (e: any) => void }> = [];

  constructor(name: string) {
    this.name = name;
  }

  on(type: string, filterOrCb: any, callback?: (...args: any[]) => void) {
    const cb = typeof filterOrCb === 'function' ? filterOrCb : callback;
    const filterTable = (typeof filterOrCb === 'object' && filterOrCb?.table) ? filterOrCb.table : undefined;

    if (cb && typeof window !== 'undefined') {
      const handler = (e: any) => {
        const changedTable = e.detail?.table;
        if (!filterTable || !changedTable || filterTable === changedTable) {
          try {
            cb(e.detail || { eventType: 'UPDATE', new: {}, old: {} });
          } catch (err) {}
        }
      };
      window.addEventListener('app-data-updated', handler);
      this.listeners.push({ table: filterTable, cb, handler });
    }
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    if (callback) {
      setTimeout(() => {
        try {
          callback('SUBSCRIBED');
        } catch (e) {}
      }, 0);
    }
    return this;
  }

  async unsubscribe(): Promise<string> {
    if (typeof window !== 'undefined') {
      this.listeners.forEach(item => {
        window.removeEventListener('app-data-updated', item.handler);
      });
      this.listeners = [];
    }
    return Promise.resolve('ok');
  }

  async send(payload: any): Promise<string> {
    if (typeof window !== 'undefined' && payload?.table) {
      dispatchTableUpdated(payload.table);
    }
    return Promise.resolve('ok');
  }
}

export class LocalPgQueryBuilder {
  private table: string;
  private action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private filters: Record<string, any> = {};
  private complexFilters: Array<{ column: string; op: string; value: any }> = [];
  private orderCol?: string;
  private ascending: boolean = true;
  private limitCount?: number;
  private offsetCount?: number;
  private idCol?: string;
  private wantsSingle: boolean = false;
  private wantsMaybeSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*') {
    this.action = 'select';
    return this;
  }

  insert(data: any) {
    this.action = 'insert';
    this.payload = data;
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = data;
    if (options?.onConflict) this.idCol = options.onConflict;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters[column] = value;
    return this;
  }

  neq(column: string, value: any) {
    this.complexFilters.push({ column, op: '!=', value });
    return this;
  }

  gt(column: string, value: any) {
    this.complexFilters.push({ column, op: '>', value });
    return this;
  }

  gte(column: string, value: any) {
    this.complexFilters.push({ column, op: '>=', value });
    return this;
  }

  lt(column: string, value: any) {
    this.complexFilters.push({ column, op: '<', value });
    return this;
  }

  lte(column: string, value: any) {
    this.complexFilters.push({ column, op: '<=', value });
    return this;
  }

  like(column: string, value: any) {
    this.complexFilters.push({ column, op: 'LIKE', value });
    return this;
  }

  ilike(column: string, value: any) {
    this.complexFilters.push({ column, op: 'ILIKE', value });
    return this;
  }

  is(column: string, value: any) {
    this.filters[column] = value;
    return this;
  }

  in(column: string, values: any[]) {
    this.complexFilters.push({ column, op: 'IN', value: values });
    return this;
  }

  filter(column: string, op: string, value: any) {
    this.complexFilters.push({ column, op, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.ascending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantsMaybeSingle = true;
    return this;
  }

  abortSignal() {
    return this;
  }

  private getCacheKey(): string {
    return `${this.table}:${JSON.stringify(this.filters)}:${JSON.stringify(this.complexFilters)}:${this.orderCol || ''}:${this.ascending}:${this.limitCount || ''}:${this.offsetCount || ''}`;
  }

  async then(resolve: (res: { data: any; error: any; count?: number }) => void, reject?: (err: any) => void) {
    try {
      // 1. If this is a SELECT query, check RAM Cache first (0ms latency)
      if (this.action === 'select') {
        const cacheKey = this.getCacheKey();
        const cached = queryCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
          let cachedData = cached.data;
          if (this.wantsSingle || this.wantsMaybeSingle) {
            cachedData = Array.isArray(cachedData) ? (cachedData.length > 0 ? cachedData[0] : null) : cachedData;
          }
          resolve({ data: cachedData, error: null, count: Array.isArray(cachedData) ? cachedData.length : 1 });
          return;
        }

        // 2. Request Coalescing (Deduplicate in-flight identical queries)
        let promise = inFlightRequests.get(cacheKey);
        if (!promise) {
          promise = (async () => {
            const res = await fetch(getApiUrl('/api/pg/crud'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'select',
                table: this.table,
                data: null,
                filters: this.filters,
                complexFilters: this.complexFilters,
                order: this.orderCol,
                ascending: this.ascending,
                limit: this.limitCount,
                offset: this.offsetCount,
                idCol: this.idCol
              })
            });
            const json = await res.json().catch(() => ({ data: [], error: null }));
            const rows = Array.isArray(json.data) ? json.data : (json.data ? [json.data] : []);
            queryCache.set(cacheKey, { data: rows, timestamp: Date.now() });
            return rows;
          })();
          inFlightRequests.set(cacheKey, promise);
          promise.finally(() => inFlightRequests.delete(cacheKey));
        }

        const rows = await promise;
        let data = rows;
        if (this.wantsSingle || this.wantsMaybeSingle) {
          data = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
        }
        resolve({ data, error: null, count: Array.isArray(data) ? data.length : 1 });
        return;
      }

      // 3. For MUTATIONS (insert, update, delete, upsert), execute & invalidate cache
      const res = await fetch(getApiUrl('/api/pg/crud'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: this.action,
          table: this.table,
          data: this.payload,
          filters: this.filters,
          complexFilters: this.complexFilters,
          order: this.orderCol,
          ascending: this.ascending,
          limit: this.limitCount,
          offset: this.offsetCount,
          idCol: this.idCol
        })
      });

      const json = await res.json().catch(() => ({ data: [], error: null }));
      if (!res.ok || json.error) {
        resolve({ data: this.wantsSingle ? null : [], error: json.error || new Error('Local PostgreSQL Query Error'), count: 0 });
        return;
      }

      let data = json.data ?? [];
      if (this.wantsSingle || this.wantsMaybeSingle) {
        data = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
      } else {
        data = Array.isArray(data) ? data : (data ? [data] : []);
      }

      // Invalidate cache and notify other components
      invalidateTableCache(this.table);
      dispatchTableUpdated(this.table);

      resolve({ data, error: null, count: Array.isArray(data) ? data.length : 1 });
    } catch (err: any) {
      resolve({ data: this.wantsSingle ? null : [], error: err, count: 0 });
    }
  }

  catch(reject: (err: any) => void) {
    return this.then(r => {
      if (r.error && reject) reject(r.error);
    }, reject);
  }
}

const activeChannels = new Map<string, LocalRealtimeChannel>();

export const supabase: any = {
  from(table: string) {
    return new LocalPgQueryBuilder(table);
  },
  channel(name: string) {
    let chan = activeChannels.get(name);
    if (!chan) {
      chan = new LocalRealtimeChannel(name);
      activeChannels.set(name, chan);
    }
    return chan;
  },
  async removeChannel(chan: any): Promise<string> {
    if (chan && chan.name) {
      await chan.unsubscribe();
      activeChannels.delete(chan.name);
    }
    return Promise.resolve('ok');
  },
  async removeAllChannels(): Promise<string[]> {
    for (const c of activeChannels.values()) {
      await c.unsubscribe();
    }
    activeChannels.clear();
    return Promise.resolve(['ok']);
  },
  getChannels() {
    return Array.from(activeChannels.values());
  },
  functions: {
    invoke: async () => ({ data: null, error: null })
  },
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null })
  },
  storage: {
    from: () => ({
      upload: async () => ({ data: null, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      download: async () => ({ data: null, error: null })
    })
  },
  async rpc(name: string, args?: any) {
    try {
      const res = await fetch(getApiUrl('/api/pg/rpc'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, args })
      });
      const json = await res.json().catch(() => ({ data: [], error: null }));
      return { data: json.data ?? [], error: json.error || null };
    } catch (err: any) {
      return { data: [], error: err };
    }
  }
};

export const getSupabase = () => supabase;
export const isConfigured = true;

console.log("⚡ [TURBO SPEED] Bally Jute ERP running on Accelerated Local PostgreSQL Engine.");
