import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { BadgeDollarSign, CheckCircle2, FileText, XCircle } from 'lucide-react';

type ClientLite = {
  id: string;
  company_name?: string | null;
  building_name?: string | null;
  internal_alias?: string | null;
};

type QuotationLite = {
  id: string;
  client_id?: string | null;
  quotation_number?: string | null;
  status?: string | null;
  total_amount?: number | null;
  created_at?: string | null;
};

type ServiceRequestLite = {
  id: string;
  client_id?: string | null;
  request_type?: string | null;
  status?: string | null;
  quotation_amount?: number | string | null;
  quotation_number?: string | null;
  created_at?: string | null;
};

type RankedCommercial = {
  name: string;
  total: number;
  approved: number;
  rejected: number;
  amount: number;
};

const currency = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function getClientName(client?: ClientLite | null) {
  if (!client) return 'Sin cliente';
  return client.internal_alias || client.building_name || client.company_name || 'Sin cliente';
}

function normalizeQuotationStatus(status?: string | null) {
  const normalized = (status || '').toLowerCase();
  if (['approved', 'accepted', 'completed'].includes(normalized)) return 'approved';
  if (normalized === 'rejected') return 'rejected';
  return 'open';
}

function normalizeServiceRequestStatus(status?: string | null) {
  const normalized = (status || '').toLowerCase();
  if (['approved', 'completed', 'in_progress'].includes(normalized)) return 'approved';
  if (normalized === 'rejected') return 'rejected';
  return 'open';
}

export function CommercialAnalysisView() {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [quotations, setQuotations] = useState<QuotationLite[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestLite[]>([]);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clientsRes, quotationsRes, requestsRes] = await Promise.all([
        supabase.from('clients').select('id, company_name, building_name, internal_alias'),
        supabase
          .from('quotations')
          .select('id, client_id, quotation_number, status, total_amount, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('service_requests')
          .select('id, client_id, request_type, status, quotation_amount, quotation_number, created_at')
          .order('created_at', { ascending: false }),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (quotationsRes.error) throw quotationsRes.error;
      if (requestsRes.error) throw requestsRes.error;

      setClients((clientsRes.data as ClientLite[]) || []);
      setQuotations((quotationsRes.data as QuotationLite[]) || []);
      setServiceRequests((requestsRes.data as ServiceRequestLite[]) || []);
    } catch (error) {
      console.error('Error loading commercial analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const clientMap = useMemo(() => new Map(clients.map((item) => [item.id, item])), [clients]);

  const approvedQuotations = quotations.filter((item) => normalizeQuotationStatus(item.status) === 'approved');
  const rejectedQuotations = quotations.filter((item) => normalizeQuotationStatus(item.status) === 'rejected');
  const openQuotations = quotations.filter((item) => normalizeQuotationStatus(item.status) === 'open');
  const approvedRequests = serviceRequests.filter((item) => normalizeServiceRequestStatus(item.status) === 'approved');
  const rejectedRequests = serviceRequests.filter((item) => normalizeServiceRequestStatus(item.status) === 'rejected');

  const totalQuotedAmount = quotations.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  const approvedQuotedAmount = approvedQuotations.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  const linkedRequestAmount = serviceRequests.reduce((sum, item) => sum + Number(item.quotation_amount || 0), 0);
  const approvalRate = quotations.length > 0 ? Math.round((approvedQuotations.length / quotations.length) * 100) : 0;

  const topBuildings = useMemo(() => {
    const map = new Map<string, RankedCommercial>();

    quotations.forEach((item) => {
      const name = getClientName(item.client_id ? clientMap.get(item.client_id) : undefined);
      const current = map.get(name) || { name, total: 0, approved: 0, rejected: 0, amount: 0 };
      current.total += 1;
      current.amount += Number(item.total_amount || 0);

      const status = normalizeQuotationStatus(item.status);
      if (status === 'approved') current.approved += 1;
      if (status === 'rejected') current.rejected += 1;

      map.set(name, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [clientMap, quotations]);

  const requestTypeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();

    serviceRequests.forEach((item) => {
      const key = item.request_type || 'other';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [serviceRequests]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Análisis Comercial</h1>
        <p className="text-slate-600 mt-1">
          Conversión de cotizaciones, volumen por edificio y seguimiento de reparaciones solicitadas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Cotizaciones emitidas" value={quotations.length} detail={`${openQuotations.length} abiertas`} icon={FileText} />
        <MetricCard title="Cotizaciones aprobadas" value={approvedQuotations.length} detail={`${approvalRate}% de aprobación`} icon={CheckCircle2} />
        <MetricCard title="Cotizaciones rechazadas" value={rejectedQuotations.length} detail={`${rejectedRequests.length} solicitudes rechazadas`} icon={XCircle} />
        <MetricCard title="Monto cotizado" value={currency.format(totalQuotedAmount)} detail={`Aprobado: ${currency.format(approvedQuotedAmount)}`} icon={BadgeDollarSign} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Edificios con más cotizaciones</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3">Edificio / Cliente</th>
                  <th className="text-left px-5 py-3">Total</th>
                  <th className="text-left px-5 py-3">Aprobadas</th>
                  <th className="text-left px-5 py-3">Rechazadas</th>
                  <th className="text-left px-5 py-3">Monto</th>
                </tr>
              </thead>
              <tbody>
                {topBuildings.map((row) => (
                  <tr key={row.name} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-5 py-3 text-slate-700">{row.total}</td>
                    <td className="px-5 py-3 text-emerald-700 font-medium">{row.approved}</td>
                    <td className="px-5 py-3 text-rose-700 font-medium">{row.rejected}</td>
                    <td className="px-5 py-3 text-slate-700">{currency.format(row.amount)}</td>
                  </tr>
                ))}
                {topBuildings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                      No hay cotizaciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Solicitudes ligadas a negocio</h2>
            <div className="space-y-3 text-sm">
              <InfoRow label="Solicitudes aprobadas" value={approvedRequests.length} />
              <InfoRow label="Solicitudes rechazadas" value={rejectedRequests.length} />
              <InfoRow label="Monto informado en solicitudes" value={currency.format(linkedRequestAmount)} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Tipo de solicitud</h2>
            <div className="space-y-3">
              {requestTypeBreakdown.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 capitalize">{row.name}</span>
                  <span className="font-semibold text-slate-900">{row.value}</span>
                </div>
              ))}
              {requestTypeBreakdown.length === 0 && <p className="text-sm text-slate-500">Sin solicitudes registradas.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
          <p className="text-xs text-slate-500 mt-2">{detail}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-100 text-slate-700">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}