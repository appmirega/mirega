import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, MapPin, Loader2, Check } from 'lucide-react';

interface Building {
  id: string;
  name: string;
  address: string;
  client_id: string;
  elevators: Array<{
    id: string;
    internal_code: string;
    location: string;
  }>;
}

interface Client {
  id: string;
  company_name: string;
}

interface ManualEmergencySelectorProps {
  onCancel: () => void;
  onBuildingSelected: (data: {
    clientId: string;
    buildingName: string;
    buildingAddress: string;
    elevators: Array<{ id: string; internal_code: string; location: string }>;
  }) => void;
}

export function ManualEmergencySelector({
  onCancel,
  onBuildingSelected,
}: ManualEmergencySelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedBuilding, setSelectedBuilding] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingBuildings, setLoadingBuildings] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (selectedClient) {
      loadBuildings(selectedClient);
    } else {
      setBuildings([]);
      setSelectedBuilding('');
    }
  }, [selectedClient]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name')
        .order('company_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      alert('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const loadBuildings = async (clientId: string) => {
    setLoadingBuildings(true);
    try {
      const { data, error } = await supabase
        .from('buildings')
        .select(`
          id,
          name,
          address,
          client_id,
          elevators (
            id,
            internal_code,
            location
          )
        `)
        .eq('client_id', clientId)
        .eq('is_active', true);

      if (error) throw error;
      setBuildings((data || []) as Building[]);
    } catch (error) {
      console.error('Error loading buildings:', error);
      alert('Error al cargar edificios');
    } finally {
      setLoadingBuildings(false);
    }
  };

  const handleSubmit = () => {
    const building = buildings.find((b) => b.id === selectedBuilding);
    if (!building) {
      alert('Selecciona un edificio');
      return;
    }

    if (!building.elevators || building.elevators.length === 0) {
      alert('Este edificio no tiene ascensores registrados');
      return;
    }

    onBuildingSelected({
      clientId: building.client_id,
      buildingName: building.name,
      buildingAddress: building.address,
      elevators: building.elevators,
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Seleccionar Edificio
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Elige el cliente y edificio para registrar la emergencia
        </p>
      </div>

      {/* Cliente */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cliente *
        </label>
        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-base"
        >
          <option value="">Seleccionar cliente...</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.company_name}
            </option>
          ))}
        </select>
      </div>

      {/* Edificio */}
      {selectedClient && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Edificio *
          </label>
          {loadingBuildings ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
            </div>
          ) : buildings.length === 0 ? (
            <p className="text-gray-500 text-sm py-4">
              No hay edificios registrados para este cliente
            </p>
          ) : (
            <div className="space-y-2">
              {buildings.map((building) => (
                <button
                  key={building.id}
                  onClick={() => setSelectedBuilding(building.id)}
                  className={`w-full flex items-start gap-4 p-4 border-2 rounded-lg transition ${
                    selectedBuilding === building.id
                      ? 'border-red-600 bg-red-50'
                      : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedBuilding === building.id
                        ? 'bg-red-600'
                        : 'bg-gray-100'
                    }`}
                  >
                    {selectedBuilding === building.id ? (
                      <Check className="w-6 h-6 text-white" />
                    ) : (
                      <Building2 className="w-6 h-6 text-gray-600" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <h4 className="font-semibold text-gray-900">
                      {building.name}
                    </h4>
                    <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4" />
                      {building.address}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {building.elevators?.length || 0} ascensor(es)
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Botones */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={!selectedBuilding}
          className={`flex-1 px-4 py-3 rounded-lg font-medium transition ${
            selectedBuilding
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
