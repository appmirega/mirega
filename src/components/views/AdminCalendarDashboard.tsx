import { useMemo, useState } from 'react';

// ✅ Herramientas reales ya existentes en tu proyecto
import { MaintenanceCalendarView } from '../calendar/MaintenanceCalendarView';
import { EmergencyShiftsMonthlyView } from '../calendar/EmergencyShiftsMonthlyView';
import { EmergencyShiftScheduler } from '../calendar/EmergencyShiftScheduler';
import { MaintenanceMassPlannerV2 } from '../calendar/MaintenanceMassPlannerV2';
import { CoordinationRequestsPanel } from '../calendar/CoordinationRequestsPanel';
import { TechnicianAvailabilityPanel } from '../calendar/TechnicianAvailabilityPanel';

type AdminCalendarDashboardProps = {
  onNavigate?: (path: string) => void;
};

type TabKey =
  | 'maintenance_calendar'
  | 'mass_planner'
  | 'emergency_scheduler'
  | 'emergency_monthly'
  | 'coordination_requests'
  | 'availability';

export default function AdminCalendarDashboard({ onNavigate }: AdminCalendarDashboardProps) {
  const [tab, setTab] = useState<TabKey>('maintenance_calendar');

  const header = useMemo(() => {
    switch (tab) {
      case 'maintenance_calendar':
        return { title: 'Calendario de Mantenciones', subtitle: 'Planifica, asigna y revisa el mes completo.' };
      case 'mass_planner':
        return { title: 'Planificación Masiva', subtitle: 'Programación masiva de mantenciones por rango de fechas.' };
      case 'emergency_scheduler':
        return { title: 'Turnos de Emergencia', subtitle: 'Programa turnos/guardias de emergencia.' };
      case 'emergency_monthly':
        return { title: 'Resumen Mensual Emergencias', subtitle: 'Vista mensual de turnos/visitas de emergencia.' };
      case 'coordination_requests':
        return { title: 'Solicitudes de Coordinación', subtitle: 'Solicitudes de técnicos/clientes para coordinar servicios.' };
      case 'availability':
        return { title: 'Disponibilidad de Técnicos', subtitle: 'Disponibilidad / ausencias para planificación.' };
      default:
        return { title: 'Gestión de Calendario', subtitle: '' };
    }
  }, [tab]);

  const TabButton = ({
    active,
    children,
    onClick,
  }: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={[
        'px-3 py-2 rounded-lg text-sm font-medium border',
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
      ].join(' ')}
      type="button"
    >
      {children}
    </button>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{header.title}</h1>
          {header.subtitle ? <p className="text-slate-600 mt-1">{header.subtitle}</p> : null}
        </div>

        {/* Atajos a otras vistas del sistema (si quieres) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onNavigate?.('service-requests')}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50"
          >
            Ver Solicitudes
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('maintenance-checklist')}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50"
          >
            Mantenimientos
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('emergencies')}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50"
          >
            Emergencias
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <TabButton active={tab === 'maintenance_calendar'} onClick={() => setTab('maintenance_calendar')}>
          Calendario Mantenciones
        </TabButton>
        <TabButton active={tab === 'mass_planner'} onClick={() => setTab('mass_planner')}>
          Planificación Masiva
        </TabButton>
        <TabButton active={tab === 'emergency_scheduler'} onClick={() => setTab('emergency_scheduler')}>
          Turnos Emergencia
        </TabButton>
        <TabButton active={tab === 'emergency_monthly'} onClick={() => setTab('emergency_monthly')}>
          Emergencias Mensual
        </TabButton>
        <TabButton active={tab === 'coordination_requests'} onClick={() => setTab('coordination_requests')}>
          Solicitudes
        </TabButton>
        <TabButton active={tab === 'availability'} onClick={() => setTab('availability')}>
          Disponibilidad
        </TabButton>
      </div>

      {/* Content */}
      <div className="bg-white border border-slate-200 rounded-xl p-3">
        {tab === 'maintenance_calendar' ? (
          <MaintenanceCalendarView />
        ) : null}

        {tab === 'mass_planner' ? (
          <MaintenanceMassPlannerV2 />
        ) : null}

        {tab === 'emergency_scheduler' ? (
          <EmergencyShiftScheduler />
        ) : null}

        {tab === 'emergency_monthly' ? (
          <EmergencyShiftsMonthlyView />
        ) : null}

        {tab === 'coordination_requests' ? (
          <CoordinationRequestsPanel />
        ) : null}

        {tab === 'availability' ? (
          <TechnicianAvailabilityPanel />
        ) : null}
      </div>

      <p className="text-xs text-slate-500">
        Nota: el 404 de <code>/favicon.png</code> es normal si no lo tienes en <code>/public</code>. No afecta.
      </p>
    </div>
  );
}