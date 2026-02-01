import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Wrench, Search } from 'lucide-react';
import { ElevatorList } from '../elevators/ElevatorList';

interface ElevatorRow {
  id: string;
  tower_name: string | null;
  index_number: number | null;
  location_name: string | null;
  manufacturer: string | null;
  model: string | null;
  capacity_kg: number | null;
  floors: number | null;
  installation_date: string | null;
  classification: string | null;
  status: string | null;
  address_asc: string | null;
  clients: {
    company_name: string;
    internal_alias: string | null;
    building_name: string | null;
    address: string;
  } | null;
  created_at?: string; // por si lo necesitas más adelante
}

export interface ElevatorItem {
  id: string;
  clientName: string;
  internalAlias: string | null;
  buildingName: string | null;
  towerName: string;
  indexNumber: number;
  classification: string | null;
  manufacturer: string;
  model: string;
  capacityKg: number;
  floors: number;
  status: string;
  address: string;
  installationDate: string | null;
}

export function ElevatorsView() {
  const [elevators, setElevators] = useState<ElevatorItem[]>([]);
  const [filteredElevators, setFilteredElevators] = useState<ElevatorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadElevators();
  }, []);

  useEffect(() => {
    filterElevators();
  }, [elevators, searchTerm, statusFilter]);

  const loadElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select<ElevatorRow>(`
          id,
          tower_name,
          index_number,
          location_name,
          manufacturer,
          model,
          capacity_kg,
          floors,
          installation_date,
          classification,
          status,
          address_asc,
          created_at,
          clients (
            company_name,
            internal_alias,
            building_name,
            address
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: ElevatorItem[] = (data || []).map((row, idx) => {
        const tower =
          (row.tower_name && row.tower_name.trim()) ||
          row.location_name ||
          `Ascensor ${idx + 1}`;

        const indexNumber = row.index_number && row.index_number > 0
          ? row.index_number
          : idx + 1;

        return {
          id: row.id,
          clientName: row.clients?.company_name ?? 'Sin cliente',
          internalAlias: row.clients?.internal_alias ?? null,
          buildingName: row.clients?.building_name ?? null,
          towerName: tower,
          indexNumber,
          classification: row.classification ?? null,
          manufacturer: row.manufacturer ?? 'Sin fabricante',
          model: row.model ?? 'Sin modelo',
          capacityKg: row.capacity_kg ?? 0,
          floors: row.floors ?? 0,
          status: row.status ?? 'unknown',
          address:
            row.address_asc ||
            row.clients?.address ||
            'Sin dirección registrada',
          installationDate: row.installation_date,
        };
      });

      setElevators(mapped);
    } catch (err) {
      console.error('Error loading elevators:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterElevators = () => {
    let filtered = [...elevators];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((e) => {
        return (
          e.manufacturer.toLowerCase().includes(term) ||
          e.model.toLowerCase().includes(term) ||
          e.clientName.toLowerCase().includes(term) ||
          (e.internalAlias ?? '').toLowerCase().includes(term) ||
          (e.buildingName ?? '').toLowerCase().includes(term) ||
          e.towerName.toLowerCase().includes(term) ||
          e.address.toLowerCase().includes(term)
        );
      });
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((e) => e.status === statusFilter);
    }

    setFilteredElevators(filtered);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'operational':
        return 'Operativo';
      case 'maintenance':
        return 'En Mantenimiento';
      case 'stopped':
        return 'Detenido';
      case 'under_observation':
        return 'En Observación';
      default:
        return 'Sin estado';
    }
  };

  const stats = {
    total: elevators.length,
    operational: elevators.filter((e) => e.status === 'operational').length,
    maintenance: elevators.filter((e) => e.status === 'maintenance').length,
    stopped: elevators.filter((e) => e.status === 'stopped').length,
  };

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Gestión de Ascensores
        </h1>
        <p className="text-slate-600 mt-1">
          Visualiza todos los ascensores por cliente, torre y número de ascensor.
        </p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Ascensores</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {stats.total}
              </p>
            </div>
            <Wrench className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Operativos</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {stats.operational}
              </p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">En Mantenimiento</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {stats.maintenance}
              </p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Detenidos</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {stats.stopped}
              </p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Wrench className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros + lista */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, alias, edificio, torre, modelo, fabricante o dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="operational">{getStatusLabel('operational')}</option>
            <option value="maintenance">{getStatusLabel('maintenance')}</option>
            <option value="stopped">{getStatusLabel('stopped')}</option>
            <option value="under_observation">
              {getStatusLabel('under_observation')}
            </option>
          </select>
        </div>

        {/* Contenido */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredElevators.length === 0 ? (
          <div className="text-center py-12">
            <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">
              No se encontraron ascensores
            </p>
          </div>
        ) : (
          <ElevatorList elevators={filteredElevators} />
        )}
      </div>
    </div>
  );
}

