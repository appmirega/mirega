import { useState, useMemo, FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface CertificationFormProps {
  elevatorClassification?: string | null;
  onSubmit: (data: {
    lastCertificationDate: string | null;
    nextCertificationDate: string | null;
    certificationNotLegible: boolean;
  }) => void;
  onCancel: () => void;
}

export function CertificationForm({
  elevatorClassification,
  onSubmit,
  onCancel,
}: CertificationFormProps) {
  const [lastCertificationDate, setLastCertificationDate] = useState<string>('');
  const [nextCertificationDate, setNextCertificationDate] = useState<string>('');
  const [certificationNotLegible, setCertificationNotLegible] =
    useState<boolean>(false);

  // Cálculo de días para el vencimiento
  const daysInfo = useMemo(() => {
    if (!nextCertificationDate) return null;

    const today = new Date();
    const next = new Date(nextCertificationDate);

    // normalizar solo a fecha (sin horas)
    const todayUTC = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const nextUTC = new Date(
      next.getFullYear(),
      next.getMonth(),
      next.getDate()
    );

    const diffMs = nextUTC.getTime() - todayUTC.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: 'expired' as const,
        label: `Vencida hace ${Math.abs(diffDays)} día(s)`,
      };
    }

    if (diffDays <= 30) {
      return {
        status: 'warning' as const,
        label: `Vence en ${diffDays} día(s)`,
      };
    }

    return {
      status: 'ok' as const,
      label: `Vence en ${diffDays} día(s)`,
    };
  }, [nextCertificationDate]);

  const classificationLabel = useMemo(() => {
    if (!elevatorClassification) return 'No definido';
    switch (elevatorClassification) {
      case 'ascensor_residencial':
        return 'Ascensor residencial';
      case 'ascensor_corporativo':
        return 'Ascensor corporativo';
      case 'montacargas':
        return 'Montacargas';
      case 'montaplatos':
        return 'Montaplatos';
      default:
        return elevatorClassification;
    }
  }, [elevatorClassification]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Dejar que el técnico trabaje con información parcial si marcó "no legible"
    if (!certificationNotLegible) {
      // Validación mínima: si no está marcada como no legible,
      // al menos la próxima certificación debe existir
      if (!nextCertificationDate) {
        alert(
          'Ingresa la fecha de la próxima certificación o marca que el certificado no es legible.'
        );
        return;
      }
    }

    onSubmit({
      lastCertificationDate:
        lastCertificationDate.trim() === '' ? null : lastCertificationDate,
      nextCertificationDate:
        nextCertificationDate.trim() === '' ? null : nextCertificationDate,
      certificationNotLegible,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Clasificación detectada (solo referencia visual) */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700">
        <span className="font-semibold">Clasificación detectada:</span>{' '}
        {classificationLabel}{' '}
        <span className="text-slate-500">
          (la vigencia real de la certificación depende de la resolución del
          edificio y de la autoridad competente)
        </span>
      </div>

      {/* Fechas de certificación */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Última certificación vigente */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Última certificación vigente
          </label>
          <div className="relative">
            <input
              type="date"
              className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
              value={lastCertificationDate}
              onChange={(e) => setLastCertificationDate(e.target.value)}
              disabled={certificationNotLegible}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Fecha que aparece en el certificado actual. Si el certificado no
            está disponible o no es legible, marca la opción de abajo.
          </p>
        </div>

        {/* Próxima certificación */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Próxima certificación
          </label>
          <div className="relative">
            <input
              type="date"
              className="w-full rounded-lg border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 pr-10"
              value={nextCertificationDate}
              onChange={(e) => setNextCertificationDate(e.target.value)}
              disabled={certificationNotLegible}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Ingresa la fecha de vencimiento indicada en el certificado o la que
            corresponda según la resolución del edificio (mes y año asignados
            por dirección).
          </p>
        </div>
      </div>

      {/* Estado de vigencia (solo si hay próxima fecha) */}
      {!certificationNotLegible && daysInfo && (
        <div
          className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
            daysInfo.status === 'ok'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : daysInfo.status === 'warning'
              ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {daysInfo.status === 'ok' && (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          )}
          {daysInfo.status === 'warning' && (
            <Clock className="w-5 h-5 flex-shrink-0" />
          )}
          {daysInfo.status === 'expired' && (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <div>
            <p className="font-semibold">
              {daysInfo.status === 'ok'
                ? 'Vigente'
                : daysInfo.status === 'warning'
                ? 'Próxima a vencer'
                : 'Certificación vencida'}
            </p>
            <p className="text-xs opacity-90">{daysInfo.label}</p>
          </div>
        </div>
      )}

      {/* Checkbox: certificado no legible */}
      <div className="pt-2 border-t border-slate-200">
        <label className="inline-flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            checked={certificationNotLegible}
            onChange={(e) => setCertificationNotLegible(e.target.checked)}
          />
          <span>
            El certificado de inspección periódica no es legible / no está
            disponible en terreno.
            <span className="block text-xs text-slate-500 mt-0.5">
              Podrás actualizar las fechas más adelante cuando se disponga del
              certificado oficial.
            </span>
          </span>
        </label>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium"
        >
          Volver
        </button>
        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold"
        >
          Continuar al checklist
        </button>
      </div>
    </form>
  );
}


