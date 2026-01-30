import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertTriangle, CheckCircle, Calendar, Search, Filter, Building2, Wrench } from 'lucide-react';

interface CertificationInfo {
  id: string;
  client_name: string;
  client_address: string;
  elevator_brand: string;
  elevator_model: string;
  elevator_serial: string;
  last_certification_date: string | null;
  next_certification_date: string | null;
  certification_not_legible: boolean;
  days_until_expiry: number | null;
  status: 'valid' | 'expiring_soon' | 'expired' | 'unknown';
}

type FilterType = 'all' | 'expired' | 'expiring_soon' | 'valid' | 'unknown';

export function CertificationsDashboard() {
  const [certifications, setCertifications] = useState<CertificationInfo[]>([]);
  const [filteredCertifications, setFilteredCertifications] = useState<CertificationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [stats, setStats] = useState({
    total: 0,
    expired: 0,
    expiring_soon: 0,
    valid: 0,
    unknown: 0,
  });

  useEffect(() => {
    loadCertifications();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterType, certifications]);

  const loadCertifications = async () => {
    try {
      const { data: checklists, error } = await supabase
        .from('mnt_checklists')
        .select(`
          id,
          last_certification_date,
          next_certification_date,
          certification_not_legible,
          clients (
            business_name,
            address
          ),
          elevators (
            brand,
            model,
            serial_number
          )
        `)
        .order('next_certification_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const uniqueElevators = new Map<string, any>();

      checklists?.forEach((checklist) => {
        const elevatorId = checklist.elevators?.id;
        if (!elevatorId) return;

        const existing = uniqueElevators.get(elevatorId);
        if (!existing || (checklist.next_certification_date &&
            (!existing.next_certification_date ||
             new Date(checklist.next_certification_date) > new Date(existing.next_certification_date)))) {
          uniqueElevators.set(elevatorId, checklist);
        }
      });

      const certData: CertificationInfo[] = Array.from(uniqueElevators.values()).map((checklist) => {
        let status: CertificationInfo['status'] = 'unknown';
        let daysUntilExpiry: number | null = null;

        if (checklist.certification_not_legible) {
          status = 'unknown';
        } else if (checklist.next_certification_date) {
          const today = new Date();
          const nextDate = new Date(checklist.next_certification_date);
          daysUntilExpiry = Math.floor((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry < 0) {
            status = 'expired';
          } else if (daysUntilExpiry <= 120) {
            status = 'expiring_soon';
          } else {
            status = 'valid';
          }
        }

        return {
          id: checklist.id,
          client_name: checklist.clients?.business_name || 'N/A',
          client_address: checklist.clients?.address || 'N/A',
          elevator_brand: checklist.elevators?.brand || 'N/A',
          elevator_model: checklist.elevators?.model || 'N/A',
          elevator_serial: checklist.elevators?.serial_number || 'N/A',
          last_certification_date: checklist.last_certification_date,
          next_certification_date: checklist.next_certification_date,
          certification_not_legible: checklist.certification_not_legible,
          days_until_expiry: daysUntilExpiry,
          status,
        };
      });

      setCertifications(certData);

      const newStats = {
        total: certData.length,
        expired: certData.filter((c) => c.status === 'expired').length,
        expiring_soon: certData.filter((c) => c.status === 'expiring_soon').length,
        valid: certData.filter((c) => c.status === 'valid').length,
        unknown: certData.filter((c) => c.status === 'unknown').length,
      };
      setStats(newStats);
    } catch (error) {
      console.error('Error loading certifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...certifications];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (cert) =>
          cert.client_name.toLowerCase().includes(term) ||
          cert.elevator_brand.toLowerCase().includes(term) ||
          cert.elevator_model.toLowerCase().includes(term) ||
          cert.elevator_serial.toLowerCase().includes(term)
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter((cert) => cert.status === filterType);
    }

    setFilteredCertifications(filtered);
  };

  const getStatusBadge = (status: CertificationInfo['status']) => {
    const badges = {
      valid: { bg: 'bg-green-100', text: 'text-green-800', label: 'Vigente' },
      expiring_soon: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Por Vencer' },
      expired: { bg: 'bg-red-100', text: 'text-red-800', label: 'Vencida' },
      unknown: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Sin Info' },
    };

    const badge = badges[status];
    return (
      <span className={`px-3 py-1 ${badge.bg} ${badge.text} text-xs font-semibold rounded-full`}>
        {badge.label}
      </span>
    );
  };

  const getDaysLabel = (days: number | null) => {
    if (days === null) return 'Sin información';
    if (days < 0) return `Venció hace ${Math.abs(days)} días`;
    if (days === 0) return 'Vence hoy';
    return `${days} días restantes`;
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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard de Certificaciones</h1>
        <p className="text-slate-600 mt-1">Monitoreo de certificaciones de ascensores</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border-2 border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-600">Total</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setFilterType('expired')}
          className={`bg-white border-2 rounded-lg p-4 text-left transition hover:shadow-lg ${
            filterType === 'expired' ? 'border-red-500 ring-2 ring-red-200' : 'border-red-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-900">{stats.expired}</p>
              <p className="text-sm text-red-700">Vencidas</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterType('expiring_soon')}
          className={`bg-white border-2 rounded-lg p-4 text-left transition hover:shadow-lg ${
            filterType === 'expiring_soon' ? 'border-yellow-500 ring-2 ring-yellow-200' : 'border-yellow-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-900">{stats.expiring_soon}</p>
              <p className="text-sm text-yellow-700">Por Vencer</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterType('valid')}
          className={`bg-white border-2 rounded-lg p-4 text-left transition hover:shadow-lg ${
            filterType === 'valid' ? 'border-green-500 ring-2 ring-green-200' : 'border-green-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{stats.valid}</p>
              <p className="text-sm text-green-700">Vigentes</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterType('unknown')}
          className={`bg-white border-2 rounded-lg p-4 text-left transition hover:shadow-lg ${
            filterType === 'unknown' ? 'border-slate-500 ring-2 ring-slate-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.unknown}</p>
              <p className="text-sm text-slate-700">Sin Info</p>
            </div>
          </div>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, marca, modelo o serial..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setFilterType('all')}
            className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-5 h-5" />
            Todos
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ascensor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Última Cert.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Próxima Cert.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Días</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCertifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No se encontraron certificaciones</p>
                    <p className="text-sm text-slate-500 mt-1">Intenta ajustar los filtros de búsqueda</p>
                  </td>
                </tr>
              ) : (
                filteredCertifications.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{cert.client_name}</p>
                          <p className="text-xs text-slate-500">{cert.client_address}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <Wrench className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {cert.elevator_brand} {cert.elevator_model}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">{cert.elevator_serial}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {cert.last_certification_date
                        ? new Date(cert.last_certification_date).toLocaleDateString('es-ES')
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {cert.next_certification_date
                        ? new Date(cert.next_certification_date).toLocaleDateString('es-ES')
                        : cert.certification_not_legible
                        ? 'No legible'
                        : 'N/A'}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-slate-700">{getDaysLabel(cert.days_until_expiry)}</p>
                    </td>
                    <td className="px-4 py-4">{getStatusBadge(cert.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {stats.expired > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-red-900 mb-2">Atención: Certificaciones Vencidas</h3>
              <p className="text-sm text-red-800">
                Hay <strong>{stats.expired}</strong> certificación(es) vencida(s) que requieren atención inmediata.
                Los ascensores con certificaciones vencidas no deben operar hasta renovar su certificación.
              </p>
            </div>
          </div>
        </div>
      )}

      {stats.expiring_soon > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-yellow-900 mb-2">Certificaciones Próximas a Vencer</h3>
              <p className="text-sm text-yellow-800">
                Hay <strong>{stats.expiring_soon}</strong> certificación(es) que vence(n) en los próximos 120 días.
                Coordina la renovación con anticipación para evitar interrupciones.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
