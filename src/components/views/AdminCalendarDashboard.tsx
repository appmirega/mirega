import { useEffect, useMemo, useState } from 'react';

import { MaintenanceCalendarView } from '../calendar/MaintenanceCalendarView';
import { MaintenanceMassPlannerV2 } from '../calendar/MaintenanceMassPlannerV2';
import { EmergencyShiftScheduler } from '../calendar/EmergencyShiftScheduler';
import { EmergencyShiftsMonthlyView } from '../calendar/EmergencyShiftsMonthlyView';
import { CoordinationRequestsPanel } from '../calendar/CoordinationRequestsPanel';
import { TechnicianAvailabilityPanel } from '../calendar/TechnicianAvailabilityPanel';
import { TechnicianAbsenceForm } from '../calendar/TechnicianAbsenceForm';

type TabKey =
  | 'maintenance_calendar'
  | 'mass_planner'
  | 'emergency_scheduler'
  | 'emergency_monthly'
  | 'coordination_requests'
  | 'availability'
  | 'absences';

type AdminCalendarDashboardProps = {
  onNavigate?: (path: string) => void;
  /** Abre directamente una pestaña específica (útil para navegación desde App/Layout). */
  initialTab?: TabKey;
};

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
      }`}
      type="button"
    >
      {children}
    </button>
  );
}

export default function AdminCalendarDashboard({ onNavigate, initialTab }: AdminCalendarDashboardProps) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'maintenance_calendar');

  // Si App cambia initialTab (por navegación), reflejarlo.
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  const header = useMemo(() => {
    switch (tab) {
      case 'maintenance_calendar':
        return {
          title: 'Calendario de Mantenimientos',
          subtitle: 'Planifica mantenimientos y asignaciones por día/técnico.',
        };
      case 'mass_planner':
        return {
          title: 'Planificación Masiva',
          subtitle: 'Carga mensual de mantenimientos por técnico (masivo).',
        };
      case 'emergency_scheduler':
        return {
          title: 'Turnos de Emergencia',
          subtitle: 'Asignación/gestión de turnos de emergencia.',
        };
      case 'emergency_monthly':
        return {
          title: 'Turnos Mensuales (Vista)',
          subtitle: 'Vista mensual consolidada de turnos de emergencia.',
        };
      case 'coordination_requests':
        return {
          title: 'Solicitudes y Coordinación',
          subtitle: 'Revisión y coordinación de solicitudes (técnicos/clientes).',
        };
      case 'availability':
        return { title: 'Disponibilidad de Técnicos', subtitle: 'Disponibilidad / ausencias para planificación.' };
      case 'absences':
        return { title: 'Registrar Ausencias', subtitle: 'Ingresa ausencias para bloquear disponibilidad del técnico.' };
      default:
        return { title: 'Gestión de Calendario', subtitle: '' };
    }
  }, [tab]);

  return (
    <div className="p-4">
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-slate-900">{header.title}</h1>
        <p className="text-sm text-slate-600">{header.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'maintenance_calendar'} onClick={() => setTab('maintenance_calendar')}>
          Mantenimientos
        </TabButton>
        <TabButton active={tab === 'mass_planner'} onClick={() => setTab('mass_planner')}>
          Planificación Masiva
        </TabButton>
        <TabButton active={tab === 'emergency_scheduler'} onClick={() => setTab('emergency_scheduler')}>
          Turnos Emergencia
        </TabButton>
        <TabButton active={tab === 'emergency_monthly'} onClick={() => setTab('emergency_monthly')}>
          Vista Turnos Mensual
        </TabButton>
        <TabButton active={tab === 'coordination_requests'} onClick={() => setTab('coordination_requests')}>
          Solicitudes
        </TabButton>
        <TabButton active={tab === 'availability'} onClick={() => setTab('availability')}>
          Disponibilidad
        </TabButton>
        <TabButton active={tab === 'absences'} onClick={() => setTab('absences')}>
          Ausencias
        </TabButton>
      </div>

      <div className="mt-4">
        {tab === 'maintenance_calendar' ? <MaintenanceCalendarView onNavigate={onNavigate} /> : null}

        {tab === 'mass_planner' ? <MaintenanceMassPlannerV2 /> : null}

        {tab === 'emergency_scheduler' ? <EmergencyShiftScheduler /> : null}

        {tab === 'emergency_monthly' ? <EmergencyShiftsMonthlyView /> : null}

        {tab === 'coordination_requests' ? <CoordinationRequestsPanel /> : null}

        {tab === 'availability' ? <TechnicianAvailabilityPanel /> : null}

        {tab === 'absences' ? <TechnicianAbsenceForm /> : null}
      </div>
    </div>
  );
}