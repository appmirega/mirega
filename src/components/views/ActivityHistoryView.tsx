import { useState, useEffect } from 'react';
import { Activity, Calendar, User, Filter, Download } from 'lucide-react';
import { activityLogger } from '../../services/activityLogger';

interface ActivityRecord {
  id: string;
  activity_type: string;
  description: string;
  metadata: any;
  created_at: string;
  profiles?: {
    full_name: string;
    role: string;
  };
}

export function ActivityHistoryView() {
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    loadActivities();
    activityLogger.logViewChange('activity-history').catch(() => {});
  }, []);

  const loadActivities = async () => {
    setLoading(true);
    const data = await activityLogger.getRecentActivity(200);
    setActivities(data);
    setLoading(false);
  };

  const handleExport = () => {
    const csv = [
      ['Fecha', 'Usuario', 'Tipo', 'Descripción'],
      ...filteredActivities.map(activity => [
        new Date(activity.created_at).toLocaleString('es-MX'),
        activity.profiles?.full_name || 'Desconocido',
        activity.activity_type,
        activity.description
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    activityLogger.logExport('CSV', filteredActivities.length).catch(() => {});
  };

  const filteredActivities = activities.filter(activity => {
    return !typeFilter || activity.activity_type === typeFilter;
  });

  const uniqueTypes = Array.from(new Set(activities.map(a => a.activity_type)));

  const getActivityIcon = (type: string) => {
    const iconMap: { [key: string]: string } = {
      authentication: '🔐',
      navigation: '🧭',
      export: '📥',
      maintenance: '🔧',
      client_management: '👥',
      document: '📄'
    };
    return iconMap[type] || '📌';
  };

  const groupedByDate = filteredActivities.reduce((groups, activity) => {
    const date = new Date(activity.created_at).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as { [key: string]: ActivityRecord[] });

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
            <Activity className="w-8 h-8" />
            Historial de Actividad
          </h1>
          <p className="text-slate-600 mt-1">
            Registro de todas tus actividades en el sistema
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
          >
            <option value="">Todos los tipos</option>
            {uniqueTypes.map(type => (
              <option key={type} value={type}>
                {getActivityIcon(type)} {type}
              </option>
            ))}
          </select>
          <div className="px-4 py-2 bg-slate-50 rounded-lg">
            <span className="text-sm text-slate-600">Total: </span>
            <span className="font-semibold text-slate-900">{filteredActivities.length}</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedByDate).map(([date, dayActivities]) => (
          <div key={date} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Calendar className="w-4 h-4" />
                {date}
              </div>
            </div>
            <div className="divide-y divide-slate-200">
              {dayActivities.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="text-2xl">{getActivityIcon(activity.activity_type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-slate-900">
                          {activity.description}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(activity.created_at).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <User className="w-3 h-3" />
                        {activity.profiles?.full_name || 'Usuario'}
                        <span className="text-slate-400">•</span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                          {activity.activity_type}
                        </span>
                      </div>
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                            Ver detalles
                          </summary>
                          <pre className="mt-2 text-xs bg-slate-50 p-2 rounded overflow-x-auto">
                            {JSON.stringify(activity.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filteredActivities.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <Activity className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No hay actividades registradas</p>
        </div>
      )}
    </div>
  );
}