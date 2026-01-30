import { useState, useRef } from 'react';
import { Camera, X, Check, Upload } from 'lucide-react';

interface WorkOrderPhotoCaptureProps {
  photoNumber: number;
  onPhotoCapture: (photoNumber: number, file: File) => void;
  onRemovePhoto: (photoNumber: number) => void;
  capturedPhoto?: File | null;
}

export function WorkOrderPhotoCapture({
  photoNumber,
  onPhotoCapture,
  onRemovePhoto,
  capturedPhoto,
}: WorkOrderPhotoCaptureProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('No se pudo acceder a la cámara');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `work-order-photo-${photoNumber}.jpg`, {
              type: 'image/jpeg',
            });
            onPhotoCapture(photoNumber, file);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onPhotoCapture(photoNumber, file);
    }
  };

  return (
    <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-slate-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-slate-900">Foto {photoNumber}</h4>
        {capturedPhoto && (
          <button
            onClick={() => onRemovePhoto(photoNumber)}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {!capturedPhoto && !showCamera && (
        <div className="space-y-2">
          <button
            onClick={startCamera}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Camera className="w-5 h-5" />
            Tomar Foto
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
          >
            <Upload className="w-5 h-5" />
            Subir desde Archivo
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {showCamera && (
        <div className="space-y-3">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg bg-black"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <button
              onClick={capturePhoto}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Check className="w-5 h-5" />
              Capturar
            </button>
            <button
              onClick={stopCamera}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
            >
              <X className="w-5 h-5" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      {capturedPhoto && (
        <div className="relative">
          <img
            src={URL.createObjectURL(capturedPhoto)}
            alt={`Foto ${photoNumber}`}
            className="w-full rounded-lg"
          />
          <div className="absolute top-2 right-2 bg-green-600 text-white px-2 py-1 rounded text-xs font-semibold flex items-center gap-1">
            <Check className="w-3 h-3" />
            Capturada
          </div>
        </div>
      )}
    </div>
  );
}
