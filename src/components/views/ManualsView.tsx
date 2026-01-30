import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ManualUploadForm } from '../forms/ManualUploadForm';
import { BookOpen, Search, Filter, Download, Trash2, Plus, FileText, Calendar, User } from 'lucide-react';

interface Manual {
  id: string;
  title: string;
  brand: string | null;
  model: string | null;
  document_type: string;
  file_url: string;
  uploaded_by: string | null;
  created_at: string;
  uploader_name?: string;
}

export function ManualsView() {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadManuals();
  }, []);

  const loadManuals = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('technical_manuals')
        .select(`
          *,
          uploader:uploaded_by(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const manualsWithNames = data?.map((manual: any) => ({
        ...manual,
        uploader_name: manual.uploader?.full_name || 'Desconocido',
      })) || [];

      setManuals(manualsWithNames);
    } catch (error) {
      console.error('Error loading manuals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Estás seguro de eliminar el manual "${title}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('technical_manuals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setManuals(manuals.filter(m => m.id !== id));
    } catch (error) {
      console.error('Error deleting manual:', error);
      alert('Error al eliminar el manual');
    }
  };

  const getDocumentTypeName = (type: string) => {
    const types: Record<string, string> = {
      manual: 'Manual de Usuario',
      maintenance: 'Manual de Mantenimiento',
      installation: 'Manual de Instalación',
      technical: 'Ficha Técnica',
      parts: 'Catálogo de Repuestos',
      other: 'Otro',
    };
    return types[type] || type;
  };

  const filteredManuals = manuals.filter(manual => {
    const matchesSearch =
      manual.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manual.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      manual.model?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === 'all' || manual.document_type === filterType;

    return matchesSearch && matchesFilter;
  });

  if (showUploadForm) {
    return (
      <ManualUploadForm
        onSuccess={() => {
          setShowUploadForm(false);
          loadManuals();
        }}
        onCancel={() => setShowUploadForm(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manuales Técnicos</h1>
          <p className="text-slate-600 mt-1">
            Gestión de documentación técnica y manuales de equipos
          </p>
        </div>
        <button
          onClick={() => setShowUploadForm(true)}
          className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
        >
          <Plus className="w-5 h-5" />
          Subir Manual
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por título, marca o modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">Todos los tipos</option>
              <option value="manual">Manuales de Usuario</option>
              <option value="maintenance">Manuales de Mantenimiento</option>
              <option value="installation">Manuales de Instalación</option>
              <option value="technical">Fichas Técnicas</option>
              <option value="parts">Catálogos de Repuestos</option>
              <option value="other">Otros</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : filteredManuals.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">
              {searchTerm || filterType !== 'all'
                ? 'No se encontraron manuales con los filtros aplicados'
                : 'No hay manuales técnicos cargados'}
            </p>
            {!searchTerm && filterType === 'all' && (
              <button
                onClick={() => setShowUploadForm(true)}
                className="mt-4 text-green-600 hover:text-green-700 font-medium"
              >
                Subir el primer manual
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredManuals.map((manual) => (
              <div
                key={manual.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-500 uppercase">
                      {getDocumentTypeName(manual.document_type)}
                    </span>
                  </div>
                </div>

                <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2">
                  {manual.title}
                </h3>

                {(manual.brand || manual.model) && (
                  <div className="flex gap-2 mb-3 text-sm text-slate-600">
                    {manual.brand && (
                      <span className="px-2 py-1 bg-slate-100 rounded">
                        {manual.brand}
                      </span>
                    )}
                    {manual.model && (
                      <span className="px-2 py-1 bg-slate-100 rounded">
                        {manual.model}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                  <User className="w-3 h-3" />
                  <span>{manual.uploader_name}</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {new Date(manual.created_at).toLocaleDateString('es-CL', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex gap-2">
                  <a
                    href={manual.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                  >
                    <Download className="w-4 h-4" />
                    Descargar
                  </a>
                  <button
                    onClick={() => handleDelete(manual.id, manual.title)}
                    className="px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredManuals.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-600 text-center">
              Mostrando {filteredManuals.length} de {manuals.length} manual{manuals.length !== 1 ? 'es' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
