import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Método no permitido' 
    });
  }

  try {
    // Estadísticas generales de clientes
    const [
      { count: totalClients },
      { count: totalElevators },
      { count: activeServiceRequests },
      { count: pendingEmergencies },
      { count: completedMaintenances }
    ] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('elevators').select('*', { count: 'exact', head: true }),
      supabase.from('service_requests').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
      supabase.from('emergency_visits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('maintenance_assignments').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    // Top 5 clientes con más ascensores
    const { data: topClients } = await supabase
      .from('clients')
      .select(`
        id,
        company_name,
        building_name,
        elevators:elevators(count)
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    // Clientes por ciudad
    const { data: clientsByCity } = await supabase
      .from('clients')
      .select('city')
      .order('city');

    const cityStats = clientsByCity?.reduce((acc: any, client: any) => {
      const city = client.city || 'Sin ciudad';
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});

    // Clientes creados en el último mes
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: newClientsThisMonth } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', lastMonth);

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          total_clients: totalClients || 0,
          total_elevators: totalElevators || 0,
          active_service_requests: activeServiceRequests || 0,
          pending_emergencies: pendingEmergencies || 0,
          completed_maintenances_last_30_days: completedMaintenances || 0,
          new_clients_this_month: newClientsThisMonth || 0
        },
        top_clients: topClients?.map((client: any) => ({
          id: client.id,
          company_name: client.company_name,
          building_name: client.building_name,
          elevator_count: client.elevators?.[0]?.count || 0
        })),
        clients_by_city: Object.entries(cityStats || {}).map(([city, count]) => ({
          city,
          count
        })).sort((a: any, b: any) => b.count - a.count)
      }
    });

  } catch (error: any) {
    console.error('Error en /api/clients/stats:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    });
  }
}
