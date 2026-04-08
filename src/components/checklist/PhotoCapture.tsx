import { useRef } from "react";

interface Props {
  onCapture: (file: File) => void;
}

export default function PhotoCapture({ onCapture }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenCamera = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🔥 Validación básica (evita archivos raros)
    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten imágenes");
      return;
    }

    onCapture(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleOpenCamera}
        className="bg-blue-600 text-white px-3 py-2 rounded"
      >
        Tomar Foto
      </button>

      {/* 🔥 SOLO CÁMARA */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}