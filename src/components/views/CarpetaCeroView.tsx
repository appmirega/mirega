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
  const { profile, selectedClientId } = useAuth();
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

  const canUpload =
    profile?.role === 'admin' || profile?.role === 'developer' || profile?.role === 'client';

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
    if (selectedClientId) {
      loadData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  useEffect(() => {
    filterDocuments();
  }, [searchTerm, selectedType, selectedElevator, documents]);

  const loadData = async () => {
    if (!selectedClientId) return;

    try {
      setLoading(true);

      const [docsResult, elevatorsResult] = await Promise.all([
        supabase
          .from('legal_documents')
          .select(`
            *,
            elevators (
              location_name
            )
          `)
          .eq('client_id', selectedClientId)
          .order('created_at', { ascending: false }),
        supabase
          .from('elevators')
          .select('id, location_name')
          .eq('client_id', selectedClientId)
          .order('location_name'),
      ]);

      if (docsResult.error) throw docsResult.error;
      if (elevatorsResult.error) throw elevatorsResult.error;

      setDocuments((docsResult.data as LegalDocument[]) || []);
      setElevators((elevatorsResult.data as Elevator[]) || []);
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
        (doc) =>
          doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          doc.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter((doc) => doc.document_type === selectedType);
    }

    if (selectedElevator !== 'all') {
      filtered = filtered.filter((doc) => doc.elevator_id === selectedElevator);
    }

    setFilteredDocuments(filtered);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !selectedClientId) {
      alert('Por favor selecciona un archivo');
      return;
    }

    setUploading(true);
    try {
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${selectedClientId}/${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('legal-documents')
        .upload(fileName, uploadForm.file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('legal-documents').getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('legal_documents').insert({
        client_id: selectedClientId,
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
    if (!selectedClientId) return;

    try {
      const fileName = doc.file_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('legal-documents')
          .remove([`${selectedClientId}/${fileName}`]);
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
    return documentTypes.find((t) => t.value === type)?.label || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!selectedClientId) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
        <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600 font-medium">No hay edificio seleccionado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Carpeta Cero</h1>
          <p className="text-slate-600 mt-1">
            Documentación legal, técnica y municipal asociada al edificio
          </p>
        </div>

        {canUpload && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            <Upload className="w-4 h-4" />
            Subir Documento
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Buscar por título o descripción"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          />

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="all">Todos los tipos</option>
            {documentTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <select
            value={selectedElevator}
            onChange={(e) => setSelectedElevator(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="all">Todos los ascensores</option>
            {elevators.map((elevator) => (
              <option key={elevator.id} value={elevator.id}>
                {elevator.location_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No hay documentos cargados</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{doc.title}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {getTypeLabel(doc.document_type)}
                    {doc.elevators?.location_name ? ` · ${doc.elevators.location_name}` : ''}
                  </p>
                  {doc.description && (
                    <p className="text-sm text-slate-600 mt-2">{doc.description}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    {doc.file_name} · {formatFileSize(doc.file_size)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => window.open(doc.file_url, '_blank')}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>

                  <button
                    onClick={() => downloadDocument(doc)}
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </button>

                  {canUpload && (
                    <button
                      onClick={() => handleDelete(doc)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 text-red-600 px-3 py-2 text-sm hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Subir Documento</h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpload} className="p-5 space-y-4">
              <input
                type="text"
                placeholder="Título"
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />

              <textarea
                placeholder="Descripción"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 min-h-[100px]"
              />

              <select
                value={uploadForm.document_type}
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, document_type: e.target.value })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {documentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              <select
                value={uploadForm.elevator_id}
                onChange={(e) => setUploadForm({ ...uploadForm, elevator_id: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Documento general del edificio</option>
                {elevators.map((elevator) => (
                  <option key={elevator.id} value={elevator.id}>
                    {elevator.location_name}
                  </option>
                ))}
              </select>

              <input
                type="file"
                onChange={(e) =>
                  setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-60"
                >
                  {uploading ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}