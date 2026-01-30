import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, FileText, Calendar, Mail, Search, Filter, Check, X } from 'lucide-react';
import { generateMaintenancePDF, generatePDFFilename } from '../../utils/pdfGenerator';

interface PDFRecord {
  id: string;
  folio_number: number;
  file_name: string;
  sent_at: string | null;
  created_at: string;
  checklist: {
    month: number;
    year: number;
    completion_date: string;
    last_certification_date: string | null;
    next_certification_date: string | null;
    certification_not_legible: boolean;
    clients: {
      business_name: string;
      address: string;
      contact_name: string;
      email: string;
    };
    elevators: {
      brand: string;
      model: string;
      serial_number: string;
      is_hydraulic: boolean;
    };
    profiles: {
      full_name: string;
      email: string;
    };
  };
  signature: {
    signer_name: string;
    signature_data: string;
    signed_at: string;
  };
}

export function PDFHistoryView() {
  const [pdfs, setPdfs] = useState<PDFRecord[]>([]);
  const [filteredPdfs, setFilteredPdfs] = useState<PDFRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSent, setFilterSent] = useState<'all' | 'sent' | 'not_sent'>('all');

  useEffect(() => {
    loadPDFs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterSent, pdfs]);

  const loadPDFs = async () => {
    try {
      const { data, error } = await supabase
        .from('mnt_maintenance_pdfs')
        .select(`
          *,
          checklist:mnt_checklists!inner (
            month,
            year,
            completion_date,
            last_certification_date,
            next_certification_date,
            certification_not_legible,
            clients (
              business_name,
              address,
              contact_name,
              email
            ),
            elevators (
              brand,
              model,
              serial_number,
              is_hydraulic
            ),
            profiles:profiles!mnt_checklists_technician_id_fkey (
              full_name,
              email
            )
          ),
          signature:mnt_checklist_signatures!inner (
            signer_name,
            signature_data,
            signed_at
          )
        `)
        .order('folio_number', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map((item) => ({
        id: item.id,
        folio_number: item.folio_number,
        file_name: item.file_name,
        sent_at: item.sent_at,
        created_at: item.created_at,
        checklist: Array.isArray(item.checklist) ? item.checklist[0] : item.checklist,
        signature: Array.isArray(item.signature) ? item.signature[0] : item.signature,
      })) || [];

      setPdfs(formattedData);
    } catch (error) {
      console.error('Error loading PDFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...pdfs];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (pdf) =>
          pdf.checklist.clients?.business_name.toLowerCase().includes(term) ||
          pdf.checklist.elevators?.brand.toLowerCase().includes(term) ||
          pdf.checklist.elevators?.model.toLowerCase().includes(term) ||
          pdf.folio_number.toString().includes(term)
      );
    }

    if (filterSent === 'sent') {
      filtered = filtered.filter((pdf) => pdf.sent_at !== null);
    } else if (filterSent === 'not_sent') {
      filtered = filtered.filter((pdf) => pdf.sent_at === null);
    }

    setFilteredPdfs(filtered);
  };

  const handleDownloadPDF = async (pdfRecord: PDFRecord) => {
    setDownloading(pdfRecord.id);
    try {
      const { data: answers } = await supabase
        .from('mnt_checklist_answers')
        .select('*, mnt_checklist_questions(*)')
        .eq('checklist_id', pdfRecord.checklist.id);

      const questionsWithAnswers = answers?.map((a) => ({
        question_number: a.mnt_checklist_questions.question_number,
        section: a.mnt_checklist_questions.section,
        question_text: a.mnt_checklist_questions.question_text,
        answer_status: a.status,
        observations: a.observations,
      })).filter(q => q.answer_status !== 'pending') || [];

      const pdfBlob = await generateMaintenancePDF({
        folio: pdfRecord.folio_number,
        client: {
          business_name: pdfRecord.checklist.clients.business_name,
          address: pdfRecord.checklist.clients.address,
          contact_name: pdfRecord.checklist.clients.contact_name,
        },
        elevator: {
          brand: pdfRecord.checklist.elevators.brand,
          model: pdfRecord.checklist.elevators.model,
          serial_number: pdfRecord.checklist.elevators.serial_number,
          is_hydraulic: pdfRecord.checklist.elevators.is_hydraulic,
        },
        checklist: {
          month: pdfRecord.checklist.month,
          year: pdfRecord.checklist.year,
          last_certification_date: pdfRecord.checklist.last_certification_date,
          next_certification_date: pdfRecord.checklist.next_certification_date,
          certification_not_legible: pdfRecord.checklist.certification_not_legible,
          completion_date: pdfRecord.checklist.completion_date,
        },
        technician: {
          full_name: pdfRecord.checklist.profiles.full_name,
          email: pdfRecord.checklist.profiles.email,
        },
        questions: questionsWithAnswers,
        signature: {
          signer_name: pdfRecord.signature.signer_name,
          signature_data: pdfRecord.signature.signature_data,
          signed_at: pdfRecord.signature.signed_at,
        },
      });

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdfRecord.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar el PDF');
    } finally {
      setDownloading(null);
    }
  };

  const handleResendEmail = async (pdfRecord: PDFRecord) => {
    const confirm = window.confirm(
      `¿Reenviar correo a ${pdfRecord.checklist.clients.email}?`
    );

    if (!confirm) return;

    setResending(pdfRecord.id);
    try {
      const { data: answers } = await supabase
        .from('mnt_checklist_answers')
        .select('*, mnt_checklist_questions(*)')
        .eq('checklist_id', pdfRecord.checklist.id);

      const questionsWithAnswers = answers?.map((a) => ({
        question_number: a.mnt_checklist_questions.question_number,
        section: a.mnt_checklist_questions.section,
        question_text: a.mnt_checklist_questions.question_text,
        answer_status: a.status,
        observations: a.observations,
      })).filter(q => q.answer_status !== 'pending') || [];

      const pdfBlob = await generateMaintenancePDF({
        folio: pdfRecord.folio_number,
        client: {
          business_name: pdfRecord.checklist.clients.business_name,
          address: pdfRecord.checklist.clients.address,
          contact_name: pdfRecord.checklist.clients.contact_name,
        },
        elevator: {
          brand: pdfRecord.checklist.elevators.brand,
          model: pdfRecord.checklist.elevators.model,
          serial_number: pdfRecord.checklist.elevators.serial_number,
          is_hydraulic: pdfRecord.checklist.elevators.is_hydraulic,
        },
        checklist: {
          month: pdfRecord.checklist.month,
          year: pdfRecord.checklist.year,
          last_certification_date: pdfRecord.checklist.last_certification_date,
          next_certification_date: pdfRecord.checklist.next_certification_date,
          certification_not_legible: pdfRecord.checklist.certification_not_legible,
          completion_date: pdfRecord.checklist.completion_date,
        },
        technician: {
          full_name: pdfRecord.checklist.profiles.full_name,
          email: pdfRecord.checklist.profiles.email,
        },
        questions: questionsWithAnswers,
        signature: {
          signer_name: pdfRecord.signature.signer_name,
          signature_data: pdfRecord.signature.signature_data,
          signed_at: pdfRecord.signature.signed_at,
        },
      });

      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64 = base64data.split(',')[1];

        const response = await fetch(
          `${import.meta.env.VITE_DATABASE_URL}/functions/v1/send-maintenance-report`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_DATABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: pdfRecord.checklist.clients.email,
              clientName: pdfRecord.checklist.clients.business_name,
              elevatorInfo: `${pdfRecord.checklist.elevators.brand} ${pdfRecord.checklist.elevators.model}`,
              period: `${pdfRecord.checklist.month}/${pdfRecord.checklist.year}`,
              folio: pdfRecord.folio_number,
              pdfBase64: base64,
              fileName: pdfRecord.file_name,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Error al enviar el correo');
        }

        await supabase
          .from('mnt_maintenance_pdfs')
          .update({ sent_at: new Date().toISOString() })
          .eq('id', pdfRecord.id);

        alert('Correo reenviado exitosamente');
        loadPDFs();
      };
    } catch (error) {
      console.error('Error resending email:', error);
      alert('Error al reenviar el correo');
    } finally {
      setResending(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const stats = {
    total: pdfs.length,
    sent: pdfs.filter((p) => p.sent_at !== null).length,
    pending: pdfs.filter((p) => p.sent_at === null).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Histórico de PDFs</h1>
        <p className="text-slate-600 mt-1">Descarga y gestiona reportes de mantenimiento</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-600">Total PDFs</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setFilterSent(filterSent === 'sent' ? 'all' : 'sent')}
          className={`bg-white border-2 rounded-lg p-4 text-left transition hover:shadow-lg ${
            filterSent === 'sent' ? 'border-green-500 ring-2 ring-green-200' : 'border-green-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <Check className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{stats.sent}</p>
              <p className="text-sm text-green-700">Enviados</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setFilterSent(filterSent === 'not_sent' ? 'all' : 'not_sent')}
          className={`bg-white border-2 rounded-lg p-4 text-left transition hover:shadow-lg ${
            filterSent === 'not_sent' ? 'border-amber-500 ring-2 ring-amber-200' : 'border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <X className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-2xl font-bold text-amber-900">{stats.pending}</p>
              <p className="text-sm text-amber-700">Pendientes</p>
            </div>
          </div>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, folio, marca o modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => setFilterSent('all')}
            className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
              filterSent === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Filter className="w-5 h-5" />
            Todos
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Folio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ascensor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Periodo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Generado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Enviado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPdfs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No se encontraron PDFs</p>
                  </td>
                </tr>
              ) : (
                filteredPdfs.map((pdf) => (
                  <tr key={pdf.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <span className="font-mono font-bold text-blue-600">
                        {String(pdf.folio_number).padStart(6, '0')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{pdf.checklist.clients.business_name}</p>
                      <p className="text-xs text-slate-500">{pdf.checklist.clients.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-900">
                        {pdf.checklist.elevators.brand} {pdf.checklist.elevators.model}
                      </p>
                      <p className="text-xs text-slate-500 font-mono">{pdf.checklist.elevators.serial_number}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {pdf.checklist.month}/{pdf.checklist.year}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {new Date(pdf.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-4">
                      {pdf.sent_at ? (
                        <div>
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            Enviado
                          </span>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(pdf.sent_at).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownloadPDF(pdf)}
                          disabled={downloading === pdf.id}
                          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                          title="Descargar PDF"
                        >
                          {downloading === pdf.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleResendEmail(pdf)}
                          disabled={resending === pdf.id}
                          className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                          title="Reenviar correo"
                        >
                          {resending === pdf.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <Mail className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
