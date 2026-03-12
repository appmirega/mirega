import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  Calendar,
  ClipboardList,
  AlertTriangle,
  FileText,
  User,
  Siren,
  ClipboardCheck,
} from "lucide-react";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
};

type DashboardStats = {
  stoppedElevators: number;
  emergenciesThisMonth: number;
  myRequestsThisMonth: number;
  myRequestsManaged: number;
  myWorkOrdersIssued: number;
  myWorkOrdersCompleted: number;
};

interface TechnicianDashboardProps {
  onNavigate?: (path: string) => void;
}

export function TechnicianDashboard({
  onNavigate,
}: TechnicianDashboardProps = {}) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    stoppedElevators: 0,
    emergenciesThisMonth: 0,
    myRequestsThisMonth: 0,
    myRequestsManaged: 0,
    myWorkOrdersIssued: 0,
    myWorkOrdersCompleted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Auth session missing!");

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const typedProfile = profileData as ProfileRow;
      setProfile(typedProfile);

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const firstDayOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDayOfMonth = new Date(year, month, 0).getDate();
      const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(
        lastDayOfMonth
      ).padStart(2, "0")}`;

      const managedStatuses = [
        "analyzing",
        "quotation_sent",
        "approved",
        "scheduled",
        "in_progress",
        "completed",
        "closed",
        "rejected",
      ];

      const completedWorkOrderStatuses = ["completed", "closed"];

      const [
        { count: stoppedCount, error: stoppedError },
        { count: emergenciesMonthCount, error: emergencyError },
        { count: myRequestsMonthCount, error: myRequestsMonthError },
        { count: myRequestsManagedCount, error: myRequestsManagedError },
        { count: myWorkOrdersIssuedCount, error: myWorkOrdersIssuedError },
        { count: myWorkOrdersCompletedCount, error: myWorkOrdersCompletedError },
      ] = await Promise.all([
        supabase
          .from("emergency_visits")
          .select("id", { count: "exact", head: true })
          .eq("final_status", "stopped")
          .is("reactivation_date", null)
          .eq("status", "completed"),

        supabase
          .from("emergency_visits")
          .select("id", { count: "exact", head: true })
          .gte("created_at", `${firstDayOfMonth}T00:00:00`)
          .lte("created_at", `${lastDayStr}T23:59:59`),

        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("created_by_technician_id", typedProfile.id)
          .gte("created_at", `${firstDayOfMonth}T00:00:00`)
          .lte("created_at", `${lastDayStr}T23:59:59`),

        supabase
          .from("service_requests")
          .select("id", { count: "exact", head: true })
          .eq("created_by_technician_id", typedProfile.id)
          .in("status", managedStatuses),

        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .eq("assigned_technician_id", typedProfile.id),

        supabase
          .from("work_orders")
          .select("id", { count: "exact", head: true })
          .eq("assigned_technician_id", typedProfile.id)
          .in("status", completedWorkOrderStatuses),
      ]);

      if (stoppedError) throw stoppedError;
      if (emergencyError) throw emergencyError;
      if (myRequestsMonthError) throw myRequestsMonthError;
      if (myRequestsManagedError) throw myRequestsManagedError;
      if (myWorkOrdersIssuedError) throw myWorkOrdersIssuedError;
      if (myWorkOrdersCompletedError) throw myWorkOrdersCompletedError;

      setStats({
        stoppedElevators: stoppedCount || 0,
        emergenciesThisMonth: emergenciesMonthCount || 0,
        myRequestsThisMonth: myRequestsMonthCount || 0,
        myRequestsManaged: myRequestsManagedCount || 0,
        myWorkOrdersIssued: myWorkOrdersIssuedCount || 0,
        myWorkOrdersCompleted: myWorkOrdersCompletedCount || 0,
      });
    } catch (err: any) {
      console.error("Error loading technician dashboard:", err);
      setError(err?.message || "No fue posible cargar el dashboard técnico.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Panel Técnico</h1>
        <p className="mt-1 text-slate-600">
          Acceso rápido a calendario, checklist y alertas operativas.
        </p>

        {profile && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
            <User className="h-4 w-4" />
            <span>{profile.full_name || profile.id}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => onNavigate?.("stopped-elevators")}
          className="rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-500 to-red-600 p-6 text-left text-white shadow-lg transition hover:scale-[1.01] hover:shadow-xl"
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="rounded-lg bg-white/20 p-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            {stats.stoppedElevators > 0 && (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-red-600">
                ALERTA
              </span>
            )}
          </div>

          <h3 className="mb-1 text-3xl font-bold">{stats.stoppedElevators}</h3>
          <p className="text-sm text-white/90">Ascensores detenidos</p>
          <p className="mt-2 text-xs text-white/80">
            Ver listado de ascensores detenidos
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.("emergency-history")}
          className="rounded-xl border bg-white p-6 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md"
        >
          <div className="mb-4 w-fit rounded-lg bg-blue-500 p-3 text-white">
            <Siren className="h-6 w-6" />
          </div>

          <h3 className="mb-1 text-2xl font-bold text-slate-900">
            {stats.emergenciesThisMonth}
          </h3>
          <p className="text-sm text-slate-600">Emergencias del mes</p>
          <p className="mt-2 text-xs text-slate-500">
            Ver historial mensual de emergencias
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.("service-requests")}
          className="rounded-xl border bg-white p-6 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md"
        >
          <div className="mb-4 w-fit rounded-lg bg-orange-500 p-3 text-white">
            <FileText className="h-6 w-6" />
          </div>

          <h3 className="mb-1 text-2xl font-bold text-slate-900">
            {stats.myRequestsManaged} / {stats.myRequestsThisMonth}
          </h3>
          <p className="text-sm text-slate-600">Mis solicitudes</p>
          <p className="mt-2 text-xs text-slate-500">
            Gestionadas por admin / Total del mes
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.("work-orders")}
          className="rounded-xl border bg-white p-6 text-left shadow-sm transition hover:scale-[1.01] hover:shadow-md"
        >
          <div className="mb-4 w-fit rounded-lg bg-amber-500 p-3 text-white">
            <ClipboardCheck className="h-6 w-6" />
          </div>

          <h3 className="mb-1 text-2xl font-bold text-slate-900">
            {stats.myWorkOrdersCompleted} / {stats.myWorkOrdersIssued}
          </h3>
          <p className="text-sm text-slate-600">Órdenes de trabajo</p>
          <p className="mt-2 text-xs text-slate-500">
            Completadas / Emitidas
          </p>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <button
          type="button"
          onClick={() => onNavigate?.("calendar")}
          className="rounded-xl border bg-white p-6 text-left shadow-sm transition hover:shadow-md"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3 text-blue-700">
              <Calendar className="h-6 w-6" />
            </div>
            <div className="text-lg font-semibold text-slate-900">
              Mi Calendario
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Revisa tus asignaciones, permisos y vacaciones.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.("maintenance-checklist")}
          className="rounded-xl border bg-white p-6 text-left shadow-sm transition hover:shadow-md"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-3 text-green-700">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div className="text-lg font-semibold text-slate-900">
              Checklist de Mantenimiento
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Accede a tus checklists y tareas técnicas.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate?.("emergencies")}
          className="rounded-xl border bg-white p-6 text-left shadow-sm transition hover:shadow-md"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-3 text-red-700">
              <Siren className="h-6 w-6" />
            </div>
            <div className="text-lg font-semibold text-slate-900">
              Emergencias
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Ingresa a la gestión general de emergencias.
          </p>
        </button>
      </div>
    </div>
  );
}