import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, Users, Wrench, FileText, Calendar, Award } from 'lucide-react';

interface Stats {
  totalChecklists: number;
  completedThisMonth: number;
  totalClients: number;
  totalElevators: number;
  totalTechnicians: number;
  avgChecklistTime: number;
}

interface MonthlyData {
  month: string;
  completed: number;
}

interface TechnicianPerformance {
  name: string;
  completed: number;
  avg_time: number;
}

interface ElevatorIssues {
  elevator: string;
  issues: number;
}

export function StatisticsView() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalChecklists: 0,
    completedThisMonth: 0,
    totalClients: 0,
    totalElevators: 0,
    totalTechnicians: 0,
    avgChecklistTime: 0,
  });
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [technicianPerformance, setTechnicianPerformance] = useState<TechnicianPerformance[]>([]);
  const [elevatorIssues, setElevatorIssues] = useState<ElevatorIssues[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const { data: checklists } = await supabase
        .from('mnt_checklists')
        .select('*, profiles(full_name), elevators(brand, model)');

      const { data: clients } = await supabase
        .from('clients')
        .select('id');

      const { data: elevators } = await supabase
        .from('elevators')
        .select('id');

      const { data: technicians } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'technician');

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const completedThisMonth = checklists?.filter(
        (c) => c.status === 'completed' && c.month === currentMonth && c.year === currentYear
      ).length || 0;

      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const last6Months: MonthlyData[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        const completed = checklists?.filter(
          (c) => c.status === 'completed' && c.month === month && c.year === year
        ).length || 0;

        last6Months.push({
          month: monthNames[month - 1],
          completed,
        });
      }
      setMonthlyData(last6Months);

      const techPerformance = new Map<string, { completed: number; total_time: number }>();
      checklists?.forEach((c) => {
        if (c.status === 'completed' && c.profiles) {
          const name = c.profiles.full_name;
          const existing = techPerformance.get(name) || { completed: 0, total_time: 0 };

          let time = 0;
          if (c.created_at && c.completion_date) {
            time = (new Date(c.completion_date).getTime() - new Date(c.created_at).getTime()) / (1000 * 60);
          }

          techPerformance.set(name, {
            completed: existing.completed + 1,
            total_time: existing.total_time + time,
          });
        }
      });

      const techArray: TechnicianPerformance[] = Array.from(techPerformance.entries())
        .map(([name, data]) => ({
          name,
          completed: data.completed,
          avg_time: data.completed > 0 ? Math.round(data.total_time / data.completed) : 0,
        }))
        .sort((a, b) => b.completed - a.completed)
        .slice(0, 5);

      setTechnicianPerformance(techArray);

      const { data: answers } = await supabase
        .from('mnt_checklist_answers')
        .select('*, mnt_checklists!inner(elevators(brand, model))');

      const issuesMap = new Map<string, number>();
      answers?.forEach((a) => {
        if (a.status === 'rejected' && a.mnt_checklists?.elevators) {
          const elevator = `${a.mnt_checklists.elevators.brand} ${a.mnt_checklists.elevators.model}`;
          issuesMap.set(elevator, (issuesMap.get(elevator) || 0) + 1);
        }
      });

      const issuesArray: ElevatorIssues[] = Array.from(issuesMap.entries())
        .map(([elevator, issues]) => ({ elevator, issues }))
        .sort((a, b) => b.issues - a.issues)
        .slice(0, 5);

      setElevatorIssues(issuesArray);

      const inProgress = checklists?.filter((c) => c.status === 'in_progress').length || 0;
      const completed = checklists?.filter((c) => c.status === 'completed').length || 0;

      setStatusDistribution([
        { name: 'Completados', value: completed, color: '#22c55e' },
        { name: 'En Progreso', value: inProgress, color: '#eab308' },
      ]);

      setStats({
        totalChecklists: checklists?.length || 0,
        completedThisMonth,
        totalClients: clients?.length || 0,
        totalElevators: elevators?.length || 0,
        totalTechnicians: technicians?.length || 0,
        avgChecklistTime: techArray.length > 0
          ? Math.round(techArray.reduce((sum, t) => sum + t.avg_time, 0) / techArray.length)
          : 0,
      });
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Estadísticas y Reportes</h1>
        <p className="text-slate-600 mt-1">Panel de métricas y análisis del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-10 h-10 opacity-80" />
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-4xl font-bold mb-2">{stats.totalChecklists}</p>
          <p className="text-blue-100">Total Checklists</p>
          <p className="text-sm text-blue-200 mt-2">
            {stats.completedThisMonth} completados este mes
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-10 h-10 opacity-80" />
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-4xl font-bold mb-2">{stats.totalClients}</p>
          <p className="text-green-100">Clientes Activos</p>
          <p className="text-sm text-green-200 mt-2">
            {stats.totalElevators} ascensores registrados
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <Wrench className="w-10 h-10 opacity-80" />
            <Award className="w-6 h-6" />
          </div>
          <p className="text-4xl font-bold mb-2">{stats.totalTechnicians}</p>
          <p className="text-purple-100">Técnicos Activos</p>
          <p className="text-sm text-purple-200 mt-2">
            Promedio {stats.avgChecklistTime} min/checklist
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Checklists Completados (Últimos 6 Meses)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={2} name="Completados" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            Estado de Checklists
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-600" />
            Top 5 Técnicos Más Productivos
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={technicianPerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip />
              <Legend />
              <Bar dataKey="completed" fill="#8b5cf6" name="Completados" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-red-600" />
            Ascensores con Más Problemas
          </h3>
          {elevatorIssues.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={elevatorIssues}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="elevator" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="issues" fill="#ef4444" name="Problemas Encontrados" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-slate-500">No hay datos de problemas</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3">Información del Panel</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Los datos se actualizan en tiempo real</li>
          <li>Las métricas incluyen todos los checklists del sistema</li>
          <li>El tiempo promedio se calcula desde creación hasta completado</li>
          <li>Los gráficos muestran tendencias de los últimos 6 meses</li>
        </ul>
      </div>
    </div>
  );
}
