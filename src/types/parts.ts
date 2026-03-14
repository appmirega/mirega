export interface PartCatalogItem {
  id: string;

  part_code?: string;

  name: string;

  brand?: string;

  model?: string;

  category?: string;

  description?: string;

  default_warranty_months?: number;

  is_active: boolean;

  created_at?: string;

  updated_at?: string;
}

export interface ElevatorPartHistory {
  id: string;

  elevator_id: string;

  work_order_id: string;

  part_catalog_id: string;

  installed_at: string;

  warranty_start?: string;

  warranty_end?: string;

  serial_number?: string;

  notes?: string;

  created_at?: string;
}