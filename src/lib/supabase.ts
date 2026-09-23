// ============================================================================
// 100% LOCAL NATIVE POSTGRESQL 18 CLIENT (bjcl_db) - PERMANENT ADAPTER
// ============================================================================

import { getApiUrl } from './utils';

// Channel & Realtime listener manager for local app event synchronization
export class LocalRealtimeChannel {
  name: string;
  private listeners: Array<(...args: any[]) => void> = [];

  constructor(name: string) {
    this.name = name;
  }

  on(type: string, filterOrCb: any, callback?: (...args: any[]) => void) {
    const cb = typeof filterOrCb === 'function' ? filterOrCb : callback;
    if (cb) {
      this.listeners.push(cb);
      if (typeof window !== 'undefined') {
        const handler = (e: any) => {
          try {
            cb(e.detail || { eventType: 'UPDATE', new: {}, old: {} });
          } catch (err) {}
        };
        window.addEventListener('app-data-updated', handler);
        (this as any)[`__handler_${this.listeners.length}`] = handler;
      }
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
      Object.keys(this).forEach(k => {
        if (k.startsWith('__handler_')) {
          window.removeEventListener('app-data-updated', (this as any)[k]);
        }
      });
    }
    return Promise.resolve('ok');
  }

  async send(payload: any): Promise<string> {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: payload }));
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

  async then(resolve: (res: { data: any; error: any; count?: number }) => void, reject?: (err: any) => void) {
    try {
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

      const json = await res.json();
      if (!res.ok || json.error) {
        resolve({ data: null, error: json.error || new Error('Local PostgreSQL Query Error') });
        return;
      }

      let data = json.data;
      if (this.wantsSingle) {
        data = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
      } else if (this.wantsMaybeSingle) {
        data = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
      }

      // Notify other views if state modified
      if (this.action !== 'select' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: this.table, action: this.action } }));
      }

      resolve({ data, error: null, count: Array.isArray(data) ? data.length : 1 });
    } catch (err: any) {
      resolve({ data: null, error: err });
    }
  }

  catch(reject: (err: any) => void) {
    return this.then(r => {
      if (r.error) reject(r.error);
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
      const json = await res.json();
      return { data: json.data, error: json.error || null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
};

export const getSupabase = () => supabase;
export const isConfigured = true;

console.log("🔒 [100% LOCAL ARCHITECTURE] Bally Jute ERP running on Local PostgreSQL 18 (bjcl_db).");
