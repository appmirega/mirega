import { useState, useEffect } from 'react';
import { Package, Plus, Search, CheckCircle, Clock, AlertCircle, Wrench, Camera, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Elevator {
  id: string;
  location_name: string;
  serial_number: string;
  manufacturer: string;
  model: string;
  clients: {
    company_name: string;
    building_name: string;
  };
}

interface Assignment {
  id: string;
  elevator_id: string;
  status: string;
  progress_percentage: number;
  assignment_type: string;
  created_at: string;
  started_at: string;
  elevator: Elevator;
}

interface PartFormData {
  part_name: string;
  part_type: string;
  manufacturer: string;
  model: string;
  specifications: string;
  quantity: number;
  photos: string[];
  installation_date: string;
  expected_lifetime_years: number;
  supplier: string;
  warranty_months: number;
  condition_status: string;
  notes: string;
}

const PART_TYPES = [
  'Motor', 'Tarjeta de Control', 'Contactor', 'Limitador de Velocidad',
  'Regulador', 'Polea', 'Roldana', 'Cable de Tracción', 'Cable de Compensación',
  'Pistón', 'Válvula', 'Botonera', 'Display', 'Sensor', 'Encoder',
  'Fotocélula', 'Puerta', 'Operador de Puerta', 'Guía', 'Zapata',
  'Amortiguador', 'Otro'
];

const CONDITION_STATUS = [
  { value: 'excellent', label: 'Excelente', color: 'bg-green-100 text-green-800' },
  { value: 'good', label: 'Bueno', color: 'bg-blue-100 text-blue-800' },
  { value: 'fair', label: 'Regular', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'poor', label: 'Malo', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Crítico', color: 'bg-red-100 text-red-800' }
];

export function TechnicianPartsManagementView() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'available' | 'my-assignments'>('available');
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPartForm, setShowPartForm] = useState(false);
  const [selectedElevator, setSelectedElevator] = useState<Elevator | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [partForm, setPartForm] = useState<PartFormData>({
    part_name: '',
    part_type: '',
    manufacturer: '',
    model: '',
    specifications: '',
    quantity: 1,
    photos: [],
    installation_date: '',
    expected_lifetime_years: 0,
    supplier: '',
    warranty_months: 0,
    condition_status: 'good',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'available') {
        await loadAvailableElevators();
      } else {
        await loadMyAssignments();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableElevators = async () => {
    const { data, error } = await supabase
      .from('elevators')
      .select(`
        id,
        location_name,
        serial_number,
        manufacturer,
        model,
        clients (
          company_name,
          building_name
        )
      `)
      .order('location_name');

    if (!error && data) {
      setElevators(data as any);
    }
  };

  const loadMyAssignments = async () => {
    const { data, error } = await supabase
      .from('technician_assignments')
      .select(`
        id,
        elevator_id,
        status,
        progress_percentage,
        assignment_type,
        created_at,
        started_at,
        elevator:elevators (
          id,
          location_name,
          serial_number,
          manufacturer,
          model,
          clients (
            company_name,
            building_name
          )
        )
      `)
      .eq('technician_id', user?.id)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAssignments(data as any);
    }
  };

  const handleSelfAssign = async (elevator: Elevator) => {
    try {
      const { error } = await supabase
        .from('technician_assignments')
        .insert({
          elevator_id: elevator.id,
          technician_id: user?.id,
          assigned_by: user?.id,
          assignment_type: 'self_assigned',
          status: 'pending'
        });

      if (error) throw error;

      alert('Te has autoasignado exitosamente');
      loadData();
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Error al autoasignarse');
    }
  };

  const handleStartAssignment = async (assignment: Assignment) => {
    try {
      const { error } = await supabase
        .from('technician_assignments')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', assignment.id);

      if (error) throw error;

      setSelectedAssignment(assignment);
      setSelectedElevator(assignment.elevator);
      setShowPartForm(true);
      loadData();
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al iniciar asignación');
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `elevator-parts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('maintenance-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('maintenance-photos')
        .getPublicUrl(filePath);

      setPartForm(prev => ({
        ...prev,
        photos: [...prev.photos, publicUrl]
      }));
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('Error al subir la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    setPartForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }));
  };

  const handleSavePart = async () => {
    if (!partForm.part_name.trim()) {
      alert('El nombre de la parte es obligatorio');
      return;
    }

    if (!selectedElevator) return;

    try {
      // Guardar la parte
      const { error: partError } = await supabase
        .from('elevator_specific_parts')
        .insert({
          elevator_id: selectedElevator.id,
          part_name: partForm.part_name,
          part_type: partForm.part_type,
          manufacturer: partForm.manufacturer,
          model: partForm.model,
          quantity: partForm.quantity,
          photos: partForm.photos,
          measurements: { specifications: partForm.specifications },
          installation_date: partForm.installation_date || null,
          expected_lifetime_years: partForm.expected_lifetime_years || null,
          supplier: partForm.supplier,
          warranty_months: partForm.warranty_months || null,
          condition_status: partForm.condition_status,
          notes: partForm.notes
        });

      if (partError) throw partError;

      // Actualizar progreso de la asignación si existe
      if (selectedAssignment) {
        // Calcular nuevo porcentaje (simplificado - cada parte suma 10%)
        const newProgress = Math.min(selectedAssignment.progress_percentage + 10, 100);

        await supabase
          .from('technician_assignments')
          .update({
            progress_percentage: newProgress,
            status: newProgress === 100 ? 'completed' : 'in_progress',
            completed_at: newProgress === 100 ? new Date().toISOString() : null
          })
          .eq('id', selectedAssignment.id);
      }

      alert('Parte guardada exitosamente');

      // Reset form
      setPartForm({
        part_name: '',
        part_type: '',
        manufacturer: '',
        model: '',
        specifications: '',
        quantity: 1,
        photos: [],
        installation_date: '',
        expected_lifetime_years: 0,
        supplier: '',
        warranty_months: 0,
        condition_status: 'good',
        notes: ''
      });

      loadData();
    } catch (error: any) {
      console.error('Error:', error);
      alert('Error al guardar la parte');
    }
  };

  const filteredElevators = elevators.filter(e =>
    e.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.clients?.building_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAssignments = assignments.filter(a =>
    a.elevator?.location_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.elevator?.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.elevator?.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Gestión de Partes y Piezas</h1>
        <p className="text-slate-600 mt-1">
          Autoasígnate ascensores y completa la información de sus componentes
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('available')}
              className={`py-4 px-2 border-b-2 font-medium transition ${
                activeTab === 'available'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Ascensores Disponibles
            </button>
            <button
              onClick={() => setActiveTab('my-assignments')}
              className={`py-4 px-2 border-b-2 font-medium transition ${
                activeTab === 'my-assignments'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Mis Asignaciones ({assignments.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por ubicación, serie, cliente o edificio..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : activeTab === 'available' ? (
            <div className="space-y-3">
              {filteredElevators.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">No se encontraron ascensores</p>
                </div>
              ) : (
                filteredElevators.map((elevator) => (
                  <div key={elevator.id} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{elevator.location_name}</h3>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                          <div>
                            <span className="text-slate-500">Cliente:</span>
                            <p className="text-slate-900">{elevator.clients?.company_name}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Edificio:</span>
                            <p className="text-slate-900">{elevator.clients?.building_name}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Serie:</span>
                            <p className="text-slate-900">{elevator.serial_number}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Modelo:</span>
                            <p className="text-slate-900">{elevator.model}</p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSelfAssign(elevator)}
                        className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition whitespace-nowrap"
                      >
                        <Plus className="w-4 h-4 inline mr-1" />
                        Autoasignarme
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAssignments.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">No tienes asignaciones activas</p>
                  <p className="text-slate-500 text-sm mt-2">Ve a la pestaña de ascensores disponibles para autoasignarte</p>
                </div>
              ) : (
                filteredAssignments.map((assignment) => (
                  <div key={assignment.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{assignment.elevator?.location_name}</h3>
                        <p className="text-sm text-slate-600">{assignment.elevator?.clients?.building_name}</p>
                      </div>
                      <div className="text-right">
                        {assignment.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                            <Clock className="w-4 h-4" />
                            Pendiente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                            <Wrench className="w-4 h-4" />
                            En Progreso
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">Progreso</span>
                        <span className="text-slate-900 font-medium">{assignment.progress_percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${assignment.progress_percentage}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (assignment.status === 'pending') {
                          handleStartAssignment(assignment);
                        } else {
                          setSelectedAssignment(assignment);
                          setSelectedElevator(assignment.elevator);
                          setShowPartForm(true);
                        }
                      }}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      {assignment.status === 'pending' ? 'Iniciar' : 'Continuar Llenando'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showPartForm && selectedElevator && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full my-8">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Agregar Parte o Pieza</h2>
                  <p className="text-sm text-slate-600">{selectedElevator.location_name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowPartForm(false);
                    setSelectedElevator(null);
                    setSelectedAssignment(null);
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre de la Parte <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={partForm.part_name}
                    onChange={(e) => setPartForm({ ...partForm, part_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Ej: Motor Trifásico Principal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Parte</label>
                  <select
                    value={partForm.part_type}
                    onChange={(e) => setPartForm({ ...partForm, part_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    {PART_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fabricante</label>
                  <input
                    type="text"
                    value={partForm.manufacturer}
                    onChange={(e) => setPartForm({ ...partForm, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Modelo</label>
                  <input
                    type="text"
                    value={partForm.model}
                    onChange={(e) => setPartForm({ ...partForm, model: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={partForm.quantity}
                    onChange={(e) => setPartForm({ ...partForm, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                  <select
                    value={partForm.condition_status}
                    onChange={(e) => setPartForm({ ...partForm, condition_status: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {CONDITION_STATUS.map(status => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
                  <input
                    type="text"
                    value={partForm.supplier}
                    onChange={(e) => setPartForm({ ...partForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de Instalación</label>
                  <input
                    type="date"
                    value={partForm.installation_date}
                    onChange={(e) => setPartForm({ ...partForm, installation_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Vida Útil (años)</label>
                  <input
                    type="number"
                    min="0"
                    value={partForm.expected_lifetime_years}
                    onChange={(e) => setPartForm({ ...partForm, expected_lifetime_years: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Garantía (meses)</label>
                  <input
                    type="number"
                    min="0"
                    value={partForm.warranty_months}
                    onChange={(e) => setPartForm({ ...partForm, warranty_months: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Especificaciones Técnicas</label>
                  <textarea
                    value={partForm.specifications}
                    onChange={(e) => setPartForm({ ...partForm, specifications: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Dimensiones, voltaje, potencia, etc."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Fotos</label>
                  <div className="space-y-2">
                    {partForm.photos.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {partForm.photos.map((photo, index) => (
                          <div key={index} className="relative">
                            <img src={photo} alt="Parte" className="w-24 h-24 object-cover rounded border" />
                            <button
                              type="button"
                              onClick={() => removePhoto(index)}
                              className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 cursor-pointer">
                      <Camera className="w-4 h-4" />
                      {uploadingPhoto ? 'Subiendo...' : 'Agregar Foto'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={uploadingPhoto}
                      />
                    </label>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notas Adicionales</label>
                  <textarea
                    value={partForm.notes}
                    onChange={(e) => setPartForm({ ...partForm, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 rounded-b-xl flex gap-3">
              <button
                onClick={handleSavePart}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
              >
                <Save className="w-5 h-5" />
                Guardar Parte
              </button>
              <button
                onClick={() => {
                  setShowPartForm(false);
                  setSelectedElevator(null);
                  setSelectedAssignment(null);
                }}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
