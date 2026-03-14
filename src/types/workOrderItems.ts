export type WorkOrderItemType =
  | 'part'
  | 'material'
  | 'labor';

export interface WorkOrderItem {
  id: string;

  work_order_id: string;

  item_type: WorkOrderItemType;

  description: string;

  quantity: number;

  unit?: string;

  part_catalog_id?: string;

  warranty_months?: number;

  notes?: string;

  sort_order?: number;

  created_at?: string;

  updated_at?: string;
}