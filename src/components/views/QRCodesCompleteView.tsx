import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import QRCode from 'qrcode';
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

interface ClientItem {
  id: string;
  company_name: string;
  internal_alias?: string | null;
  address?: string | null;
}

interface Elevator {
  id: string;
  client_id: string;
  internal_code?: string | null;
  elevator_number?: string | number | null;
  index_number?: string | number | null;
  tower_name?: string | null;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  location_building?: string | null;
  location_floor?: string | null;
  location_specific?: string | null;
  status?: string | null;
  clients?: ClientItem | null;
}

type ViewTab = 'manage' | 'gallery';

interface ElevatorFormData {
  client_id: string;
  internal_code: string;
  elevator_number: string;
  tower_name: string;
  brand: string;
  model: string;
  serial_number: string;
  location_building: string;
  location_floor: string;
  location_specific: string;
}

function getElevatorQrUrl(elevatorId: string) {
  return `${window.location.origin}/elevator/${elevatorId}`;
}

function getBuildingDisplayName(elevator: Elevator) {
  const clientAlias = elevator.clients?.internal_alias?.trim();
  const towerName = elevator.tower_name?.trim();
  const locationBuilding = elevator.location_building?.trim();
  const clientName = elevator.clients?.company_name?.trim();

  return clientAlias || towerName || locationBuilding || clientName || 'ASCENSOR';
}

function getElevatorNumberDisplay(elevator: Elevator) {
  const elevatorNumber = elevator.elevator_number?.toString().trim();
  const indexNumber = elevator.index_number?.toString().trim();
  const internalCode = elevator.internal_code?.toString().trim();

  if (elevatorNumber) return elevatorNumber;
  if (indexNumber) return indexNumber;
  if (internalCode) return internalCode;

  return 'S/N';
}

function getElevatorLabelLine(elevator: Elevator) {
  return `Ascensor ${getElevatorNumberDisplay(elevator)}`;
}

function getElevatorLocationLine(elevator: Elevator) {
  const tower = elevator.tower_name?.trim();
  const building = elevator.location_building?.trim();
  const floor = elevator.location_floor?.trim();

  if (tower && floor) return `${tower} - ${floor}`;
  if (building && floor) return `${building} - ${floor}`;
  if (tower) return tower;
  if (building) return building;
  return '';
}

export function QRCodesCompleteView() {
  const [activeTab, setActiveTab] = useState<ViewTab>('manage');
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [selectedElevators, setSelectedElevators] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState<ElevatorFormData>({
    client_id: '',
    internal_code: '',
    elevator_number: '',
    tower_name: '',
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
    generateVisibleQrs(filteredElevators);
  }, [elevators, searchTerm, filterClient]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredElevators = useMemo(() => {
    let filtered = [...elevators];
    const term = searchTerm.trim().toLowerCase();

    if (term) {
      filtered = filtered.filter((elevator) => {
        const buildingName = getBuildingDisplayName(elevator).toLowerCase();
        const elevatorLabel = getElevatorLabelLine(elevator).toLowerCase();
        const clientName = elevator.clients?.company_name?.toLowerCase() ?? '';
        const clientAlias = elevator.clients?.internal_alias?.toLowerCase() ?? '';
        const internalCode = elevator.internal_code?.toLowerCase() ?? '';
        const brand = elevator.brand?.toLowerCase() ?? '';
        const model = elevator.model?.toLowerCase() ?? '';
        const serial = elevator.serial_number?.toLowerCase() ?? '';
        const tower = elevator.tower_name?.toLowerCase() ?? '';
        const building = elevator.location_building?.toLowerCase() ?? '';

        return (
          buildingName.includes(term) ||
          elevatorLabel.includes(term) ||
          clientName.includes(term) ||
          clientAlias.includes(term) ||
          internalCode.includes(term) ||
          brand.includes(term) ||
          model.includes(term) ||
          serial.includes(term) ||
          tower.includes(term) ||
          building.includes(term)
        );
      });
    }

    if (filterClient !== 'all') {
      filtered = filtered.filter((elevator) => elevator.client_id === filterClient);
    }

    return filtered;
  }, [elevators, searchTerm, filterClient]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadElevators(), loadClients()]);
    } finally {
      setLoading(false);
    }
  };

  const loadElevators = async () => {
    const { data, error } = await supabase
      .from('elevators')
      .select(`
        id,
        client_id,
        internal_code,
        elevator_number,
        index_number,
        tower_name,
        brand,
        model,
        serial_number,
        location_building,
        location_floor,
        location_specific,
        status,
        clients (
          id,
          company_name,
          internal_alias,
          address
        )
      `)
      .order('client_id', { ascending: true });

    if (error) {
      console.error('Error loading elevators:', error);
      alert(`Error al cargar ascensores: ${error.message}`);
      return;
    }

    setElevators((data as Elevator[]) || []);
  };

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name, internal_alias, address')
      .order('company_name', { ascending: true });

    if (error) {
      console.error('Error loading clients:', error);
      alert(`Error al cargar clientes: ${error.message}`);
      return;
    }

    setClients((data as ClientItem[]) || []);
  };

  const generateVisibleQrs = async (items: Elevator[]) => {
    try {
      const entries = await Promise.all(
        items.map(async (elevator) => {
          const dataUrl = await QRCode.toDataURL(getElevatorQrUrl(elevator.id), {
            width: 512,
            margin: 1,
          });
          return [elevator.id, dataUrl] as const;
        })
      );

      setQrMap((prev) => {
        const next = { ...prev };
        for (const [id, dataUrl] of entries) {
          next[id] = dataUrl;
        }
        return next;
      });
    } catch (error) {
      console.error('Error generating QR previews:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      internal_code: '',
      elevator_number: '',
      tower_name: '',
      brand: '',
      model: '',
      serial_number: '',
      location_building: '',
      location_floor: '',
      location_specific: '',
    });
  };

  const handleCreateElevator = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        client_id: formData.client_id,
        internal_code: formData.internal_code.trim() || null,
        elevator_number: formData.elevator_number.trim() || null,
        tower_name: formData.tower_name.trim() || null,
        brand: formData.brand.trim() || null,
        model: formData.model.trim() || null,
        serial_number: formData.serial_number.trim() || null,
        location_building: formData.location_building.trim() || null,
        location_floor: formData.location_floor.trim() || null,
        location_specific: formData.location_specific.trim() || null,
        status: 'active',
      };

      const { error } = await supabase.from('elevators').insert(payload);
      if (error) throw error;

      alert('Ascensor creado correctamente');
      setShowCreateModal(false);
      resetForm();
      await loadElevators();
      setActiveTab('manage');
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

  const generateQrDataUrl = async (elevator: Elevator, width = 1000) => {
    return QRCode.toDataURL(getElevatorQrUrl(elevator.id), {
      width,
      margin: 1,
    });
  };

  const downloadSingleQR = async (elevator: Elevator) => {
    try {
      const qrDataUrl = await generateQrDataUrl(elevator, 1200);
      const link = document.createElement('a');
      const buildingName = getBuildingDisplayName(elevator).replace(/\s+/g, '_');
      const elevatorName = getElevatorLabelLine(elevator).replace(/\s+/g, '_');

      link.href = qrDataUrl;
      link.download = `QR_${buildingName}_${elevatorName}.png`;
      link.click();
    } catch (error) {
      console.error('Error downloading QR:', error);
      alert('No se pudo descargar el QR');
    }
  };

  const handlePrintSelected = async () => {
    if (selectedElevators.size === 0) {
      alert('Selecciona al menos un ascensor para imprimir');
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
              padding: 0.12cm 0.1cm 0.08cm 0.1cm;
              page-break-inside: avoid;
              overflow: hidden;
            }

            .building {
              font-size: 8pt;
              font-weight: 700;
              text-align: center;
              line-height: 1.1;
              min-height: 0.55cm;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 0.06cm;
              text-transform: uppercase;
            }

            .elevator {
              font-size: 8pt;
              font-weight: 700;
              text-align: center;
              line-height: 1.1;
              min-height: 0.45cm;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 0.08cm;
            }

            .qr-wrap {
              width: 2.45cm;
              height: 2.45cm;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 0.08cm;
            }

            .qr-wrap img {
              width: 2.45cm;
              height: 2.45cm;
              object-fit: contain;
              display: block;
            }

            .footer-building {
              font-size: 7pt;
              font-weight: 700;
              text-align: center;
              line-height: 1.05;
              text-transform: uppercase;
              margin-bottom: 0.03cm;
              width: 100%;
              white-space: normal;
              word-break: break-word;
            }

            .footer-elevator {
              font-size: 7pt;
              text-align: center;
              line-height: 1.05;
              width: 100%;
            }

            @media print {
              .toolbar {
                display: none;
              }

              body {
                padding: 0;
              }

              .sheet {
                gap: 0.2cm;
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
      const qrDataUrl = await generateQrDataUrl(elevator, 900);
      const buildingName = getBuildingDisplayName(elevator);
      const elevatorName = getElevatorLabelLine(elevator);

      const item = printWindow.document.createElement('div');
      item.className = 'label';
      item.innerHTML = `
        <div class="building">${buildingName}</div>
        <div class="elevator">${elevatorName}</div>
        <div class="qr-wrap">
          <img src="${qrDataUrl}" alt="QR ${elevatorName}" />
        </div>
        <div class="footer-building">${buildingName}</div>
        <div class="footer-elevator">${elevatorName}</div>
      `;
      sheet?.appendChild(item);
    }

    printWindow.document.close();
  };

  const selectedCount = selectedElevators.size;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
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
                  {client.internal_alias || client.company_name}
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
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {filteredElevators.map((elevator) => {
                    const buildingName = getBuildingDisplayName(elevator);
                    const elevatorLabel = getElevatorLabelLine(elevator);
                    const locationLine = getElevatorLocationLine(elevator);
                    const qrSrc = qrMap[elevator.id];

                    return (
                      <div
                        key={elevator.id}
                        className="border border-slate-200 rounded-xl p-5 bg-slate-50"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900 uppercase">
                                {buildingName}
                              </h3>
                              <p className="text-base font-medium text-slate-700">
                                {elevatorLabel}
                              </p>
                              {locationLine && (
                                <p className="text-sm text-slate-500">{locationLine}</p>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              <p className="text-slate-700">
                                <span className="font-medium">Cliente:</span>{' '}
                                {elevator.clients?.company_name || '-'}
                              </p>
                              <p className="text-slate-700">
                                <span className="font-medium">Código:</span>{' '}
                                {elevator.internal_code || '-'}
                              </p>
                              <p className="text-slate-700">
                                <span className="font-medium">Marca:</span>{' '}
                                {elevator.brand || '-'}
                              </p>
                              <p className="text-slate-700">
                                <span className="font-medium">Modelo:</span>{' '}
                                {elevator.model || '-'}
                              </p>
                            </div>

                            <a
                              href={getElevatorQrUrl(elevator.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Abrir URL del QR
                            </a>
                          </div>

                          <div className="flex flex-col items-center gap-3">
                            <div className="bg-white border border-slate-200 rounded-lg p-3">
                              {qrSrc ? (
                                <img
                                  src={qrSrc}
                                  alt={`QR ${elevatorLabel}`}
                                  className="w-[180px] h-[180px] object-contain"
                                />
                              ) : (
                                <div className="w-[180px] h-[180px] flex items-center justify-center text-sm text-slate-400">
                                  Generando QR...
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => downloadSingleQR(elevator)}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                            >
                              <Download className="w-4 h-4" />
                              Descargar PNG
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'gallery' && (
            <>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                  >
                    {filteredElevators.length > 0 && selectedCount === filteredElevators.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    {filteredElevators.length > 0 && selectedCount === filteredElevators.length
                      ? 'Deseleccionar todos'
                      : 'Seleccionar todos'}
                  </button>

                  <span className="text-sm text-slate-600">
                    {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
                  </span>
                </div>

                <button
                  onClick={handlePrintSelected}
                  disabled={selectedCount === 0}
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
                    const buildingName = getBuildingDisplayName(elevator);
                    const elevatorLabel = getElevatorLabelLine(elevator);
                    const qrSrc = qrMap[elevator.id];

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
                            {buildingName}
                          </h3>
                          <p className="text-sm font-medium text-slate-700 mb-3">
                            {elevatorLabel}
                          </p>

                          <div className="bg-white p-3 rounded-lg mb-3 border border-slate-200">
                            {qrSrc ? (
                              <img
                                src={qrSrc}
                                alt={`QR ${elevatorLabel}`}
                                className="w-full max-w-[180px] mx-auto"
                              />
                            ) : (
                              <div className="h-[180px] flex items-center justify-center text-sm text-slate-400">
                                Generando QR...
                              </div>
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
                      {client.internal_alias || client.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Código Interno
                  </label>
                  <input
                    type="text"
                    value={formData.internal_code}
                    onChange={(e) =>
                      setFormData({ ...formData, internal_code: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Número de Ascensor
                  </label>
                  <input
                    type="text"
                    value={formData.elevator_number}
                    onChange={(e) =>
                      setFormData({ ...formData, elevator_number: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Torre</label>
                  <input
                    type="text"
                    value={formData.tower_name}
                    onChange={(e) =>
                      setFormData({ ...formData, tower_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Marca</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Modelo</label>
                  <input
                    type="text"
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
                    Edificio / Identificador
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">Piso</label>
                  <input
                    type="text"
                    value={formData.location_floor}
                    onChange={(e) =>
                      setFormData({ ...formData, location_floor: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ubicación específica
                </label>
                <input
                  type="text"
                  value={formData.location_specific}
                  onChange={(e) =>
                    setFormData({ ...formData, location_specific: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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