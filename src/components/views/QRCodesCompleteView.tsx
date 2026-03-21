import { useEffect, useMemo, useState } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import QRCode from 'qrcode';

interface ClientItem {
  id: string;
  company_name: string;
  address?: string | null;
}

interface Elevator {
  id: string;
  client_id: string;
  internal_code: string;
  brand: string;
  model: string;
  serial_number: string | null;
  location_building: string | null;
  location_address: string;
  status: 'active' | 'inactive' | 'under_maintenance';
  clients?: ClientItem | ClientItem[] | null;
}

type ViewTab = 'manage' | 'gallery';

interface ElevatorFormData {
  client_id: string;
  internal_code: string;
  brand: string;
  model: string;
  serial_number: string;
  location_building: string;
  location_address: string;
}

function getElevatorQrUrl(elevatorId: string) {
  return `${window.location.origin}/elevator/${elevatorId}`;
}

function getClientObject(elevator: Elevator): ClientItem | null {
  if (!elevator.clients) return null;
  return Array.isArray(elevator.clients) ? elevator.clients[0] ?? null : elevator.clients;
}

function getShortBuildingName(elevator: Elevator) {
  const shortName = elevator.location_building?.trim();
  const clientName = getClientObject(elevator)?.company_name?.trim();
  return shortName || clientName || 'EDIFICIO';
}

function getElevatorNumber(elevator: Elevator) {
  const code = elevator.internal_code?.trim();
  return code || 'S/N';
}

function getElevatorLabelLine(elevator: Elevator) {
  return `Ascensor ${getElevatorNumber(elevator)}`;
}

function QRCodesCompleteView() {
  const [activeTab, setActiveTab] = useState<ViewTab>('manage');
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [selectedElevators, setSelectedElevators] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<ElevatorFormData>({
    client_id: '',
    internal_code: '',
    brand: '',
    model: '',
    serial_number: '',
    location_building: '',
    location_address: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const filteredElevators = useMemo(() => {
    let filtered = [...elevators];
    const term = searchTerm.trim().toLowerCase();

    if (term) {
      filtered = filtered.filter((elevator) => {
        const client = getClientObject(elevator);
        return (
          getShortBuildingName(elevator).toLowerCase().includes(term) ||
          getElevatorLabelLine(elevator).toLowerCase().includes(term) ||
          (client?.company_name || '').toLowerCase().includes(term) ||
          (elevator.internal_code || '').toLowerCase().includes(term) ||
          (elevator.brand || '').toLowerCase().includes(term) ||
          (elevator.model || '').toLowerCase().includes(term) ||
          (elevator.serial_number || '').toLowerCase().includes(term)
        );
      });
    }

    if (filterClient !== 'all') {
      filtered = filtered.filter((elevator) => elevator.client_id === filterClient);
    }

    return filtered;
  }, [elevators, searchTerm, filterClient]);

  useEffect(() => {
    const generateQrs = async () => {
      const nextMap: Record<string, string> = {};

      for (const elevator of filteredElevators) {
        try {
          nextMap[elevator.id] = await QRCode.toDataURL(getElevatorQrUrl(elevator.id), {
            width: 900,
            margin: 1,
          });
        } catch (error) {
          console.error('Error generating QR:', error);
        }
      }

      setQrMap(nextMap);
    };

    if (filteredElevators.length > 0) {
      generateQrs();
    } else {
      setQrMap({});
    }
  }, [filteredElevators]);

  const loadData = async () => {
    setLoading(true);
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
          id,
          client_id,
          internal_code,
          brand,
          model,
          serial_number,
          location_building,
          location_address,
          status,
          clients (
            id,
            company_name,
            address
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setElevators((data as Elevator[]) || []);
    } catch (error) {
      console.error('Error loading elevators:', error);
      alert('Error al cargar ascensores');
    }
  };

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, address')
        .order('company_name', { ascending: true });

      if (error) throw error;
      setClients((data as ClientItem[]) || []);
    } catch (error) {
      console.error('Error loading clients:', error);
      alert('Error al cargar clientes');
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      internal_code: '',
      brand: '',
      model: '',
      serial_number: '',
      location_building: '',
      location_address: '',
    });
  };

  const handleCreateElevator = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase.from('elevators').insert({
        client_id: formData.client_id,
        internal_code: formData.internal_code.trim(),
        brand: formData.brand.trim(),
        model: formData.model.trim(),
        serial_number: formData.serial_number.trim() || null,
        location_building: formData.location_building.trim() || null,
        location_address: formData.location_address.trim(),
        status: 'active',
      });

      if (error) throw error;

      alert('Ascensor creado correctamente');
      setShowCreateModal(false);
      resetForm();
      await loadElevators();
    } catch (error: any) {
      console.error('Error creating elevator:', error);
      alert(`Error al crear ascensor: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleElevatorSelection = (id: string) => {
    setSelectedElevators((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (filteredElevators.length === 0) return;

    if (selectedElevators.size === filteredElevators.length) {
      setSelectedElevators(new Set());
      return;
    }

    setSelectedElevators(new Set(filteredElevators.map((elevator) => elevator.id)));
  };

  const downloadSingleQR = async (elevator: Elevator) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(getElevatorQrUrl(elevator.id), {
        width: 1400,
        margin: 1,
      });

      const buildingName = getShortBuildingName(elevator).replace(/\s+/g, '_');
      const elevatorLabel = getElevatorLabelLine(elevator).replace(/\s+/g, '_');

      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `QR_${buildingName}_${elevatorLabel}.png`;
      link.click();
    } catch (error) {
      console.error('Error downloading QR:', error);
      alert('No se pudo descargar el QR');
    }
  };

  const handlePrintSelected = async () => {
    if (selectedElevators.size === 0) {
      alert('Selecciona al menos un código QR para imprimir');
      return;
    }

    const selectedList = filteredElevators.filter((elevator) =>
      selectedElevators.has(elevator.id)
    );

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('No se pudo abrir la ventana de impresión');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>Etiquetas QR Ascensores</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              color: #000;
            }

            .toolbar {
              padding: 12px;
            }

            .toolbar button {
              padding: 8px 14px;
              font-size: 14px;
              cursor: pointer;
            }

            .sheet {
              display: grid;
              grid-template-columns: repeat(auto-fill, 3cm);
              gap: 0.2cm;
              justify-content: start;
              padding: 0.2cm;
            }

            .label {
              width: 3cm;
              height: 5cm;
              border: 1px solid #000;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              padding: 0.12cm 0.1cm 0.12cm 0.1cm;
              page-break-inside: avoid;
              overflow: hidden;
            }

            .elevator {
              font-size: 8pt;
              font-weight: 700;
              text-align: center;
              line-height: 1.1;
              min-height: 0.5cm;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 0.1cm;
              width: 100%;
            }

            .qr-wrap {
              width: 2.45cm;
              height: 2.9cm;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 0.1cm;
            }

            .qr-wrap img {
              width: 2.45cm;
              height: 2.45cm;
              object-fit: contain;
              display: block;
            }

            .building {
              font-size: 7.5pt;
              font-weight: 700;
              text-align: center;
              line-height: 1.05;
              text-transform: uppercase;
              width: 100%;
              word-break: break-word;
            }

            @media print {
              .toolbar {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="toolbar">
            <button onclick="window.print()">Imprimir</button>
          </div>
          <div class="sheet" id="sheet"></div>
        </body>
      </html>
    `);

    const sheet = printWindow.document.getElementById('sheet');

    for (const elevator of selectedList) {
      const qrDataUrl = await QRCode.toDataURL(getElevatorQrUrl(elevator.id), {
        width: 1200,
        margin: 1,
      });

      const buildingName = getShortBuildingName(elevator);
      const elevatorLabel = getElevatorLabelLine(elevator);

      const item = printWindow.document.createElement('div');
      item.className = 'label';
      item.innerHTML = `
        <div class="elevator">${elevatorLabel}</div>
        <div class="qr-wrap">
          <img src="${qrDataUrl}" alt="QR ${elevatorLabel}" />
        </div>
        <div class="building">${buildingName}</div>
      `;
      sheet?.appendChild(item);
    }

    printWindow.document.close();
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
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Códigos QR</h1>
          <p className="text-slate-600 mt-1">
            Gestión y generación de códigos QR para ascensores
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Nuevo Ascensor
          </button>
        </div>
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

        <div className="p-6 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por edificio, ascensor, cliente, código o modelo..."
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

          {activeTab === 'manage' && (
            <>
              {filteredElevators.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay ascensores registrados</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredElevators.map((elevator) => {
                    const qrDataURL = qrMap[elevator.id];
                    if (!qrDataURL) return null;

                    return (
                      <QRCard
                        key={elevator.id}
                        qrDataURL={qrDataURL}
                        buildingName={getShortBuildingName(elevator)}
                        elevatorLabel={getElevatorLabelLine(elevator)}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'gallery' && (
            <>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  >
                    {selectedElevators.size === filteredElevators.length && filteredElevators.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {selectedElevators.size === filteredElevators.length && filteredElevators.length > 0
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
                  Imprimir etiquetas
                </button>
              </div>

              {filteredElevators.length === 0 ? (
                <div className="text-center py-12">
                  <QrCode className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay códigos QR disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {filteredElevators.map((elevator) => {
                    const isSelected = selectedElevators.has(elevator.id);
                    const qrDataURL = qrMap[elevator.id];

                    return (
                      <div
                        key={elevator.id}
                        onClick={() => toggleElevatorSelection(elevator.id)}
                        className={`relative border-2 rounded-xl p-4 cursor-pointer transition ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="absolute top-3 right-3">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </div>

                        <div className="text-center">
                          <h3 className="font-bold text-slate-900 uppercase text-sm mb-1">
                            {getShortBuildingName(elevator)}
                          </h3>
                          <p className="text-sm font-medium text-slate-700 mb-3">
                            {getElevatorLabelLine(elevator)}
                          </p>

                          <div className="bg-white p-3 rounded-lg mb-3 border border-slate-200 min-h-[210px] flex items-center justify-center">
                            {qrDataURL ? (
                              <img
                                src={qrDataURL}
                                alt={`QR ${getElevatorLabelLine(elevator)}`}
                                className="w-full max-w-[180px] mx-auto"
                              />
                            ) : (
                              <span className="text-sm text-slate-400">Generando QR...</span>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadSingleQR(elevator);
                            }}
                            className="mt-2 flex items-center justify-center gap-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                          >
                            <Download className="w-4 h-4" />
                            Descargar PNG
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Código Interno *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.internal_code}
                    onChange={(e) =>
                      setFormData({ ...formData, internal_code: e.target.value })
                    }
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número de Serie
                  </label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) =>
                      setFormData({ ...formData, serial_number: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre edificio / nombre corto
                  </label>
                  <input
                    type="text"
                    value={formData.location_building}
                    onChange={(e) =>
                      setFormData({ ...formData, location_building: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Dirección *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.location_address}
                    onChange={(e) =>
                      setFormData({ ...formData, location_address: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? 'Creando...' : 'Crear Ascensor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default QRCodesCompleteView;