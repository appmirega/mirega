// src/components/forms/TechnicianForm.tsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, Mail, Phone, Key, X } from 'lucide-react';
import { safeJson } from '../../lib/safeJson';
import {
  validateEmail,
  validatePhone,
  validatePassword,
} from '../../utils/validation';

interface TechnicianFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  existingProfile?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
}

export default function TechnicianForm({ onSuccess, onCancel, existingProfile }: TechnicianFormProps) {
  const isEditing = !!existingProfile;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    full_name: existingProfile?.full_name || '',
    email: existingProfile?.email || '',
    phone: existingProfile?.phone || '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    // Validar email
    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      setError(emailValidation.error!);
      setLoading(false);
      return;
    }

    // Validar teléfono si se proporciona
    if (formData.phone) {
      const phoneValidation = validatePhone(formData.phone);
      if (!phoneValidation.isValid) {
        setError(phoneValidation.error!);
        setLoading(false);
        return;
      }
    }

    const wantsPasswordChange = formData.password.length > 0 || formData.confirmPassword.length > 0;
    if (isEditing) {
      if (wantsPasswordChange && formData.password !== formData.confirmPassword) {
        setError('Las contraseñas no coinciden');
        setLoading(false);
        return;
      }
      if (wantsPasswordChange) {
        const passwordValidation = validatePassword(formData.password);
        if (!passwordValidation.isValid) {
          setError(passwordValidation.error!);
          setLoading(false);
          return;
        }
      }
    } else {
      if (formData.password !== formData.confirmPassword) {
        setError('Las contraseñas no coinciden');
        setLoading(false);
        return;
      }
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        setError(passwordValidation.error!);
        setLoading(false);
        return;
      }
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const endpoint = isEditing ? '/api/users/update' : '/api/users/create';
      const payload: Record<string, unknown> = {
        email: formData.email,
        full_name: formData.full_name,
        phone: formData.phone || null,
        role: 'technician',
      };

      if (isEditing && existingProfile?.id) {
        payload.user_id = existingProfile.id;
      }

      if (!isEditing || wantsPasswordChange) {
        payload.password = formData.password;
      }

      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await safeJson(resp);
      if (!resp.ok || !result?.ok) {
        throw new Error(result?.error || 'No se pudo guardar el técnico');
      }

      // Limpia y cierra
      if (!isEditing) {
        setFormData({
          full_name: '',
          email: '',
          phone: '',
          password: '',
          confirmPassword: '',
        });
      }
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar el técnico');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserPlus className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold text-slate-900">{isEditing ? 'Editar Técnico' : 'Nuevo Técnico'}</h2>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        )}
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Nombre Completo *</label>
            <input
              type="text"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Mail className="w-4 h-4 inline mr-1" />
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="tecnico@mirega.cl"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              Teléfono *
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="+56 9 1234 5678"
            />
          </div>

          <div className="md:col-span-2 border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              <Key className="w-5 h-5 inline mr-2" />
              Credenciales de Acceso
            </h3>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{isEditing ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</label>
            <input
              type="password"
              required={!isEditing}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder={isEditing ? 'Déjalo vacío si no quieres cambiarla' : 'Mínimo 8 caracteres'}
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{isEditing ? 'Confirmar nueva contraseña (opcional)' : 'Confirmar Contraseña *'}</label>
            <input
              type="password"
              required={!isEditing}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder={isEditing ? 'Repite la nueva contraseña' : 'Repetir contraseña'}
              minLength={8}
            />
          </div>
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
            disabled={loading}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? (isEditing ? 'Actualizando...' : 'Creando...') : isEditing ? 'Actualizar Técnico' : 'Crear Técnico'}
          </button>
        </div>
      </form>
    </div>
  );
}
