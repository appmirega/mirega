import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Calculator, CircleDollarSign, FileText, TrendingUp } from 'lucide-react';

type ClientLite = {
  id: string;
  company_name?: string | null;
  building_name?: string | null;
  internal_alias?: string | null;
};

type QuotationLite = {
  id: string;
  client_id?: string | null;
  status?: string | null;
  total_amount?: number | null;
};

type ServiceRequestLite = {
  id: string;
  client_id?: string | null;
  status?: string | null;
  quotation_amount?: number | string | null;
};

type CostRow = {
  name: string;
  quoted: number;
  requestQuoted: number;
  total: number;
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

function isApprovedStatus(status?: string | null) {
  return ['approved', 'accepted', 'completed', 'in_progress'].includes((status || '').toLowerCase());
}

export function CostAnalysisView() {
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
        supabase.from('quotations').select('id, client_id, status, total_amount'),
        supabase.from('service_requests').select('id, client_id, status, quotation_amount'),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (quotationsRes.error) throw quotationsRes.error;
      if (requestsRes.error) throw requestsRes.error;

      setClients((clientsRes.data as ClientLite[]) || []);
      setQuotations((quotationsRes.data as QuotationLite[]) || []);
      setServiceRequests((requestsRes.data as ServiceRequestLite[]) || []);
    } catch (error) {
      console.error('Error loading cost analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const clientMap = useMemo(() => new Map(clients.map((item) => [item.id, item])), [clients]);

  const totalQuotationAmount = quotations.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  const approvedQuotationAmount = quotations
    .filter((item) => isApprovedStatus(item.status))
    .reduce((sum, item) => sum + Number(item.total_amount || 0), 0);

  const totalRequestAmount = serviceRequests.reduce((sum, item) => sum + Number(item.quotation_amount || 0), 0);
  const approvedRequestAmount = serviceRequests
    .filter((item) => isApprovedStatus(item.status))
    .reduce((sum, item) => sum + Number(item.quotation_amount || 0), 0);

  const avgQuotation = quotations.length > 0 ? Math.round(totalQuotationAmount / quotations.length) : 0;
  const approvedCount = quotations.filter((item) => isApprovedStatus(item.status)).length;
  const avgApprovedQuotation = approvedCount > 0 ? Math.round(approvedQuotationAmount / approvedCount) : 0;

  const byClient = useMemo(() => {
    const map = new Map<string, CostRow>();

    quotations.forEach((item) => {
      const name = getClientName(item.client_id ? clientMap.get(item.client_id) : undefined);
      const current = map.get(name) || { name, quoted: 0, requestQuoted: 0, total: 0 };
      current.quoted += Number(item.total_amount || 0);
      current.total = current.quoted + current.requestQuoted;
      map.set(name, current);
    });

    serviceRequests.forEach((item) => {
      const name = getClientName(item.client_id ? clientMap.get(item.client_id) : undefined);
      const current = map.get(name) || { name, quoted: 0, requestQuoted: 0, total: 0 };
      current.requestQuoted += Number(item.quotation_amount || 0);
      current.total = current.quoted + current.requestQuoted;
      map.set(name, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [clientMap, quotations, serviceRequests]);

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
        <h1 className="text-3xl font-bold text-slate-900">Costos y Conversión</h1>
        <p className="text-slate-600 mt-1">
          Consolidado económico usando montos disponibles en cotizaciones y solicitudes vinculadas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard title="Monto total cotizado" value={currency.format(totalQuotationAmount)} detail="Tabla quotations.total_amount" icon={CircleDollarSign} />
        <MetricCard title="Monto aprobado" value={currency.format(approvedQuotationAmount)} detail="Estados aprobados/aceptados/completados" icon={TrendingUp} />
        <MetricCard title="Monto desde solicitudes" value={currency.format(totalRequestAmount)} detail="Tabla service_requests.quotation_amount" icon={FileText} />
        <MetricCard title="Promedio cotización" value={currency.format(avgQuotation)} detail={`Promedio aprobadas: ${currency.format(avgApprovedQuotation)}`} icon={Calculator} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Clientes con mayor monto acumulado</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-5 py-3">Cliente / Edificio</th>
                  <th className="text-left px-5 py-3">Cotizaciones</th>
                  <th className="text-left px-5 py-3">Solicitudes</th>
                  <th className="text-left px-5 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {byClient.map((row) => (
                  <tr key={row.name} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.name}</td>
                    <td className="px-5 py-3 text-slate-700">{currency.format(row.quoted)}</td>
                    <td className="px-5 py-3 text-slate-700">{currency.format(row.requestQuoted)}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{currency.format(row.total)}</td>
                  </tr>
                ))}
                {byClient.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-slate-500">
                      No hay montos registrados todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Lectura rápida</h2>
          <div className="space-y-3 text-sm">
            <InfoRow label="Aprobado en cotizaciones" value={currency.format(approvedQuotationAmount)} />
            <InfoRow label="Aprobado en solicitudes" value={currency.format(approvedRequestAmount)} />
            <InfoRow label="Base usada" value="quotations + service_requests" />
            <InfoRow label="Precisión" value="Solo montos existentes" />
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
      <span className="font-semibold text-slate-900 text-right">{value}</span>
    </div>
  );
}