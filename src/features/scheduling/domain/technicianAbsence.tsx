export interface TechnicianAbsenceRow {
  id: string;
  technician_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  absence_type?: string | null;
  reason?: string | null;
  status: string; // pending | approved | rejected
}