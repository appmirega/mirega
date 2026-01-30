import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Download, 
  Share2, 
  Eye, 
  Search,
  CheckCircle2,
  Building2,
  Package
} from 'lucide-react';

interface MaintenanceRecord {
  id: string;
  year: number;
  month: number;
  status: string;
  completion_date: string | null;
  pdf_url: string | null;
  elevators: {
    id: string;
    elevator_number: string;
  };
  clients: {
    internal_alias: string;
    building_name: string;
    company_name: string;
  };
}

export const ClientMaintenancesView: React.FC = () => {
  const { profile } = useAuth();
  const [history, setHistory] = useState<MaintenanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilterYear, setHistoryFilterYear] = useState<'all' | number>('all');
  const [historyFilterMonth, setHistoryFilterMonth] = useState<'all' | number>('all');
  const [historyFilterElevator, setHistoryFilterElevator] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    if (!profile?.id) {
      console.error('❌ No profile found');
      return;
    }

    try {
      setLoadingHistory(true);
      
      console.log('🔍 Profile ID:', profile.id);
      console.log('📧 Profile Email:', profile.email);
      
      // Primero intentar por profile_id (nuevo flujo)
      let { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, company_name, building_name, internal_alias')
        .eq('profile_id', profile.id)
        .maybeSingle();

      console.log('🏢 Client Data (by profile_id):', clientData);
      console.log('⚠️ Client Error:', clientError);

      // Si no encuentra por profile_id, intentar por email (clientes legacy)
      if (!clientData && profile.email) {
        console.log('🔄 Trying fallback: matching by email...');
        const { data: clientByEmail } = await supabase
          .from('clients')
          .select('id, company_name, building_name, internal_alias')
          .eq('contact_email', profile.email)
          .maybeSingle();
        
        clientData = clientByEmail;
        console.log('📧 Client Data (by email):', clientData);
      }

      if (!clientData) {
        console.error('❌ No client found for this profile (tried profile_id and email)');
        setLoadingHistory(false);
        return;
      }

      // Obtener todos los mantenimientos de los ascensores del cliente (no solo completed)
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          id,
          year,
          month,
          status,
          completion_date,
          pdf_url,
          elevators!inner (
            id,
            elevator_number,
            client_id
          ),
          clients (
            internal_alias,
            building_name,
            company_name
          )
        `)
        .eq('elevators.client_id', clientData.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      console.log('📊 Maintenance Data:', data);
      console.log('⚠️ Maintenance Error:', error);

      if (error) throw error;
      
      // Supabase devuelve arrays para las relaciones, necesitamos transformar los datos
      const transformedData = (data || []).map(item => ({
        ...item,
        elevators: Array.isArray(item.elevators) && item.elevators.length > 0 ? item.elevators[0] : item.elevators,
        clients: Array.isArray(item.clients) && item.clients.length > 0 ? item.clients[0] : item.clients
      }));
      
      setHistory(transformedData as any);
    } catch (error) {
      console.error('Error loading maintenance history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleViewPDF = async (scheduleId: string) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select('pdf_url')
        .eq('id', scheduleId)
        .single();

      if (error) throw error;
      
      if (data?.pdf_url) {
        window.open(data.pdf_url, '_blank');
      } else {
        alert('PDF no disponible');
      }
    } catch (error) {
      console.error('Error viewing PDF:', error);
      alert('Error al abrir el PDF');
    }
  };

  const handleDownloadPDF = async (scheduleId: string) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select('pdf_url, month, year, elevators(elevator_number), clients(internal_alias, building_name)')
        .eq('id', scheduleId)
        .single();

      if (error) throw error;
      
      if (data?.pdf_url) {
        const elevatorData = Array.isArray(data.elevators) && data.elevators.length > 0 ? data.elevators[0] : data.elevators;
        const clientData = Array.isArray(data.clients) && data.clients.length > 0 ? data.clients[0] : data.clients;
        
        const buildingName = (clientData as any)?.internal_alias || (clientData as any)?.building_name || 'edificio';
        const elevatorNum = (elevatorData as any)?.elevator_number || 'asc';
        const monthName = new Date(data.year, data.month - 1).toLocaleString('es-CL', { month: 'long' });
        const filename = `mantenimiento_${buildingName}_${elevatorNum}_${monthName}_${data.year}.pdf`;
        
        const link = document.createElement('a');
        link.href = data.pdf_url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert('PDF no disponible');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar el PDF');
    }
  };

  const handleSharePDF = async (scheduleId: string) => {
    try {
      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select('pdf_url')
        .eq('id', scheduleId)
        .single();

      if (error) throw error;
      
      if (data?.pdf_url) {
        await navigator.clipboard.writeText(data.pdf_url);
        alert('¡Enlace copiado al portapapeles!');
      } else {
        alert('PDF no disponible');
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      alert('Error al compartir el PDF');
    }
  };

  const handleDownloadAnnualPackage = async () => {
    if (historyFilterYear === 'all') {
      alert('Por favor selecciona un año específico para descargar el paquete anual');
      return;
    }

    if (!profile?.id) {
      console.error('No profile found');
      return;
    }

    try {
      // Primero obtener el client_id
      const { data: clientData } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (!clientData) {
        alert('No se encontró información del cliente');
        return;
      }

      const { data, error } = await supabase
        .from('maintenance_schedules')
        .select(`
          id,
          pdf_url,
          month,
          year,
          elevators!inner (
            elevator_number,
            client_id
          ),
          clients (
            internal_alias,
            building_name
          )
        `)
        .eq('elevators.client_id', clientData.id)
        .eq('year', historyFilterYear)
        .eq('status', 'completed')
        .not('pdf_url', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) {
        alert('No hay PDFs disponibles para este año');
        return;
      }

      // Descargar cada PDF automáticamente
      data.forEach((record, index) => {
        setTimeout(() => {
          const elevatorData = Array.isArray(record.elevators) && record.elevators.length > 0 ? record.elevators[0] : record.elevators;
          const clientData = Array.isArray(record.clients) && record.clients.length > 0 ? record.clients[0] : record.clients;
          
          const buildingName = (clientData as any)?.internal_alias || (clientData as any)?.building_name || 'edificio';
          const elevatorNum = (elevatorData as any)?.elevator_number || 'asc';
          const monthName = new Date(record.year, record.month - 1).toLocaleString('es-CL', { month: 'long' });
          const filename = `mantenimiento_${buildingName}_${elevatorNum}_${monthName}_${record.year}.pdf`;
          
          const link = document.createElement('a');
          link.href = record.pdf_url!;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }, index * 500); // Delay para evitar bloqueos
      });

      alert(`Descargando ${data.length} PDFs del año ${historyFilterYear}...`);
    } catch (error) {
      console.error('Error downloading annual package:', error);
      alert('Error al descargar el paquete anual');
    }
  };

  // Verificar si hay al menos un filtro seleccionado
  const hasActiveFilter = 
    historySearchQuery !== '' || 
    historyFilterYear !== 'all' || 
    historyFilterMonth !== 'all' ||
    historyFilterElevator !== '';

  // Filtrar historial (solo mostrar los que tienen PDF disponible)
  const filteredHistory = history.filter(h => {
    // Solo mostrar mantenimientos completados con PDF
    if (h.status !== 'completed' || !h.pdf_url) return false;
    
    const buildingName = h.clients?.internal_alias || h.clients?.building_name || h.clients?.company_name || '';
    const matchesSearch = historySearchQuery === '' || 
      buildingName.toLowerCase().includes(historySearchQuery.toLowerCase());
    const matchesYear = historyFilterYear === 'all' || h.year === historyFilterYear;
    const matchesMonth = historyFilterMonth === 'all' || h.month === historyFilterMonth;
    const matchesElevator = historyFilterElevator === '' || 
      String(h.elevators?.elevator_number) === historyFilterElevator;
    
    return matchesSearch && matchesYear && matchesMonth && matchesElevator;
  });

  // Agrupar por edificio y período
  const groupedHistory = filteredHistory.reduce((acc: any, h: any) => {
    const building = h.clients?.internal_alias || h.clients?.building_name || 'Sin nombre';
    const monthName = new Date(h.completion_date || `${h.year}-${String(h.month).padStart(2,'0')}-01`)
      .toLocaleString('es-CL', { month: 'long' });
    const key = `${monthName} ${h.year}`;
    
    if (!acc[building]) acc[building] = {};
    if (!acc[building][key]) acc[building][key] = [];
    acc[building][key].push(h);
    return acc;
  }, {});

  const totalCompleted = history.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-8 h-8 text-blue-600" />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-900">Mis Mantenimientos</h2>
              <p className="text-sm text-slate-600">Historial de mantenimientos realizados</p>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 mb-1">Total Completados</p>
              <p className="text-3xl font-bold text-green-900">{totalCompleted}</p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700 mb-1">Mostrando</p>
              <p className="text-3xl font-bold text-blue-900">{filteredHistory.length}</p>
            </div>
          </div>

          {/* Filtros */}
          <div className="space-y-3 mb-6 p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <p className="text-sm font-semibold text-slate-700">Filtros de búsqueda</p>
              <span className="text-xs text-slate-500">(Selecciona al menos un filtro)</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Buscar Edificio</label>
                <input
                  type="text"
                  placeholder="Nombre edificio..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">N° Ascensor</label>
                <input
                  type="text"
                  placeholder="Ej: 1, 2, 3..."
                  value={historyFilterElevator}
                  onChange={(e) => setHistoryFilterElevator(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
                <select
                  value={historyFilterYear}
                  onChange={(e) => setHistoryFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Todos</option>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mes</label>
                <select
                  value={historyFilterMonth}
                  onChange={(e) => setHistoryFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Todos</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {new Date(2025, m - 1).toLocaleString('es-CL', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setHistorySearchQuery('');
                    setHistoryFilterYear('all');
                    setHistoryFilterMonth('all');
                    setHistoryFilterElevator('');
                  }}
                  className="w-full px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Limpiar
                </button>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleDownloadAnnualPackage}
                  disabled={historyFilterYear === 'all'}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
                  title={historyFilterYear === 'all' ? 'Selecciona un año específico' : 'Descargar todos los PDFs del año'}
                >
                  <Package className="w-4 h-4" />
                  Pack
                </button>
              </div>
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : !hasActiveFilter ? (
            <div className="text-center py-12 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <Search className="w-16 h-16 text-blue-300 mx-auto mb-4" />
              <p className="text-blue-900 font-semibold mb-2">Selecciona al menos un filtro</p>
              <p className="text-sm text-blue-700">
                Para ver tus mantenimientos, selecciona edificio, N° ascensor, año o mes
              </p>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 border-2 border-slate-200 rounded-lg">
              <CheckCircle2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">No se encontraron mantenimientos</p>
              <p className="text-sm text-slate-500 mt-2">Intenta ajustar los filtros</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.keys(groupedHistory).map((building) => (
                <div key={building} className="border-b border-slate-200 pb-4 last:border-0">
                  <h3 className="font-semibold text-lg text-slate-900 mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    {building}
                  </h3>
                  {Object.keys(groupedHistory[building]).map((period) => (
                    <div key={period} className="ml-4 mb-3">
                      <h4 className="font-medium text-slate-700 mb-2 capitalize">{period}</h4>
                      <ul className="space-y-2">
                        {groupedHistory[building][period].map((h: any) => (
                          <li key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-slate-900">
                                Ascensor {h.elevators?.elevator_number ?? '?'}
                              </span>
                              {h.completion_date && (
                                <span className="text-xs text-slate-500">
                                  {new Date(h.completion_date).toLocaleDateString('es-CL')}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button 
                                className="p-1.5 hover:bg-blue-200 rounded text-blue-600 transition"
                                title="Ver PDF"
                                onClick={() => handleViewPDF(h.id)}
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                className="p-1.5 hover:bg-green-200 rounded text-green-600 transition"
                                title="Descargar PDF"
                                onClick={() => handleDownloadPDF(h.id)}
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button 
                                className="p-1.5 hover:bg-purple-200 rounded text-purple-600 transition"
                                title="Compartir"
                                onClick={() => handleSharePDF(h.id)}
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
