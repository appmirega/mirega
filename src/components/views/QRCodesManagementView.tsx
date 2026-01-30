import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { QrCode, Plus, Download, AlertCircle, Printer, CheckSquare, Square } from 'lucide-react';
import QRCodeGenerator from 'qrcode';

interface Client {
  id: string;
  business_name: string;
  contact_name: string;
  address: string;
}

interface ClientQR {
  id: string;
  client_id: string;
  qr_code: string;
  created_at: string;
  clients: Client;
}

export function QRCodesManagementView() {
  const [clientsWithQR, setClientsWithQR] = useState<ClientQR[]>([]);
  const [clientsWithoutQR, setClientsWithoutQR] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [selectedQRs, setSelectedQRs] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [qrResult, clientsResult] = await Promise.all([
        supabase
          .from('mnt_client_qr_codes')
          .select('*, clients(id, business_name, contact_name, address)')
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('id, business_name, contact_name, address')
          .eq('is_active', true)
          .order('business_name'),
      ]);

      if (qrResult.error) throw qrResult.error;
      if (clientsResult.error) throw clientsResult.error;

      const withQR = qrResult.data || [];
      const allClients = clientsResult.data || [];

      const clientIdsWithQR = new Set(withQR.map(qr => qr.client_id));
      const withoutQR = allClients.filter(c => !clientIdsWithQR.has(c.id));

      setClientsWithQR(withQR);
      setClientsWithoutQR(withoutQR);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (clientId: string, businessName: string) => {
    setGenerating(clientId);
    try {
      const qrCode = `MIREGA-${clientId.substring(0, 8).toUpperCase()}`;

      const { error } = await supabase
        .from('mnt_client_qr_codes')
        .insert([{ client_id: clientId, qr_code: qrCode }]);

      if (error) throw error;

      alert(`Código QR generado exitosamente para ${businessName}`);
      loadData();
    } catch (error: any) {
      console.error('Error generating QR:', error);
      alert('Error al generar código QR: ' + error.message);
    } finally {
      setGenerating(null);
    }
  };

  const downloadQRImage = async (qrCode: string, businessName: string) => {
    try {
      const qrDataURL = await QRCodeGenerator.toDataURL(qrCode, {
        width: 400,
        margin: 2,
        color: {
          dark: '#1e293b',
          light: '#ffffff',
        },
      });

      const link = document.createElement('a');
      link.href = qrDataURL;
      link.download = `QR_${businessName.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading QR:', error);
      alert('Error al descargar código QR');
    }
  };

  const toggleQRSelection = (qrId: string) => {
    const newSelected = new Set(selectedQRs);
    if (newSelected.has(qrId)) {
      newSelected.delete(qrId);
    } else {
      newSelected.add(qrId);
    }
    setSelectedQRs(newSelected);
  };

  const selectAllQRs = () => {
    const allIds = new Set(clientsWithQR.map(item => item.id));
    setSelectedQRs(allIds);
  };

  const clearSelection = () => {
    setSelectedQRs(new Set());
  };

  const printSelectedQRs = async () => {
    if (selectedQRs.size === 0) {
      alert('Por favor selecciona al menos un código QR para imprimir');
      return;
    }

    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Por favor permite las ventanas emergentes para imprimir');
        return;
      }

      const selectedItems = clientsWithQR.filter(item => selectedQRs.has(item.id));

      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Códigos QR - Impresión</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            .qr-container {
              page-break-inside: avoid;
              margin-bottom: 40px;
              text-align: center;
              border: 2px solid #e2e8f0;
              padding: 20px;
              border-radius: 8px;
            }
            .qr-image {
              width: 300px;
              height: 300px;
              margin: 20px auto;
            }
            .client-name {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 10px;
              color: #1e293b;
            }
            .qr-code-text {
              font-size: 16px;
              font-family: monospace;
              color: #64748b;
              margin-top: 10px;
            }
            @media print {
              .qr-container {
                page-break-after: always;
              }
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
      `;

      for (const item of selectedItems) {
        const qrDataURL = await QRCodeGenerator.toDataURL(item.qr_code, {
          width: 300,
          margin: 2,
          color: {
            dark: '#1e293b',
            light: '#ffffff',
          },
        });

        htmlContent += `
          <div class="qr-container">
            <div class="client-name">${item.clients.business_name}</div>
            <img src="${qrDataURL}" alt="QR Code" class="qr-image" />
            <div class="qr-code-text">${item.qr_code}</div>
          </div>
        `;
      }

      htmlContent += `
        </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 500);

    } catch (error) {
      console.error('Error printing QRs:', error);
      alert('Error al preparar la impresión');
    }
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
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Gestión de Códigos QR</h1>
        <p className="text-slate-600 mt-1">Genera y administra códigos QR únicos para cada cliente</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <QrCode className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-900">{clientsWithQR.length}</p>
              <p className="text-sm text-blue-700">Con Código QR</p>
            </div>
          </div>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-orange-900">{clientsWithoutQR.length}</p>
              <p className="text-sm text-orange-700">Sin Código QR</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Plus className="w-8 h-8 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{clientsWithQR.length + clientsWithoutQR.length}</p>
              <p className="text-sm text-slate-700">Total Clientes</p>
            </div>
          </div>
        </div>
      </div>

      {clientsWithoutQR.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900">Clientes sin Código QR</h2>
            <p className="text-sm text-slate-600 mt-1">Genera códigos QR para estos clientes</p>
          </div>
          <div className="divide-y divide-slate-200">
            {clientsWithoutQR.map((client) => (
              <div key={client.id} className="p-6 flex items-center justify-between hover:bg-slate-50">
                <div>
                  <p className="font-semibold text-slate-900">{client.business_name}</p>
                  <p className="text-sm text-slate-600">{client.contact_name}</p>
                  <p className="text-xs text-slate-500">{client.address}</p>
                </div>
                <button
                  onClick={() => generateQRCode(client.id, client.business_name)}
                  disabled={generating === client.id}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating === client.id ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Generar QR
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Códigos QR Generados</h2>
              <p className="text-sm text-slate-600 mt-1">Selecciona códigos QR para imprimir</p>
            </div>
            {clientsWithQR.length > 0 && (
              <div className="flex items-center gap-3">
                {selectedQRs.size > 0 && (
                  <>
                    <span className="text-sm text-slate-600">
                      {selectedQRs.size} seleccionado{selectedQRs.size > 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={clearSelection}
                      className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    >
                      Limpiar
                    </button>
                  </>
                )}
                <button
                  onClick={selectAllQRs}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition text-sm"
                >
                  <CheckSquare className="w-4 h-4" />
                  Seleccionar Todos
                </button>
                <button
                  onClick={printSelectedQRs}
                  disabled={selectedQRs.size === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Seleccionados
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-12 px-6 py-3"></th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Contacto</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Código QR</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Creado</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {clientsWithQR.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <QrCode className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No hay códigos QR generados</p>
                    <p className="text-sm text-slate-500 mt-1">Genera códigos para los clientes</p>
                  </td>
                </tr>
              ) : (
                clientsWithQR.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleQRSelection(item.id)}
                        className="text-slate-600 hover:text-blue-600 transition"
                      >
                        {selectedQRs.has(item.id) ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{item.clients.business_name}</p>
                      <p className="text-xs text-slate-500">{item.clients.address}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{item.clients.contact_name}</td>
                    <td className="px-6 py-4">
                      <code className="px-2 py-1 bg-slate-100 text-slate-800 rounded text-sm font-mono">
                        {item.qr_code}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {new Date(item.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => downloadQRImage(item.qr_code, item.clients.business_name)}
                        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Descargar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3">Instrucciones de Uso</h3>
        <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
          <li>Genera un código QR único para cada cliente</li>
          <li>Descarga la imagen del código QR</li>
          <li>Imprime el código y entrégalo al cliente o colócalo en el edificio</li>
          <li>Los técnicos escanearán este código para iniciar los mantenimientos</li>
          <li>Un mismo código QR sirve para todos los ascensores del cliente</li>
        </ol>
      </div>
    </div>
  );
}
