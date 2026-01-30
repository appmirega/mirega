import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Upload, File, X, AlertCircle, CheckCircle } from 'lucide-react';

interface ManualUploadFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ManualUploadForm({ onSuccess, onCancel }: ManualUploadFormProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    brand: '',
    model: '',
    document_type: 'manual',
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Solo se permiten archivos PDF');
        setSelectedFile(null);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo no debe superar los 10 MB');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setError('Debes seleccionar un archivo PDF');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      const fileExt = 'pdf';
      const fileName = `${Date.now()}-${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `manuals/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('technical-manuals')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found')) {
          setError('El almacenamiento no está configurado. Contacta al administrador.');
        } else {
          throw uploadError;
        }
        setLoading(false);
        setUploading(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('technical-manuals')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('technical_manuals')
        .insert({
          title: formData.title,
          brand: formData.brand || null,
          model: formData.model || null,
          document_type: formData.document_type,
          file_url: publicUrl,
          uploaded_by: profile?.id,
        });

      if (insertError) throw insertError;

      setSuccess('Manual técnico subido exitosamente');
      setFormData({
        title: '',
        brand: '',
        model: '',
        document_type: 'manual',
      });
      setSelectedFile(null);

      if (onSuccess) {
        setTimeout(() => onSuccess(), 1500);
      }
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Error al subir el manual técnico');
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Upload className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold text-slate-900">Subir Manual Técnico</h2>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Título del Manual *
          </label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Ej: Manual de Mantenimiento Ascensor Hidráulico"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Marca
            </label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ej: OTIS, Schindler, ThyssenKrupp"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Modelo
            </label>
            <input
              type="text"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ej: Gen2, MRL"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tipo de Documento *
          </label>
          <select
            value={formData.document_type}
            onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="manual">Manual de Usuario</option>
            <option value="maintenance">Manual de Mantenimiento</option>
            <option value="installation">Manual de Instalación</option>
            <option value="technical">Ficha Técnica</option>
            <option value="parts">Catálogo de Repuestos</option>
            <option value="other">Otro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Archivo PDF *
          </label>
          <div className="mt-2">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {selectedFile ? (
                  <>
                    <File className="w-12 h-12 text-green-600 mb-3" />
                    <p className="text-sm text-slate-700 font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 text-slate-400 mb-3" />
                    <p className="mb-2 text-sm text-slate-700">
                      <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
                    </p>
                    <p className="text-xs text-slate-500">Solo archivos PDF (Máx. 10 MB)</p>
                  </>
                )}
              </div>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                required
              />
            </label>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Importante:</strong> Los manuales técnicos estarán disponibles para todos los técnicos y administradores del sistema.
          </p>
        </div>

        <div className="flex gap-4 pt-4 border-t border-slate-200">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !selectedFile}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Subir Manual
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
