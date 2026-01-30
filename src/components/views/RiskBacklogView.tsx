import React, { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2, Shield, Timer, Download } from 'lucide-react';
import { getBacklog, getRiskData, BacklogItem, ElevatorRisk } from '../../lib/riskService';

interface CardProps {
  title: string;
  value: string;
  description?: string;
  icon: React.ReactNode;
  tone?: 'info' | 'warn' | 'ok';
}

function StatCard({ title, value, description, icon, tone = 'info' }: CardProps) {
  const toneClass =
    tone === 'warn'
      ? 'bg-orange-50 border-orange-200 text-orange-800'
      : tone === 'ok'
      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : 'bg-sky-50 border-sky-200 text-sky-800';

  return (
    <div className={`rounded-xl border ${toneClass} p-4 shadow-sm flex items-start gap-3`}>
      <div className="mt-1">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-2xl font-bold leading-7">{value}</p>
        {description && <p className="text-xs text-slate-600 mt-1">{description}</p>}
      </div>
    </div>
  );
}

function bandLabel(band: ElevatorRisk['band']) {
  if (band === 'high') return 'Alto';
  if (band === 'medium') return 'Medio';
  return 'Bajo';
}

function bandColor(band: ElevatorRisk['band']) {
  if (band === 'high') return 'bg-rose-50 border-rose-200 text-rose-700';
  if (band === 'medium') return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-emerald-50 border-emerald-200 text-emerald-700';
}

export default function RiskBacklogView() {
  const [risk, setRisk] = useState<ElevatorRisk[]>([]);
  const [backlog, setBacklog] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const [riskData, backlogData] = await Promise.all([getRiskData(), getBacklog()]);
        if (!mounted) return;
        setRisk(riskData);
        setBacklog(backlogData);
      } catch (err) {
        console.error('Risk/Backlog load error:', err);
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setError(`No pudimos cargar riesgos y backlog. Detalle: ${msg}`);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredRisk = useMemo(() => {
    if (riskFilter === 'all') return risk;
    return risk.filter((r) => r.band === riskFilter);
  }, [risk, riskFilter]);

  const filteredBacklog = useMemo(() => {
    if (statusFilter === 'all') return backlog;
    return backlog.filter((b) => b.status === statusFilter);
  }, [backlog, statusFilter]);

  const topRisk = useMemo(() => filteredRisk.slice(0, 6), [filteredRisk]);
  const overdueBacklog = useMemo(() => filteredBacklog.filter((b) => b.ageDays >= 15), [filteredBacklog]);

  const avgProbability = useMemo(() => {
    if (!filteredRisk.length) return 0;
    const total = filteredRisk.reduce((acc, r) => acc + r.probability, 0);
    return (total / filteredRisk.length) * 100;
  }, [filteredRisk]);

  const highRiskCount = useMemo(() => filteredRisk.filter((r) => r.band === 'high').length, [filteredRisk]);
  const backlogValue = useMemo(() => filteredBacklog.reduce((acc, b) => acc + b.value, 0), [filteredBacklog]);
  const backlogAvgAge = useMemo(() => {
    if (!filteredBacklog.length) return 0;
    return filteredBacklog.reduce((acc, b) => acc + b.ageDays, 0) / filteredBacklog.length;
  }, [filteredBacklog]);
  const backlogOver15Pct = useMemo(() => {
    if (!filteredBacklog.length) return 0;
    return (overdueBacklog.length * 100) / filteredBacklog.length;
  }, [filteredBacklog, overdueBacklog]);

  const handleExport = (rows: string[][], filename: string) => {
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const handleExportRisk = () => {
    const rows = [
      ['Ascensor', 'Riesgo', 'Probabilidad', 'Impacto', 'Fallas', 'Banda'],
      ...filteredRisk.map((r) => [
        r.elevatorName,
        r.riskScore.toFixed(0),
        `${(r.probability * 100).toFixed(0)}%`,
        r.impact.toFixed(0),
        r.failures.toString(),
        r.band,
      ]),
    ];
    handleExport(rows, `gestion-trabajo-riesgo-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportBacklog = () => {
    const rows = [
      ['Orden', 'Equipo', 'Estado', 'Edad_dias', 'Valor'],
      ...filteredBacklog.map((b) => [
        b.workOrderId,
        b.elevatorId || 'Ascensor',
        b.status,
        b.ageDays.toString(),
        b.value.toFixed(0),
      ]),
    ];
    handleExport(rows, `gestion-trabajo-backlog-${new Date().toISOString().split('T')[0]}.csv`);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Cargando riesgos y backlog...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-rose-600">{error}</p>
        <p className="text-xs text-slate-500">Revisa permisos de lectura y nombres de columnas en Supabase.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Trabajo</h1>
          <p className="text-slate-600">Priorización para mitigación y ejecución rápida.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 mr-2">
            <div className="h-3 w-3 rounded bg-rose-300" /> Alto
            <div className="h-3 w-3 rounded bg-amber-300" /> Medio
            <div className="h-3 w-3 rounded bg-emerald-300" /> Bajo
          </div>
          <button
            onClick={handleExportRisk}
            className="flex items-center gap-1 px-3 py-2 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            <Download className="h-4 w-4" /> Riesgo CSV
          </button>
          <button
            onClick={handleExportBacklog}
            className="flex items-center gap-1 px-3 py-2 text-xs bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            <Download className="h-4 w-4" /> Backlog CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard
          title="Riesgo promedio"
          value={`${avgProbability.toFixed(0)}%`}
          description="Probabilidad promedio de falla anualizada"
          icon={<Shield className="h-5 w-5" />}
        />
        <StatCard
          title="Equipos riesgo alto"
          value={highRiskCount.toString()}
          description="Priorizar inspección preventiva"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={highRiskCount > 0 ? 'warn' : 'ok'}
        />
        <StatCard
          title="Ordenes abiertas"
          value={filteredBacklog.length.toString()}
          description="Pendientes en ejecución"
          icon={<Activity className="h-5 w-5" />}
          tone={filteredBacklog.length > 8 ? 'warn' : 'info'}
        />
        <StatCard
          title="Monto expuesto"
          value={`$${(backlogValue / 1000).toFixed(0)}k`}
          description="Valor de órdenes sin cerrar"
          icon={<Timer className="h-5 w-5" />}
          tone={backlogValue > 800000 ? 'warn' : 'info'}
        />
        <StatCard
          title="Edad prom. backlog"
          value={`${backlogAvgAge.toFixed(0)}d`}
          description="Días promedio abiertas"
          icon={<Timer className="h-5 w-5" />}
          tone={backlogAvgAge > 15 ? 'warn' : 'info'}
        />
      </div>

      <div className="flex flex-wrap gap-4 bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <div className="space-y-1 text-sm">
          <p className="text-slate-600">Filtro de riesgo</p>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          >
            <option value="all">Todos</option>
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Bajo</option>
          </select>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-slate-600">Filtro de estado OT</p>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="approved">Aprobado</option>
            <option value="in_progress">En progreso</option>
          </select>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-slate-600">Backlog &gt;15 días</p>
          <p className="font-semibold text-slate-900">{backlogOver15Pct.toFixed(0)}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Top riesgo</p>
              <p className="text-xs text-slate-500">Equipos con mayor severidad</p>
            </div>
            <Shield className="h-4 w-4 text-slate-500" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {topRisk.map((r) => (
              <div
                key={r.elevatorId}
                className={`rounded-lg border p-3 ${bandColor(r.band)} shadow-sm`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{r.elevatorName}</p>
                  <span className="text-xs font-bold uppercase tracking-wide">{bandLabel(r.band)}</span>
                </div>
                <p className="text-xs text-slate-600">Riesgo ${(r.riskScore / 1000).toFixed(1)}k</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                  <span className="rounded bg-white/70 px-2 py-1 border border-white/60">
                    Prob: {(r.probability * 100).toFixed(0)}%
                  </span>
                  <span className="rounded bg-white/70 px-2 py-1 border border-white/60">
                    Impacto: ${(r.impact / 1000).toFixed(0)}k
                  </span>
                  <span className="rounded bg-white/70 px-2 py-1 border border-white/60">
                    Fallas: {r.failures}
                  </span>
                </div>
              </div>
            ))}
            {topRisk.length === 0 && <p className="text-sm text-slate-500">Sin registros suficientes.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Backlog crítico</p>
              <p className="text-xs text-slate-500">Ordenes con más de 15 días</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="space-y-2">
            {overdueBacklog.slice(0, 8).map((item) => (
              <div key={item.workOrderId} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.description}</p>
                  <p className="text-xs text-slate-500">{item.status} • {item.ageDays} días</p>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <p className="font-semibold">${(item.value / 1000).toFixed(0)}k</p>
                  <p className="text-emerald-600">{item.elevatorId || 'Ascensor'}</p>
                </div>
              </div>
            ))}
            {overdueBacklog.length === 0 && <p className="text-sm text-slate-500">Sin backlog crítico.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-slate-700">Backlog completo</p>
            <p className="text-xs text-slate-500">Ordenes abiertas para seguimiento operativo</p>
          </div>
          <CheckCircle2 className="h-4 w-4 text-slate-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-2">Orden</th>
                <th className="py-2">Equipo</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Edad</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {filteredBacklog.slice(0, 50).map((item) => (
                <tr key={item.workOrderId} className="border-t text-slate-700">
                  <td className="py-2 pr-2 font-semibold">{item.workOrderId}</td>
                  <td className="py-2 pr-2">{item.elevatorId || 'Ascensor'}</td>
                  <td className="py-2 pr-2 capitalize">{item.status}</td>
                  <td className="py-2 pr-2">{item.ageDays} días</td>
                  <td className="py-2 text-right">${(item.value / 1000).toFixed(0)}k</td>
                </tr>
              ))}
              {filteredBacklog.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">
                    No hay órdenes abiertas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
