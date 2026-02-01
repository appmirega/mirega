import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { QRCard } from '../qr/QRCard';
import {
  QrCode,
  Plus,
  Printer,
  Building2,
  Search,
  Filter,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';
import QRCode from 'qrcode';

interface Elevator {
  id: string;
  internal_code: string;
  brand: string;
  model: string;
  serial_number: string;
  location_building: string;
  location_floor: string;
  location_specific: string | null;
  clients: {
    id: string;
    company_name: string;
    address: string;
  };
}

type ViewTab = 'manage' | 'gallery';

export function QRCodesCompleteView() {
  const [activeTab, setActiveTab] = useState<ViewTab>('manage');
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [filteredElevators, setFilteredElevators] = useState<Elevator[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [selectedElevators, setSelectedElevators] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [formData, setFormData] = useState({
    client_id: '',
    internal_code: '',
    brand: '',
    model: '',
    serial_number: '',
    location_building: '',
    location_floor: '',
    location_specific: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterClient, elevators]);

  const loadData = async () => {
    try {
      await Promise.all([loadElevators(), loadClients()]);
    } finally {
      setLoading(false);
    }
  };

  const loadElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('elevators')
        .select(`
          *,
          clients (
            id,
            company_name,
            address
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setElevators(data || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
    }
  };

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
    }
  };

  const applyFilters = () => {
    let filtered = elevators;

    if (searchTerm) {
      filtered = filtered.filter(
        (e) =>
          e.internal_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.clients?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterClient !== 'all') {
      filtered = filtered.filter((e) => e.clients?.id === filterClient);
    }

    setFilteredElevators(filtered);
  };

  const handleCreateElevator = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);

    try {
      const { error } = await supabase.from('elevators').insert({
        client_id: formData.client_id,
        internal_code: formData.internal_code,
        brand: formData.brand,
        model: formData.model,
        serial_number: formData.serial_number,
        location_building: formData.location_building,
        location_floor: formData.location_floor,
        location_specific: formData.location_specific || null,
        status: 'active',
      });

      if (error) throw error;

      alert('Ascensor creado exitosamente');
      setShowCreateModal(false);
      setFormData({
        client_id: '',
        internal_code: '',
        brand: '',
        model: '',
        serial_number: '',
        location_building: '',
        location_floor: '',
        location_specific: '',
      });
      loadElevators();
    } catch (error: any) {
      console.error('Error creating elevator:', error);
      alert('Error al crear ascensor: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const toggleElevatorSelection = (id: string) => {
    const newSelected = new Set(selectedElevators);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedElevators(newSelected);
  };

  const selectAll = () => {
    if (selectedElevators.size === filteredElevators.length) {
      setSelectedElevators(new Set());
    } else {
      setSelectedElevators(new Set(filteredElevators.map((e) => e.id)));
    }
  };

  const handlePrintSelected = async () => {
    if (selectedElevators.size === 0) {
      alert('Selecciona al menos un código QR para imprimir');
      return;
    }

    const selectedElevatorsList = elevators.filter((e) => selectedElevators.has(e.id));
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      alert('No se pudo abrir la ventana de impresión');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Códigos QR - Impresión</title>
          <style>
            @page { size: A4; margin: 1cm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .qr-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .qr-item {
              page-break-inside: avoid;
              border: 2px solid #000;
              padding: 20px;
              text-align: center;
              background: white;
            }
            .qr-item img { max-width: 200px; margin: 20px auto; display: block; }
            .qr-item h2 { margin: 10px 0; font-size: 18px; }
            .qr-item p { margin: 5px 0; font-size: 14px; color: #666; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
              Imprimir
            </button>
          </div>
          <div class="qr-grid" id="qr-container"></div>
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                const printBtn = document.querySelector('button');
                if (printBtn) printBtn.style.display = 'block';
              }, 1000);
            });
          </script>
        </body>
      </html>
    `);

    const container = printWindow.document.getElementById('qr-container');

    for (const elevator of selectedElevatorsList) {
      const qrUrl = `${window.location.origin}/elevator/${elevator.id}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
      });

      const qrItem = printWindow.document.createElement('div');
      qrItem.className = 'qr-item';
      qrItem.innerHTML = `
        <h2>${elevator.clients?.company_name || 'Cliente'}</h2>
        <img src="${qrDataUrl}" alt="QR Code" />
        <p><strong>${elevator.brand} ${elevator.model}</strong></p>
        <p>Código: ${elevator.internal_code}</p>
        <p>${elevator.location_building} - ${elevator.location_floor}</p>
        <p style="font-size: 12px; margin-top: 10px;">${elevator.serial_number}</p>
      `;
      container?.appendChild(qrItem);
    }

    printWindow.document.close();
  };

  const downloadSingleQR = async (elevator: Elevator) => {
    const qrUrl = `${window.location.origin}/elevator/${elevator.id}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 600,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${elevator.internal_code}_${elevator.clients?.company_name || 'Cliente'}.png`;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Códigos QR</h1>
          <p className="text-slate-600 mt-1">Gestión y generación de códigos QR para ascensores</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Nuevo Ascensor
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'manage'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Gestión
              </div>
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'gallery'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Galería e Impresión
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'manage' && (
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por código, marca, modelo o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos los clientes</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {filteredElevators.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay ascensores registrados</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredElevators.map((elevator) => (
                    <QRCard key={elevator.id} elevator={elevator as any} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  >
                    {selectedElevators.size === filteredElevators.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selectedElevators.size === filteredElevators.length
                      ? 'Deseleccionar Todos'
                      : 'Seleccionar Todos'}
                  </button>
                  <span className="text-sm text-slate-600">
                    {selectedElevators.size} seleccionado{selectedElevators.size !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={handlePrintSelected}
                  disabled={selectedElevators.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Seleccionados
                </button>
              </div>

              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <select
                  value={filterClient}
                  onChange={(e) => setFilterClient(e.target.value)}
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Todos los clientes</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </div>

              {filteredElevators.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay códigos QR disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredElevators.map((elevator) => (
                    <div
                      key={elevator.id}
                      onClick={() => toggleElevatorSelection(elevator.id)}
                      className={`relative border-2 rounded-xl p-6 cursor-pointer transition ${
                        selectedElevators.has(elevator.id)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="absolute top-4 right-4">
                        {selectedElevators.has(elevator.id) ? (
                          <CheckSquare className="w-6 h-6 text-blue-600" />
                        ) : (
                          <Square className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="text-center">
                        <h3 className="font-bold text-slate-900 mb-2">
                          {elevator.clients?.company_name}
                        </h3>
                        <div className="bg-white p-4 rounded-lg mb-4">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                              `${window.location.origin}/elevator/${elevator.id}`
                            )}`}
                            alt="QR Code"
                            className="w-full max-w-[200px] mx-auto"
                          />
                        </div>
                        <p className="font-semibold text-slate-900 mb-1">
                          {elevator.brand} {elevator.model}
                        </p>
                        <p className="text-sm text-slate-600 mb-1">Código: {elevator.internal_code}</p>
                        <p className="text-sm text-slate-600">
                          {elevator.location_building} - {elevator.location_floor}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadSingleQR(elevator);
                          }}
                          className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                        >
                          <Download className="w-4 h-4" />
                          Descargar PNG
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Crear Nuevo Ascensor</h3>

            <form onSubmit={handleCreateElevator} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cliente *</label>
                <select
                  required
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Código Interno *</label>
                  <input
                    type="text"
                    required
                    value={formData.internal_code}
                    onChange={(e) => setFormData({ ...formData, internal_code: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número de Serie *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Marca *</label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Modelo *</label>
                  <input
                    type="text"
                    required
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Edificio *</label>
                  <input
                    type="text"
                    required
                    value={formData.location_building}
                    onChange={(e) => setFormData({ ...formData, location_building: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Piso *</label>
                  <input
                    type="text"
                    required
                    value={formData.location_floor}
                    onChange={(e) => setFormData({ ...formData, location_floor: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ubicación Específica
                </label>
                <input
                  type="text"
                  value={formData.location_specific}
                  onChange={(e) => setFormData({ ...formData, location_specific: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={generating}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {generating ? 'Creando...' : 'Crear Ascensor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
