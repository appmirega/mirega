import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  X,
  Building,
  User,
  Users,
  Clock,
  Calendar,
  Lock,
  AlertCircle,
  Trash2,
  Check,
  AlertTriangle,
} from "lucide-react";

interface Technician {
  technician_id: string;
  full_name: string;
  phone: string;
  email: string;
  is_on_leave: boolean;
  assignments_today: number;
  emergency_shift_type?: string;
}

interface MaintenanceAssignment {
  id: string;
  scheduled_date: string;
  scheduled_time_start: string;
  scheduled_time_end: string;
  building_name: string;
  client_name: string;
  assigned_to: string;
  is_external: boolean;
  status: string;
  is_fixed: boolean;
  is_holiday_date: boolean;
  display_status: string;
  estimated_duration_hours: number;
  assigned_technician_id?: string;
  publication_status?: string;

  // ✅ existe en MaintenanceCalendarView, lo agregamos aquí también
  emergency_context_notes?: string;
}

interface BuildingRow {
  id: string;
  name: string;
  address: string;
  client_id: string;
}

interface MaintenanceAssignmentModalProps {
  selectedDate: Date | null;
  assignment: MaintenanceAssignment | null;
  technicians: Technician[];
  technicianAbsences?: Map<string, Map<string, string[]>>;
  onClose: () => void;
  onSuccess: () => void;
}

export function MaintenanceAssignmentModal({
  selectedDate,
  assignment,
  technicians,
  technicianAbsences,
  onClose,
  onSuccess,
}: MaintenanceAssignmentModalProps) {
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isHoliday, setIsHoliday] = useState(false);

  // ✅ FIX: Hook dentro del componente (nunca antes de imports)
  const [emergencyContext, setEmergencyContext] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    building_id: "",
    assigned_technician_id: "",
    is_external: false,
    external_personnel_name: "",
    external_personnel_phone: "",
    scheduled_date: "",
    scheduled_time_start: "09:00",
    scheduled_time_end: "11:00",
    estimated_duration_hours: 2,
    is_fixed: false,
    notes: "",
    requires_additional_technicians: false,
    additional_technicians_count: 1,
    coordination_notes: "",
    assignment_type: "mantenimiento",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadBuildings();

    if (selectedDate) {
      // fecha local exacta (sin UTC)
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, "0");
      const dd = String(selectedDate.getDate()).padStart(2, "0");
      const dateStr = `${yyyy}-${mm}-${dd}`;

      setFormData((prev) => ({ ...prev, scheduled_date: dateStr }));
      checkHoliday(dateStr);
    }

    if (assignment) {
      loadAssignmentData();
    } else {
      // si es creación nueva, no mostrar contexto de emergencia de otra cosa
      setEmergencyContext(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, assignment]);

  const loadBuildings = async () => {
    const { data, error } = await supabase
      .from("buildings")
      .select("id, name, address, client_id")
      .order("name");

    if (error) {
      console.error("Error loading buildings:", error);
      return;
    }

    setBuildings((data as any[]) || []);
  };

  const loadAssignmentData = async () => {
    if (!assignment) return;

    const { data, error } = await supabase
      .from("maintenance_assignments")
      .select("*")
      .eq("id", assignment.id)
      .single();

    if (error) {
      console.error("Error loading assignment:", error);
      return;
    }

    setFormData({
      building_id: data.building_id || "",
      assigned_technician_id: data.assigned_technician_id || "",
      is_external: data.is_external || false,
      external_personnel_name: data.external_personnel_name || "",
      external_personnel_phone: data.external_personnel_phone || "",
      scheduled_date: data.scheduled_date,
      scheduled_time_start: data.scheduled_time_start,
      scheduled_time_end: data.scheduled_time_end,
      estimated_duration_hours: data.estimated_duration_hours || 2,
      is_fixed: data.is_fixed || false,
      notes: data.notes || "",
      requires_additional_technicians: data.requires_additional_technicians || false,
      additional_technicians_count: data.additional_technicians_count || 1,
      coordination_notes: data.coordination_notes || "",
      assignment_type: data.assignment_type || "mantenimiento",
    });

    // ✅ FIX: el UI lo usa, ahora sí lo seteamos
    setEmergencyContext((data.emergency_context_notes as string) ?? null);
  };

  const checkHoliday = async (date: string) => {
    const { data, error } = await supabase.rpc("is_holiday", { check_date: date });

    if (!error && data) {
      setIsHoliday(true);
    } else {
      setIsHoliday(false);
    }
  };

  const validateForm = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.building_id) {
      newErrors.building_id = "Seleccione un edificio";
    }

    if (!formData.is_external && !formData.assigned_technician_id) {
      newErrors.assigned_technician_id = "Seleccione un técnico";
    }

    if (formData.is_external) {
      if (!formData.external_personnel_name) {
        newErrors.external_personnel_name = 'Ingrese el nombre del personal externo';
      }
      if (!formData.external_personnel_phone) {
        newErrors.external_personnel_phone = 'Ingrese el teléfono del personal externo';
      }
    }

    if (!formData.scheduled_date) {
      newErrors.scheduled_date = "Seleccione una fecha";
    }

    if (!formData.scheduled_time_start) {
      newErrors.scheduled_time_start = "Seleccione hora de inicio";
    }

    if (!formData.scheduled_time_end) {
      newErrors.scheduled_time_end = "Seleccione hora de fin";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    const ok = await validateForm();
    if (!ok) return;

    setLoading(true);
    try {
      const payload: any = {
        building_id: formData.building_id,
        assigned_technician_id: formData.is_external ? null : formData.assigned_technician_id,
        is_external: formData.is_external,
        external_personnel_name: formData.is_external ? formData.external_personnel_name : null,
        external_personnel_phone: formData.is_external ? formData.external_personnel_phone : null,
        scheduled_date: formData.scheduled_date,
        scheduled_time_start: formData.scheduled_time_start,
        scheduled_time_end: formData.scheduled_time_end,
        estimated_duration_hours: formData.estimated_duration_hours,
        is_fixed: formData.is_fixed,
        notes: formData.notes,
        requires_additional_technicians: formData.requires_additional_technicians,
        additional_technicians_count: formData.additional_technicians_count,
        coordination_notes: formData.coordination_notes,
        assignment_type: formData.assignment_type,
      };

      if (assignment?.id) {
        const { error } = await supabase
          .from("maintenance_assignments")
          .update(payload)
          .eq("id", assignment.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("maintenance_assignments").insert(payload);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error saving assignment:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!assignment?.id) return;

    const ok = window.confirm("¿Eliminar esta asignación?");
    if (!ok) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("maintenance_assignments")
        .delete()
        .eq("id", assignment.id);

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error deleting assignment:", err);
    } finally {
      setLoading(false);
    }
  };

  const currentDateStr = formData.scheduled_date;
  const absencesForDay = currentDateStr ? technicianAbsences?.get(currentDateStr) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-semibold">
              {assignment ? "Editar asignación" : "Nueva asignación"}
            </h2>
            <p className="text-sm text-slate-500">
              {isHoliday ? "⚠️ Fecha feriado detectada" : "Planifica y asigna técnicos sin romper el calendario"}
            </p>
          </div>

          <button
            className="rounded-md p-2 hover:bg-slate-100"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {/* Edificio */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              <span className="inline-flex items-center gap-2">
                <Building className="h-4 w-4" /> Edificio
              </span>
            </label>
            <select
              className={`w-full rounded-md border px-3 py-2 text-sm outline-none ${
                errors.building_id ? "border-red-400" : "border-slate-200"
              }`}
              value={formData.building_id}
              onChange={(e) => setFormData((p) => ({ ...p, building_id: e.target.value }))}
            >
              <option value="">Seleccione...</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.address}
                </option>
              ))}
            </select>
            {errors.building_id && (
              <div className="mt-1 flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" /> {errors.building_id}
              </div>
            )}
          </div>

          {/* Asignación */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Users className="h-4 w-4" /> Técnico interno
              </label>

              <select
                disabled={formData.is_external}
                className={`mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none ${
                  errors.assigned_technician_id ? "border-red-400" : "border-slate-200"
                } ${formData.is_external ? "bg-slate-50" : ""}`}
                value={formData.assigned_technician_id}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, assigned_technician_id: e.target.value }))
                }
              >
                <option value="">Seleccione...</option>
                {technicians.map((t) => {
                  const isAbsent = absencesForDay?.has(t.technician_id) ?? false;
                  const reasons = isAbsent ? absencesForDay?.get(t.technician_id) ?? [] : [];
                  const badge = isAbsent ? ` (AUSENTE: ${reasons.join(", ")})` : "";
                  return (
                    <option key={t.technician_id} value={t.technician_id}>
                      {t.full_name}
                      {badge}
                    </option>
                  );
                })}
              </select>

              {errors.assigned_technician_id && !formData.is_external && (
                <div className="mt-1 flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> {errors.assigned_technician_id}
                </div>
              )}
            </div>

            <div className="rounded-lg border p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <User className="h-4 w-4" /> Personal externo
              </label>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_external}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      is_external: e.target.checked,
                      assigned_technician_id: e.target.checked ? "" : p.assigned_technician_id,
                    }))
                  }
                />
                <span className="text-sm text-slate-700">Asignar externo</span>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-2">
                <input
                  disabled={!formData.is_external}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none ${
                    errors.external_personnel_name ? "border-red-400" : "border-slate-200"
                  } ${!formData.is_external ? "bg-slate-50" : ""}`}
                  placeholder="Nombre"
                  value={formData.external_personnel_name}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, external_personnel_name: e.target.value }))
                  }
                />
                <input
                  disabled={!formData.is_external}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none ${
                    errors.external_personnel_phone ? "border-red-400" : "border-slate-200"
                  } ${!formData.is_external ? "bg-slate-50" : ""}`}
                  placeholder="Teléfono"
                  value={formData.external_personnel_phone}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, external_personnel_phone: e.target.value }))
                  }
                />
              </div>

              {(errors.external_personnel_name || errors.external_personnel_phone) &&
                formData.is_external && (
                  <div className="mt-2 space-y-1 text-sm text-red-600">
                    {errors.external_personnel_name && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> {errors.external_personnel_name}
                      </div>
                    )}
                    {errors.external_personnel_phone && (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" /> {errors.external_personnel_phone}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Fecha y Horas */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Fecha
                </span>
              </label>
              <input
                type="date"
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none ${
                  errors.scheduled_date ? "border-red-400" : "border-slate-200"
                }`}
                value={formData.scheduled_date}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, scheduled_date: e.target.value }));
                  checkHoliday(e.target.value);
                }}
              />
              {errors.scheduled_date && (
                <div className="mt-1 flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> {errors.scheduled_date}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Inicio
                </span>
              </label>
              <input
                type="time"
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none ${
                  errors.scheduled_time_start ? "border-red-400" : "border-slate-200"
                }`}
                value={formData.scheduled_time_start}
                onChange={(e) => setFormData((p) => ({ ...p, scheduled_time_start: e.target.value }))}
              />
              {errors.scheduled_time_start && (
                <div className="mt-1 flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> {errors.scheduled_time_start}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Fin
                </span>
              </label>
              <input
                type="time"
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none ${
                  errors.scheduled_time_end ? "border-red-400" : "border-slate-200"
                }`}
                value={formData.scheduled_time_end}
                onChange={(e) => setFormData((p) => ({ ...p, scheduled_time_end: e.target.value }))}
              />
              {errors.scheduled_time_end && (
                <div className="mt-1 flex items-center gap-2 text-sm text-red-600">
                  <AlertCircle className="h-4 w-4" /> {errors.scheduled_time_end}
                </div>
              )}
            </div>
          </div>

          {/* Bloquear fecha */}
          <div className="rounded-lg border p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={formData.is_fixed}
                onChange={(e) => setFormData((p) => ({ ...p, is_fixed: e.target.checked }))}
              />
              <Lock className="h-4 w-4 text-slate-600" />
              <span className="text-sm text-slate-700">
                Bloquear fecha (no permitir reprogramación)
              </span>
            </label>
          </div>

          {/* Contexto de Emergencias */}
          {emergencyContext && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
                <div className="whitespace-pre-wrap text-sm text-orange-800">{emergencyContext}</div>
              </div>
            </div>
          )}

          {/* Notas */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notas</label>
            <textarea
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notas internas..."
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4">
          <div className="flex gap-2">
            {assignment?.id && (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                onClick={handleDelete}
                disabled={loading}
              >
                <Trash2 className="h-4 w-4" /> Eliminar
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-slate-50"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              onClick={handleSave}
              disabled={loading}
            >
              <Check className="h-4 w-4" /> {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}