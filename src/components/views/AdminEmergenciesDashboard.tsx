import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus } from 'lucide-react';
import { TechnicianEmergencyView } from './TechnicianEmergencyView';

interface EmergencyRow {
  id: string;
  elevator_id: string | null;
  client_id: string | null;
  status: string | null;
  final_status: string | null;
  reported_at: string | null;
  created_at: string | null;
  clients?: {
    company_name?: string | null;
    internal_alias?: string | null;
  } | null;
  elevators?: {
    elevator_number?: number | null;
    tower_name?: string | null;
  } | null;
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

interface Filters {
  building: string;
  elevator: string;
  client: string;
  year: string;
  status: string;
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

  const normalizeStatus = (status?: string | null, finalStatus?: string | null) => {
    if (status === 'closed' && finalStatus === 'stopped') return 'cerrada - detenido';
    if (status === 'closed' && finalStatus === 'observation') return 'cerrada - observación';
    if (status === 'closed' && finalStatus === 'operational') return 'cerrada - operativa';
    if (status === 'resolved' && finalStatus === 'operational') return 'resuelta - operativa';
    return status || 'sin estado';
  };

  const buildElevatorLabel = (elevator?: { elevator_number?: number | null; tower_name?: string | null } | null) => {
    if (!elevator) return '-';

    const number = elevator.elevator_number ? `Ascensor #${elevator.elevator_number}` : 'Ascensor';
    const tower = elevator.tower_name?.trim();

    return tower ? `${tower} - ${number}` : number;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('es-CL');
  };

  const loadEmergencies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('emergency_visits')
        .select(`
          id,
          elevator_id,
          client_id,
          status,
          final_status,
          reported_at,
          created_at,
          clients (
            company_name,
            internal_alias
          ),
          elevators (
            elevator_number,
            tower_name
          )
        `)
        .order('reported_at', { ascending: false });

      if (error) throw error;

      const rows = ((data || []) as any[]).map((row: any) => {
        const clientData = Array.isArray(row.clients) ? row.clients[0] : row.clients;
        const elevatorData = Array.isArray(row.elevators) ? row.elevators[0] : row.elevators;

        const buildingName =
          clientData?.internal_alias?.trim() ||
          clientData?.company_name?.trim() ||
          'Sin edificio';

        const clientName = clientData?.company_name?.trim() || 'Sin cliente';
        const elevatorLabel = buildElevatorLabel(elevatorData);
        const dateSource = row.reported_at || row.created_at;
        const year = dateSource ? String(new Date(dateSource).getFullYear()) : '';
        const status = normalizeStatus(row.status, row.final_status);

        return {
          id: row.id,
          elevatorLabel,
          buildingName,
          clientName,
          date: formatDate(dateSource),
          status,
          year,
        } satisfies EmergencyItem;
      });

      setEmergencies(rows);
      setBuildingOptions(Array.from(new Set(rows.map((e) => e.buildingName).filter(Boolean))).sort());
      setElevatorOptions(Array.from(new Set(rows.map((e) => e.elevatorLabel).filter(Boolean))).sort());
      setClientOptions(Array.from(new Set(rows.map((e) => e.clientName).filter(Boolean))).sort());
      setYearOptions(Array.from(new Set(rows.map((e) => e.year).filter(Boolean))).sort((a, b) => Number(b) - Number(a)));
      setStatusOptions(Array.from(new Set(rows.map((e) => e.status).filter(Boolean))).sort());
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