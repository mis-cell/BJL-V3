// ============================================================================
// 100% LOCAL NATIVE POSTGRESQL 18 CLIENT (SUPABASE DISCONNECTED)
// ============================================================================

class LocalPgQueryBuilder {
  private table: string;
  private action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private filters: Record<string, any> = {};
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

  async then(resolve: (res: { data: any; error: any; count?: number }) => void, reject?: (err: any) => void) {
    try {
      const res = await fetch('/api/pg/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: this.action,
          table: this.table,
          data: this.payload,
          filters: this.filters,
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

      resolve({ data, error: null, count: Array.isArray(data) ? data.length : 1 });
    } catch (err: any) {
      resolve({ data: null, error: err });
    }
  }
}

export const supabase: any = {
  from(table: string) {
    return new LocalPgQueryBuilder(table);
  },
  async rpc(name: string, args?: any) {
    try {
      const res = await fetch('/api/pg/rpc', {
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

console.log("🔒 [100% LOCAL ARCHITECTURE] Bally Jute ERP is running entirely on Local PostgreSQL 18 (bjcl_db). Supabase is disconnected.");
