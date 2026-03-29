import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, ExternalLink, FileText, Filter, Search } from 'lucide-react';

interface ChecklistRow {
  id: string;
  folio: number | null;
  month: number;
  year: number;
  status: string;
  completion_date: string | null;
  created_at: string;
  pdf_url: string | null;
  clients: {
    company_name?: string | null;
    building_name?: string | null;
    internal_alias?: string | null;
  } | null;
  elevators: {
    elevator_number?: number | null;
    location_name?: string | null;
  } | null;
}

function sanitizeStorageSegment(value?: string | null): string {
  if (!value) return 'general';

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'general';
}

function buildSafeMaintenancePdfName(
  internalAlias: string | null | undefined,
  elevatorNumber: number | string | null | undefined,
  month: number,
  year: number
) {
  const safeAlias = sanitizeStorageSegment(internalAlias || 'cliente');
  const safeElevator = `asc${elevatorNumber ?? 'x'}`;

  return `mantenimiento_${safeAlias}_${safeElevator}_${month}-${year}.pdf`;
}

export function PDFHistoryView() {
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'with_pdf' | 'without_pdf'>('all');

  useEffect(() => {
    void loadRows();
  }, []);

  const loadRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mnt_checklists')
        .select(`
          id,
          folio,
          month,
          year,
          status,
          completion_date,
          created_at,
          pdf_url,
          clients(company_name, building_name, internal_alias),
          elevators(elevator_number, location_name)
        `)
        .eq('status', 'completed')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('completion_date', { ascending: false });

      if (error) throw error;
      setRows((data || []) as ChecklistRow[]);
    } catch (error) {
      console.error('Error cargando historial de PDFs:', error);
      alert('Error al cargar el historial de PDFs');
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      const clientName = row.clients?.internal_alias || row.clients?.building_name || row.clients?.company_name || '';
      const elevatorText = row.elevators?.elevator_number ? `ascensor ${row.elevators.elevator_number}` : '';
      const folioText = row.folio ? String(row.folio) : '';

      const matchesSearch =
        term === '' ||
        clientName.toLowerCase().includes(term) ||
        elevatorText.toLowerCase().includes(term) ||
        folioText.includes(term);

      const matchesAvailability =
        filterAvailability === 'all' ||
        (filterAvailability === 'with_pdf' && !!row.pdf_url) ||
        (filterAvailability === 'without_pdf' && !row.pdf_url);

      return matchesSearch && matchesAvailability;
    });
  }, [rows, searchTerm, filterAvailability]);

  const stats = useMemo(() => ({
    total: rows.length,
    withPdf: rows.filter((row) => !!row.pdf_url).length,
    withoutPdf: rows.filter((row) => !row.pdf_url).length,
  }), [rows]);

  const handleOpenPdf = (row: ChecklistRow) => {
    if (!row.pdf_url) {
      alert('PDF no disponible. Puede que aún no se haya generado.');
      return;
    }

    window.open(row.pdf_url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadPdf = async (row: ChecklistRow) => {
    if (!row.pdf_url) {
      alert('PDF no disponible. Puede que aún no se haya generado.');
      return;
    }

    try {
      const response = await fetch(row.pdf_url);
      if (!response.ok) {
        throw new Error('No se pudo descargar el archivo');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildSafeMaintenancePdfName(
        row.clients?.internal_alias,
        row.elevators?.elevator_number,
        row.month,
        row.year
      );
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando PDF:', error);
      alert('Error al descargar el PDF');
    }
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
        <h1 className="text-3xl font-bold text-slate-900">Historial de PDFs</h1>
        <p className="text-slate-600 mt-1">Consulta y descarga los informes ya generados desde mnt_checklists.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setFilterAvailability('all')}
          className={`bg-white border-2 rounded-lg p-4 text-left transition hover:shadow-lg ${
            filterAvailability === 'all' ? 'border-slate-800 ring-2 ring-slate-200' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-600">Total completados</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterAvailability(filterAvailability === 'with_pdf' ? 'all' : 'with_pdf')}
          className={`bg-white border-2 rounded-lg p-4 text-left transition hover:shadow-lg ${
            filterAvailability === 'with_pdf' ? 'border-green-500 ring-2 ring-green-200' : 'border-green-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{stats.withPdf}</p>
              <p className="text-sm text-green-700">Con PDF</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterAvailability(filterAvailability === 'without_pdf' ? 'all' : 'without_pdf')}
          className={`bg-white border-2 rounded-lg p-4 text-left transition hover:shadow-lg ${
            filterAvailability === 'without_pdf' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-900">{stats.withoutPdf}</p>
              <p className="text-sm text-amber-700">Sin PDF</p>
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
              placeholder="Buscar por cliente, folio o ascensor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            onClick={() => setFilterAvailability('all')}
            className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
              filterAvailability === 'all'
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Folio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ascensor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Periodo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Completado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">PDF</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No se encontraron registros</p>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const clientName = row.clients?.internal_alias || row.clients?.building_name || row.clients?.company_name || 'Sin nombre';
                  const completionLabel = row.completion_date
                    ? new Date(row.completion_date).toLocaleDateString('es-CL')
                    : 'Sin fecha';

                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <span className="font-mono font-bold text-blue-600">
                          {row.folio ? String(row.folio).padStart(6, '0') : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">{clientName}</p>
                        <p className="text-xs text-slate-500">{row.clients?.company_name || row.clients?.building_name || ''}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-900">
                          Ascensor {row.elevators?.elevator_number ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500">{row.elevators?.location_name || ''}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {row.month}/{row.year}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-700">
                        {completionLabel}
                      </td>
                      <td className="px-4 py-4">
                        {row.pdf_url ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            Disponible
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                            No generado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenPdf(row)}
                            className="p-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition"
                            title="Abrir PDF"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDownloadPdf(row)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            title="Descargar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
