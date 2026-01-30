import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Plus, Trash2, Save, X, AlertCircle } from 'lucide-react';

interface ElevatorSpecificPart {
  id: string;
  part_type: string;
  part_name: string;
  manufacturer: string;
  model: string;
  specifications: string;
  quantity_needed: number;
  source: string;
  notes: string;
}

interface Props {
  elevatorId: string;
  elevatorInfo: string;
  onClose: () => void;
}

export function ElevatorSpecificPartsForm({ elevatorId, elevatorInfo, onClose }: Props) {
  const [parts, setParts] = useState<ElevatorSpecificPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newPart, setNewPart] = useState({
    part_type: '',
    part_name: '',
    manufacturer: '',
    model: '',
    specifications: '',
    quantity_needed: 1,
    notes: '',
  });

  const partTypes = [
    'Tarjeta de Control',
    'Motor',
    'Contactor',
    'Relé',
    'Operador de Puertas',
    'Encoder',
    'Inversor',
    'Freno',
    'Cable',
    'Riel Guía',
    'Paracaídas',
    'Limitador de Velocidad',
    'Amortiguador',
    'Otro',
  ];

  useEffect(() => {
    loadParts();
  }, [elevatorId]);

  const loadParts = async () => {
    try {
      const { data, error } = await supabase
        .from('elevator_specific_parts')
        .select('*')
        .eq('elevator_id', elevatorId)
        .order('part_type', { ascending: true });

      if (error) throw error;
      setParts(data || []);
    } catch (error) {
      console.error('Error loading parts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPart = async () => {
    if (!newPart.part_type || !newPart.part_name) {
      alert('Tipo y Nombre de parte son obligatorios');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { error } = await supabase
        .from('elevator_specific_parts')
        .insert([{
          elevator_id: elevatorId,
          ...newPart,
          source: 'manual',
          created_by: user.id,
        }]);

      if (error) throw error;

      alert('Parte agregada exitosamente');
      setNewPart({
        part_type: '',
        part_name: '',
        manufacturer: '',
        model: '',
        specifications: '',
        quantity_needed: 1,
        notes: '',
      });
      setShowAddForm(false);
      loadParts();
    } catch (error: any) {
      console.error('Error adding part:', error);
      alert('Error al agregar parte: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deletePart = async (partId: string) => {
    if (!confirm('¿Eliminar esta parte del registro?')) return;

    try {
      const { error } = await supabase
        .from('elevator_specific_parts')
        .delete()
        .eq('id', partId);

      if (error) throw error;
      alert('Parte eliminada');
      loadParts();
    } catch (error: any) {
      console.error('Error deleting part:', error);
      alert('Error al eliminar: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              Partes Específicas del Ascensor
            </h2>
            <p className="text-sm text-slate-600 mt-1">{elevatorInfo}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">Sistema de Registro de Partes</p>
              <p className="text-blue-700 mt-1">
                Este formulario registra qué partes y piezas específicas usa este ascensor.
                Se alimenta automáticamente cuando se solicitan repuestos, pero también puedes agregar partes manualmente.
              </p>
            </div>
          </div>

          {/* Botón Agregar */}
          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Plus className="w-5 h-5" />
              Agregar Parte Manualmente
            </button>
          )}

          {/* Formulario Agregar */}
          {showAddForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
              <h3 className="font-bold text-slate-900">Nueva Parte</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Parte *
                  </label>
                  <select
                    value={newPart.part_type}
                    onChange={(e) => setNewPart({ ...newPart, part_type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    {partTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre de la Parte *
                  </label>
                  <input
                    type="text"
                    value={newPart.part_name}
                    onChange={(e) => setNewPart({ ...newPart, part_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej: Tarjeta LCB-II"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fabricante
                  </label>
                  <input
                    type="text"
                    value={newPart.manufacturer}
                    onChange={(e) => setNewPart({ ...newPart, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej: Mitsubishi"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={newPart.model}
                    onChange={(e) => setNewPart({ ...newPart, model: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej: LCB-II"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Especificaciones
                  </label>
                  <input
                    type="text"
                    value={newPart.specifications}
                    onChange={(e) => setNewPart({ ...newPart, specifications: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej: 220V, 50Hz"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cantidad Necesaria
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newPart.quantity_needed}
                    onChange={(e) => setNewPart({ ...newPart, quantity_needed: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={newPart.notes}
                    onChange={(e) => setNewPart({ ...newPart, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Información adicional..."
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleAddPart}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 font-medium"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Guardando...' : 'Guardar Parte'}
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista de Partes */}
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : parts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">No hay partes registradas para este ascensor</p>
              <p className="text-sm text-slate-500 mt-2">
                Agrega partes manualmente o se registrarán automáticamente al solicitar repuestos
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900">Partes Registradas ({parts.length})</h3>
              {parts.map((part) => (
                <div
                  key={part.id}
                  className="bg-white border-2 border-slate-200 rounded-lg p-4 hover:border-blue-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-bold text-slate-900">{part.part_name}</h4>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          {part.part_type}
                        </span>
                        {part.source === 'auto_request' && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Auto
                          </span>
                        )}
                        {part.source === 'manual' && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                            Manual
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        {part.manufacturer && (
                          <div>
                            <p className="text-xs text-slate-500">Fabricante</p>
                            <p className="font-medium text-slate-900">{part.manufacturer}</p>
                          </div>
                        )}
                        {part.model && (
                          <div>
                            <p className="text-xs text-slate-500">Modelo</p>
                            <p className="font-medium text-slate-900">{part.model}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-slate-500">Cantidad</p>
                          <p className="font-medium text-slate-900">{part.quantity_needed}</p>
                        </div>
                        {part.specifications && (
                          <div>
                            <p className="text-xs text-slate-500">Especificaciones</p>
                            <p className="font-medium text-slate-900">{part.specifications}</p>
                          </div>
                        )}
                      </div>

                      {part.notes && (
                        <div className="mt-2">
                          <p className="text-xs text-slate-500">Notas</p>
                          <p className="text-sm text-slate-700">{part.notes}</p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => deletePart(part.id)}
                      className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-6 border-t border-slate-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
