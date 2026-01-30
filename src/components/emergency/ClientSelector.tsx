import { useState, useEffect } from 'react';
import { ArrowLeft, Building2, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Client {
  id: string;
  company_name: string;
  address: string | null;
}

interface Elevator {
  id: string;
  elevator_number: number;
  brand: string;
  model: string;
  serial_number: string;
  location_name: string;
}

interface ClientSelectorProps {
  onCancel: () => void;
  onElevatorSelected: (clientId: string, elevatorId: string) => void;
}

export function ClientSelector({ onCancel, onElevatorSelected }: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar clientes al montar
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name, address')
      .order('company_name');

    if (error) {
      console.error('Error loading clients:', error);
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  const loadElevators = async (clientId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('elevators')
      .select('id, elevator_number, brand, model, serial_number, location_name')
      .eq('client_id', clientId)
      .order('elevator_number');

    if (error) {
      console.error('Error loading elevators:', error);
    } else {
      setElevators(data || []);
    }
    setLoading(false);
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    loadElevators(client.id);
  };

  const handleElevatorSelect = (elevatorId: string) => {
    console.log('🎯 Ascensor seleccionado:', elevatorId, 'Cliente:', selectedClient?.id);
    if (selectedClient) {
      onElevatorSelected(selectedClient.id, elevatorId);
    }
  };

  const filteredClients = clients.filter(c =>
    c.company_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !selectedClient) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={selectedClient ? () => setSelectedClient(null) : onCancel}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedClient ? 'Seleccionar Ascensor' : 'Seleccionar Cliente'}
            </h1>
            {selectedClient && (
              <p className="text-gray-600">{selectedClient.company_name}</p>
            )}
          </div>
        </div>

        {/* Lista de Clientes */}
        {!selectedClient && (
          <>
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 mb-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
            />

            <div className="space-y-2">
              {filteredClients.map(client => (
                <button
                  key={client.id}
                  onClick={() => handleClientSelect(client)}
                  className="w-full flex items-start gap-4 p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">{client.company_name}</h3>
                    {client.address && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                        <MapPin className="w-4 h-4" />
                        {client.address}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Lista de Ascensores */}
        {selectedClient && (
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : elevators.length === 0 ? (
              <p className="text-center text-gray-600 py-12">
                No hay ascensores registrados para este cliente
              </p>
            ) : (
              elevators.map(elevator => (
                <button
                  key={elevator.id}
                  onClick={() => handleElevatorSelect(elevator.id)}
                  className="w-full flex items-start gap-4 p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl font-bold text-green-700">
                      {elevator.elevator_number}
                    </span>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">
                    Ascensor #{elevator.elevator_number}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {elevator.brand} {elevator.model}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      S/N: {elevator.serial_number} | {elevator.location_name}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
