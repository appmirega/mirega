import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  AlertTriangle,
  Users,
  Wrench,
  Clock,
  TrendingUp,
  Zap,
  AlertCircle,
  CheckCircle,
  FileText,
} from "lucide-react";

interface AlertDashboardProps {
  onNavigate?: (path: string) => void;
}

interface AlertStats {
  activeEmergencies: number;
  pendingApprovals: number;
  clientRequests: number;
  techniciansAvailable: number;
  maintenanceToday: number;
  overdueTasks: number;
  elevatorIssues: number;
  pendingQuotations: number;
}

export function AlertDashboard({ onNavigate }: AlertDashboardProps = {}) {
  const [stats, setStats] = useState<AlertStats>({
    activeEmergencies: 0,
    pendingApprovals: 0,
    clientRequests: 0,
    techniciansAvailable: 0,
    maintenanceToday: 0,
    overdueTasks: 0,
    elevatorIssues: 0,
    pendingQuotations: 0,
  });

  const [loading, setLoading] = useState(true);

  const actionPaths: Record<string, string> = {
    "Ver emergencias": "emergencies",
    "Revisar reportes": "stopped-elevators",
    "Gestionar urgentes": "work-orders",
    "Aprobar órdenes": "work-orders",
    "Ver solicitudes": "service-requests",
    "Seguimiento": "service-requests",
    "Ver equipo": "users",
    "Ver cronograma": "calendar",
  };

  useEffect(() => {
    loadAlertData();
  }, []);

  const loadAlertData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const threeDaysAgo = new Date(
        new Date().setDate(new Date().getDate() - 3)
      ).toISOString();

      const { count: emergencies } = await supabase
        .from("emergency_visits")
        .select("id", { count: "exact", head: true })
        .in("status", ["reported", "assigned", "in_progress"]);

      const { count: pendingWO } = await supabase
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_approval");

      const { count: clientReqs } = await supabase
        .from("service_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .eq("created_by_client", true);

      const { count: techs } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "technician")
        .eq("is_active", true);

      const { count: maintenance } = await supabase
        .from("maintenance_schedules")
        .select("id", { count: "exact", head: true })
        .eq("scheduled_date", today);

      const { count: overdue } = await supabase
        .from("work_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_approval")
        .lt("created_at", threeDaysAgo);

      const { count: elevatorProblems } = await supabase
        .from("emergency_visits")
        .select("id", { count: "exact", head: true })
        .eq("final_status", "stopped")
        .is("reactivation_date", null);

      const { count: quotes } = await supabase
        .from("quotations")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent");

      setStats({
        activeEmergencies: emergencies || 0,
        pendingApprovals: pendingWO || 0,
        clientRequests: clientReqs || 0,
        techniciansAvailable: techs || 0,
        maintenanceToday: maintenance || 0,
        overdueTasks: overdue || 0,
        elevatorIssues: elevatorProblems || 0,
        pendingQuotations: quotes || 0,
      });
    } catch (error) {
      console.error("Error loading alert data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const alerts = [
    {
      id: "emergencies",
      title: "Emergencias Activas",
      value: stats.activeEmergencies,
      icon: AlertTriangle,
      color: "red",
      severity: stats.activeEmergencies > 0 ? "critical" : "normal",
      description: "Llamadas de emergencia que requieren atención inmediata",
      action: "Ver emergencias",
    },
    {
      id: "elevator-issues",
      title: "Ascensores con Problemas",
      value: stats.elevatorIssues,
      icon: Zap,
      color: "orange",
      severity: stats.elevatorIssues > 0 ? "warning" : "normal",
      description: "Reportes de fallas en ascensores",
      action: "Revisar reportes",
    },
    {
      id: "pending-approvals",
      title: "Pendientes de Aprobación",
      value: stats.pendingApprovals,
      icon: Clock,
      color: "yellow",
      severity: stats.pendingApprovals > 0 ? "warning" : "normal",
      description: "Órdenes de trabajo aguardando aprobación",
      action: "Aprobar órdenes",
    },
    {
      id: "overdue",
      title: "Tareas Vencidas",
      value: stats.overdueTasks,
      icon: AlertCircle,
      color: "red",
      severity: stats.overdueTasks > 0 ? "critical" : "normal",
      description: "Órdenes sin completar por más de 3 días",
      action: "Gestionar urgentes",
    },
    {
      id: "client-requests",
      title: "Solicitudes de Clientes",
      value: stats.clientRequests,
      icon: Users,
      color: "blue",
      severity: stats.clientRequests > 2 ? "warning" : "normal",
      description: "Nuevas solicitudes de servicio",
      action: "Ver solicitudes",
    },
    {
      id: "quotations",
      title: "Cotizaciones Pendientes",
      value: stats.pendingQuotations,
      icon: FileText,
      color: "purple",
      severity: stats.pendingQuotations > 0 ? "warning" : "normal",
      description: "Cotizaciones en espera",
      action: "Seguimiento",
    },
    {
      id: "technicians",
      title: "Técnicos Disponibles",
      value: stats.techniciansAvailable,
      icon: Wrench,
      color: "green",
      severity: "normal",
      description: "Técnicos activos en el sistema",
      action: "Ver equipo",
    },
    {
      id: "maintenance",
      title: "Mantenimientos Hoy",
      value: stats.maintenanceToday,
      icon: TrendingUp,
      color: "cyan",
      severity: "normal",
      description: "Mantenimientos programados hoy",
      action: "Ver cronograma",
    },
  ];

  const AlertCard = ({ alert }: { alert: any }) => {
    const Icon = alert.icon;

    const handleClick = () => {
      const path = actionPaths[alert.action];
      if (path) onNavigate?.(path);
    };

    return (
      <div className="border rounded-xl p-4 bg-white shadow hover:shadow-lg transition">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-slate-700" />
            <span className="font-semibold text-sm">{alert.title}</span>
          </div>

          <span className="text-lg font-bold">{alert.value}</span>
        </div>

        <p className="text-xs text-slate-600 mb-3">{alert.description}</p>

        <button
          onClick={handleClick}
          className="w-full text-xs font-semibold py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
        >
          {alert.action} →
        </button>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}