import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, AlertCircle } from 'lucide-react';

interface EmergencyPhotoCaptureProps {
  photoType: 'before' | 'after';
  requiredPhotos: number;
  onPhotosChange: (photos: File[]) => void;
  existingPhotos?: File[];
}

export function EmergencyPhotoCapture({
  photoType,
  requiredPhotos,
  onPhotosChange,
  existingPhotos = [],
}: EmergencyPhotoCaptureProps) {
  const [photos, setPhotos] = useState<File[]>(existingPhotos);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  React.useEffect(() => {
    if (existingPhotos.length > 0) {
      const urls = existingPhotos.map((file) => URL.createObjectURL(file));
      setPreviews(urls);
      return () => urls.forEach((url) => URL.revokeObjectURL(url));
    }
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setStream(mediaStream);
      setCameraActive(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('No se pudo acceder a la cámara');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;

      const file = new File([blob], `emergency_${photoType}_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });

      const newPhotos = [...photos, file];
      setPhotos(newPhotos);
      onPhotosChange(newPhotos);

      const url = URL.createObjectURL(file);
      setPreviews([...previews, url]);

      if (newPhotos.length >= requiredPhotos) {
        stopCamera();
      }
    }, 'image/jpeg');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = requiredPhotos - photos.length;
    const filesToAdd = files.slice(0, remainingSlots);

    const newPhotos = [...photos, ...filesToAdd];
    setPhotos(newPhotos);
    onPhotosChange(newPhotos);

    const newUrls = filesToAdd.map((file) => URL.createObjectURL(file));
    setPreviews([...previews, ...newUrls]);
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
    onPhotosChange(newPhotos);

    URL.revokeObjectURL(previews[index]);
    const newPreviews = previews.filter((_, i) => i !== index);
    setPreviews(newPreviews);
  };

  React.useEffect(() => {
    return () => {
      stopCamera();
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const isComplete = photos.length === requiredPhotos;
  const title = photoType === 'before' ? 'Fotos del Estado Inicial' : 'Fotos del Estado Final';

  return (
    <div className="border border-gray-300 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          {isComplete && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Completo
            </span>
          )}
          <span className="text-sm text-gray-500">
            {photos.length}/{requiredPhotos}
          </span>
        </div>
      </div>

      {photos.length < requiredPhotos && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Se requieren {requiredPhotos} fotos. Faltan {requiredPhotos - photos.length}.
          </p>
        </div>
      )}

      {/* Vista previa de fotos */}
      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {previews.map((preview, index) => (
            <div key={index} className="relative group">
              <img
                src={preview}
                alt={`Foto ${index + 1}`}
                className="w-full h-32 object-cover rounded-lg border border-gray-300"
              />
              <button
                onClick={() => removePhoto(index)}
                className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-70 text-white text-xs rounded">
                Foto {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controles de captura */}
      {photos.length < requiredPhotos && (
        <div className="space-y-3">
          {!cameraActive ? (
            <>
              <button
                onClick={startCamera}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Camera className="h-5 w-5" />
                Tomar Foto con Cámara
              </button>

              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <Upload className="h-5 w-5" />
                  Subir desde Galería
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover"
                  autoPlay
                  playsInline
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={capturePhoto}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Camera className="h-5 w-5" />
                  Capturar
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
