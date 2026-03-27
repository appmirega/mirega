import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle,
  Download,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Wrench,
  Zap,
  HelpCircle,
} from 'lucide-react';

interface EmergencyVisit {
  id: string;
  elevator_id: string;
  failure_category: 'technical_failure' | 'external_failure' | 'other';
  reported_issue: string;
  resolution_description: string;
  visit_date: string;
  visit_time: string;
  status: string;
  technician_name: string;
  elevators: {
    location_name: string;
    address: string;
  };
}

export function ClientEmergenciesView() {
  const { selectedClientId } = useAuth();
  const [emergencies, setEmergencies] = useState<EmergencyVisit[]>([]);
  const [filteredEmergencies, setFilteredEmergencies] = useState<EmergencyVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stats, setStats] = useState({
    total: 0,
    technical: 0,
    external: 0,
    other: 0,
  });

  useEffect(() => {
    if (selectedClientId) {
      loadEmergencies();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  useEffect(() => {
    filterEmergencies();
  }, [selectedCategory, emergencies]);

  const loadEmergencies = async () => {
    if (!selectedClientId) return;

    try {
      setLoading(true);

      const { data: elevatorsData } = await supabase
        .from('elevators')
        .select('id')
        .eq('client_id', selectedClientId);

      const elevatorIds = elevatorsData?.map((e) => e.id) || [];

      if (elevatorIds.length === 0) {
        setEmergencies([]);
        setFilteredEmergencies([]);
        setStats({ total: 0, technical: 0, external: 0, other: 0 });
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('emergency_visits_v2')
        .select(`
          id,
          elevator_id,
          failure_category,
          reported_issue,
          resolution_description,
          visit_date,
          visit_time,
          status,
          technician_name,
          elevators (
            location_name,
            address
          )
        `)
        .in('elevator_id', elevatorIds)
        .order('visit_date', { ascending: false })
        .order('visit_time', { ascending: false });

      if (error) throw error;

      const emergenciesData = (data as EmergencyVisit[]) || [];
      setEmergencies(emergenciesData);

      const technicalCount = emergenciesData.filter(
        (e) => e.failure_category === 'technical_failure'
      ).length;
      const externalCount = emergenciesData.filter(
        (e) => e.failure_category === 'external_failure'
      ).length;
      const otherCount = emergenciesData.filter((e) => e.failure_category === 'other').length;

      setStats({
        total: emergenciesData.length,
        technical: technicalCount,
        external: externalCount,
        other: otherCount,
      });
    } catch (error) {
      console.error('Error loading emergencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterEmergencies = () => {
    if (selectedCategory === 'all') {
      setFilteredEmergencies(emergencies);
    } else {
      setFilteredEmergencies(
        emergencies.filter((e) => e.failure_category === selectedCategory)
      );
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical_failure':
        return <Wrench className="w-5 h-5" />;
      case 'external_failure':
        return <Zap className="w-5 h-5" />;
      case 'other':
        return <HelpCircle className="w-5 h-5" />;
      default:
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'technical_failure':
        return 'Falla Técnica';
      case 'external_failure':
        return 'Falla Externa';
      case 'other':
        return 'Otros';
      default:
        return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical_failure':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'external_failure':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'other':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-slate-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En Progreso';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Fecha',
      'Hora',
      'Ascensor',
      'Categoría',
      'Problema Reportado',
      'Solución',
      'Técnico',
      'Estado',
    ];

    const rows = filteredEmergencies.map((e) => [
      e.visit_date,
      e.visit_time,
      e.elevators?.location_name || 'N/A',
      getCategoryLabel(e.failure_category),
      e.reported_issue,
      e.resolution_description || 'N/A',
      e.technician_name,
      getStatusLabel(e.status),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `emergencias_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!selectedClientId) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600 font-medium">No hay edificio seleccionado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Historial de Emergencias</h1>
          <p className="text-slate-600 mt-1">
            Visualiza todas las visitas de emergencia de tus ascensores
          </p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={filteredEmergencies.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total" value={stats.total} icon={<FileText className="w-5 h-5 text-slate-600" />} />
        <StatCard label="Falla técnica" value={stats.technical} icon={<Wrench className="w-5 h-5 text-red-600" />} />
        <StatCard label="Falla externa" value={stats.external} icon={<Zap className="w-5 h-5 text-orange-600" />} />
        <StatCard label="Otros" value={stats.other} icon={<HelpCircle className="w-5 h-5 text-blue-600" />} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { value: 'all', label: 'Todas' },
            { value: 'technical_failure', label: 'Falla Técnica' },
            { value: 'external_failure', label: 'Falla Externa' },
            { value: 'other', label: 'Otros' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedCategory(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedCategory === option.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filteredEmergencies.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No hay emergencias registradas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEmergencies.map((emergency) => (
              <div key={emergency.id} className="border border-slate-200 rounded-lg p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg border ${getCategoryColor(emergency.failure_category)}`}>
                      {getCategoryIcon(emergency.failure_category)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {emergency.elevators?.location_name || 'Ascensor'}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {emergency.visit_date} · {emergency.visit_time}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusIcon(emergency.status)}
                    <span className="text-sm font-medium text-slate-700">
                      {getStatusLabel(emergency.status)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Categoría</span>
                    <p className="font-medium text-slate-900">
                      {getCategoryLabel(emergency.failure_category)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Técnico</span>
                    <p className="font-medium text-slate-900">
                      {emergency.technician_name || 'No informado'}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-500">Problema reportado</span>
                    <p className="text-slate-900">{emergency.reported_issue || 'N/A'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-500">Solución</span>
                    <p className="text-slate-900">
                      {emergency.resolution_description || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-slate-100 p-2 rounded-lg">{icon}</div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-600">{label}</p>
        </div>
      </div>
    </div>
  );
}