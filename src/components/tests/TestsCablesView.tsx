import { ArrowLeft } from 'lucide-react';

interface TestsCablesViewProps {
  title?: string;
  onBack: () => void;
}

export function TestsCablesView({ title = 'Pruebas de Cables', onBack }: TestsCablesViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <button onClick={onBack} className="rounded-lg p-2 hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-600">Vista no operativa</p>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
            <p className="text-lg font-semibold text-slate-800">Vista no operativa</p>
            <p className="mt-2 text-sm text-slate-600">
              Esta vista quedó creada como placeholder para continuar el flujo sin romper la aplicación.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
