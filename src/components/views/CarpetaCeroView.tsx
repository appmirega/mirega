import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  FolderOpen,
  Upload,
  Download,
  FileText,
  Trash2,
  Search,
  Filter,
  Eye,
} from 'lucide-react';

interface LegalDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  elevator_id: string | null;
  elevators: {
    location_name: string;
  } | null;
}

interface Elevator {
  id: string;
  location_name: string;
}

export function CarpetaCeroView() {
  const { profile } = useAuth();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<LegalDocument[]>([]);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedElevator, setSelectedElevator] = useState<string>('all');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    document_type: 'mechanical_plans',
    elevator_id: '',
    file: null as File | null,
  });

  const canUpload = profile?.role === 'admin' || profile?.role === 'developer' || profile?.role === 'client';

  const documentTypes = [
    { value: 'mechanical_plans', label: 'Planos Mecánicos' },
    { value: 'electrical_plans', label: 'Planos Eléctricos' },
    { value: 'assembly_plans', label: 'Planos de Montaje' },
    { value: 'municipal_permits', label: 'Permisos Municipales' },
    { value: 'contracts', label: 'Contratos' },
    { value: 'certifications', label: 'Certificaciones' },
    { value: 'other', label: 'Otros' },
  ];

  useEffect(() => {
    if (profile?.id) {
      loadData();
    }
  }, [profile]);

  useEffect(() => {
    filterDocuments();
  }, [searchTerm, selectedType, selectedElevator, documents]);

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

      const [docsResult, elevatorsResult] = await Promise.all([
        supabase
          .from('legal_documents')
          .select(`
            *,
            elevators (
              location_name
            )
          `)
          .eq('client_id', client.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('elevators')
          .select('id, location_name')
          .eq('client_id', client.id)
          .order('location_name'),
      ]);

      if (docsResult.error) throw docsResult.error;
      if (elevatorsResult.error) throw elevatorsResult.error;

      setDocuments(docsResult.data || []);
      setElevators(elevatorsResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = documents;

    if (searchTerm) {
      filtered = filtered.filter(
        doc =>
          doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(doc => doc.document_type === selectedType);
    }

    if (selectedElevator !== 'all') {
      filtered = filtered.filter(doc => doc.elevator_id === selectedElevator);
    }

    setFilteredDocuments(filtered);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) {
      alert('Por favor selecciona un archivo');
      return;
    }

    setUploading(true);
    try {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', profile?.id)
        .maybeSingle();

      if (!client) throw new Error('Cliente no encontrado');

      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${client.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('legal-documents')
        .upload(fileName, uploadForm.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('legal-documents')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('legal_documents')
        .insert({
          client_id: client.id,
          elevator_id: uploadForm.elevator_id || null,
          title: uploadForm.title,
          description: uploadForm.description || null,
          document_type: uploadForm.document_type,
          file_url: publicUrl,
          file_name: uploadForm.file.name,
          file_size: uploadForm.file.size,
          uploaded_by: profile?.id,
        });

      if (insertError) throw insertError;

      alert('Documento subido exitosamente');
      setShowUploadModal(false);
      setUploadForm({
        title: '',
        description: '',
        document_type: 'mechanical_plans',
        elevator_id: '',
        file: null,
      });
      loadData();
    } catch (error: any) {
      console.error('Error uploading document:', error);
      alert('Error al subir documento: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: LegalDocument) => {
    if (!confirm(`¿Estás seguro de eliminar "${doc.title}"?`)) return;

    try {
      const fileName = doc.file_url.split('/').pop();
      if (fileName) {
        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('profile_id', profile?.id)
          .maybeSingle();

        if (client) {
          await supabase.storage
            .from('legal-documents')
            .remove([`${client.id}/${fileName}`]);
        }
      }

      const { error } = await supabase
        .from('legal_documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      alert('Documento eliminado');
      loadData();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      alert('Error al eliminar: ' + error.message);
    }
  };

  const downloadDocument = (doc: LegalDocument) => {
    window.open(doc.file_url, '_blank');
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  };

  const getTypeLabel = (type: string) => {
    return documentTypes.find(t => t.value === type)?.label || type;
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
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FolderOpen className="w-8 h-8" />
            Carpeta Cero
          </h1>
          <p className="text-slate-600 mt-1">
            Documentación legal y técnica de los ascensores
          </p>
        </div>
        {canUpload && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Upload className="w-4 h-4" />
            Subir Documento
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Buscar
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título o descripción..."
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Tipo de Documento
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los tipos</option>
              {documentTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ascensor
            </label>
            <select
              value={selectedElevator}
              onChange={(e) => setSelectedElevator(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los ascensores</option>
              <option value="general">General (sin ascensor específico)</option>
              {elevators.map(elevator => (
                <option key={elevator.id} value={elevator.id}>
                  {elevator.location_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">No hay documentos</p>
          <p className="text-sm text-slate-500 mt-1">
            {documents.length === 0
              ? 'Sube documentos para comenzar'
              : 'Prueba cambiando los filtros de búsqueda'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:border-slate-300 transition"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 mb-1 truncate">{doc.title}</h3>
                  <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                    {getTypeLabel(doc.document_type)}
                  </span>
                </div>
              </div>

              {doc.description && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{doc.description}</p>
              )}

              <div className="space-y-2 mb-4 text-sm text-slate-600">
                {doc.elevators && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Ascensor:</span>
                    <span>{doc.elevators.location_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="font-medium">Tamaño:</span>
                  <span>{formatFileSize(doc.file_size)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Subido:</span>
                  <span>{new Date(doc.created_at).toLocaleDateString('es-ES')}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => downloadDocument(doc)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                >
                  <Download className="w-4 h-4" />
                  Descargar
                </button>
                {canUpload && (
                  <button
                    onClick={() => handleDelete(doc)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Subir Documento</h3>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de Documento *
                </label>
                <select
                  value={uploadForm.document_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, document_type: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {documentTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ascensor (opcional)
                </label>
                <select
                  value={uploadForm.elevator_id}
                  onChange={(e) => setUploadForm({ ...uploadForm, elevator_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">General (no específico)</option>
                  {elevators.map(elevator => (
                    <option key={elevator.id} value={elevator.id}>
                      {elevator.location_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Archivo PDF *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf"
                  onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">Solo archivos PDF</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {uploading ? 'Subiendo...' : 'Subir Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3">Acerca de Carpeta Cero</h3>
        <p className="text-sm text-blue-800 mb-3">
          La Carpeta Cero es un repositorio digital que contiene toda la documentación legal y técnica
          relacionada con tus ascensores.
        </p>
        <ul className="space-y-2 text-sm text-blue-800 list-disc list-inside">
          <li>Planos mecánicos, eléctricos y de montaje</li>
          <li>Permisos y certificaciones municipales</li>
          <li>Contratos de mantenimiento y servicios</li>
          <li>Certificaciones de seguridad</li>
          <li>Cualquier otra documentación relevante</li>
        </ul>
      </div>
    </div>
  );
}
