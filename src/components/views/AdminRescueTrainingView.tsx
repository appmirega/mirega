import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  UserPlus,
  Users,
  FileText,
  Download,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  Award,
  BookOpen,
  Upload,
  X,
  Check,
} from 'lucide-react';

interface TrainingRequest {
  id: string;
  personnel_count: number;
  preferred_dates: string[];
  status: string;
  scheduled_date: string | null;
  notes: string | null;
  created_at: string;
  clients: {
    company_name: string;
    contact_name: string;
    email: string;
  };
}

interface Personnel {
  id: string;
  first_name: string;
  last_name: string;
  rut: string;
  position: string;
  status: string;
  created_at: string;
  clients: {
    company_name: string;
  };
  training_sessions: TrainingSession[];
}

interface TrainingSession {
  id: string;
  training_date: string;
  trainer_name: string;
  certification_issued: boolean;
}

interface TrainingDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  file_url: string;
  file_name: string;
  is_active: boolean;
}

type ViewTab = 'requests' | 'personnel' | 'documents';

export function AdminRescueTrainingView() {
  const [activeTab, setActiveTab] = useState<ViewTab>('requests');
  const [requests, setRequests] = useState<TrainingRequest[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [documents, setDocuments] = useState<TrainingDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TrainingRequest | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [scheduleForm, setScheduleForm] = useState({
    scheduled_date: '',
  });

  const [sessionForm, setSessionForm] = useState({
    training_date: '',
    trainer_name: '',
    duration_hours: 2,
    topics_covered: '',
    certification_issued: false,
  });

  const [documentForm, setDocumentForm] = useState({
    title: '',
    description: '',
    document_type: 'manual',
    file: null as File | null,
  });

  const [stats, setStats] = useState({
    pendingRequests: 0,
    scheduledRequests: 0,
    totalPersonnel: 0,
    certifiedPersonnel: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [requests, personnel]);

  const loadData = async () => {
    try {
      await Promise.all([loadRequests(), loadPersonnel(), loadDocuments()]);
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('rescue_training_requests')
        .select(`
          *,
          clients (
            company_name,
            contact_name,
            email
          )
        `)
        .order('created_at', { ascending: false});

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading requests:', error);
    }
  };

  const loadPersonnel = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const { data, error } = await supabase
        .from('rescue_training_personnel')
        .select(`
          *,
          clients (
            company_name
          ),
          training_sessions:rescue_training_sessions!rescue_training_sessions_personnel_id_fkey(
            id,
            training_date,
            trainer_name,
            certification_issued
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const personnelWithCurrentYear = (data || []).map((person) => ({
        ...person,
        training_sessions: person.training_sessions.filter((session: any) => {
          return session.training_date >= yearStart && session.training_date <= yearEnd;
        }),
      }));

      setPersonnel(personnelWithCurrentYear);
    } catch (error) {
      console.error('Error loading personnel:', error);
    }
  };

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('rescue_training_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const calculateStats = () => {
    const pending = requests.filter((r) => r.status === 'pending').length;
    const scheduled = requests.filter((r) => r.status === 'scheduled').length;
    const certified = personnel.filter((p) => p.training_sessions.length >= 3).length;

    setStats({
      pendingRequests: pending,
      scheduledRequests: scheduled,
      totalPersonnel: personnel.length,
      certifiedPersonnel: certified,
    });
  };

  const handleScheduleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('rescue_training_requests')
        .update({
          status: 'scheduled',
          scheduled_date: scheduleForm.scheduled_date,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      alert('Capacitación programada exitosamente');
      setShowScheduleModal(false);
      setSelectedRequest(null);
      setScheduleForm({ scheduled_date: '' });
      loadRequests();
    } catch (error: any) {
      console.error('Error scheduling request:', error);
      alert('Error al programar: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;

    setSubmitting(true);
    try {
      const topicsArray = sessionForm.topics_covered.split(',').map((t) => t.trim()).filter((t) => t);

      const { error } = await supabase
        .from('rescue_training_sessions')
        .insert({
          client_id: selectedPerson.clients ? (selectedPerson as any).client_id : null,
          personnel_id: selectedPerson.id,
          training_date: sessionForm.training_date,
          trainer_name: sessionForm.trainer_name,
          duration_hours: sessionForm.duration_hours,
          topics_covered: topicsArray,
          certification_issued: sessionForm.certification_issued,
        });

      if (error) throw error;

      alert('Sesión registrada exitosamente');
      setShowSessionModal(false);
      setSelectedPerson(null);
      setSessionForm({
        training_date: '',
        trainer_name: '',
        duration_hours: 2,
        topics_covered: '',
        certification_issued: false,
      });
      loadPersonnel();
    } catch (error: any) {
      console.error('Error adding session:', error);
      alert('Error al registrar sesión: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentForm.file) {
      alert('Selecciona un archivo');
      return;
    }

    setSubmitting(true);
    try {
      const fileExt = documentForm.file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('training-documents')
        .upload(fileName, documentForm.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('training-documents')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('rescue_training_documents')
        .insert({
          title: documentForm.title,
          description: documentForm.description || null,
          document_type: documentForm.document_type,
          file_url: publicUrl,
          file_name: documentForm.file.name,
          is_active: true,
        });

      if (insertError) throw insertError;

      alert('Documento subido exitosamente');
      setShowDocumentModal(false);
      setDocumentForm({
        title: '',
        description: '',
        document_type: 'manual',
        file: null,
      });
      loadDocuments();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      alert('Error al subir documento: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDocumentStatus = async (doc: TrainingDocument) => {
    try {
      const { error } = await supabase
        .from('rescue_training_documents')
        .update({ is_active: !doc.is_active })
        .eq('id', doc.id);

      if (error) throw error;
      loadDocuments();
    } catch (error) {
      console.error('Error toggling document:', error);
      alert('Error al actualizar documento');
    }
  };

  const getRequestStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getRequestStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'scheduled':
        return 'Programada';
      case 'completed':
        return 'Completada';
      default:
        return status;
    }
  };

  const getTrainingStatus = (person: Personnel) => {
    const sessions = person.training_sessions.length;
    if (sessions >= 3) return { label: 'Completo', color: 'bg-green-100 text-green-800' };
    if (sessions > 0) return { label: 'En Progreso', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'Pendiente', color: 'bg-red-100 text-red-800' };
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
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Capacitaciones</h1>
          <p className="text-slate-600 mt-1">Administración de inducciones de rescate</p>
        </div>
        <button
          onClick={() => setShowDocumentModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Upload className="w-4 h-4" />
          Subir Documento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <Clock className="w-5 h-5 text-yellow-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.pendingRequests}</p>
          <p className="text-sm text-slate-600">Solicitudes Pendientes</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <Calendar className="w-5 h-5 text-blue-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.scheduledRequests}</p>
          <p className="text-sm text-slate-600">Programadas</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <Users className="w-5 h-5 text-slate-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.totalPersonnel}</p>
          <p className="text-sm text-slate-600">Total Personal</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <Award className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-slate-900">{stats.certifiedPersonnel}</p>
          <p className="text-sm text-slate-600">Certificados</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'requests'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Solicitudes
              </div>
            </button>
            <button
              onClick={() => setActiveTab('personnel')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'personnel'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Personal
              </div>
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-6 py-4 font-medium transition ${
                activeTab === 'documents'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Documentos
              </div>
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'requests' && (
            <div className="space-y-4">
              {requests.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay solicitudes</p>
                </div>
              ) : (
                requests.map((request) => (
                  <div
                    key={request.id}
                    className="border border-slate-200 rounded-lg p-6 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-bold text-slate-900">
                            {request.clients.company_name}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${getRequestStatusColor(
                              request.status
                            )}`}
                          >
                            {getRequestStatusLabel(request.status)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">
                          Personal a capacitar: {request.personnel_count}
                        </p>
                        {request.preferred_dates.length > 0 && (
                          <p className="text-sm text-slate-600 mb-2">
                            Fechas preferidas: {request.preferred_dates.join(', ')}
                          </p>
                        )}
                        {request.scheduled_date && (
                          <p className="text-sm text-green-700 font-medium mb-2">
                            Programado para: {new Date(request.scheduled_date).toLocaleDateString('es-ES')}
                          </p>
                        )}
                        {request.notes && (
                          <p className="text-sm text-slate-600 italic">{request.notes}</p>
                        )}
                      </div>
                      {request.status === 'pending' && (
                        <button
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowScheduleModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                        >
                          <Calendar className="w-4 h-4" />
                          Programar
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'personnel' && (
            <div className="space-y-4">
              {personnel.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay personal registrado</p>
                </div>
              ) : (
                personnel.map((person) => {
                  const status = getTrainingStatus(person);
                  return (
                    <div
                      key={person.id}
                      className="border border-slate-200 rounded-lg p-6 hover:border-slate-300 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-bold text-slate-900">
                              {person.first_name} {person.last_name}
                            </h3>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-1">
                            {person.clients.company_name} - {person.position}
                          </p>
                          <p className="text-sm text-slate-600 mb-3">RUT: {person.rut}</p>
                          <p className="text-sm font-medium text-slate-700">
                            Capacitaciones: {person.training_sessions.length}/3
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPerson(person);
                            setShowSessionModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Registrar Sesión
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              {documents.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600 font-medium">No hay documentos</p>
                </div>
              ) : (
                documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="border border-slate-200 rounded-lg p-6 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <FileText className="w-5 h-5 text-blue-600 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 mb-1">{doc.title}</h3>
                          {doc.description && (
                            <p className="text-sm text-slate-600 mb-2">{doc.description}</p>
                          )}
                          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            {doc.document_type}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => window.open(doc.file_url, '_blank')}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleDocumentStatus(doc)}
                          className={`px-3 py-2 rounded-lg transition text-sm ${
                            doc.is_active
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-slate-600 text-white hover:bg-slate-700'
                          }`}
                        >
                          {doc.is_active ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showScheduleModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Programar Capacitación</h3>

            <form onSubmit={handleScheduleRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fecha *</label>
                <input
                  type="date"
                  required
                  value={scheduleForm.scheduled_date}
                  onChange={(e) => setScheduleForm({ scheduled_date: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleModal(false);
                    setSelectedRequest(null);
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Programando...' : 'Programar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSessionModal && selectedPerson && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Registrar Sesión de Capacitación</h3>

            <form onSubmit={handleAddSession} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={sessionForm.training_date}
                    onChange={(e) => setSessionForm({ ...sessionForm, training_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Duración (horas)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={sessionForm.duration_hours}
                    onChange={(e) =>
                      setSessionForm({ ...sessionForm, duration_hours: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Instructor *</label>
                <input
                  type="text"
                  required
                  value={sessionForm.trainer_name}
                  onChange={(e) => setSessionForm({ ...sessionForm, trainer_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Temas cubiertos (separados por coma)
                </label>
                <textarea
                  value={sessionForm.topics_covered}
                  onChange={(e) => setSessionForm({ ...sessionForm, topics_covered: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="certification"
                  checked={sessionForm.certification_issued}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, certification_issued: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="certification" className="text-sm font-medium text-slate-700">
                  Certificación emitida
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSessionModal(false);
                    setSelectedPerson(null);
                  }}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Registrando...' : 'Registrar Sesión'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDocumentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Subir Documento</h3>

            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Título *</label>
                <input
                  type="text"
                  required
                  value={documentForm.title}
                  onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label>
                <textarea
                  value={documentForm.description}
                  onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo *</label>
                <select
                  value={documentForm.document_type}
                  onChange={(e) => setDocumentForm({ ...documentForm, document_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="manual">Manual</option>
                  <option value="procedure">Procedimiento</option>
                  <option value="responsibility_form">Formulario de Responsabilidad</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Archivo PDF *</label>
                <input
                  type="file"
                  required
                  accept=".pdf"
                  onChange={(e) => setDocumentForm({ ...documentForm, file: e.target.files?.[0] || null })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDocumentModal(false)}
                  disabled={submitting}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
