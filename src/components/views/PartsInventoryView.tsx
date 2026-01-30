import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Plus, Search, Edit2, Trash2, AlertCircle, Save, X } from 'lucide-react';

interface Part {
  id: string;
  part_name: string;
  part_type: string;
  manufacturer: string;
  model: string;
  specifications: string;
  quantity_in_stock: number;
  minimum_quantity: number;
  unit_price: number;
  location: string;
  notes: string;
  last_updated: string;
}

export function PartsInventoryView() {
  const [parts, setParts] = useState<Part[]>([]);
  const [filteredParts, setFilteredParts] = useState<Part[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);

  const [formData, setFormData] = useState({
    part_name: '',
    part_type: '',
    manufacturer: '',
    model: '',
    specifications: '',
    quantity_in_stock: 0,
    minimum_quantity: 0,
    unit_price: 0,
    location: '',
    notes: '',
  });

  useEffect(() => {
    loadParts();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredParts(parts);
    } else {
      const filtered = parts.filter(part =>
        part.part_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.part_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        part.model.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredParts(filtered);
    }
  }, [searchTerm, parts]);

  const loadParts = async () => {
    try {
      const { data, error } = await supabase
        .from('parts_inventory')
        .select('*')
        .order('part_name');

      if (error) throw error;
      setParts(data || []);
      setFilteredParts(data || []);
    } catch (error) {
      console.error('Error loading parts:', error);
    } finally {
      setLoading(false);
    }
  };

  const openForm = (part?: Part) => {
    if (part) {
      setEditingPart(part);
      setFormData({
        part_name: part.part_name,
        part_type: part.part_type,
        manufacturer: part.manufacturer,
        model: part.model,
        specifications: part.specifications,
        quantity_in_stock: part.quantity_in_stock,
        minimum_quantity: part.minimum_quantity,
        unit_price: part.unit_price,
        location: part.location,
        notes: part.notes,
      });
    } else {
      setEditingPart(null);
      setFormData({
        part_name: '',
        part_type: '',
        manufacturer: '',
        model: '',
        specifications: '',
        quantity_in_stock: 0,
        minimum_quantity: 0,
        unit_price: 0,
        location: '',
        notes: '',
      });
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPart(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPart) {
        // Actualizar
        const { error } = await supabase
          .from('parts_inventory')
          .update(formData)
          .eq('id', editingPart.id);

        if (error) throw error;
        alert('Repuesto actualizado exitosamente');
      } else {
        // Crear
        const { error } = await supabase
          .from('parts_inventory')
          .insert([formData]);

        if (error) throw error;
        alert('Repuesto agregado exitosamente');
      }

      closeForm();
      loadParts();
    } catch (error: any) {
      console.error('Error saving part:', error);
      alert('Error al guardar repuesto: ' + error.message);
    }
  };

  const deletePart = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este repuesto?')) return;

    try {
      const { error } = await supabase
        .from('parts_inventory')
        .delete()
        .eq('id', id);

      if (error) throw error;
      alert('Repuesto eliminado exitosamente');
      loadParts();
    } catch (error: any) {
      console.error('Error deleting part:', error);
      alert('Error al eliminar repuesto: ' + error.message);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" />
            Inventario de Repuestos
          </h1>
          <p className="text-slate-600 mt-1">
            Gestiona el inventario de partes y piezas para ascensores
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Agregar Repuesto
        </button>
      </div>

      {/* Buscador */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por nombre, tipo, fabricante o modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Lista de Repuestos */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredParts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">
            {searchTerm ? 'No se encontraron repuestos' : 'No hay repuestos en el inventario'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => openForm()}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Agregar el primer repuesto
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredParts.map((part) => {
            const isLowStock = part.quantity_in_stock <= part.minimum_quantity;
            return (
              <div
                key={part.id}
                className={`bg-white rounded-xl shadow-sm border-2 p-6 transition ${
                  isLowStock ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-slate-900">{part.part_name}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        {part.part_type}
                      </span>
                      {isLowStock && (
                        <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Stock Bajo
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-slate-500">Fabricante</p>
                        <p className="font-medium text-slate-900">{part.manufacturer}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Modelo</p>
                        <p className="font-medium text-slate-900">{part.model}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Cantidad en Stock</p>
                        <p className={`font-bold text-lg ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                          {part.quantity_in_stock}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Precio Unitario</p>
                        <p className="font-medium text-slate-900">${part.unit_price.toLocaleString()}</p>
                      </div>
                    </div>

                    {part.specifications && (
                      <div className="mt-3">
                        <p className="text-xs text-slate-500">Especificaciones</p>
                        <p className="text-sm text-slate-700">{part.specifications}</p>
                      </div>
                    )}

                    {part.location && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500">Ubicación</p>
                        <p className="text-sm text-slate-700">{part.location}</p>
                      </div>
                    )}

                    {part.notes && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500">Notas</p>
                        <p className="text-sm text-slate-700">{part.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => openForm(part)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Editar"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deletePart(part.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Eliminar"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                {editingPart ? 'Editar Repuesto' : 'Agregar Repuesto'}
              </h2>
              <button
                onClick={closeForm}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre del Repuesto *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.part_name}
                    onChange={(e) => setFormData({ ...formData, part_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej: Tarjeta de Control Principal"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Repuesto *
                  </label>
                  <select
                    required
                    value={formData.part_type}
                    onChange={(e) => setFormData({ ...formData, part_type: e.target.value })}
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
                    Fabricante *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej: Mitsubishi"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
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
                    value={formData.specifications}
                    onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej: 220V, 50Hz"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cantidad en Stock *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.quantity_in_stock}
                    onChange={(e) => setFormData({ ...formData, quantity_in_stock: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Cantidad Mínima *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.minimum_quantity}
                    onChange={(e) => setFormData({ ...formData, minimum_quantity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Precio Unitario *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Ubicación en Bodega
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ej: Estante A3, Nivel 2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notas
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Información adicional..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  <Save className="w-5 h-5" />
                  {editingPart ? 'Actualizar' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
