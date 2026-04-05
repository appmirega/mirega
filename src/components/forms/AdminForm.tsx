// src/components/forms/AdminForm.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, User, Mail, Phone, X, AlertCircle, CheckCircle, KeyRound } from 'lucide-react';
import { safeJson } from '../../lib/safeJson';

interface EditableProfile {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface AdminFormProps {
  existingProfile?: EditableProfile | null;
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

export default function AdminForm({ existingProfile, onSuccess, onCancel }: AdminFormProps) {
  const isEditMode = Boolean(existingProfile?.id);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setFullName(sanitizeFullName(existingProfile?.full_name || ''));
    setEmail((existingProfile?.email || '').trim());
    setPhoneDigits(getPhoneDigitsFromStoredValue(existingProfile?.phone));
    setMessage(null);
  }, [existingProfile]);

  const defaultPassword = useMemo(() => {
    const year = new Date().getFullYear();
    return `Mirega${year}@@`;
  }, []);

  const canSubmit = fullName.trim().length > 0 && email.trim().length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setMessage(null);

    try {
      if (isEditMode && existingProfile?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            phone: normalizePhoneForStorage(phoneDigits),
          })
          .eq('id', existingProfile.id);

        if (error) throw error;

        setMessage({
          type: 'success',
          text: `Administrador ${fullName.trim()} actualizado correctamente.`,
        });
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('No hay sesión activa');

        const res = await fetch('/api/users/create', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim(),
            phone: normalizePhoneForStorage(phoneDigits),
            password: null,
            role: 'admin',
            person_type: 'internal',
            company_name: null,
            grant_access: true,
          }),
        });

        const result = await safeJson(res);
        if (!res.ok || !result?.ok) {
          throw new Error(result?.error || 'No se pudo crear el administrador');
        }

        setMessage({
          type: 'success',
          text: `Administrador ${fullName.trim()} creado. Clave inicial: ${defaultPassword} (podrá cambiarla después).`,
        });

        setFullName('');
        setEmail('');
        setPhoneDigits('');
      }

      onSuccess?.();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || (isEditMode ? 'No se pudo actualizar el administrador' : 'No se pudo crear el administrador'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          {isEditMode ? 'Editar Administrador' : 'Nuevo Administrador'}
        </h2>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 p-3 rounded ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-300'
              : 'bg-red-50 text-red-700 border border-red-300'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium">Nombre Completo</label>
        <div className="flex items-center border rounded p-2">
          <User className="w-4 h-4 mr-2 text-gray-400" />
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(sanitizeFullName(e.target.value))}
            required
            className="w-full outline-none bg-transparent"
            placeholder="Ej: JUAN PÉREZ"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Email</label>
        <div className="flex items-center border rounded p-2">
          <Mail className="w-4 h-4 mr-2 text-gray-400" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isEditMode}
            className="w-full outline-none bg-transparent disabled:text-gray-500 disabled:cursor-not-allowed"
            placeholder="correo@empresa.cl"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Teléfono</label>
        <div className="flex items-center border rounded p-2 gap-2">
          <Phone className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">+56</span>
          <input
            type="tel"
            inputMode="numeric"
            value={phoneDigits}
            onChange={(e) => setPhoneDigits(sanitizeChilePhoneDigits(e.target.value))}
            className="w-full outline-none bg-transparent"
            placeholder="912345678"
            maxLength={CHILE_LOCAL_LENGTH}
          />
        </div>
      </div>

      {!isEditMode && (
        <div className="border-t pt-4 text-sm text-gray-600">
          <div className="flex items-center gap-2 font-medium text-gray-800">
            <KeyRound className="w-4 h-4" />
            Credenciales de acceso
          </div>
          <div className="mt-1">
            La contraseña inicial se generará automáticamente como <span className="font-semibold">{defaultPassword}</span>.
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100">
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`px-4 py-2 text-white rounded ${loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? (isEditMode ? 'Guardando...' : 'Creando...') : isEditMode ? 'Guardar cambios' : 'Crear Administrador'}
        </button>
      </div>
    </form>
  );
}
