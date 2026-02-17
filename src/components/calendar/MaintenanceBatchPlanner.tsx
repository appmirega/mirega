import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Calendar, Building, User, Check, AlertCircle } from 'lucide-react';

interface Technician {
  id: string;
  full_name: string;
}

interface Building {
  id: string;
  name: string;
  address: string;
}

export function MaintenanceBatchPlanner({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState('');
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    supabase.from('buildings').select('id, name, address').then(({ data }) => setBuildings(data || []));
    supabase.from('profiles').select('id, full_name').eq('role', 'technician').then(({ data }) => setTechnicians(data || []));
  }, []);

  // Valida si el edificio ya tiene mantenimiento asignado en el rango
  const checkConflicts = async (buildingId: string, start: string, days: number) => {
    const startDateObj = new Date(start);
    const endDateObj = new Date(start);
    endDateObj.setDate(startDateObj.getDate() + days - 1);
    const startStr = startDateObj.toISOString().slice(0, 10);
    const endStr = endDateObj.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('maintenance_assignments')
      .select('id, scheduled_date, building_id')
      .eq('building_id', buildingId)
      .gte('scheduled_date', startStr)
      .lte('scheduled_date', endStr);
    if (error) return true;
    return data && data.length > 0;
  };

  const handlePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedBuilding || !selectedTechnician || !startDate || days < 1) {
      setError('Completa todos los campos.');
      return;
    }
    // Solo lunes a viernes para internos
    const start = new Date(startDate);
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if ([0, 6].includes(d.getDay())) {
        setError('Solo se pueden asignar días hábiles (lunes a viernes) para técnicos internos.');
        return;
      }
    }
    setLoading(true);
    const conflict = await checkConflicts(selectedBuilding, startDate, days);
    if (conflict) {
      setError('Ya existe un mantenimiento asignado para este edificio en ese rango.');
      setLoading(false);
      return;
    }
    // Crear asignaciones para cada día
    const assignments = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      assignments.push({
        building_id: selectedBuilding,
        assigned_technician_id: selectedTechnician,
        scheduled_date: d.toISOString().slice(0, 10),
        assignment_type: 'mantenimiento',
        is_external: false,
        status: 'scheduled',
      });
    }
    const { error: insertError } = await supabase.from('maintenance_assignments').insert(assignments);
    setLoading(false);
    if (insertError) {
      setError('Error al asignar mantenimiento: ' + insertError.message);
    } else {
      setSuccess('Mantenimiento planificado correctamente.');
      setSelectedBuilding('');
      setSelectedTechnician('');
      setStartDate('');
      setDays(1);
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded shadow p-6 mt-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Calendar className="w-6 h-6" /> Planificador de Mantenimiento</h2>
      <form onSubmit={handlePlan} className="space-y-4">
        <div>
          <label className="block font-medium mb-1"><Building className="inline w-4 h-4 mr-1" /> Edificio</label>
          <select value={selectedBuilding} onChange={e => setSelectedBuilding(e.target.value)} className="border rounded px-2 py-1 w-full" required>
            <option value="">Selecciona un edificio</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.name} - {b.address}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1"><User className="inline w-4 h-4 mr-1" /> Técnico</label>
          <select value={selectedTechnician} onChange={e => setSelectedTechnician(e.target.value)} className="border rounded px-2 py-1 w-full" required>
            <option value="">Selecciona un técnico</option>
            {technicians.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Fecha de inicio</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded px-2 py-1 w-full" required />
        </div>
        <div>
          <label className="block font-medium mb-1">Cantidad de días</label>
          <input type="number" min={1} max={31} value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded px-2 py-1 w-full" required />
        </div>
        {error && <div className="bg-red-100 text-red-700 rounded p-2 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
        {success && <div className="bg-green-100 text-green-700 rounded p-2 flex items-center gap-2"><Check className="w-4 h-4" /> {success}</div>}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded w-full" disabled={loading}>{loading ? 'Asignando...' : 'Planificar'}</button>
      </form>
    </div>
  );
}
