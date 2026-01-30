import { supabase } from '../lib/supabase';

export interface ActivityLog {
  activity_type: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface AuditLog {
  action: 'create' | 'update' | 'delete' | 'view' | 'export';
  target_table: string;
  record_id?: string;
  old_data?: any;
  new_data?: any;
}

class ActivityLogger {
  async logActivity(log: ActivityLog) {
    // Activity logging temporarily disabled to prevent errors
    return;
  }

  async logAudit(log: AuditLog) {
    // Audit logging temporarily disabled to prevent errors
    return;
  }

  async getRecentActivity(limit = 50) {
    // Activity logging temporarily disabled
    return [];
  }

  async getAuditLogs(filters?: {
    action?: string;
    target_table?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }) {
    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:user_id (
            full_name,
            role
          )
        `)
        .order('created_at', { ascending: false });

      if (filters?.action) {
        query = query.eq('action', filters.action);
      }

      if (filters?.target_table) {
        query = query.eq('resource_type', filters.target_table);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }

  private async getIpAddress(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  async logLogin() {
    return this.logActivity({
      activity_type: 'authentication',
      description: 'Usuario inició sesión',
      metadata: { event: 'login' }
    });
  }

  async logLogout() {
    return this.logActivity({
      activity_type: 'authentication',
      description: 'Usuario cerró sesión',
      metadata: { event: 'logout' }
    });
  }

  async logViewChange(view: string) {
    return this.logActivity({
      activity_type: 'navigation',
      description: `Navegó a ${view}`,
      metadata: { view }
    });
  }

  async logExport(type: string, recordCount: number) {
    await this.logActivity({
      activity_type: 'export',
      description: `Exportó ${recordCount} registros como ${type}`,
      metadata: { type, recordCount }
    });

    return this.logAudit({
      action: 'export',
      target_table: 'exports',
      new_data: { type, recordCount }
    });
  }

  async logChecklistCompletion(checklistId: string, elevatorId: string) {
    await this.logActivity({
      activity_type: 'maintenance',
      description: 'Completó checklist de mantenimiento',
      metadata: { checklistId, elevatorId }
    });

    return this.logAudit({
      action: 'create',
      target_table: 'maintenance_checklists',
      record_id: checklistId,
      new_data: { elevatorId, completed: true }
    });
  }

  async logClientCreation(clientId: string, clientName: string) {
    await this.logActivity({
      activity_type: 'client_management',
      description: `Creó nuevo cliente: ${clientName}`,
      metadata: { clientId, clientName }
    });

    return this.logAudit({
      action: 'create',
      target_table: 'clients',
      record_id: clientId,
      new_data: { name: clientName }
    });
  }

  async logClientUpdate(clientId: string, oldData: any, newData: any) {
    await this.logActivity({
      activity_type: 'client_management',
      description: `Actualizó información de cliente`,
      metadata: { clientId }
    });

    return this.logAudit({
      action: 'update',
      target_table: 'clients',
      record_id: clientId,
      old_data: oldData,
      new_data: newData
    });
  }

  async logPDFGeneration(checklistId: string, elevatorId: string) {
    await this.logActivity({
      activity_type: 'document',
      description: 'Generó PDF de certificación',
      metadata: { checklistId, elevatorId }
    });

    return this.logAudit({
      action: 'create',
      target_table: 'documents',
      new_data: { checklistId, elevatorId, type: 'pdf' }
    });
  }
}

export const activityLogger = new ActivityLogger();