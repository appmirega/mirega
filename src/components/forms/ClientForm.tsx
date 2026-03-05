import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Building2, Mail, Phone, User, X, KeyRound } from 'lucide-react'
import { safeJson } from '../../lib/safeJson'

interface ClientFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function ClientForm({ onSuccess, onCancel }: ClientFormProps) {

  const defaultPassword = useMemo(() => {
    const year = new Date().getFullYear()
    return `Mirega${year}@@`
  }, [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [clientData, setClientData] = useState({
    name: '',
    rut: '',
    address: '',
    admin_name: '',
    admin_email: '',
    admin_phone: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {

      const {
        data: { session }
      } = await supabase.auth.getSession()

      if (!session) throw new Error('No hay sesión activa')

      const resp = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: clientData.admin_email,
          password: null,
          full_name: clientData.admin_name,
          phone: clientData.admin_phone,
          role: 'client',
          person_type: 'internal',
          company_name: null,
          grant_access: true
        })
      })

      const result = await safeJson(resp)

      if (!resp.ok || !result?.ok) {
        throw new Error(result?.error || 'No se pudo crear el cliente')
      }

      const { error: insertError } = await supabase
        .from('clients')
        .insert({
          name: clientData.name,
          rut: clientData.rut,
          address: clientData.address,
          admin_name: clientData.admin_name,
          admin_email: clientData.admin_email,
          admin_phone: clientData.admin_phone,
          auth_user_id: result.user_id
        })

      if (insertError) throw insertError

      setSuccess(
        `Cliente creado. Clave inicial del administrador: ${defaultPassword}`
      )

      setClientData({
        name: '',
        rut: '',
        address: '',
        admin_name: '',
        admin_email: '',
        admin_phone: ''
      })

      onSuccess?.()

    } catch (err: any) {
      setError(err?.message || 'Error al crear cliente')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-green-600" />
          Nuevo Cliente
        </h2>

        {onCancel && (
          <button onClick={onCancel}>
            <X className="w-5 h-5 text-slate-500" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="block text-sm font-medium">Nombre del Cliente</label>
          <input
            required
            value={clientData.name}
            onChange={(e) => setClientData({ ...clientData, name: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">RUT</label>
          <input
            value={clientData.rut}
            onChange={(e) => setClientData({ ...clientData, rut: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Dirección</label>
          <input
            value={clientData.address}
            onChange={(e) => setClientData({ ...clientData, address: e.target.value })}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <hr className="my-4"/>

        <h3 className="font-semibold text-lg">Administrador del Cliente</h3>

        <div>
          <label className="block text-sm font-medium">
            <User className="w-4 h-4 inline mr-1"/>
            Nombre
          </label>
          <input
            required
            value={clientData.admin_name}
            onChange={(e) =>
              setClientData({ ...clientData, admin_name: e.target.value })
            }
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            <Mail className="w-4 h-4 inline mr-1"/>
            Email
          </label>
          <input
            type="email"
            required
            value={clientData.admin_email}
            onChange={(e) =>
              setClientData({ ...clientData, admin_email: e.target.value })
            }
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            <Phone className="w-4 h-4 inline mr-1"/>
            Teléfono
          </label>
          <input
            value={clientData.admin_phone}
            onChange={(e) =>
              setClientData({ ...clientData, admin_phone: e.target.value })
            }
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="border-t pt-4 text-sm text-slate-600 flex items-start gap-2">
          <KeyRound className="w-4 h-4 mt-0.5"/>
          <span>
            La contraseña inicial se generará automáticamente como
            <strong className="ml-1">{defaultPassword}</strong>.
          </span>
        </div>

        <div className="flex gap-3 pt-4">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-slate-300 rounded py-2"
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 text-white rounded py-2"
          >
            {loading ? 'Creando...' : 'Crear Cliente'}
          </button>
        </div>

      </form>
    </div>
  )
}