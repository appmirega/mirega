export type UserRole = 'developer' | 'admin' | 'technician' | 'client';

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          full_name: string;
          email: string;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string;
          email?: string;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          user_id: string | null;
          company_name: string;
          rut: string;
          address: string;
          city: string;
          contact_person: string;
          contact_phone: string;
          contact_email: string;
          billing_address: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
      };
      elevators: {
        Row: {
          id: string;
          client_id: string;
          qr_code: string | null;
          internal_code: string;
          brand: string;
          model: string;
          serial_number: string | null;
          installation_date: string | null;
          last_certification_date: string | null;
          next_certification_date: string | null;
          capacity_kg: number | null;
          capacity_persons: number | null;
          floors: number | null;
          location_building: string | null;
          location_address: string;
          location_coordinates: string | null;
          status: 'active' | 'inactive' | 'under_maintenance';
          created_at: string;
          updated_at: string;
        };
      };
      maintenance_schedules: {
        Row: {
          id: string;
          elevator_id: string;
          template_id: string | null;
          assigned_technician_id: string | null;
          scheduled_date: string;
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          created_at: string;
        };
      };
      emergency_visits: {
        Row: {
          id: string;
          elevator_id: string;
          client_id: string;
          reported_by: string;
          report_method: 'app' | 'whatsapp' | 'phone' | 'email';
          incident_type: 'stopped' | 'malfunction' | 'noise' | 'door_issue' | 'other';
          priority: 'low' | 'medium' | 'high' | 'critical';
          description: string;
          reported_at: string;
          assigned_technician_id: string | null;
          attended_at: string | null;
          resolved_at: string | null;
          resolution_notes: string | null;
          status: 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
          created_at: string;
        };
      };
      work_orders: {
        Row: {
          id: string;
          order_number: string;
          elevator_id: string;
          client_id: string;
          order_type: 'maintenance' | 'repair' | 'emergency' | 'installation' | 'inspection';
          title: string;
          description: string | null;
          assigned_technician_id: string | null;
          scheduled_date: string | null;
          priority: 'low' | 'medium' | 'high' | 'critical';
          status: 'draft' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'info' | 'warning' | 'alert' | 'reminder';
          reference_type: string | null;
          reference_id: string | null;
          is_read: boolean;
          created_at: string;
        };
      };
    };
  };
};
