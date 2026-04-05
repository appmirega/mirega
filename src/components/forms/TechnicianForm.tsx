import { useState } from "react";

interface Props {
  initialData?: any;
  onSubmit: (data: any) => void;
}

export default function TechnicianForm({ initialData, onSubmit }: Props) {
  const [form, setForm] = useState({
    name: initialData?.name || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
  });

  const handleChange = (field: string, value: string) => {
    // Nombre → MAYÚSCULAS
    if (field === "name") {
      value = value.replace(/[^a-zA-Z\s]/g, "").toUpperCase();
    }

    // Teléfono → solo números + Chile
    if (field === "phone") {
      value = value.replace(/\D/g, "");
      if (!value.startsWith("56")) {
        value = "56" + value;
      }
      value = value.slice(0, 11);
    }

    setForm({ ...form, [field]: value });
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Nombre"
        value={form.name}
        onChange={(e) => handleChange("name", e.target.value)}
        className="input"
      />

      <input
        type="text"
        placeholder="+569XXXXXXXX"
        value={`+${form.phone}`}
        onChange={(e) => handleChange("phone", e.target.value)}
        className="input"
      />

      <input
        type="email"
        placeholder="Email"
        value={form.email}
        disabled={!!initialData} // 🔒 bloqueado en edición
        onChange={(e) => handleChange("email", e.target.value)}
        className="input"
      />

      <button type="submit" className="btn-primary">
        Guardar
      </button>
    </form>
  );
}