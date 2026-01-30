import { useMemo, useState } from 'react';
import { BookOpen, Wrench, Users, Shield, Plus } from 'lucide-react';
import AdminForm from '../forms/AdminForm'; // ⬅️ import por defecto, corregido

interface Stats {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accentClass: string;
}

export default function DeveloperDashboard() {
  const [showAdminForm, setShowAdminForm] = useState(false);

  const stats: Stats[] = useMemo(
    () => [
      {
        label: 'Administradores',
        value: 0,
        icon: <Shield className="w-5 h-5" />,
        accentClass: 'text-blue-600 bg-blue-50',
      },
      {
        label: 'Técnicos',
        value: 0,
        icon: <Wrench className="w-5 h-5" />,
        accentClass: 'text-green-600 bg-green-50',
      },
      {
        label: 'Clientes',
        value: 0,
        icon: <Users className="w-5 h-5" />,
        accentClass: 'text-orange-600 bg-orange-50',
      },
      {
        label: 'Documentación',
        value: 'OK',
        icon: <BookOpen className="w-5 h-5" />,
        accentClass: 'text-purple-600 bg-purple-50',
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Panel de Desarrollador</h1>
          <p className="text-slate-600">Utilidades y acceso rápido para tareas de desarrollo.</p>
        </div>
        <button
          onClick={() => setShowAdminForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Crear Administrador
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((s, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-sm text-slate-600">{s.label}</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{s.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${s.accentClass}`}>{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Modal AdminForm */}
      {showAdminForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowAdminForm(false)}
          />
          {/* Content */}
          <div className="relative z-10 w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200">
            <AdminForm
              onSuccess={() => {
                setShowAdminForm(false);
              }}
              onCancel={() => setShowAdminForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
