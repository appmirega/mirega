import { useState, useEffect } from 'react';
import { Calendar, Upload, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { activityLogger } from '../../services/activityLogger';

interface Elevator {
  id: string;
  internal_code: string;
  client: {
    name: string;
  };
  location: string;
}

interface BulkSchedule {
  elevator_id: string;
  scheduled_date: string;
  technician_id?: string;
  notes?: string;
}

export function BulkOperationsView() {
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedElevators, setSelectedElevators] = useState<Set<string>>(new Set());
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
    activityLogger.logViewChange('bulk-operations').catch(() => {});
  }, []);

  const loadData = async () => {
    const { data: elevatorsData } = await supabase
      .from('elevators')
      .select(`
        id,
        internal_code,
        location,
        client:clients(name)
      `)
      .order('internal_code');

    const { data: techsData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'technician')
      .order('full_name');

    if (elevatorsData) setElevators(elevatorsData as any);
    if (techsData) setTechnicians(techsData);
  };

  const toggleElevator = (id: string) => {
    const newSelected = new Set(selectedElevators);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedElevators(newSelected);
  };

  const selectAll = () => {
    setSelectedElevators(new Set(elevators.map(e => e.id)));
  };

  const clearSelection = () => {
    setSelectedElevators(new Set());
  };

  const handleBulkSchedule = async () => {
    if (selectedElevators.size === 0) {
      setError('Selecciona al menos un elevador');
      return;
    }

    if (!scheduledDate) {
      setError('Selecciona una fecha');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const schedules: BulkSchedule[] = Array.from(selectedElevators).map(elevatorId => ({
        elevator_id: elevatorId,
        scheduled_date: scheduledDate,
        technician_id: selectedTechnician || undefined,
        notes: notes || undefined,
        status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('maintenance_schedules')
        .insert(schedules);

      if (insertError) throw insertError;

      activityLogger.logActivity({
        activity_type: 'bulk_operation',
        description: `Programó mantenimiento masivo para ${selectedElevators.size} elevadores`,
        metadata: {
          count: selectedElevators.size,
          date: scheduledDate,
          technician_id: selectedTechnician
        }
      }).catch(() => {});

      setSuccess(true);
      setSelectedElevators(new Set());
      setScheduledDate('');
      setSelectedTechnician('');
      setNotes('');

      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error al programar mantenimientos');
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').slice(1);

        const schedules: BulkSchedule[] = lines
          .filter(line => line.trim())
          .map(line => {
            const [elevatorCode, date, technicianName, notes] = line.split(',').map(s => s.trim());

            const elevator = elevators.find(e => e.internal_code === elevatorCode);
            const technician = technicians.find(t => t.full_name === technicianName);

            if (!elevator) return null;

            return {
              elevator_id: elevator.id,
              scheduled_date: date,
              technician_id: technician?.id,
              notes: notes || undefined,
              status: 'pending'
            };
          })
          .filter(Boolean) as BulkSchedule[];

        if (schedules.length === 0) {
          setError('No se encontraron registros válidos en el CSV');
          return;
        }

        setLoading(true);
        const { error: insertError } = await supabase
          .from('maintenance_schedules')
          .insert(schedules);

        if (insertError) throw insertError;

        activityLogger.logActivity({
          activity_type: 'bulk_operation',
          description: `Importó ${schedules.length} programaciones desde CSV`,
          metadata: { count: schedules.length, source: 'csv' }
        }).catch(() => {});

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (err: any) {
        setError(err.message || 'Error al importar CSV');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="w-8 h-8" />
          Operaciones Masivas
        </h1>
        <p className="text-slate-600 mt-1">
          Programa mantenimientos para múltiples elevadores simultáneamente
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800">Operación completada exitosamente</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                Seleccionar Elevadores ({selectedElevators.size})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Seleccionar todos
                </button>
                <span className="text-slate-400">|</span>
                <button
                  onClick={clearSelection}
                  className="text-sm text-slate-600 hover:text-slate-900"
                >
                  Limpiar
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {elevators.map((elevator) => (
                <label
                  key={elevator.id}
                  className="flex items-center gap-3 p-4 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedElevators.has(elevator.id)}
                    onChange={() => toggleElevator(elevator.id)}
                    className="w-4 h-4 text-slate-900 rounded focus:ring-slate-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-slate-900">
                      {elevator.internal_code}
                    </div>
                    <div className="text-sm text-slate-600">
                      {elevator.client.name} - {elevator.location}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-4">Importar desde CSV</h3>
            <p className="text-sm text-slate-600 mb-4">
              Formato: Código Elevador, Fecha (YYYY-MM-DD), Técnico, Notas
            </p>
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer transition-colors w-fit">
              <Upload className="w-4 h-4" />
              Seleccionar archivo CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4">
              Detalles de Programación
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha de Mantenimiento *
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Técnico Asignado
                </label>
                <select
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                >
                  <option value="">Sin asignar</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Notas
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-transparent resize-none"
                  placeholder="Notas adicionales para todos los mantenimientos..."
                />
              </div>

              <button
                onClick={handleBulkSchedule}
                disabled={loading || selectedElevators.size === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    Programando...
                  </>
                ) : (
                  <>
                    <Calendar className="w-5 h-5" />
                    Programar {selectedElevators.size} Mantenimiento{selectedElevators.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-900 mb-2 text-sm">
              Resumen
            </h3>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Elevadores seleccionados: {selectedElevators.size}</li>
              <li>• Fecha: {scheduledDate || 'No seleccionada'}</li>
              <li>• Técnico: {technicians.find(t => t.id === selectedTechnician)?.full_name || 'Sin asignar'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}