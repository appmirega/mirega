import { useMemo, useRef, useState } from 'react';
import { Camera, Check, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ExistingPhotos {
  photo1?: string;
  photo2?: string;
  photo3?: string;
  photo4?: string;
}

interface PhotoCaptureProps {
  questionId: string;
  checklistId: string;
  existingPhotos?: ExistingPhotos;
  minRequired?: number;
  maxPhotos?: 2 | 4;
  disabled?: boolean;
  onPhotosChange: (
    photo1Url: string | null,
    photo2Url: string | null,
    photo3Url?: string | null,
    photo4Url?: string | null
  ) => void;
}

type SlotNumber = 1 | 2 | 3 | 4;

function getFileExtension(file: File) {
  const originalExt = file.name.split('.').pop()?.toLowerCase();
  if (originalExt && ['jpg', 'jpeg', 'png', 'webp'].includes(originalExt)) {
    return originalExt === 'jpeg' ? 'jpg' : originalExt;
  }
  return 'jpg';
}

async function compressImage(file: File, maxWidth = 1600, quality = 0.78): Promise<File> {
  const imageBitmap = await createImageBitmap(file);

  let width = imageBitmap.width;
  let height = imageBitmap.height;

  if (width > maxWidth) {
    const ratio = maxWidth / width;
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo preparar la compresión de imagen.');
  }

  ctx.drawImage(imageBitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('No se pudo comprimir la imagen.'));
          return;
        }
        resolve(result);
      },
      'image/jpeg',
      quality
    );
  });

  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

export default function PhotoCapture({
  questionId,
  checklistId,
  existingPhotos,
  minRequired = 2,
  maxPhotos = 4,
  disabled = false,
  onPhotosChange,
}: PhotoCaptureProps) {
  const [photos, setPhotos] = useState<Record<SlotNumber, string | null>>({
    1: existingPhotos?.photo1 || null,
    2: existingPhotos?.photo2 || null,
    3: existingPhotos?.photo3 || null,
    4: existingPhotos?.photo4 || null,
  });

  const [uploading, setUploading] = useState<SlotNumber | null>(null);

  const input1Ref = useRef<HTMLInputElement>(null);
  const input2Ref = useRef<HTMLInputElement>(null);
  const input3Ref = useRef<HTMLInputElement>(null);
  const input4Ref = useRef<HTMLInputElement>(null);

  const visibleSlots: SlotNumber[] = useMemo(
    () => (maxPhotos === 4 ? [1, 2, 3, 4] : [1, 2]),
    [maxPhotos]
  );

  const inputRefMap: Record<SlotNumber, React.RefObject<HTMLInputElement | null>> = {
    1: input1Ref,
    2: input2Ref,
    3: input3Ref,
    4: input4Ref,
  };

  const syncPhotos = (nextPhotos: Record<SlotNumber, string | null>) => {
    setPhotos(nextPhotos);
    onPhotosChange(
      nextPhotos[1],
      nextPhotos[2],
      nextPhotos[3],
      nextPhotos[4]
    );
  };

  const uploadPhoto = async (file: File, slot: SlotNumber) => {
    setUploading(slot);

    try {
      const compressedFile = await compressImage(file, 1600, 0.78);
      const fileExt = getFileExtension(compressedFile);
      const fileName = `${checklistId}_${questionId}_photo${slot}_${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('maintenance-photos')
        .upload(filePath, compressedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: compressedFile.type,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('maintenance-photos').getPublicUrl(filePath);

      const nextPhotos = { ...photos, [slot]: publicUrl };
      syncPhotos(nextPhotos);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      alert(`Error al subir la foto: ${error.message || 'desconocido'}`);
    } finally {
      setUploading(null);
    }
  };

  const handleFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slot: SlotNumber
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      e.target.value = '';
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      alert('La imagen no debe superar los 12 MB antes de comprimir');
      e.target.value = '';
      return;
    }

    await uploadPhoto(file, slot);
    e.target.value = '';
  };

  const deletePhoto = (slot: SlotNumber) => {
    const nextPhotos = { ...photos, [slot]: null };
    syncPhotos(nextPhotos);
  };

  const currentCount = visibleSlots.filter((slot) => !!photos[slot]).length;
  const isIncomplete = currentCount < minRequired;

  const PhotoSlot = ({
    slot,
    photoUrl,
  }: {
    slot: SlotNumber;
    photoUrl: string | null;
  }) => {
    const isUploading = uploading === slot;
    const inputRef = inputRefMap[slot];

    return (
      <div className="relative">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileSelect(e, slot)}
          className="hidden"
          disabled={disabled}
        />

        {photoUrl ? (
          <div className="relative group">
            <img
              src={photoUrl}
              alt={`Foto ${slot}`}
              className="h-44 w-full rounded-xl border-2 border-slate-300 object-cover"
            />

            {!disabled && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition group-hover:bg-black/40">
                <button
                  type="button"
                  onClick={() => deletePhoto(slot)}
                  className="opacity-0 transition group-hover:opacity-100 rounded-lg bg-red-600 p-3 text-white hover:bg-red-700"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            )}

            <div className="absolute right-2 top-2 rounded-full bg-green-600 p-2 text-white shadow-lg">
              <Check className="h-4 w-4" />
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !disabled && inputRef.current?.click()}
            disabled={disabled || isUploading}
            className="flex h-44 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm text-slate-600">Subiendo...</p>
              </>
            ) : (
              <>
                <div className="rounded-full bg-slate-100 p-3">
                  <Camera className="h-8 w-8 text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-slate-700">Foto {slot}</p>
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
        <Camera className="h-4 w-4" />
        <span className="font-semibold">
          Evidencia fotográfica ({minRequired} mín. / {maxPhotos} máx.)
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {visibleSlots.map((slot) => (
          <PhotoSlot key={slot} slot={slot} photoUrl={photos[slot]} />
        ))}
      </div>

      {isIncomplete && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            Debes capturar al menos {minRequired} fotografías para esta pregunta.
          </p>
        </div>
      )}

      <div className="text-xs text-slate-500">
        <p>• Captura solo por cámara</p>
        <p>• Tamaño máximo antes de compresión: 12 MB</p>
        <p>• Las imágenes se comprimen automáticamente para mejorar rendimiento</p>
      </div>
    </div>
  );
}