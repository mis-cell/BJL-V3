import { supabase } from "../lib/supabase";

export type EntityType = 
  | 'user_master' 
  | 'sauda_master' 
  | 'satta_master' 
  | 'sauda_quality_details'
  | 'satta_quality_details'
  | 'satta_base_rates'
  | 'satta_differentials'
  | 'satta_calculated_rates'
  | 'material_received'
  | 'temporary_material_received'
  | 'final_arrival'
  | 'purchase_master' 
  | 'sauda_check_point'
  | 'sauda_check_point_details'
  | 'sauda_check_point_deductions'
  | 'mill_inspection_deduction'
  | 'material_inspection_deductions'
  | 'temporary_po'
  | 'temporary_po_details'
  | 'godown_master'
  | 'broker_master'
  | 'supply_master'
  | 'opening_stock'
  | 'closing_stock'
  | 'batch_master'
  | 'unit_master'
  | 'lorry_weighments'
  | 'payment_master'
  | 'payment_details';

export const dbModule = {
  async fetchAll(table: string, orderCol?: string, ascending: boolean = true): Promise<any[]> {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    let query = supabase.from(table).select("*");
    if (orderCol) query = query.order(orderCol, { ascending });
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async insert(table: string, data: any) {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    if (!navigator.onLine) {
      queueOfflineAction({ action: 'insert', table, data });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-data-updated'));
      return data;
    }
    const { data: result, error } = await supabase
      .from(table)
      .insert(data)
      .select()
      .single();
    
    if (error) throw error;
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-data-updated'));
    return result;
  },

  async upsert(table: string, data: any, idCol?: string) {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    if (!navigator.onLine) {
      queueOfflineAction({ action: 'insert', table, data });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-data-updated'));
      return data;
    }
    const { data: result, error } = await supabase
      .from(table)
      .upsert(data, idCol ? { onConflict: idCol } : undefined)
      .select()
      .maybeSingle();
    
    if (error) throw error;
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-data-updated'));
    return result;
  },

  async update(table: string, idCol: string, idVal: any, data: any) {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    if (!navigator.onLine) {
      queueOfflineAction({ action: 'update', table, idCol, idVal, data });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-data-updated'));
      return data;
    }
    const { data: result, error } = await supabase
      .from(table)
      .update(data)
      .eq(idCol, idVal)
      .select()
      .single();
    
    if (error) throw error;
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-data-updated'));
    return result;
  },

  async delete(table: string, idCol: string, idVal: any) {
    if (!supabase) throw new Error("Offline Mode: Connection not established.");
    if (!navigator.onLine) {
      queueOfflineAction({ action: 'delete', table, idCol, idVal });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-data-updated'));
      return true;
    }
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(idCol, idVal);
    
    if (error) throw error;
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('app-data-updated'));
    return true;
  }
};

// --- In-Memory Offline Background Sync Worker ---
interface OfflineAction {
  action: 'insert' | 'update' | 'delete';
  table: string;
  data?: any;
  idCol?: string;
  idVal?: any;
  timestamp?: number;
}

let inMemoryOfflineQueue: OfflineAction[] = [];

function getOfflineQueue(): OfflineAction[] {
  return inMemoryOfflineQueue;
}

function queueOfflineAction(action: OfflineAction) {
  inMemoryOfflineQueue.push({ ...action, timestamp: Date.now() });
  console.warn(`[SYNC] Network offline. Queued action in memory: ${action.action} on ${action.table}`);
}

export async function flushOfflineQueue() {
  const queue = [...inMemoryOfflineQueue];
  if (queue.length === 0) return;

  console.log(`[SYNC] Network online. Flushing ${queue.length} queued actions...`);
  const failedQueue: OfflineAction[] = [];

  for (const item of queue) {
    try {
      if (item.action === 'insert') {
        await supabase.from(item.table).insert(item.data);
      } else if (item.action === 'update' && item.idCol && item.idVal) {
        await supabase.from(item.table).update(item.data).eq(item.idCol, item.idVal);
      } else if (item.action === 'delete' && item.idCol && item.idVal) {
        await supabase.from(item.table).delete().eq(item.idCol, item.idVal);
      }
    } catch (e) {
      console.error(`[SYNC] Failed to process queued action for ${item.table}:`, e);
      failedQueue.push(item);
    }
  }

  inMemoryOfflineQueue = failedQueue;
  if (failedQueue.length === 0) {
    console.log('[SYNC] All in-memory offline actions synced successfully.');
  }
}

// Auto-flush when online
window.addEventListener('online', () => {
  flushOfflineQueue();
});
