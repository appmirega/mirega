import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Download, FileDown, ExternalLink } from 'lucide-react';
import { TechnicianEmergencyView } from './TechnicianEmergencyView';

interface Filters {
  building: string;
  elevator: string;
  client: string;
  year: string;
  month: string;
  status: string;
}

interface EmergencyItem {
  id: string;
  visitId: string;
  elevatorLabel: string;
  buildingName: string;
  clientName: string;
  date: string;
  status: string;
  year: string;
  month: string;
  monthLabel: string;
  pdfUrl: string | null;
}

interface EmergencyVisitRow {
  id: string;
  client_id: string | null;
  status: string | null;
  final_status: string | null;
  visit_date: string | null;
  visit_time: string | null;
  created_at: string | null;
  completed_at: string | null;
  pdf_url: string | null;
}

interface EmergencyVisitElevatorRow {
  emergency_visit_id: string;
  elevator_id: string;
  final_status: string | null;
}

interface ElevatorRow {
  id: string;
  client_id: string | null;
  elevator_number: number | null;
  tower_name: string | null;
}

interface ClientRow {
  id: string;
  company_name: string | null;
  internal_alias?: string | null;
  building_name?: string | null;
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

export function AdminEmergenciesDashboard() {
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [filtered, setFiltered] = useState<EmergencyItem[]>([]);
  const [filters, setFilters] = useState<Filters>({
    building: '',
    elevator: '',
    client: '',
    year: '',
    month: '',
    status: '',
  });

  const [buildingOptions, setBuildingOptions] = useState<string[]>([]);
  const [elevatorOptions, setElevatorOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [showNewEmergency, setShowNewEmergency] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadEmergencies();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, emergencies]);

  const normalizeStatus = (
    visitStatus?: string | null,
    visitFinalStatus?: string | null,
    elevatorFinalStatus?: string | null
  ) => {
    const finalStatus = elevatorFinalStatus || visitFinalStatus;

    if ((visitStatus === 'closed' || visitStatus === 'completed') && finalStatus === 'stopped') {
      return 'cerrada - detenido';
    }
    if ((visitStatus === 'closed' || visitStatus === 'completed') && finalStatus === 'observation') {
      return 'cerrada - observación';
    }
    if ((visitStatus === 'closed' || visitStatus === 'completed') && finalStatus === 'operational') {
      return 'cerrada - operativa';
    }

    if (visitStatus === 'draft') return 'borrador';
    if (visitStatus === 'reported') return 'reportada';
    if (visitStatus === 'assigned') return 'asignada';
    if (visitStatus === 'in_progress') return 'en progreso';
    if (visitStatus === 'resolved') return 'resuelta';
    if (visitStatus === 'completed') return 'completada';
    if (visitStatus === 'closed') return 'cerrada';

    return visitStatus || 'sin estado';
  };

  const buildElevatorLabel = (elevator?: ElevatorRow | null) => {
    if (!elevator) return '-';

    const tower = elevator.tower_name?.trim();
    const number = elevator.elevator_number
      ? `Ascensor #${elevator.elevator_number}`
      : 'Ascensor';

    return tower ? `${tower} - ${number}` : number;
  };

  const formatDate = (
    visitDate?: string | null,
    visitTime?: string | null,
    fallback?: string | null
  ) => {
    try {
      if (visitDate) {
        const composed = visitTime
          ? `${visitDate}T${visitTime}`
          : `${visitDate}T00:00:00`;
        const date = new Date(composed);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleDateString('es-CL');
        }
      }

      if (fallback) {
        const date = new Date(fallback);
        if (!Number.isNaN(date.getTime())) {
          return date.toLocaleDateString('es-CL');
        }
      }

      return '-';
    } catch {
      return '-';
    }
  };

  const getYearMonth = (visitDate?: string | null, fallback?: string | null) => {
    if (visitDate) {
      const [yearPart, monthPart] = visitDate.split('-');
      return {
        year: yearPart || '',
        month: monthPart || '',
        monthLabel: getMonthLabel(monthPart || ''),
      };
    }

    if (fallback) {
      const date = new Date(fallback);
      if (!Number.isNaN(date.getTime())) {
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return {
          year,
          month,
          monthLabel: getMonthLabel(month),
        };
      }
    }

    return {
      year: '',
      month: '',
      monthLabel: '-',
    };
  };

  const buildFileName = (record: EmergencyItem) => {
    const parts = [
      'emergencia',
      sanitizeFilePart(record.clientName || 'cliente'),
      sanitizeFilePart(record.buildingName || 'edificio'),
      sanitizeFilePart(record.elevatorLabel || 'ascensor'),
      record.year || 'sin_anio',
      record.month || 'sin_mes',
    ].filter(Boolean);

    return `${parts.join('_')}.pdf`;
  };

  const downloadSinglePdf = (record: EmergencyItem) => {
    if (!record.pdfUrl) {
      alert('Esta emergencia no tiene PDF disponible');
      return;
    }

    triggerFileDownload(record.pdfUrl, buildFileName(record));
  };

  const loadEmergencies = async () => {
    setLoading(true);

    try {
      const { data: visitsData, error: visitsError } = await supabase
        .from('emergency_visits')
        .select('id, client_id, status, final_status, visit_date, visit_time, created_at, completed_at, pdf_url')
        .order('created_at', { ascending: false });

      if (visitsError) throw visitsError;

      const visits = (visitsData || []) as EmergencyVisitRow[];

      if (visits.length === 0) {
        setEmergencies([]);
        setFiltered([]);
        setBuildingOptions([]);
        setElevatorOptions([]);
        setClientOptions([]);
        setYearOptions([]);
        setMonthOptions([]);
        setStatusOptions([]);
        return;
      }

      const visitIds = visits.map((v) => v.id);

      const { data: visitElevatorsData, error: visitElevatorsError } = await supabase
        .from('emergency_visit_elevators')
        .select('emergency_visit_id, elevator_id, final_status')
        .in('emergency_visit_id', visitIds);

      if (visitElevatorsError) throw visitElevatorsError;

      const visitElevators = (visitElevatorsData || []) as EmergencyVisitElevatorRow[];
      const elevatorIds = Array.from(new Set(visitElevators.map((row) => row.elevator_id).filter(Boolean)));

      let elevatorsMap = new Map<string, ElevatorRow>();
      let clientsMap = new Map<string, ClientRow>();

      const explicitClientIds = Array.from(
        new Set(visits.map((visit) => visit.client_id).filter((id): id is string => !!id))
      );

      if (elevatorIds.length > 0) {
        const { data: elevatorsData, error: elevatorsError } = await supabase
          .from('elevators')
          .select('id, client_id, elevator_number, tower_name')
          .in('id', elevatorIds);

        if (elevatorsError) throw elevatorsError;

        const elevators = (elevatorsData || []) as ElevatorRow[];
        elevatorsMap = new Map(elevators.map((e) => [e.id, e]));

        const clientIds = Array.from(
          new Set([
            ...explicitClientIds,
            ...elevators
              .map((e) => e.client_id)
              .filter((id): id is string => !!id),
          ])
        );

        if (clientIds.length > 0) {
          const { data: clientsData, error: clientsError } = await supabase
            .from('clients')
            .select('id, company_name, internal_alias, building_name')
            .in('id', clientIds);

          if (clientsError) throw clientsError;

          const clients = (clientsData || []) as ClientRow[];
          clientsMap = new Map(clients.map((c) => [c.id, c]));
        }
      } else if (explicitClientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, company_name, internal_alias, building_name')
          .in('id', explicitClientIds);

        if (clientsError) throw clientsError;

        const clients = (clientsData || []) as ClientRow[];
        clientsMap = new Map(clients.map((c) => [c.id, c]));
      }

      const visitElevatorsMap = new Map<string, EmergencyVisitElevatorRow[]>();
      visitElevators.forEach((row) => {
        const current = visitElevatorsMap.get(row.emergency_visit_id) || [];
        current.push(row);
        visitElevatorsMap.set(row.emergency_visit_id, current);
      });

      const rows: EmergencyItem[] = visits.flatMap((visit) => {
        const linkedElevators = visitElevatorsMap.get(visit.id) || [];
        const { year, month, monthLabel } = getYearMonth(visit.visit_date, visit.created_at);

        if (linkedElevators.length === 0) {
          const fallbackClient = visit.client_id ? clientsMap.get(visit.client_id) : null;

          return [
            {
              id: visit.id,
              visitId: visit.id,
              elevatorLabel: '-',
              buildingName:
                fallbackClient?.internal_alias?.trim() ||
                fallbackClient?.building_name?.trim() ||
                fallbackClient?.company_name?.trim() ||
                'Sin edificio',
              clientName:
                fallbackClient?.company_name?.trim() ||
                fallbackClient?.building_name?.trim() ||
                'Sin cliente',
              date: formatDate(visit.visit_date, visit.visit_time, visit.created_at),
              status: normalizeStatus(visit.status, visit.final_status, null),
              year,
              month,
              monthLabel,
              pdfUrl: visit.pdf_url || null,
            },
          ];
        }

        return linkedElevators.map((linked, index) => {
          const elevator = elevatorsMap.get(linked.elevator_id) || null;
          const clientId = elevator?.client_id || visit.client_id;
          const client = clientId ? clientsMap.get(clientId) || null : null;

          return {
            id: `${visit.id}-${index}`,
            visitId: visit.id,
            elevatorLabel: buildElevatorLabel(elevator),
            buildingName:
              client?.internal_alias?.trim() ||
              client?.building_name?.trim() ||
              client?.company_name?.trim() ||
              'Sin edificio',
            clientName:
              client?.company_name?.trim() ||
              client?.building_name?.trim() ||
              'Sin cliente',
            date: formatDate(visit.visit_date, visit.visit_time, visit.created_at),
            status: normalizeStatus(visit.status, visit.final_status, linked.final_status),
            year,
            month,
            monthLabel,
            pdfUrl: visit.pdf_url || null,
          };
        });
      });

      setEmergencies(rows);
      setBuildingOptions(
        Array.from(new Set(rows.map((e) => e.buildingName).filter(Boolean))).sort()
      );
      setElevatorOptions(
        Array.from(new Set(rows.map((e) => e.elevatorLabel).filter(Boolean))).sort()
      );
      setClientOptions(
        Array.from(new Set(rows.map((e) => e.clientName).filter(Boolean))).sort()
      );
      setYearOptions(
        Array.from(new Set(rows.map((e) => e.year).filter(Boolean))).sort(
          (a, b) => Number(b) - Number(a)
        )
      );
      setMonthOptions(
        Array.from(new Set(rows.map((e) => e.month).filter(Boolean))).sort(
          (a, b) => Number(a) - Number(b)
        )
      );
      setStatusOptions(
        Array.from(new Set(rows.map((e) => e.status).filter(Boolean))).sort()
      );
    } catch (err) {
      console.error('Error loading emergencies:', err);
      setEmergencies([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...emergencies];

    if (filters.building) {
      result = result.filter((e) => e.buildingName === filters.building);
    }

    if (filters.elevator) {
      result = result.filter((e) => e.elevatorLabel === filters.elevator);
    }

    if (filters.client) {
      result = result.filter((e) => e.clientName === filters.client);
    }

    if (filters.year) {
      result = result.filter((e) => e.year === filters.year);
    }

    if (filters.month) {
      result = result.filter((e) => e.month === filters.month);
    }

    if (filters.status) {
      result = result.filter((e) => e.status === filters.status);
    }

    setFiltered(result);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const available = filtered.filter((e) => !!e.pdfUrl);
      const uniqueByVisit = Array.from(new Map(available.map((e) => [e.visitId, e])).values());

      if (uniqueByVisit.length === 0) {
        alert('No hay PDFs de emergencia disponibles para los filtros seleccionados');
        return;
      }

      alert(`Iniciando descarga de ${uniqueByVisit.length} PDF(s) de emergencia...`);

      uniqueByVisit.forEach((record, index) => {
        setTimeout(() => {
          triggerFileDownload(record.pdfUrl!, buildFileName(record));
        }, index * 450);
      });
    } catch (error) {
      console.error('Error downloading emergency PDFs:', error);
      alert('Error al descargar PDFs de emergencia');
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  if (showNewEmergency) {
    return <TechnicianEmergencyView />;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Emergencias</h1>
          <p className="text-sm text-slate-600 mt-1">
            Descarga individual o masiva de informes PDF por cliente, mes y año.
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          onClick={() => setShowNewEmergency(true)}
          title="Nueva emergencia"
        >
          <Plus className="w-5 h-5" /> Nueva Emergencia
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
          <option value="">Filtrar por ascensor</option>
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

        <select
          className="px-3 py-2 border rounded"
          name="status"
          value={filters.status}
          onChange={handleFilterChange}
        >
          <option value="">Filtrar por estado</option>
          {statusOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
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
            <th className="p-2">Ascensor</th>
            <th className="p-2">Edificio</th>
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
              <td colSpan={7} className="text-center p-4">
                Cargando...
              </td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center p-4">
                No hay emergencias
              </td>
            </tr>
          ) : (
            filtered.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="p-2">{e.elevatorLabel}</td>
                <td className="p-2">{e.buildingName}</td>
                <td className="p-2">{e.clientName}</td>
                <td className="p-2">{e.date}</td>
                <td className="p-2">{e.monthLabel} {e.year ? `- ${e.year}` : ''}</td>
                <td className="p-2">{e.status}</td>
                <td className="p-2">
                  {e.pdfUrl ? (
                    <div className="flex flex-wrap gap-3 text-sm">
                      <a
                        href={e.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Ver PDF
                      </a>
                      <button
                        type="button"
                        onClick={() => downloadSinglePdf(e)}
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
