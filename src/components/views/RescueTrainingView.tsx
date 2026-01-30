import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
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
} from 'lucide-react';

interface Personnel {
  id: string;
  first_name: string;
  last_name: string;
  rut: string;
  position: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  training_sessions: TrainingSession[];
}

interface TrainingSession {
  id: string;
  training_date: string;
  trainer_name: string;
  duration_hours: number;
  certification_issued: boolean;
  certificate_url: string | null;
}

interface TrainingDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  file_url: string;
  file_name: string;
}

export function RescueTrainingView() {
  const { profile } = useAuth();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [documents, setDocuments] = useState<TrainingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newPerson, setNewPerson] = useState({
    first_name: '',
    last_name: '',
    rut: '',
    position: '',
    email: '',
    phone: '',
  });

  const [trainingRequest, setTrainingRequest] = useState({
    personnel_count: 1,
    preferred_dates: '',
    notes: '',
  });

  const isAdmin = profile?.role === 'admin' || profile?.role === 'developer';

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', profile?.id)
        .maybeSingle();

      if (!client) {
        setLoading(false);
        return;
      }

      const currentYear = new Date().getFullYear();
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const { data: personnelData, error: personnelError } = await supabase
        .from('rescue_training_personnel')
        .select(`
          *,
          training_sessions:rescue_training_sessions!rescue_training_sessions_personnel_id_fkey(
            id,
            training_date,
            trainer_name,
            duration_hours,
            certification_issued,
            certificate_url
          )
        `)
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });

      if (personnelError) throw personnelError;

      const personnelWithCurrentYearSessions = (personnelData || []).map(person => ({
        ...person,
        training_sessions: person.training_sessions.filter((session: any) => {
          const sessionDate = session.training_date;
          return sessionDate >= yearStart && sessionDate <= yearEnd;
        }),
      }));

      setPersonnel(personnelWithCurrentYearSessions);

      const { data: docsData, error: docsError } = await supabase
        .from('rescue_training_documents')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (docsError) throw docsError;
      setDocuments(docsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', profile?.id)
        .maybeSingle();

      if (!client) throw new Error('Cliente no encontrado');

      const { error } = await supabase
        .from('rescue_training_personnel')
        .insert({
          client_id: client.id,
          first_name: newPerson.first_name,
          last_name: newPerson.last_name,
          rut: newPerson.rut,
          position: newPerson.position,
          email: newPerson.email || null,
          phone: newPerson.phone || null,
        });

      if (error) throw error;

      alert('Personal agregado exitosamente. Se notificará al administrador.');
      setShowAddModal(false);
      setNewPerson({
        first_name: '',
        last_name: '',
        rut: '',
        position: '',
        email: '',
        phone: '',
      });
      loadData();
    } catch (error: any) {
      console.error('Error adding personnel:', error);
      alert('Error al agregar personal: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestTraining = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', profile?.id)
        .maybeSingle();

      if (!client) throw new Error('Cliente no encontrado');

      const datesArray = trainingRequest.preferred_dates
        .split(',')
        .map(d => d.trim())
        .filter(d => d);

      const { error } = await supabase
        .from('rescue_training_requests')
        .insert({
          client_id: client.id,
          personnel_count: trainingRequest.personnel_count,
          preferred_dates: datesArray,
          notes: trainingRequest.notes || null,
        });

      if (error) throw error;

      alert('Solicitud enviada. El administrador se contactará para coordinar.');
      setShowRequestModal(false);
      setTrainingRequest({
        personnel_count: 1,
        preferred_dates: '',
        notes: '',
      });
    } catch (error: any) {
      console.error('Error requesting training:', error);
      alert('Error al solicitar capacitación: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getTrainingStatus = (person: Personnel) => {
    const sessions = person.training_sessions.length;
    const required = 3;
    const pending = Math.max(0, required - sessions);

    if (sessions >= required) {
      return {
        status: 'complete',
        label: 'Completo',
        color: 'bg-green-100 text-green-800 border-green-200',
        message: 'Sin capacitaciones pendientes',
      };
    } else if (sessions > 0) {
      return {
        status: 'partial',
        label: 'En Progreso',
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        message: `${pending} capacitación${pending > 1 ? 'es' : ''} pendiente${pending > 1 ? 's' : ''}`,
      };
    } else {
      return {
        status: 'pending',
        label: 'Pendiente',
        color: 'bg-red-100 text-red-800 border-red-200',
        message: '3 capacitaciones pendientes',
      };
    }
  };

  const downloadDocument = (doc: TrainingDocument) => {
    window.open(doc.file_url, '_blank');
  };

  const getDocumentTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      manual: 'Manual',
      procedure: 'Procedimiento',
      responsibility_form: 'Formulario de Responsabilidad',
      other: 'Otro',
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const stats = {
    total: personnel.length,
    complete: personnel.filter(p => getTrainingStatus(p).status === 'complete').length,
    partial: personnel.filter(p => getTrainingStatus(p).status === 'partial').length,
    pending: personnel.filter(p => getTrainingStatus(p).status === 'pending').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Award className="w-8 h-8" />
            Inducción de Rescate
          </h1>
          <p className="text-slate-600 mt-1">
            Gestión de capacitaciones de maniobras de rescate
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Ingreso
          </button>
          <button
            onClick={() => setShowRequestModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Calendar className="w-4 h-4" />
            Solicitar Capacitación
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-slate-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-600">Total Personal</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.complete}</p>
              <p className="text-sm text-slate-600">Completos</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.partial}</p>
              <p className="text-sm text-slate-600">En Progreso</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.pending}</p>
              <p className="text-sm text-slate-600">Pendientes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Personal Capacitado
            </h2>
          </div>

          {personnel.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">No hay personal registrado</p>
              <p className="text-sm text-slate-500 mt-1">Agrega personal para capacitación</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {personnel.map((person) => {
                const status = getTrainingStatus(person);
                return (
                  <div key={person.id} className="p-6 hover:bg-slate-50 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 text-lg">
                          {person.first_name} {person.last_name}
                        </h3>
                        <p className="text-sm text-slate-600">{person.position}</p>
                        <p className="text-xs text-slate-500">RUT: {person.rut}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">Progreso Anual</span>
                        <span className="text-sm font-bold text-slate-900">
                          {person.training_sessions.length}/3 capacitaciones
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            person.training_sessions.length >= 3
                              ? 'bg-green-500'
                              : person.training_sessions.length > 0
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${(person.training_sessions.length / 3) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-slate-600 mt-2">{status.message}</p>
                    </div>

                    {person.training_sessions.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700 mb-2">
                          Capacitaciones realizadas este año:
                        </p>
                        {person.training_sessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between text-xs bg-green-50 border border-green-200 rounded p-2"
                          >
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              <span className="text-green-900">
                                {new Date(session.training_date).toLocaleDateString('es-ES')}
                              </span>
                              <span className="text-green-700">- {session.trainer_name}</span>
                            </div>
                            {session.certification_issued && (
                              <Award className="w-3 h-3 text-green-600" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Documentos de Capacitación
            </h2>
          </div>

          {documents.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">No hay documentos disponibles</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {documents.map((doc) => (
                <div key={doc.id} className="p-6 hover:bg-slate-50 transition">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-100 p-3 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 mb-1">{doc.title}</h3>
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        {getDocumentTypeLabel(doc.document_type)}
                      </span>
                      {doc.description && (
                        <p className="text-sm text-slate-600 mt-2">{doc.description}</p>
                      )}
                      <button
                        onClick={() => downloadDocument(doc)}
                        className="flex items-center gap-2 mt-3 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Descargar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Nuevo Ingreso para Capacitación</h3>

            <form onSubmit={handleAddPerson} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nombres *</label>
                  <input
                    type="text"
                    required
                    value={newPerson.first_name}
                    onChange={(e) => setNewPerson({ ...newPerson, first_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={newPerson.last_name}
                    onChange={(e) => setNewPerson({ ...newPerson, last_name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">RUT *</label>
                  <input
                    type="text"
                    required
                    value={newPerson.rut}
                    onChange={(e) => setNewPerson({ ...newPerson, rut: e.target.value })}
                    placeholder="12.345.678-9"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Cargo *</label>
                  <input
                    type="text"
                    required
                    value={newPerson.position}
                    onChange={(e) => setNewPerson({ ...newPerson, position: e.target.value })}
                    placeholder="Ej: Conserje"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newPerson.email}
                    onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label>
                  <input
                    type="tel"
                    value={newPerson.phone}
                    onChange={(e) => setNewPerson({ ...newPerson, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Al agregar personal, se enviará una notificación al administrador para coordinar la fecha de
                  capacitación.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                  {submitting ? 'Agregando...' : 'Agregar Personal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Solicitar Capacitación</h3>

            <form onSubmit={handleRequestTraining} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Cantidad de Personal *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={trainingRequest.personnel_count}
                  onChange={(e) =>
                    setTrainingRequest({ ...trainingRequest, personnel_count: parseInt(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fechas Preferidas (separadas por coma)
                </label>
                <input
                  type="text"
                  value={trainingRequest.preferred_dates}
                  onChange={(e) => setTrainingRequest({ ...trainingRequest, preferred_dates: e.target.value })}
                  placeholder="Ej: 15 de enero, 22 de enero"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notas Adicionales</label>
                <textarea
                  value={trainingRequest.notes}
                  onChange={(e) => setTrainingRequest({ ...trainingRequest, notes: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  El administrador revisará tu solicitud y se contactará para coordinar la capacitación.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
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
                  {submitting ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3">Requisitos Anuales de Capacitación</h3>
        <p className="text-sm text-blue-800 mb-3">
          Cada persona debe completar 3 capacitaciones al año para estar al día con las normativas de
          seguridad.
        </p>
        <ul className="space-y-2 text-sm text-blue-800 list-disc list-inside">
          <li>Las capacitaciones son obligatorias para todo el personal de edificio</li>
          <li>Se entregan certificados al completar cada capacitación</li>
          <li>Los manuales están disponibles para descargar en cualquier momento</li>
          <li>Las capacitaciones incluyen maniobras de rescate y procedimientos de emergencia</li>
        </ul>
      </div>
    </div>
  );
}
