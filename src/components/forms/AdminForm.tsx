// src/components/forms/AdminForm.tsx
import { useState } from 'react';
import { Shield, User, Mail, Phone, Eye, EyeOff, Key, X, AlertCircle, CheckCircle } from 'lucide-react';
import { safeJson } from '../../lib/safeJson';

export interface AdminFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function AdminForm({ onSuccess, onCancel }: AdminFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Las contraseñas no coinciden' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          password,
          role: 'admin',
        }),
      });

      const result = await safeJson(res);
      if (!res.ok || !result?.ok) {
        throw new Error(result?.error || 'No se pudo crear el administrador');
      }

      setMessage({ type: 'success', text: `Administrador ${fullName} creado exitosamente` });
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setConfirmPassword('');
      onSuccess?.();
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'No se pudo crear el administrador' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          Nuevo Administrador
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
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full outline-none bg-transparent"
            placeholder="Ej: Juan Pérez"
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
            className="w-full outline-none bg-transparent"
            placeholder="correo@empresa.cl"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Teléfono</label>
        <div className="flex items-center border rounded p-2">
          <Phone className="w-4 h-4 mr-2 text-gray-400" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full outline-none bg-transparent"
            placeholder="+56912345678"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Contraseña</label>
        <div className="flex items-center border rounded p-2">
          <Key className="w-4 h-4 mr-2 text-gray-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full outline-none bg-transparent"
            placeholder="Contraseña segura"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">Confirmar Contraseña</label>
        <div className="flex items-center border rounded p-2">
          <Key className="w-4 h-4 mr-2 text-gray-400" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full outline-none bg-transparent"
            placeholder="Repite la contraseña"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 text-white rounded ${loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Creando...' : 'Crear Administrador'}
        </button>
      </div>
    </form>
  );
}
