import { useRef } from "react";

interface Props {
  onCapture: (file: File) => void;
}

export default function EmergencyPhotoCapture({ onCapture }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openCamera = () => {
    inputRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        onClick={openCamera}
        className="bg-red-600 text-white px-3 py-2 rounded"
      >
        Capturar Imagen
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}