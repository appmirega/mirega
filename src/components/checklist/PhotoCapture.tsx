import { useState, useRef } from 'react';
import { Camera, Upload, X, Check, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PhotoCaptureProps {
  questionId: string;
  checklistId: string;
  existingPhotos?: { photo1?: string; photo2?: string };
  onPhotosChange: (photo1Url: string | null, photo2Url: string | null) => void;
}

export default function PhotoCapture({ questionId, checklistId, existingPhotos, onPhotosChange }: PhotoCaptureProps) {
  const [photo1, setPhoto1] = useState<string | null>(existingPhotos?.photo1 || null);
  const [photo2, setPhoto2] = useState<string | null>(existingPhotos?.photo2 || null);
  const [uploading, setUploading] = useState<1 | 2 | null>(null);
  const fileInput1Ref = useRef<HTMLInputElement>(null);
  const fileInput2Ref = useRef<HTMLInputElement>(null);

  const uploadPhoto = async (file: File, photoNumber: 1 | 2) => {
    setUploading(photoNumber);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${checklistId}_${questionId}_photo${photoNumber}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('maintenance-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('maintenance-photos')
        .getPublicUrl(filePath);

      if (photoNumber === 1) {
        setPhoto1(publicUrl);
        onPhotosChange(publicUrl, photo2);
      } else {
        setPhoto2(publicUrl);
        onPhotosChange(photo1, publicUrl);
      }

    } catch (error: any) {
      console.error('Error uploading photo:', error);
      alert('Error al subir la foto: ' + error.message);
    } finally {
      setUploading(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, photoNumber: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5 MB');
      return;
    }

    await uploadPhoto(file, photoNumber);
  };

  const deletePhoto = async (photoNumber: 1 | 2) => {
    if (photoNumber === 1) {
      setPhoto1(null);
      onPhotosChange(null, photo2);
    } else {
      setPhoto2(null);
      onPhotosChange(photo1, null);
    }
  };

  const PhotoSlot = ({
    photoNumber,
    photoUrl,
    fileInputRef
  }: {
    photoNumber: 1 | 2;
    photoUrl: string | null;
    fileInputRef: React.RefObject<HTMLInputElement>;
  }) => {
    const isUploading = uploading === photoNumber;

    return (
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileSelect(e, photoNumber)}
          className="hidden"
        />

        {photoUrl ? (
          <div className="relative group">
            <img
              src={photoUrl}
              alt={`Foto ${photoNumber}`}
              className="w-full h-48 object-cover rounded-lg border-2 border-slate-300"
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition flex items-center justify-center rounded-lg">
              <button
                onClick={() => deletePhoto(photoNumber)}
                className="opacity-0 group-hover:opacity-100 transition p-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="absolute top-2 right-2 p-2 bg-green-600 text-white rounded-full shadow-lg">
              <Check className="w-4 h-4" />
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full h-48 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition flex flex-col items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-sm text-slate-600">Subiendo...</p>
              </>
            ) : (
              <>
                <div className="p-3 bg-slate-100 rounded-full">
                  <Camera className="w-8 h-8 text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-700">Foto {photoNumber}</p>
                  <p className="text-sm text-slate-500">Toca para capturar</p>
                </div>
              </>
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Camera className="w-4 h-4" />
        <span className="font-semibold">Fotografías (Obligatorias)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PhotoSlot
          photoNumber={1}
          photoUrl={photo1}
          fileInputRef={fileInput1Ref}
        />
        <PhotoSlot
          photoNumber={2}
          photoUrl={photo2}
          fileInputRef={fileInput2Ref}
        />
      </div>

      {(!photo1 || !photo2) && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            Debes capturar 2 fotografías antes de continuar
          </p>
        </div>
      )}

      <div className="text-xs text-slate-500">
        <p>• Tamaño máximo: 5 MB por foto</p>
        <p>• Formatos soportados: JPG, PNG, WebP</p>
      </div>
    </div>
  );
}
