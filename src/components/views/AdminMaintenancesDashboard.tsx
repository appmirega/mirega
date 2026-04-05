import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Download, FileDown, ExternalLink } from 'lucide-react';

interface MaintenanceItem {
  id: string;
  buildingName: string;
  buildingAddress: string;
  elevatorsLabel: string;
  clientName: string;
  date: string;
  year: string;
  month: string;
  monthLabel: string;
  statusLabel: string;
  pdfUrl: string | null;
}

interface Filters {
  building: string;
  elevator: string;
  client: string;
  year: string;
  month: string;
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
};

const getMonthLabel = (month: string) => MONTH_LABELS[month] || month || '-';

const sanitizeFilePart = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const triggerFileDownload = (url: string, fileName: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export function AdminMaintenancesDashboard({
  onNewMaintenance,
}: {
  onNewMaintenance?: () => void;
} = {}) {
  const [maintenances, setMaintenances] = useState<MaintenanceItem[]>([]);
  const [filtered, setFiltered] = useState<MaintenanceItem[]>([]);
  const [filters, setFilters] = useState<Filters>({
    building: '',
    elevator: '',
    client: '',
    year: '',
    month: '',
  });

  const [buildingOptions, setBuildingOptions] = useState<string[]>([]);
  const [elevatorOptions, setElevatorOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadMaintenances();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, maintenances]);

  const buildElevatorLabel = (elevator?: { elevator_number?: number | null; tower_name?: string | null } | null) => {
    if (!elevator) return '-';

    const number = elevator.elevator_number ? `Ascensor #${elevator.elevator_number}` : 'Ascensor';
    const tower = elevator.tower_name?.trim();

    return tower ? `${tower} - ${number}` : number;
  };

  const normalizeStatus = (status?: string | null) => {
    switch (status) {
      case 'completed':
        return 'Completado';
      case 'in_progress':
        return 'En progreso';
      case 'pending':
        return 'Pendiente';
      default:
        return status || 'Sin estado';
    }
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-CL');
  };

  const getYearMonth = (row: any, dateSource?: string | null) => {
    const parsedDate = dateSource ? new Date(dateSource) : null;
    const parsedYear = parsedDate && !Number.isNaN(parsedDate.getTime()) ? String(parsedDate.getFullYear()) : '';
    const parsedMonth = parsedDate && !Number.isNaN(parsedDate.getTime())
      ? String(parsedDate.getMonth() + 1).padStart(2, '0')
      : '';

    const year = row.year ? String(row.year) : parsedYear;
    const month = row.month ? String(row.month).padStart(2, '0') : parsedMonth;

    return {
      year,
      month,
      monthLabel: getMonthLabel(month),
    };
  };

  const buildFileName = (record: MaintenanceItem) => {
    const parts = [
      'mantenimiento',
      sanitizeFilePart(record.clientName || 'cliente'),
      sanitizeFilePart(record.buildingName || 'edificio'),
      sanitizeFilePart(record.elevatorsLabel || 'ascensor'),
      record.year || 'sin_anio',
      record.month || 'sin_mes',
    ].filter(Boolean);

    return `${parts.join('_')}.pdf`;
  };

  const downloadSinglePdf = (record: MaintenanceItem) => {
    if (!record.pdfUrl) {
      alert('Este mantenimiento no tiene PDF disponible');
      return;
    }

    triggerFileDownload(record.pdfUrl, buildFileName(record));
  };

  const loadMaintenances = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('mnt_checklists')
        .select(`
          id,
          client_id,
          elevator_id,
          status,
          created_at,
          completion_date,
          year,
          month,
          folio,
          pdf_url,
          clients (
            company_name,
            internal_alias,
            address
          ),
          elevators (
            elevator_number,
            tower_name
          )
        `)
        .order('completion_date', { ascending: false });

      if (error) throw error;

      const rows = ((data || []) as any[]).map((row: any) => {
        const clientData = Array.isArray(row.clients) ? row.clients[0] : row.clients;
        const elevatorData = Array.isArray(row.elevators) ? row.elevators[0] : row.elevators;

        const buildingName =
          clientData?.internal_alias?.trim() ||
          clientData?.company_name?.trim() ||
          'Sin edificio';

        const dateSource = row.completion_date || row.created_at;
        const { year, month, monthLabel } = getYearMonth(row, dateSource);

        return {
          id: row.id,
          buildingName,
          buildingAddress: clientData?.address?.trim() || '-',
          elevatorsLabel: buildElevatorLabel(elevatorData),
          clientName: clientData?.company_name?.trim() || 'Sin cliente',
          date: formatDate(dateSource),
          year,
          month,
          monthLabel,
          statusLabel: normalizeStatus(row.status),
          pdfUrl: row.pdf_url || null,
        } satisfies MaintenanceItem;
      });

      setMaintenances(rows);
      setBuildingOptions(Array.from(new Set(rows.map((m) => m.buildingName).filter(Boolean))).sort());
      setElevatorOptions(Array.from(new Set(rows.map((m) => m.elevatorsLabel).filter(Boolean))).sort());
      setClientOptions(Array.from(new Set(rows.map((m) => m.clientName).filter(Boolean))).sort());
      setYearOptions(Array.from(new Set(rows.map((m) => m.year).filter(Boolean))).sort((a, b) => Number(b) - Number(a)));
      setMonthOptions(Array.from(new Set(rows.map((m) => m.month).filter(Boolean))).sort((a, b) => Number(a) - Number(b)));
    } catch (err) {
      console.error('Error loading maintenances:', err);
      setMaintenances([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...maintenances];

    if (filters.building) {
      result = result.filter((m) => m.buildingName === filters.building);
    }
    if (filters.elevator) {
      result = result.filter((m) => m.elevatorsLabel === filters.elevator);
    }
    if (filters.client) {
      result = result.filter((m) => m.clientName === filters.client);
    }
    if (filters.year) {
      result = result.filter((m) => m.year === filters.year);
    }
    if (filters.month) {
      result = result.filter((m) => m.month === filters.month);
    }

    setFiltered(result);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const available = filtered.filter((m) => !!m.pdfUrl);

      if (available.length === 0) {
        alert('No hay PDFs de mantenimiento disponibles para los filtros seleccionados');
        return;
      }

      alert(`Iniciando descarga de ${available.length} PDF(s) de mantenimiento...`);

      available.forEach((record, index) => {
        setTimeout(() => {
          triggerFileDownload(record.pdfUrl!, buildFileName(record));
        }, index * 450);
      });
    } catch (error) {
      console.error('Error downloading PDFs:', error);
      alert('Error al descargar PDFs');
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Mantenimientos</h1>
          <p className="text-sm text-slate-600 mt-1">
            Descarga individual o masiva según cliente, mes y año.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          onClick={onNewMaintenance}
          title="Ir a vista de mantenimiento"
        >
          <Plus className="w-5 h-5" /> Nuevo Mantenimiento
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          className="px-3 py-2 border rounded"
          name="building"
          value={filters.building}
          onChange={handleFilterChange}
        >
          <option value="">Filtrar por edificio</option>
          {buildingOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <select
          className="px-3 py-2 border rounded"
          name="elevator"
          value={filters.elevator}
          onChange={handleFilterChange}
        >
          <option value="">Filtrar por ascensores</option>
          {elevatorOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <select
          className="px-3 py-2 border rounded"
          name="client"
          value={filters.client}
          onChange={handleFilterChange}
        >
          <option value="">Filtrar por cliente</option>
          {clientOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <select
          className="px-3 py-2 border rounded"
          name="year"
          value={filters.year}
          onChange={handleFilterChange}
        >
          <option value="">Filtrar por año (YYYY)</option>
          {yearOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>

        <select
          className="px-3 py-2 border rounded"
          name="month"
          value={filters.month}
          onChange={handleFilterChange}
        >
          <option value="">Filtrar por mes</option>
          {monthOptions.map((opt) => (
            <option key={opt} value={opt}>
              {getMonthLabel(opt)}
            </option>
          ))}
        </select>

        <button
          className="flex items-center gap-2 px-3 py-2 bg-green-200 rounded hover:bg-green-300 disabled:opacity-60"
          onClick={handleDownload}
          disabled={downloading}
        >
          <Download className="w-4 h-4" />
          {downloading ? 'Descargando...' : 'Descargar PDFs'}
        </button>
      </div>

      <div className="mb-4 text-sm text-slate-600">
        Registros filtrados: <span className="font-semibold">{filtered.length}</span>
      </div>

      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Edificio</th>
            <th className="p-2">Dirección</th>
            <th className="p-2">Ascensores</th>
            <th className="p-2">Cliente</th>
            <th className="p-2">Fecha</th>
            <th className="p-2">Mes</th>
            <th className="p-2">Estado</th>
            <th className="p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} className="text-center p-4">
                Cargando...
              </td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={8} className="text-center p-4">
                No hay mantenimientos
              </td>
            </tr>
          ) : (
            filtered.map((m) => (
              <tr key={m.id} className="border-b">
                <td className="p-2">{m.buildingName}</td>
                <td className="p-2">{m.buildingAddress}</td>
                <td className="p-2">{m.elevatorsLabel}</td>
                <td className="p-2">{m.clientName}</td>
                <td className="p-2">{m.date}</td>
                <td className="p-2">{m.monthLabel} {m.year ? `- ${m.year}` : ''}</td>
                <td className="p-2">{m.statusLabel}</td>
                <td className="p-2">
                  {m.pdfUrl ? (
                    <div className="flex flex-wrap gap-3 text-sm">
                      <a
                        href={m.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ver PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => downloadSinglePdf(m)}
                        className="inline-flex items-center gap-1 text-green-700 hover:underline"
                      >
                        <FileDown className="w-4 h-4" />
                        Descargar
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400">Sin PDF</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
