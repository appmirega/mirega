import QRCode from 'qrcode';
import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { QRCard } from '../qr/QRCard';
import {
  QrCode,
  Plus,
  Printer,
  Building2,
  Search,
  CheckSquare,
  Square,
  Download,
} from 'lucide-react';

interface Elevator {
  id: string;
  internal_code: string;
  brand: string;
  model: string;
  serial_number: string;
  location_building: string;
  location_floor: string;
  location_specific: string | null;
  elevator_number?: number | string;
  internal_name?: string;
  nombre_interno?: string;
  corto?: string;
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

      // Incluir campos de número y nombre interno
      const { data, error } = await supabase
        .from('elevators')
        .select(`
          *,
          elevator_number,
          internal_name,
          nombre_interno,
          corto,
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
          <title>Códigos QR - Etiquetas para Impresión</title>
          <style>
            @page { size: A4; margin: 0.5cm; }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 10px; }
            
            /* Etiquetas de 5x5 cm (51x51 mm aprox) - 4 por página A4 */
            .qr-grid { 
              display: grid; 
              grid-template-columns: repeat(2, 1fr); 
              gap: 15px;
              padding: 10px;
            }
            
            .qr-item {
              width: 200px;
              height: 200px;
              page-break-inside: avoid;
              border: 2px solid #273a8f;
              padding: 10px;
              text-align: center;
              background: white;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              border-radius: 4px;
            }
            
            .qr-item-header {
              font-weight: bold;
              font-size: 11px;
              color: #273a8f;
              margin-bottom: 5px;
              max-width: 180px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .qr-item-code {
              width: 140px;
              height: 140px;
              margin: 5px auto;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .qr-item-code img {
              max-width: 100%;
              max-height: 100%;
              image-rendering: pixelated;
            }
            
            .qr-item-footer {
              font-weight: bold;
              font-size: 10px;
              color: #000;
              margin-top: 5px;
            }
            
            .qr-item-footer-small {
              font-size: 8px;
              color: #666;
            }
            
            @media print { 
              .no-print { display: none; }
              body { margin: 0; padding: 5px; }
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 20px; text-align: center;">
            <h2>Códigos QR - Etiquetas para Impresión</h2>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
              Tamaño de etiqueta: 5 x 5 cm aprox. • Imprime en papel adhesivo A4
            </p>
            <button onclick="window.print()" style="margin-top: 15px; padding: 10px 20px; font-size: 16px; cursor: pointer; background: #273a8f; color: white; border: none; border-radius: 4px;">
              Imprimir Etiquetas
            </button>
          </div>
          <div class="qr-grid" id="qr-container"></div>
        </body>
      </html>
    `);

    const container = printWindow.document.getElementById('qr-container');


    for (const elevator of selectedElevatorsList) {
      const qrUrl = `${window.location.origin}/elevator/${elevator.id}`;
      const qrDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 300,
        margin: 3,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      });

      // Nombre interno preferente: internal_name, nombre_interno, corto, sino vacío
      const internalName = elevator.internal_name || elevator.nombre_interno || elevator.corto || '';
      const elevatorNumber = elevator.elevator_number !== undefined && elevator.elevator_number !== null ? `N° ${elevator.elevator_number}` : '';

      const qrItem = printWindow.document.createElement('div');
      qrItem.className = 'qr-item';
      qrItem.innerHTML = `
        <div class="qr-item-header">${elevator.clients?.company_name || 'Cliente'}</div>
        <div style="font-size:11px;font-weight:bold;color:#222;">${internalName}</div>
        <div style="font-size:10px;font-weight:bold;color:#DC2626;">${elevatorNumber}</div>
        <div class="qr-item-code">
          <img src="${qrDataUrl}" alt="QR Code" />
        </div>
        <div class="qr-item-footer">${elevator.internal_code}</div>
        <div class="qr-item-footer-small">${elevator.location_building}</div>
      `;
      container?.appendChild(qrItem);
    }

    printWindow.document.close();
  };

  const downloadSingleQR = async (elevator: Elevator) => {
    const qrUrl = `${window.location.origin}/elevator/${elevator.id}`;
    // Usar API externa para descargar QR
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(qrUrl)}&margin=3`;
    const response = await fetch(apiUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `QR_${elevator.internal_code}_${elevator.clients?.company_name || 'Cliente'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
                    <QRCard key={elevator.id} elevator={elevator} />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredElevators.map((elevator) => (
                    <div
                      key={elevator.id}
                      onClick={() => toggleElevatorSelection(elevator.id)}
                      className={`relative rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                        selectedElevators.has(elevator.id)
                          ? 'border-blue-600 bg-blue-50 shadow-lg'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                      }`}
                    >
                      {/* Checkbox en esquina superior derecha */}
                      <div className="absolute top-3 right-3 z-10">
                        {selectedElevators.has(elevator.id) ? (
                          <CheckSquare className="w-6 h-6 text-blue-600 drop-shadow" />
                        ) : (
                          <Square className="w-6 h-6 text-slate-400" />
                        )}
                      </div>

                      <div className="p-4 flex flex-col items-center justify-center text-center h-full bg-white">
                        {/* Nombre interno (arriba del QR) */}
                        <h3 className="font-bold text-slate-900 text-sm mb-3 line-clamp-2">
                          {elevator.clients?.company_name}
                        </h3>

                        {/* QR Code - Mejorado con mejor generación */}
                        <div className="w-40 h-40 bg-white border border-slate-200 rounded p-2 mb-3 flex items-center justify-center">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                              `${window.location.origin}/elevator/${elevator.id}`
                            )}&margin=1`}
                            alt="QR Code"
                            className="w-full h-full object-contain image-rendering: pixelated"
                            onError={() => {
                              // Fallback si falla la generación
                              console.error('QR generation failed for elevator:', elevator.id);
                            }}
                          />
                        </div>

                        {/* Código interno (debajo del QR) */}
                        <p className="font-bold text-slate-900 text-sm mb-1">
                          {elevator.internal_code}
                        </p>

                        {/* Número de ascensor / ubicación */}
                        <p className="text-xs text-slate-600 mb-3">
                          {elevator.location_building}
                          {elevator.location_floor && ` - Piso ${elevator.location_floor}`}
                        </p>

                        {/* Botón descargar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadSingleQR(elevator);
                          }}
                          className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          PNG
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
