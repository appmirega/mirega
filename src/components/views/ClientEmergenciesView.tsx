import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle,
  Filter,
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
  const { profile } = useAuth();
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
    if (profile?.id) {
      loadEmergencies();
    }
  }, [profile]);

  useEffect(() => {
    filterEmergencies();
  }, [selectedCategory, emergencies]);

  const loadEmergencies = async () => {
    try {
      console.log('🔍 [Emergencies] Profile ID:', profile?.id);
      console.log('📧 [Emergencies] Profile Email:', profile?.email);
      
      // Intentar por profile_id primero
      let { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, company_name, building_name, internal_alias')
        .eq('profile_id', profile?.id)
        .maybeSingle();

      console.log('🏢 [Emergencies] Client Data (by profile_id):', client);
      console.log('⚠️ [Emergencies] Client Error:', clientError);

      // Fallback a email matching
      if (!client && profile?.email) {
        console.log('🔄 [Emergencies] Trying fallback: matching by email...');
        const { data: clientByEmail } = await supabase
          .from('clients')
          .select('id, company_name, building_name, internal_alias')
          .eq('contact_email', profile.email)
          .maybeSingle();
        
        client = clientByEmail;
        console.log('📧 [Emergencies] Client Data (by email):', client);
      }

      if (!client) {
        console.error('❌ [Emergencies] No client found for this profile (tried profile_id and email)');
        setLoading(false);
        return;
      }

      const { data: elevatorsData, error: elevatorsError } = await supabase
        .from('elevators')
        .select('id, elevator_number, location_name')
        .eq('client_id', client.id);

      console.log('🏗️ [Emergencies] Elevators Data:', elevatorsData);
      console.log('⚠️ [Emergencies] Elevators Error:', elevatorsError);

      const elevatorIds = elevatorsData?.map(e => e.id) || [];

      if (elevatorIds.length === 0) {
        console.warn('⚠️ [Emergencies] No elevators found for this client');
        setLoading(false);
        return;
      }

      console.log('📋 [Emergencies] Elevator IDs:', elevatorIds);

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

      console.log('🚨 [Emergencies] Emergency Data:', data);
      console.log('⚠️ [Emergencies] Emergency Error:', error);

      if (error) throw error;

      const emergenciesData = data || [];
      setEmergencies(emergenciesData);

      const technicalCount = emergenciesData.filter(e => e.failure_category === 'technical_failure').length;
      const externalCount = emergenciesData.filter(e => e.failure_category === 'external_failure').length;
      const otherCount = emergenciesData.filter(e => e.failure_category === 'other').length;

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
        emergencies.filter(e => e.failure_category === selectedCategory)
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
    const headers = ['Fecha', 'Hora', 'Ascensor', 'Categoría', 'Problema Reportado', 'Solución', 'Técnico', 'Estado'];
    const rows = filteredEmergencies.map(e => [
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
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-slate-100 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-600">Total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-100 p-2 rounded-lg">
              <Wrench className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.technical}</p>
              <p className="text-sm text-slate-600">Fallas Técnicas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.external}</p>
              <p className="text-sm text-slate-600">Fallas Externas</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <HelpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.other}</p>
              <p className="text-sm text-slate-600">Otros</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Filtrar por Categoría</h2>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todas ({stats.total})
          </button>
          <button
            onClick={() => setSelectedCategory('technical_failure')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedCategory === 'technical_failure'
                ? 'bg-red-600 text-white'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            Fallas Técnicas ({stats.technical})
          </button>
          <button
            onClick={() => setSelectedCategory('external_failure')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedCategory === 'external_failure'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            }`}
          >
            Fallas Externas ({stats.external})
          </button>
          <button
            onClick={() => setSelectedCategory('other')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              selectedCategory === 'other'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            Otros ({stats.other})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">
            {filteredEmergencies.length} Emergencia{filteredEmergencies.length !== 1 ? 's' : ''}
          </h2>
        </div>

        {filteredEmergencies.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No hay emergencias registradas</p>
            <p className="text-sm text-slate-500 mt-1">
              {selectedCategory !== 'all'
                ? 'Prueba cambiando el filtro'
                : 'Las emergencias aparecerán aquí cuando se registren'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredEmergencies.map((emergency) => (
              <div key={emergency.id} className="p-6 hover:bg-slate-50 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3 rounded-lg border ${getCategoryColor(emergency.failure_category)}`}>
                      {getCategoryIcon(emergency.failure_category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-slate-900 text-lg">
                          {emergency.elevators?.location_name || 'Ascensor'}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getCategoryColor(
                            emergency.failure_category
                          )}`}
                        >
                          {getCategoryLabel(emergency.failure_category)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">
                        {emergency.elevators?.address || 'Sin dirección'}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-slate-500 font-medium mb-1">Problema Reportado</p>
                          <p className="text-sm text-slate-900">{emergency.reported_issue}</p>
                        </div>
                        {emergency.resolution_description && (
                          <div>
                            <p className="text-xs text-slate-500 font-medium mb-1">Solución</p>
                            <p className="text-sm text-slate-900">{emergency.resolution_description}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {new Date(emergency.visit_date).toLocaleDateString('es-ES')} a las{' '}
                            {emergency.visit_time}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4" />
                          <span>Técnico: {emergency.technician_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(emergency.status)}
                          <span>{getStatusLabel(emergency.status)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Acerca de las Categorías
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
          <div>
            <p className="font-semibold mb-1 flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              Fallas Técnicas
            </p>
            <p className="text-blue-700">
              Problemas mecánicos, eléctricos o de componentes del ascensor que requieren reparación o
              mantenimiento especializado.
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Fallas Externas
            </p>
            <p className="text-blue-700">
              Problemas originados por factores externos al ascensor como cortes de energía, vandalismo o uso
              inadecuado.
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Otros
            </p>
            <p className="text-blue-700">
              Situaciones que no clasifican en las categorías anteriores o requieren evaluación adicional.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
