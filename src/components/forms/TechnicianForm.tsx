import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

type PersonType = 'internal' | 'external';

interface ExistingTechnicianProfile {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  person_type?: PersonType | null;
  company_name?: string | null;
  grant_access?: boolean | null;
}

interface TechnicianFormProps {
  existingProfile?: ExistingTechnicianProfile | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CHILE_COUNTRY_CODE = '56';
const CHILE_LOCAL_LENGTH = 9;

function sanitizeFullName(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-ZÁÉÍÓÚÜÑ\s]/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '');
}

function sanitizeChilePhoneDigits(value: string) {
  let digits = value.replace(/\D/g, '');

  if (digits.startsWith(CHILE_COUNTRY_CODE)) {
    digits = digits.slice(CHILE_COUNTRY_CODE.length);
  }

  return digits.slice(0, CHILE_LOCAL_LENGTH);
}

function normalizePhoneForStorage(value: string) {
  const digits = sanitizeChilePhoneDigits(value);
  return digits ? `+${CHILE_COUNTRY_CODE}${digits}` : null;
}

function getPhoneDigitsFromStoredValue(value?: string | null) {
  return sanitizeChilePhoneDigits(value || '');
}

export default function TechnicianForm({ existingProfile, onSuccess, onCancel }: TechnicianFormProps) {
  const isEditMode = Boolean(existingProfile?.id);
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

  useEffect(() => {
    setFormData({
      full_name: sanitizeFullName(existingProfile?.full_name || ''),
      email: (existingProfile?.email || '').trim(),
      phone: getPhoneDigitsFromStoredValue(existingProfile?.phone),
      person_type: existingProfile?.person_type === 'external' ? 'external' : 'internal',
      company_name: existingProfile?.company_name || '',
      grant_access: existingProfile?.grant_access ?? true,
      password: '',
      confirmPassword: '',
    });
    setError(null);
    setSuccess(null);
  }, [existingProfile]);

  const isExternal = formData.person_type === 'external';

  const canSubmit = useMemo(() => {
    if (!formData.full_name.trim()) return false;
    if (!formData.email.trim()) return false;

    if (isExternal && !formData.company_name.trim()) return false;

    if (!isEditMode && formData.grant_access) {
      if (formData.password.length < 8) return false;
      if (formData.password !== formData.confirmPassword) return false;
    }

    return true;
  }, [formData, isExternal, isEditMode]);

  const handleChange = (key: keyof typeof formData, value: any) => {
    let nextValue = value;

    if (key === 'full_name') {
      nextValue = sanitizeFullName(String(value));
    }

    if (key === 'phone') {
      nextValue = sanitizeChilePhoneDigits(String(value));
    }

    setFormData((prev) => ({ ...prev, [key]: nextValue }));
  };

  const validate = () => {
    if (!formData.full_name.trim()) return 'El nombre es obligatorio.';
    if (!formData.email.trim()) return 'El email es obligatorio.';

    if (isExternal && !formData.company_name.trim()) {
      return 'Para técnico externo debes indicar la empresa.';
    }

    if (!isEditMode && formData.grant_access) {
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
      if (isEditMode && existingProfile?.id) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name.trim(),
            phone: normalizePhoneForStorage(formData.phone),
            person_type: formData.person_type,
            company_name: isExternal ? formData.company_name.trim() : null,
          })
          .eq('id', existingProfile.id);

        if (updateError) {
          throw new Error(updateError.message || 'Error actualizando técnico.');
        }

        setSuccess('✅ Técnico actualizado correctamente.');
      } else {
        const payload = {
          email: formData.email.trim(),
          password: formData.grant_access ? formData.password : null,
          full_name: formData.full_name.trim(),
          phone: normalizePhoneForStorage(formData.phone),
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

        if (formData.grant_access) {
          setSuccess('✅ Técnico creado con acceso a la plataforma.');
        } else {
          setSuccess('✅ Técnico creado sin acceso (registrado para asignaciones).');
        }

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
      }

      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">
        {isEditMode ? 'Editar técnico' : 'Crear nuevo técnico'}
      </h2>

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
                  if (!isEditMode) handleChange('grant_access', true);
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
                  if (!isEditMode) handleChange('grant_access', false);
                }}
              />
              Técnico Externo
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Nombre completo *</label>
          <input
            type="text"
            value={formData.full_name}
            onChange={(e) => handleChange('full_name', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            placeholder="Ej: JUAN PÉREZ"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Email *</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:text-slate-500 disabled:cursor-not-allowed"
            placeholder="juan@correo.com"
            required
            disabled={isEditMode}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label>
          <div className="flex items-center gap-2 w-full px-4 py-2 border border-slate-300 rounded-lg focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent">
            <span className="text-sm font-medium text-slate-600">+56</span>
            <input
              type="tel"
              inputMode="numeric"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="w-full outline-none bg-transparent"
              placeholder="912345678"
              maxLength={CHILE_LOCAL_LENGTH}
            />
          </div>
        </div>

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

        {!isEditMode && (
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
        )}

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
            {loading ? (isEditMode ? 'Guardando...' : 'Creando...') : isEditMode ? 'Guardar cambios' : 'Crear técnico'}
          </button>
        </div>
      </form>
    </div>
  );
}
