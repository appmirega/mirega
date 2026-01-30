import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Wrench,
  Search,
  Building2,
  FileText,
  Package,
  Eye,
  Edit,
  Download,
} from 'lucide-react';
import { ElevatorPartsForm } from '../forms/ElevatorPartsForm';
import { ElevatorSpecificPartsForm } from '../forms/ElevatorSpecificPartsForm';
import { ManualPartsManagementForm } from '../forms/ManualPartsManagementForm';

interface Elevator {
  id: string;
  tower_name: string | null;
  index_number: number | null;
  location_name: string | null;
  address: string | null;
  address_asc: string | null;

  elevator_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  serial_number_not_legible: boolean;
  capacity_kg: number;
  floors: number;
  installation_date: string;
  has_machine_room: boolean;
  no_machine_room: boolean;
  stops_all_floors: boolean;
  stops_odd_floors: boolean;
  stops_even_floors: boolean;
  classification: string;
  status: string;
  created_at: string;
  client_id: string;
  clients: {
    id: string;
    company_name: string;
    building_name: string | null;
    address: string;
  } | null;
}

interface PartsFormInfo {
  id: string;
  completion_percentage: number;
  is_complete: boolean;
}

interface Props {
  onNavigate?: (path: string) => void;
}

export function ElevatorsCompleteView({ onNavigate }: Props) {
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [filteredElevators, setFilteredElevators] = useState<Elevator[]>([]);
  const [partsFormsInfo, setPartsFormsInfo] = useState<
    Record<string, PartsFormInfo>
  >({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedElevator, setSelectedElevator] = useState<Elevator | null>(
    null
  );
  const [showPartsForm, setShowPartsForm] = useState(false);
  const [viewingDetails, setViewingDetails] = useState<Elevator | null>(null);
  const [showSpecificPartsForm, setShowSpecificPartsForm] = useState(false);
  const [specificPartsElevator, setSpecificPartsElevator] =
    useState<Elevator | null>(null);
  const [showManualPartsForm, setShowManualPartsForm] = useState(false);
  const [manualPartsElevator, setManualPartsElevator] =
    useState<Elevator | null>(null);

  const handleExport = () => {
    const rows = [
      ['Cliente', 'Edificio', 'Torre', 'Direccion', 'Tipo', 'Modelo', 'Serie', 'Estado'],
      ...filteredElevators.map((e) => [
        e.clients?.company_name || '',
        e.clients?.building_name || '',
        e.tower_name || e.location_name || '',
        getElevatorAddress(e),
        getElevatorTypeLabel(e.elevator_type),
        e.model,
        e.serial_number,
        e.status,
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ascensores-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  useEffect(() => {
    loadElevators();
  }, []);

  useEffect(() => {
    filterElevators();
  }, [elevators, searchTerm]);

  const getElevatorAddress = (e: Elevator) =>
    e.address_asc ||
    e.address ||
    e.clients?.address ||
    'Sin dirección registrada';

  const loadElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select(`
          *,
          clients (
            id,
            company_name,
            building_name,
            address
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setElevators((data as Elevator[]) || []);

      // Cargar información de formularios de partes
      const { data: partsForms } = await supabase
        .from('elevator_parts_forms')
        .select('id, elevator_id, completion_percentage, is_complete');

      if (partsForms) {
        const formsMap: Record<string, PartsFormInfo> = {};
        partsForms.forEach((form: any) => {
          formsMap[form.elevator_id] = {
            id: form.id,
            completion_percentage: form.completion_percentage,
            is_complete: form.is_complete,
          };
          setPartsFormsInfo(formsMap);
        });
      }
    } catch (error) {
      console.error('Error loading elevators:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterElevators = () => {
    let filtered = [...elevators];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();

      const norm = (value?: string | null) =>
        (value ?? '').toLowerCase();

      filtered = filtered.filter((e) => {
        const address = getElevatorAddress(e).toLowerCase();

        return (
          norm(e.manufacturer).includes(term) ||
          norm(e.model).includes(term) ||
          norm(e.serial_number).includes(term) ||
          norm(e.location_name).includes(term) ||
          norm(e.tower_name).includes(term) ||
          norm(e.clients?.company_name).includes(term) ||
          norm(e.clients?.building_name).includes(term) ||
          address.includes(term)
        );
      });
    }

    setFilteredElevators(filtered);
  };

  const getElevatorTypeLabel = (type: string) => {
    switch (type) {
      case 'hydraulic':
        return 'Hidráulico';
      case 'electromechanical':
        return 'Electromecánico';
      case 'traction':
        return 'Tracción';
      default:
        return type;
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'ascensor_corporativo':
        return 'Ascensor Corporativo';
      case 'ascensor_residencial':
        return 'Ascensor Residencial';
      case 'montacargas':
        return 'Montacargas';
      case 'montaplatos':
        return 'Montaplatos';
      default:
        return classification;
    }
  };

  const openPartsForm = (elevator: Elevator) => {
    setSelectedElevator(elevator);
    setShowPartsForm(true);
  };

  const closePartsForm = () => {
    setShowPartsForm(false);
    setSelectedElevator(null);
    loadElevators(); // Recargar para actualizar porcentajes
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Gestión Completa de Ascensores
        </h1>
        <p className="text-slate-600 mt-1">
          Visualiza toda la información técnica, fichas iniciales y gestiona
          partes y piezas
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por fabricante, modelo, serie, torre, cliente, edificio o dirección..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1 px-3 py-2 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredElevators.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium mb-2">
              No se encontraron ascensores
            </p>
            <p className="text-slate-500 text-sm">
              Para gestionar partes y piezas, primero debes registrar
              ascensores en el sistema.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredElevators.map((elevator) => {
              const partsInfo = partsFormsInfo[elevator.id];
              const torre =
                elevator.tower_name?.trim() ||
                elevator.location_name ||
                'Sin torre registrada';
              const address = getElevatorAddress(elevator);

              return (
                <div
                  key={elevator.id}
                  className="border border-slate-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Columna 1: Información General */}
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        <span>Información General</span>
                        {typeof elevator.index_number === 'number' &&
                          elevator.index_number > 0 && (
                            <span className="text-sm font-normal text-slate-500">
                              · Ascensor #{elevator.index_number}
                            </span>
                          )}
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-slate-500">Cliente:</span>
                          <p className="font-medium text-slate-900">
                            {elevator.clients?.company_name || 'Sin cliente'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Edificio:</span>
                          <p className="font-medium text-slate-900">
                            {elevator.clients?.building_name || 'Sin edificio'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Torre:</span>
                          <p className="text-slate-700">{torre}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Dirección:</span>
                          <p className="text-slate-700">{address}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Clasificación:</span>
                          <p className="font-medium text-blue-700">
                            {getClassificationLabel(elevator.classification)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Columna 2: Especificaciones Técnicas */}
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-green-600" />
                        Especificaciones Técnicas
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-slate-500">Tipo:</span>
                          <p className="font-medium text-slate-900">
                            {getElevatorTypeLabel(elevator.elevator_type)}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Fabricante:</span>
                          <p className="font-medium text-slate-900">
                            {elevator.manufacturer}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Modelo:</span>
                          <p className="text-slate-700">{elevator.model}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">
                            Número de Serie:
                          </span>
                          {elevator.serial_number_not_legible ? (
                            <p className="text-orange-600 italic">
                              No legible / No disponible
                            </p>
                          ) : (
                            <p className="font-mono text-slate-700">
                              {elevator.serial_number}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500">Capacidad:</span>
                          <p className="font-medium text-slate-900">
                            {elevator.capacity_kg} kg
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Pisos:</span>
                          <p className="text-slate-700">{elevator.floors}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">
                            Fecha de Instalación:
                          </span>
                          <p className="text-slate-700">
                            {new Date(
                              elevator.installation_date
                            ).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Columna 3: Características Operativas */}
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-600" />
                        Características Operativas
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-slate-500">
                            Sala de Máquinas:
                          </span>
                          <p className="font-medium text-slate-900">
                            {elevator.has_machine_room
                              ? 'Con sala de máquinas'
                              : 'Sin sala de máquinas'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">
                            Paradas en Pisos:
                          </span>
                          <p className="font-medium text-slate-900">
                            {elevator.stops_all_floors && 'Todos los pisos'}
                            {elevator.stops_odd_floors &&
                              'Solo pisos impares'}
                            {elevator.stops_even_floors &&
                              'Solo pisos pares'}
                          </p>
                        </div>

                        <div className="border-t border-slate-200 pt-3 mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-slate-500 flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Formulario Partes y Piezas:
                            </span>
                          </div>
                          {partsInfo ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all ${
                                      partsInfo.completion_percentage === 100
                                        ? 'bg-green-500'
                                        : 'bg-blue-500'
                                    }`}
                                    style={{
                                      width: `${partsInfo.completion_percentage}%`,
                                    }}
                                  ></div>
                                </div>
                                <span className="text-xs font-medium text-slate-700">
                                  {partsInfo.completion_percentage}%
                                </span>
                              </div>
                              {partsInfo.is_complete && (
                                <p className="text-xs text-green-600 font-medium">
                                  ✓ Completo
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-orange-600 italic">
                              Sin información registrada
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2 pt-3">
                          <button
                            onClick={() => setViewingDetails(elevator)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                          >
                            <Eye className="w-4 h-4" />
                            Ver Detalles
                          </button>
                          <button
                            onClick={() => openPartsForm(elevator)}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                          >
                            <Edit className="w-4 h-4" />
                            {partsInfo ? 'Editar' : 'Llenar'} Partes
                          </button>
                          <button
                            onClick={() => {
                              setManualPartsElevator(elevator);
                              setShowManualPartsForm(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                          >
                            <Package className="w-4 h-4" />
                            Gestionar Partes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPartsForm && selectedElevator && (
        <ElevatorPartsForm
          elevatorId={selectedElevator.id}
          clientId={selectedElevator.client_id}
          onClose={closePartsForm}
          onSave={closePartsForm}
        />
      )}

      {viewingDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <span>Detalles Completos del Ascensor</span>
                {typeof viewingDetails.index_number === 'number' &&
                  viewingDetails.index_number > 0 && (
                    <span className="text-sm font-normal text-slate-500">
                      · Ascensor #{viewingDetails.index_number}
                    </span>
                  )}
              </h2>
              <button
                onClick={() => setViewingDetails(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2 border-b pb-3">
                  <h3 className="font-bold text-lg text-slate-900 mb-2">
                    Cliente
                  </h3>
                  <p className="font-medium">
                    {viewingDetails.clients?.company_name || 'Sin cliente'}
                  </p>
                  <p className="text-slate-600">
                    {viewingDetails.clients?.building_name || 'Sin edificio'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs">
                    Clasificación
                  </span>
                  <p className="font-medium">
                    {getClassificationLabel(viewingDetails.classification)}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs">Tipo</span>
                  <p className="font-medium">
                    {getElevatorTypeLabel(viewingDetails.elevator_type)}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs">Fabricante</span>
                  <p className="font-medium">
                    {viewingDetails.manufacturer}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs">Modelo</span>
                  <p className="font-medium">{viewingDetails.model}</p>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-500 text-xs">
                    Número de Serie
                  </span>
                  {viewingDetails.serial_number_not_legible ? (
                    <p className="text-orange-600 italic">
                      No legible / No disponible
                    </p>
                  ) : (
                    <p className="font-mono font-medium">
                      {viewingDetails.serial_number}
                    </p>
                  )}
                </div>

                <div>
                  <span className="text-slate-500 text-xs">Capacidad</span>
                  <p className="font-medium">
                    {viewingDetails.capacity_kg} kg
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs">
                    Número de Pisos
                  </span>
                  <p className="font-medium">{viewingDetails.floors}</p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs">
                    Sala de Máquinas
                  </span>
                  <p className="font-medium">
                    {viewingDetails.has_machine_room
                      ? 'Con sala de máquinas'
                      : 'Sin sala de máquinas'}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs">
                    Paradas en Pisos
                  </span>
                  <p className="font-medium">
                    {viewingDetails.stops_all_floors && 'Todos los pisos'}
                    {viewingDetails.stops_odd_floors &&
                      'Solo pisos impares'}
                    {viewingDetails.stops_even_floors &&
                      'Solo pisos pares'}
                  </p>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-500 text-xs">Torre</span>
                  <p className="font-medium">
                    {viewingDetails.tower_name?.trim() ||
                      viewingDetails.location_name ||
                      'Sin torre registrada'}
                  </p>
                </div>

                <div className="col-span-2">
                  <span className="text-slate-500 text-xs">Dirección</span>
                  <p className="font-medium">
                    {getElevatorAddress(viewingDetails)}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs">
                    Fecha de Instalación
                  </span>
                  <p className="font-medium">
                    {new Date(
                      viewingDetails.installation_date
                    ).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                <div>
                  <span className="text-slate-500 text-xs">
                    Registrado el
                  </span>
                  <p className="font-medium">
                    {new Date(viewingDetails.created_at).toLocaleDateString(
                      'es-ES',
                      {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      }
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSpecificPartsForm && specificPartsElevator && (
        <ElevatorSpecificPartsForm
          elevatorId={specificPartsElevator.id}
          elevatorInfo={`${
            specificPartsElevator.clients?.company_name ?? 'Sin cliente'
          } - ${
            specificPartsElevator.tower_name ||
            specificPartsElevator.location_name ||
            'Sin torre'
          }`}
          onClose={() => {
            setShowSpecificPartsForm(false);
            setSpecificPartsElevator(null);
          }}
        />
      )}

      {showManualPartsForm && manualPartsElevator && (
        <ManualPartsManagementForm
          elevator={manualPartsElevator}
          onClose={() => {
            setShowManualPartsForm(false);
            setManualPartsElevator(null);
            loadElevators();
          }}
        />
      )}
    </div>
  );
}


