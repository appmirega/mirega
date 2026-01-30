import { activityLogger } from '../services/activityLogger';

export interface ExportColumn {
  key: string;
  label: string;
  format?: (value: any) => string;
}

export class ExportUtils {
  static exportToCSV(data: any[], columns: ExportColumn[], filename: string) {
    const headers = columns.map(col => col.label);
    const rows = data.map(item =>
      columns.map(col => {
        const value = this.getNestedValue(item, col.key);
        const formatted = col.format ? col.format(value) : value;
        return this.escapeCSV(formatted);
      })
    );

    const csv = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    this.downloadFile(csv, filename, 'text/csv');
    activityLogger.logExport('CSV', data.length);
  }

  static exportToExcel(data: any[], columns: ExportColumn[], filename: string) {
    const headers = columns.map(col => col.label).join('\t');
    const rows = data.map(item =>
      columns.map(col => {
        const value = this.getNestedValue(item, col.key);
        return col.format ? col.format(value) : value || '';
      }).join('\t')
    );

    const tsv = [headers, ...rows].join('\n');
    this.downloadFile(tsv, filename, 'application/vnd.ms-excel');
    activityLogger.logExport('Excel', data.length);
  }

  static exportToJSON(data: any[], filename: string) {
    const json = JSON.stringify(data, null, 2);
    this.downloadFile(json, filename, 'application/json');
    activityLogger.logExport('JSON', data.length);
  }

  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private static escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  }

  private static downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static formatDate(date: string | Date): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  static formatDateTime(date: string | Date): string {
    if (!date) return '';
    return new Date(date).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  }

  static formatBoolean(value: boolean): string {
    return value ? 'Sí' : 'No';
  }

  static formatStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'Pendiente',
      in_progress: 'En Progreso',
      completed: 'Completado',
      cancelled: 'Cancelado',
      approved: 'Aprobado',
      rejected: 'Rechazado',
      active: 'Activo',
      inactive: 'Inactivo'
    };
    return statusMap[status] || status;
  }
}