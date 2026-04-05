import { useState, useEffect } from 'react';
import { Shield, Filter, Download, Search, Clock, User, Database } from 'lucide-react';
import { activityLogger } from '../../services/activityLogger';
import { useAuth } from '../../contexts/AuthContext';

interface AuditLog {
  id: string;
  action: string;
  target_table: string;
  record_id?: string;
  old_data?: any;
  new_data?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  profiles?: {
    full_name: string;
    role: string;
  };
}

export function AuditLogView() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    loadLogs();
    activityLogger.logViewChange('audit-logs').catch(() => {});
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const data = await activityLogger.getAuditLogs({ limit: 500 });
    setLogs(data);
    setLoading(false);
  };

  const handleExport = () => {
    const csv = [
      ['Fecha', 'Usuario', 'Acción', 'Tabla', 'ID Registro', 'IP', 'Detalles'],
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString('es-MX'),
        log.profiles?.full_name || 'Desconocido',
        log.action,
        log.target_table,
        log.record_id || '',
        log.ip_address || '',
        JSON.stringify({ old: log.old_data, new: log.new_data })
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    activityLogger.logExport('CSV', filteredLogs.length).catch(() => {});
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm ||
      log.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target_table.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = !actionFilter || log.action === actionFilter;
    const matchesTable = !tableFilter || log.target_table === tableFilter;

    return matchesSearch && matchesAction && matchesTable;
  });

  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));
  const uniqueTables = Array.from(new Set(logs.map(log => log.target_table)));

  if (profile?.role !== 'admin' && profile?.role !== 'developer') {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Acceso Restringido
        </h2>
        <p className="text-slate-600">
          Solo administradores y desarrolladores pueden ver los registros de auditoría.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Registro de Auditoría
          </h1>
          <p className="text-slate-600 mt-1">
            Historial completo de acciones del sistema
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Todas las acciones</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Database className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Todas las tablas</option>
              {uniqueTables.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Total:</span>
            <span className="font-semibold text-slate-900">{filteredLogs.length}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Fecha/Hora
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Acción
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Tabla
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Dirección IP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-slate-900">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {new Date(log.created_at).toLocaleString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-slate-900">
                          {log.profiles?.full_name || 'Desconocido'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {log.profiles?.role}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      log.action === 'create' ? 'bg-green-100 text-green-800' :
                      log.action === 'update' ? 'bg-blue-100 text-blue-800' :
                      log.action === 'delete' ? 'bg-red-100 text-red-800' :
                      log.action === 'view' ? 'bg-slate-100 text-slate-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-sm text-slate-900">
                      <Database className="w-4 h-4 text-slate-400" />
                      {log.target_table}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                    {log.ip_address || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                    >
                      Ver detalles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <Shield className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No se encontraron registros</p>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                Detalles del Registro de Auditoría
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Usuario
                </label>
                <p className="text-slate-900">{selectedLog.profiles?.full_name || 'Desconocido'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Acción
                </label>
                <p className="text-slate-900">{selectedLog.action}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tabla Afectada
                </label>
                <p className="text-slate-900">{selectedLog.target_table}</p>
              </div>

              {selectedLog.record_id && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    ID del Registro
                  </label>
                  <p className="text-slate-900 font-mono text-sm">{selectedLog.record_id}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Dirección IP
                </label>
                <p className="text-slate-900">{selectedLog.ip_address || 'No disponible'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Agente de Usuario
                </label>
                <p className="text-slate-900 text-sm break-all">
                  {selectedLog.user_agent || 'No disponible'}
                </p>
              </div>

              {selectedLog.old_data && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Datos Anteriores
                  </label>
                  <pre className="bg-slate-50 p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Datos Nuevos
                  </label>
                  <pre className="bg-slate-50 p-3 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-200">
              <button
                onClick={() => setSelectedLog(null)}
                className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}