// src/components/forms/TechnicianForm.tsx
import { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { UserPlus, Mail, Phone, X, Building2, KeyRound } from 'lucide-react';
import { safeJson } from '../../lib/safeJson';

interface TechnicianFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type PersonType = 'internal' | 'external';

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
  });

  const defaultPassword = useMemo(() => {
    const year = new Date().getFullYear();
    return `Mirega${year}@@`;
  }, []);

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      person_type: 'internal',
      company_name: '',
      grant_access: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    if (formData.person_type === 'external' && !formData.company_name.trim()) {
      setError('Para técnico externo debes indicar la empresa');
      setLoading(false);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa');

      const resp = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: null, // ✅ autogenerada backend Mirega{AÑO}@@
          full_name: formData.full_name,
          phone: formData.phone || null,
          role: 'technician',
          person_type: formData.person_type,
          company_name: formData.person_type === 'external' ? formData.company_name.trim() : null,
          grant_access: formData.grant_access,
        }),
      });

      const result = await safeJson(resp);
      if (!resp.ok || !result?.ok) {
        throw new Error(result?.error || 'No se pudo crear el técnico');
      }

      if (formData.grant_access) {
        setSuccess(`Técnico creado. Clave inicial: ${defaultPassword} (el usuario podrá cambiarla después).`);
      } else {
        setSuccess('Técnico creado sin acceso (registrado para asignaciones).');
      }

      resetForm();
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Error al crear el técnico');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserPlus className="w-6 h-6 text-green-600" />
          <h2 className="text-2xl font-bold text-slate-900">Nuevo Técnico</h2>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg transition" type="button">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        )}
      </div>

      {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>}
      {success && <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">{success}</div>}

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

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de persona *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="person_type"
                  checked={formData.person_type === 'internal'}
                  onChange={() => setFormData({ ...formData, person_type: 'internal', company_name: '' })}
                />
                Técnico Interno
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="person_type"
                  checked={formData.person_type === 'external'}
                  onChange={() => setFormData({ ...formData, person_type: 'external' })}
                />
                Técnico Externo
              </label>
            </div>
          </div>

          {formData.person_type === 'external' && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                Empresa *
              </label>
              <input
                type="text"
                required
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Ascensores Ltda"
              />
            </div>
          )}

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

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formData.grant_access}
                onChange={(e) => setFormData({ ...formData, grant_access: e.target.checked })}
              />
              Dar acceso a la plataforma (crear credenciales)
            </label>
            <p className="text-xs text-slate-500 mt-1">
              Si está desactivado, el técnico queda registrado (asignable) pero no podrá iniciar sesión.
            </p>
          </div>

          {formData.grant_access && (
            <div className="md:col-span-2 border-t border-slate-200 pt-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                <KeyRound className="w-5 h-5 inline mr-2" />
                Credenciales de Acceso
              </h3>
              <p className="text-sm text-slate-600">
                La contraseña inicial se generará automáticamente como <span className="font-semibold">{defaultPassword}</span>. El usuario podrá cambiarla después.
              </p>
            </div>
          )}
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
            {loading ? 'Creando...' : 'Crear Técnico'}
          </button>
        </div>
      </form>
    </div>
  );
}