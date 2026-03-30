import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus } from 'lucide-react';
import { TechnicianEmergencyView } from './TechnicianEmergencyView';

interface Filters {
  building: string;
  elevator: string;
  client: string;
  year: string;
  status: string;
}

interface EmergencyItem {
  id: string;
  elevatorLabel: string;
  buildingName: string;
  clientName: string;
  date: string;
  status: string;
  year: string;
}

interface EmergencyVisitRow {
  id: string;
  status: string | null;
  final_status: string | null;
  visit_date: string | null;
  visit_time: string | null;
  created_at: string | null;
  completed_at: string | null;
}

interface EmergencyVisitElevatorRow {
  emergency_visit_id: string;
  final_status: string | null;
  elevators: {
    elevator_number?: number | null;
    tower_name?: string | null;
    clients?: {
      company_name?: string | null;
      internal_alias?: string | null;
      business_name?: string | null;
    } | null;
  } | null;
}

export function AdminEmergenciesDashboard() {
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [filtered, setFiltered] = useState<EmergencyItem[]>([]);
  const [filters, setFilters] = useState<Filters>({
    building: '',
    elevator: '',
    client: '',
    year: '',
    status: '',
  });

  const [buildingOptions, setBuildingOptions] = useState<string[]>([]);
  const [elevatorOptions, setElevatorOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const [yearOptions, setYearOptions] = useState<string[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [showNewEmergency, setShowNewEmergency] = useState(false);
  const [loading, setLoading] = useState(true);

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

    if (visitStatus === 'closed' && finalStatus === 'stopped') return 'cerrada - detenido';
    if (visitStatus === 'closed' && finalStatus === 'observation') return 'cerrada - observación';
    if (visitStatus === 'closed' && finalStatus === 'operational') return 'cerrada - operativa';

    if (visitStatus === 'completed' && finalStatus === 'stopped') return 'completada - detenido';
    if (visitStatus === 'completed' && finalStatus === 'observation') return 'completada - observación';
    if (visitStatus === 'completed' && finalStatus === 'operational') return 'completada - operativa';

    if (visitStatus === 'reported') return 'reportada';
    if (visitStatus === 'assigned') return 'asignada';
    if (visitStatus === 'in_progress') return 'en progreso';
    if (visitStatus === 'resolved') return 'resuelta';
    if (visitStatus === 'completed') return 'completada';
    if (visitStatus === 'closed') return 'cerrada';

    return visitStatus || 'sin estado';
  };

  const buildElevatorLabel = (elevator?: EmergencyVisitElevatorRow['elevators'] | null) => {
    if (!elevator) return '-';

    const tower = elevator.tower_name?.trim();
    const number = elevator.elevator_number
      ? `Ascensor #${elevator.elevator_number}`
      : 'Ascensor';

    return tower ? `${tower} - ${number}` : number;
  };

  const formatDate = (visitDate?: string | null, visitTime?: string | null, fallback?: string | null) => {
    try {
      if (visitDate) {
        const composed = visitTime ? `${visitDate}T${visitTime}` : `${visitDate}T00:00:00`;
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

  const getYear = (visitDate?: string | null, fallback?: string | null) => {
    if (visitDate && visitDate.length >= 4) {
      return visitDate.slice(0, 4);
    }

    if (fallback) {
      const date = new Date(fallback);
      if (!Number.isNaN(date.getTime())) {
        return String(date.getFullYear());
      }
    }

    return '';
  };

  const loadEmergencies = async () => {
    setLoading(true);

    try {
      const { data: visitsData, error: visitsError } = await supabase
        .from('emergency_visits')
        .select(`
          id,
          status,
          final_status,
          visit_date,
          visit_time,
          created_at,
          completed_at
        `)
        .order('created_at', { ascending: false });

      if (visitsError) throw visitsError;

      const visitIds = (visitsData || []).map((visit) => visit.id);

      if (visitIds.length === 0) {
        setEmergencies([]);
        setFiltered([]);
        setBuildingOptions([]);
        setElevatorOptions([]);
        setClientOptions([]);
        setYearOptions([]);
        setStatusOptions([]);
        return;
      }

      const { data: visitElevatorsData, error: visitElevatorsError } = await supabase
        .from('emergency_visit_elevators')
        .select(`
          emergency_visit_id,
          final_status,
          elevators (
            elevator_number,
            tower_name,
            clients (
              company_name,
              internal_alias,
              business_name
            )
          )
        `)
        .in('emergency_visit_id', visitIds);

      if (visitElevatorsError) throw visitElevatorsError;

      const visitElevatorsMap = new Map<string, EmergencyVisitElevatorRow[]>();

      (visitElevatorsData || []).forEach((row: any) => {
        const normalizedRow: EmergencyVisitElevatorRow = {
          emergency_visit_id: row.emergency_visit_id,
          final_status: row.final_status,
          elevators: Array.isArray(row.elevators) ? row.elevators[0] : row.elevators,
        };

        const current = visitElevatorsMap.get(normalizedRow.emergency_visit_id) || [];
        current.push(normalizedRow);
        visitElevatorsMap.set(normalizedRow.emergency_visit_id, current);
      });

      const rows: EmergencyItem[] = (visitsData || []).flatMap((visit: EmergencyVisitRow) => {
        const linkedElevators = visitElevatorsMap.get(visit.id) || [];

        if (linkedElevators.length === 0) {
          return [
            {
              id: visit.id,
              elevatorLabel: '-',
              buildingName: 'Sin edificio',
              clientName: 'Sin cliente',
              date: formatDate(visit.visit_date, visit.visit_time, visit.created_at),
              status: normalizeStatus(visit.status, visit.final_status, null),
              year: getYear(visit.visit_date, visit.created_at),
            },
          ];
        }

        return linkedElevators.map((linked, index) => {
          const elevator = linked.elevators;
          const client = elevator?.clients
            ? Array.isArray(elevator.clients)
              ? elevator.clients[0]
              : elevator.clients
            : null;

          const buildingName =
            client?.internal_alias?.trim() ||
            client?.business_name?.trim() ||
            client?.company_name?.trim() ||
            'Sin edificio';

          const clientName =
            client?.company_name?.trim() ||
            client?.business_name?.trim() ||
            'Sin cliente';

          return {
            id: `${visit.id}-${index}`,
            elevatorLabel: buildElevatorLabel(elevator),
            buildingName,
            clientName,
            date: formatDate(visit.visit_date, visit.visit_time, visit.created_at),
            status: normalizeStatus(visit.status, visit.final_status, linked.final_status),
            year: getYear(visit.visit_date, visit.created_at),
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

    if (filters.status) {
      result = result.filter((e) => e.status === filters.status);
    }

    setFiltered(result);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  if (showNewEmergency) {
    return <TechnicianEmergencyView />;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Emergencias</h1>
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
      </div>

      <table className="w-full bg-white rounded shadow">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2">Ascensor</th>
            <th className="p-2">Edificio</th>
            <th className="p-2">Cliente</th>
            <th className="p-2">Fecha</th>
            <th className="p-2">Estado</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className="text-center p-4">
                Cargando...
              </td>
            </tr>
          ) : filtered.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center p-4">
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
                <td className="p-2">{e.status}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}