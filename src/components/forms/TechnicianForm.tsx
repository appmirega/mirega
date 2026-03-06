import React, { useMemo, useState } from 'react';

type PersonType = 'internal' | 'external';

interface TechnicianFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function TechnicianForm({ onSuccess, onCancel }: TechnicianFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    person_type: 'internal' as PersonType,
    company_name: '',
    grant_access: true,
    password: '',
    confirmPassword: '',
  });

  const isExternal = formData.person_type === 'external';

  const canSubmit = useMemo(() => {
    if (!formData.full_name.trim()) return false;
    if (!formData.email.trim()) return false;

    if (isExternal && !formData.company_name.trim()) return false;

    if (formData.grant_access) {
      if (formData.password.length < 8) return false;
      if (formData.password !== formData.confirmPassword) return false;
    }

    return true;
  }, [formData, isExternal]);

  const handleChange = (key: keyof typeof formData, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!formData.full_name.trim()) return 'El nombre es obligatorio.';
    if (!formData.email.trim()) return 'El email es obligatorio.';

    if (isExternal && !formData.company_name.trim()) {
      return 'Para técnico externo debes indicar la empresa.';
    }

    if (formData.grant_access) {
      if (formData.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
      if (formData.password !== formData.confirmPassword) return 'Las contraseñas no coinciden.';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: formData.email.trim(),
        password: formData.grant_access ? formData.password : null,
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim() ? formData.phone.trim() : null,
        role: 'technician',
        person_type: formData.person_type,
        company_name: isExternal ? formData.company_name.trim() : null,
        grant_access: formData.grant_access,
      };

      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Error creando técnico.');
      }

      // ✅ Mensaje corregido (ya NO prometemos una contraseña fija)
      if (formData.grant_access) {
        setSuccess('✅ Técnico creado con acceso a la plataforma.');
      } else {
        setSuccess('✅ Técnico creado sin acceso (registrado para asignaciones).');
      }

      // Limpieza del formulario
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        person_type: 'internal',
        company_name: '',
        grant_access: true,
        password: '',
        confirmPassword: '',
      });

      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Crear nuevo técnico</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de persona *</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="person_type"
                checked={formData.person_type === 'internal'}
                onChange={() => {
                  handleChange('person_type', 'internal');
                  handleChange('company_name', '');
                  handleChange('grant_access', true);
                }}
              />
              Técnico Interno
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="person_type"
                checked={formData.person_type === 'external'}
                onChange={() => {
                  handleChange('person_type', 'external');
                  // externo por defecto sin acceso
                  handleChange('grant_access', false);
                }}
              />
              Técnico Externo
            </label>
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Nombre completo *</label>
          <input
            type="text"
            value={formData.full_name}
            onChange={(e) => handleChange('full_name', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Ej: Juan Pérez"
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="juan@correo.com"
            required
          />
        </div>

        {/* Teléfono */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="+56 9 1234 5678"
          />
        </div>

        {/* Empresa (solo external) */}
        {isExternal && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Empresa *</label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => handleChange('company_name', e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Ascensores Ltda"
              required
            />
          </div>
        )}

        {/* Acceso */}
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formData.grant_access}
              onChange={(e) => handleChange('grant_access', e.target.checked)}
            />
            Dar acceso a la plataforma (crear credenciales)
          </label>
          <p className="text-xs text-slate-500 mt-1">
            Si está desactivado, el técnico quedará registrado para asignaciones pero no podrá iniciar sesión.
          </p>

          {formData.grant_access && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Mínimo 8 caracteres"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Confirmar contraseña *</label>
                <input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Repite la contraseña"
                  required
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
              disabled={loading}
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear técnico'}
          </button>
        </div>
      </form>
    </div>
  );
}