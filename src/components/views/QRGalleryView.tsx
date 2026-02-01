import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { QrCode, Printer, CheckSquare, Square, Search, Download, Shield } from 'lucide-react';
import { QRCard } from '../qr/QRCard';
import QRCode from 'qrcode';

interface ClientQR {
  id: string;
  building_name: string;
  company_name: string;
  clientCode: string;
  qrDataURL: string;
}

type PaperSize = 'letter' | 'a4';

export function QRGalleryView() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<ClientQR[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const printRef = useRef<HTMLDivElement>(null);

  if (!profile || (profile.role !== 'developer' && profile.role !== 'admin')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Acceso Restringido</h2>
          <p className="text-slate-600">Solo los desarrolladores y administradores pueden acceder a esta vista.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('id, building_name, company_name')
        .eq('is_active', true)
        .order('building_name');

      if (error) throw error;

      const clientsWithQR = await Promise.all(
        (data || []).map(async (client) => {
          const clientCode = `CLI-${client.id.substring(0, 8).toUpperCase()}`;
          const qrDataURL = await QRCode.toDataURL(clientCode, {
            width: 300,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });

          return {
            id: client.id,
            building_name: client.building_name,
            company_name: client.company_name,
            clientCode,
            qrDataURL
          };
        })
      );

      setClients(clientsWithQR);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    const filtered = filteredClients();
    setSelectedIds(new Set(filtered.map(c => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const filteredClients = () => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(
      c => c.building_name.toLowerCase().includes(term) ||
           c.company_name.toLowerCase().includes(term)
    );
  };

  const selectedClients = () => {
    return clients.filter(c => selectedIds.has(c.id));
  };

  const handlePrint = () => {
    const selected = selectedClients();
    if (selected.length === 0) {
      alert('Por favor selecciona al menos un código QR para imprimir');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrsPerRow = 5;
    const qrsPerPage = paperSize === 'letter' ? 20 : 24;

    const pageWidth = paperSize === 'letter' ? '8.5in' : '210mm';
    const pageHeight = paperSize === 'letter' ? '11in' : '297mm';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Códigos QR - Liftix</title>
          <style>
            @page {
              size: ${paperSize === 'letter' ? 'letter' : 'A4'};
              margin: 0.5in;
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: Arial, sans-serif;
              width: ${pageWidth};
              height: ${pageHeight};
            }

            .page {
              page-break-after: always;
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              padding: 20px;
            }

            .page:last-child {
              page-break-after: auto;
            }

            .qr-grid {
              display: grid;
              grid-template-columns: repeat(${qrsPerRow}, 1fr);
              gap: 16px;
              width: 100%;
              height: 100%;
              align-content: start;
            }

            .qr-card {
              width: 112px;
              height: 150px;
              border: 2px solid #000;
              border-radius: 16px;
              overflow: hidden;
              background: white;
              display: flex;
              flex-direction: column;
              margin: 0 auto;
            }

            .qr-image-container {
              width: 100px;
              height: 100px;
              margin: 6px auto 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .qr-image {
              width: 100%;
              height: 100%;
              display: block;
            }

            .qr-label {
              padding: 4px 6px;
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
            }

            .label-text {
              font-size: 12pt;
              color: #000;
              line-height: 1.2;
            }

            .building-name {
              font-size: 21pt;
              color: #DC2626;
              font-weight: bold;
              line-height: 1.1;
              margin-top: 2px;
            }

            @media print {
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          ${Array.from({ length: Math.ceil(selected.length / qrsPerPage) }, (_, pageIndex) => {
            const pageQRs = selected.slice(pageIndex * qrsPerPage, (pageIndex + 1) * qrsPerPage);
            return `
              <div class="page">
                <div class="qr-grid">
                  ${pageQRs.map(client => `
                    <div class="qr-card">
                      <div class="qr-image-container">
                        <img src="${client.qrDataURL}" alt="QR ${client.building_name}" class="qr-image" />
                      </div>
                      <div class="qr-label">
                        <div class="label-text">Edificio:</div>
                        <div class="building-name">${client.building_name}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 250);
    };
  };

  const handleDownloadSelected = async () => {
    const selected = selectedClients();
    if (selected.length === 0) {
      alert('Por favor selecciona al menos un código QR para descargar');
      return;
    }

    for (const client of selected) {
      const link = document.createElement('a');
      link.href = client.qrDataURL;
      link.download = `QR-${client.building_name}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600">Cargando códigos QR...</div>
      </div>
    );
  }

  const filtered = filteredClients();

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <QrCode className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">Gestión de Códigos QR</h2>
          </div>
          <div className="text-sm text-slate-600">
            {clients.length} cliente{clients.length !== 1 ? 's' : ''} registrado{clients.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre de edificio o razón social..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tamaño de Papel
            </label>
            <select
              value={paperSize}
              onChange={(e) => setPaperSize(e.target.value as PaperSize)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="letter">Carta (8.5" x 11")</option>
              <option value="a4">A4 (210mm x 297mm)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-4">
            <button
              onClick={selectAll}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              <CheckSquare className="w-4 h-4" />
              Seleccionar Todos
            </button>
            <button
              onClick={deselectAll}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition text-sm"
            >
              <Square className="w-4 h-4" />
              Deseleccionar Todos
            </button>
          </div>
          <div className="text-sm text-slate-600">
            {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <button
            onClick={handlePrint}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-5 h-5" />
            Imprimir Seleccionados ({selectedIds.size})
          </button>
          <button
            onClick={handleDownloadSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            Descargar Seleccionados
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No se encontraron clientes con ese criterio de búsqueda
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {filtered.map((client) => (
              <div
                key={client.id}
                className="relative group cursor-pointer"
                onClick={() => toggleSelection(client.id)}
              >
                <div
                  className={`border-2 rounded-lg p-3 transition ${
                    selectedIds.has(client.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    <QRCard
                      qrDataURL={client.qrDataURL}
                      buildingName={client.building_name}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500 truncate">
                      {client.company_name}
                    </div>
                  </div>
                </div>

                {selectedIds.has(client.id) && (
                  <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-1">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
