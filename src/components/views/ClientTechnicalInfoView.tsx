import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Wrench, Building2, FileText, Package, Eye, Image } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Elevator {
  id: string;
  location_name: string;
  elevator_type: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  serial_number_not_legible: boolean;
  capacity_kg: number;
  floors: number;
  installation_date: string;
  has_machine_room: boolean;
  stops_all_floors: boolean;
  stops_odd_floors: boolean;
  stops_even_floors: boolean;
  classification: string;
}

interface PartsForm {
  id: string;
  control_board_model: string;
  motor_type: string;
  contactor_model: string;
  relay_types: string;
  door_operator_model: string;
  encoder_model: string;
  inverter_model: string;
  brake_type: string;
  cable_specifications: string;
  guide_rail_type: string;
  safety_gear_model: string;
  governor_model: string;
  buffer_type: string;
  additional_notes: string;
  completion_percentage: number;
  is_complete: boolean;
}

interface PartsPhoto {
  id: string;
  photo_url: string;
  description: string;
}

export function ClientTechnicalInfoView() {
  const { profile } = useAuth();
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedElevator, setSelectedElevator] = useState<Elevator | null>(null);
  const [partsForm, setPartsForm] = useState<PartsForm | null>(null);
  const [photos, setPhotos] = useState<PartsPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadElevators();
  }, [profile]);

  const loadElevators = async () => {
    try {
      // Obtener cliente del perfil actual
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', profile?.id)
        .single();

      if (!client) {
        setLoading(false);
        return;
      }

      // Obtener ascensores del cliente
      const { data: elevatorsData, error } = await supabase
        .from('elevators')
        .select('*')
        .eq('client_id', client.id)
        .order('location_name');

      if (error) throw error;
      setElevators(elevatorsData || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPartsInfo = async (elevatorId: string) => {
    try {
      // Cargar formulario de partes
      const { data: formData } = await supabase
        .from('elevator_parts_forms')
        .select('*')
        .eq('elevator_id', elevatorId)
        .maybeSingle();

      setPartsForm(formData);

      // Cargar fotos si existe el formulario
      if (formData) {
        const { data: photosData } = await supabase
          .from('elevator_parts_photos')
          .select('*')
          .eq('parts_form_id', formData.id);

        setPhotos(photosData || []);
      } else {
        setPhotos([]);
      }
    } catch (error) {
      console.error('Error loading parts info:', error);
    }
  };

  const viewElevatorDetails = async (elevator: Elevator) => {
    setSelectedElevator(elevator);
    await loadPartsInfo(elevator.id);
  };

  const getElevatorTypeLabel = (type: string) => {
    switch (type) {
      case 'hydraulic': return 'Hidráulico';
      case 'electromechanical': return 'Electromecánico';
      case 'traction': return 'Tracción';
      default: return type;
    }
  };

  const getClassificationLabel = (classification: string) => {
    switch (classification) {
      case 'ascensor_corporativo': return 'Ascensor Corporativo';
      case 'ascensor_residencial': return 'Ascensor Residencial';
      case 'montacargas': return 'Montacargas';
      case 'montaplatos': return 'Montaplatos';
      default: return classification;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Información Técnica de Mis Ascensores</h1>
        <p className="text-slate-600 mt-1">
          Visualiza las especificaciones técnicas y el estado de partes y piezas de tus ascensores
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : elevators.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No hay ascensores registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {elevators.map((elevator) => (
            <div
              key={elevator.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition cursor-pointer"
              onClick={() => viewElevatorDetails(elevator)}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Wrench className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{elevator.location_name}</h3>
                  <p className="text-sm text-slate-500">{getClassificationLabel(elevator.classification)}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Fabricante:</span>
                  <p className="font-medium text-slate-900">{elevator.manufacturer}</p>
                </div>
                <div>
                  <span className="text-slate-500">Modelo:</span>
                  <p className="text-slate-700">{elevator.model}</p>
                </div>
                <div>
                  <span className="text-slate-500">Capacidad:</span>
                  <p className="text-slate-700">{elevator.capacity_kg} kg</p>
                </div>
              </div>

              <button className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                <Eye className="w-4 h-4" />
                Ver Detalles Técnicos
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedElevator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Información Técnica Completa</h2>
              <button
                onClick={() => {
                  setSelectedElevator(null);
                  setPartsForm(null);
                  setPhotos([]);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Especificaciones Generales */}
              <div>
                <h3 className="font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Especificaciones Generales
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 text-xs">Ubicación</span>
                    <p className="font-medium">{selectedElevator.location_name}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Clasificación</span>
                    <p className="font-medium">{getClassificationLabel(selectedElevator.classification)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Tipo</span>
                    <p className="font-medium">{getElevatorTypeLabel(selectedElevator.elevator_type)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Fabricante</span>
                    <p className="font-medium">{selectedElevator.manufacturer}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Modelo</span>
                    <p className="font-medium">{selectedElevator.model}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Número de Serie</span>
                    {selectedElevator.serial_number_not_legible ? (
                      <p className="text-orange-600 italic text-xs">No disponible</p>
                    ) : (
                      <p className="font-mono">{selectedElevator.serial_number}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Capacidad</span>
                    <p className="font-medium">{selectedElevator.capacity_kg} kg</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Número de Pisos</span>
                    <p className="font-medium">{selectedElevator.floors}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Sala de Máquinas</span>
                    <p className="font-medium">
                      {selectedElevator.has_machine_room ? 'Con sala de máquinas' : 'Sin sala de máquinas'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Paradas</span>
                    <p className="font-medium">
                      {selectedElevator.stops_all_floors && 'Todos los pisos'}
                      {selectedElevator.stops_odd_floors && 'Pisos impares'}
                      {selectedElevator.stops_even_floors && 'Pisos pares'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Fecha de Instalación</span>
                    <p className="font-medium">
                      {new Date(selectedElevator.installation_date).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Información de Partes y Piezas */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  Partes y Piezas
                </h3>

                {partsForm ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex-1 bg-slate-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all ${
                            partsForm.completion_percentage === 100 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${partsForm.completion_percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {partsForm.completion_percentage}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {partsForm.control_board_model && (
                        <div>
                          <span className="text-slate-500 text-xs">Tarjeta de Control</span>
                          <p className="font-medium">{partsForm.control_board_model}</p>
                        </div>
                      )}
                      {partsForm.motor_type && (
                        <div>
                          <span className="text-slate-500 text-xs">Tipo de Motor</span>
                          <p className="font-medium">{partsForm.motor_type}</p>
                        </div>
                      )}
                      {partsForm.contactor_model && (
                        <div>
                          <span className="text-slate-500 text-xs">Modelo de Contactores</span>
                          <p className="font-medium">{partsForm.contactor_model}</p>
                        </div>
                      )}
                      {partsForm.relay_types && (
                        <div>
                          <span className="text-slate-500 text-xs">Tipos de Relés</span>
                          <p className="font-medium">{partsForm.relay_types}</p>
                        </div>
                      )}
                      {partsForm.door_operator_model && (
                        <div>
                          <span className="text-slate-500 text-xs">Operador de Puertas</span>
                          <p className="font-medium">{partsForm.door_operator_model}</p>
                        </div>
                      )}
                      {partsForm.encoder_model && (
                        <div>
                          <span className="text-slate-500 text-xs">Encoder</span>
                          <p className="font-medium">{partsForm.encoder_model}</p>
                        </div>
                      )}
                      {partsForm.inverter_model && (
                        <div>
                          <span className="text-slate-500 text-xs">Inversor</span>
                          <p className="font-medium">{partsForm.inverter_model}</p>
                        </div>
                      )}
                      {partsForm.brake_type && (
                        <div>
                          <span className="text-slate-500 text-xs">Tipo de Freno</span>
                          <p className="font-medium">{partsForm.brake_type}</p>
                        </div>
                      )}
                      {partsForm.cable_specifications && (
                        <div>
                          <span className="text-slate-500 text-xs">Especificaciones de Cables</span>
                          <p className="font-medium">{partsForm.cable_specifications}</p>
                        </div>
                      )}
                      {partsForm.guide_rail_type && (
                        <div>
                          <span className="text-slate-500 text-xs">Rieles Guía</span>
                          <p className="font-medium">{partsForm.guide_rail_type}</p>
                        </div>
                      )}
                      {partsForm.safety_gear_model && (
                        <div>
                          <span className="text-slate-500 text-xs">Paracaídas</span>
                          <p className="font-medium">{partsForm.safety_gear_model}</p>
                        </div>
                      )}
                      {partsForm.governor_model && (
                        <div>
                          <span className="text-slate-500 text-xs">Limitador de Velocidad</span>
                          <p className="font-medium">{partsForm.governor_model}</p>
                        </div>
                      )}
                      {partsForm.buffer_type && (
                        <div>
                          <span className="text-slate-500 text-xs">Amortiguadores</span>
                          <p className="font-medium">{partsForm.buffer_type}</p>
                        </div>
                      )}
                    </div>

                    {partsForm.additional_notes && (
                      <div className="mt-4">
                        <span className="text-slate-500 text-xs">Notas Adicionales</span>
                        <p className="text-sm mt-1 text-slate-700 bg-slate-50 p-3 rounded-lg">
                          {partsForm.additional_notes}
                        </p>
                      </div>
                    )}

                    {photos.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-slate-900 mb-2 flex items-center gap-2">
                          <Image className="w-4 h-4" />
                          Fotos
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {photos.map((photo) => (
                            <div
                              key={photo.id}
                              className="relative cursor-pointer group"
                              onClick={() => setViewingPhoto(photo.photo_url)}
                            >
                              <img
                                src={photo.photo_url}
                                alt={photo.description || 'Foto del ascensor'}
                                className="w-full h-40 object-cover rounded-lg border border-slate-200 group-hover:border-blue-400 transition"
                              />
                              {photo.description && (
                                <p className="text-xs text-slate-600 mt-1">{photo.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-600">
                      La información técnica de partes y piezas aún no ha sido registrada por el equipo técnico.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <img
            src={viewingPhoto}
            alt="Vista completa"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
