import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Wrench, Building2, FileText, Package, Eye, Image } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Elevator {
  id: string;
  elevator_number: number | null;
  tower_name: string | null;
  elevator_type: string;
  manufacturer: string | null;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  serial_number_not_legible: boolean;
  capacity_kg: number | null;
  floors: number | null;
  installation_date: string | null;
  has_machine_room: boolean;
  stops_all_floors: boolean;
  stops_odd_floors: boolean;
  stops_even_floors: boolean;
  classification: string | null;
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
  const { selectedClientId } = useAuth();
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedElevator, setSelectedElevator] = useState<Elevator | null>(null);
  const [partsForm, setPartsForm] = useState<PartsForm | null>(null);
  const [photos, setPhotos] = useState<PartsPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (selectedClientId) {
      loadElevators();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  const loadElevators = async () => {
    if (!selectedClientId) return;

    try {
      setLoading(true);

      const { data: elevatorsData, error } = await supabase
        .from('elevators')
        .select('*')
        .eq('client_id', selectedClientId)
        .order('elevator_number', { ascending: true });

      if (error) throw error;
      setElevators((elevatorsData as Elevator[]) || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPartsInfo = async (elevatorId: string) => {
    try {
      const { data: formData } = await supabase
        .from('elevator_parts_forms')
        .select('*')
        .eq('elevator_id', elevatorId)
        .maybeSingle();

      setPartsForm(formData);

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
      case 'hydraulic':
      case 'hidraulico':
        return 'Hidráulico';
      case 'electromechanical':
      case 'electromecanico':
        return 'Electromecánico';
      case 'traction':
        return 'Tracción';
      default:
        return type || 'No informado';
    }
  };

  const getClassificationLabel = (classification: string | null) => {
    switch (classification) {
      case 'ascensor_corporativo':
        return 'Ascensor Corporativo';
      case 'ascensor_residencial':
        return 'Ascensor Residencial';
      case 'montacargas':
      case 'montacarga':
        return 'Montacarga';
      case 'montaplatos':
        return 'Montaplatos';
      case 'ascensor':
        return 'Ascensor';
      default:
        return classification || 'No informado';
    }
  };

  const getElevatorTitle = (elevator: Elevator) => {
    const base = elevator.elevator_number
      ? `Ascensor ${elevator.elevator_number}`
      : 'Ascensor';
    return elevator.tower_name ? `${base} · ${elevator.tower_name}` : base;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Información Técnica de Mis Ascensores
        </h1>
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
                  <h3 className="font-bold text-slate-900">{getElevatorTitle(elevator)}</h3>
                  <p className="text-sm text-slate-500">
                    {getClassificationLabel(elevator.classification)}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-slate-500">Marca / Fabricante:</span>
                  <p className="font-medium text-slate-900">
                    {elevator.brand || elevator.manufacturer || 'No informado'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Modelo:</span>
                  <p className="text-slate-700">{elevator.model || 'No informado'}</p>
                </div>
                <div>
                  <span className="text-slate-500">Capacidad:</span>
                  <p className="text-slate-700">
                    {elevator.capacity_kg ? `${elevator.capacity_kg} kg` : 'N/A'}
                  </p>
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
              <div>
                <h3 className="font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Especificaciones Generales
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 text-xs">Ascensor</span>
                    <p className="font-medium">{getElevatorTitle(selectedElevator)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Clasificación</span>
                    <p className="font-medium">
                      {getClassificationLabel(selectedElevator.classification)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Tipo</span>
                    <p className="font-medium">
                      {getElevatorTypeLabel(selectedElevator.elevator_type)}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Marca / Fabricante</span>
                    <p className="font-medium">
                      {selectedElevator.brand ||
                        selectedElevator.manufacturer ||
                        'No informado'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Modelo</span>
                    <p className="font-medium">{selectedElevator.model || 'No informado'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Número de Serie</span>
                    {selectedElevator.serial_number_not_legible ? (
                      <p className="text-orange-600 italic text-xs">No disponible</p>
                    ) : (
                      <p className="font-mono">{selectedElevator.serial_number || 'N/A'}</p>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Capacidad</span>
                    <p className="font-medium">
                      {selectedElevator.capacity_kg ? `${selectedElevator.capacity_kg} kg` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">N° de Paradas</span>
                    <p className="font-medium">{selectedElevator.floors ?? 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Fecha instalación</span>
                    <p className="font-medium">
                      {selectedElevator.installation_date || 'No informada'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 text-xs">Sala de máquinas</span>
                    <p className="font-medium">
                      {selectedElevator.has_machine_room ? 'Sí' : 'No / no informado'}
                    </p>
                  </div>
                </div>
              </div>

              {partsForm && (
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5 text-green-600" />
                    Partes y Piezas
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <DetailItem label="Tablero de control" value={partsForm.control_board_model} />
                    <DetailItem label="Tipo de motor" value={partsForm.motor_type} />
                    <DetailItem label="Contactor" value={partsForm.contactor_model} />
                    <DetailItem label="Relés" value={partsForm.relay_types} />
                    <DetailItem label="Operador de puerta" value={partsForm.door_operator_model} />
                    <DetailItem label="Encoder" value={partsForm.encoder_model} />
                    <DetailItem label="Inversor" value={partsForm.inverter_model} />
                    <DetailItem label="Freno" value={partsForm.brake_type} />
                    <DetailItem label="Cables" value={partsForm.cable_specifications} />
                    <DetailItem label="Guías" value={partsForm.guide_rail_type} />
                    <DetailItem label="Paracaídas" value={partsForm.safety_gear_model} />
                    <DetailItem label="Gobernador" value={partsForm.governor_model} />
                    <DetailItem label="Buffer" value={partsForm.buffer_type} />
                  </div>

                  {partsForm.additional_notes && (
                    <div className="mt-4">
                      <span className="text-slate-500 text-xs">Notas adicionales</span>
                      <p className="mt-1 text-sm text-slate-700">{partsForm.additional_notes}</p>
                    </div>
                  )}
                </div>
              )}

              {photos.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-3 flex items-center gap-2">
                    <Image className="w-5 h-5 text-purple-600" />
                    Fotografías
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => setViewingPhoto(photo.photo_url)}
                        className="border rounded-lg p-2 text-left hover:bg-slate-50"
                      >
                        <img
                          src={photo.photo_url}
                          alt={photo.description || 'Foto'}
                          className="w-full h-32 object-cover rounded"
                        />
                        <p className="text-xs text-slate-600 mt-2">
                          {photo.description || 'Sin descripción'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!partsForm && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  No existe ficha técnica detallada cargada para este ascensor.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <img
            src={viewingPhoto}
            alt="Vista ampliada"
            className="max-w-full max-h-full rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-slate-500 text-xs">{label}</span>
      <p className="font-medium">{value || 'No informado'}</p>
    </div>
  );
}