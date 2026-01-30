import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ 
      success: false, 
      error: 'ID de cliente requerido' 
    });
  }

  try {
    // GET /api/clients/[id] - Obtener cliente específico
    if (req.method === 'GET') {
      const { data: client, error } = await supabase
        .from('clients')
        .select(`
          *,
          profile:profiles(id, email, full_name, phone, avatar_url),
          elevators:elevators(
            id,
            internal_code,
            brand,
            model,
            capacity,
            floors,
            location,
            status,
            last_maintenance_date,
            next_maintenance_date
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ 
            success: false, 
            error: 'Cliente no encontrado' 
          });
        }
        throw error;
      }

      // Obtener estadísticas adicionales
      const [
        { count: totalElevators },
        { count: activeServiceRequests },
        { count: pendingEmergencies },
        { count: scheduledMaintenances }
      ] = await Promise.all([
        supabase.from('elevators').select('*', { count: 'exact', head: true }).eq('client_id', id),
        supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('client_id', id).in('status', ['pending', 'in_progress']),
        supabase.from('emergency_visits').select('*', { count: 'exact', head: true }).eq('client_id', id).eq('status', 'pending'),
        supabase.from('maintenance_assignments').select('*', { count: 'exact', head: true }).eq('client_id', id).eq('status', 'scheduled')
      ]);

      return res.status(200).json({ 
        success: true, 
        data: {
          ...client,
          stats: {
            total_elevators: totalElevators || 0,
            active_service_requests: activeServiceRequests || 0,
            pending_emergencies: pendingEmergencies || 0,
            scheduled_maintenances: scheduledMaintenances || 0
          }
        }
      });
    }

    // PUT /api/clients/[id] - Actualizar cliente
    if (req.method === 'PUT') {
      const updates = req.body;

      // Validar email si se actualiza
      if (updates.contact_email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updates.contact_email)) {
          return res.status(400).json({
            success: false,
            error: 'Formato de email inválido'
          });
        }
        updates.contact_email = updates.contact_email.toLowerCase().trim();
      }

      // Validar RUT si se actualiza
      if (updates.rut && !validateRUT(updates.rut)) {
        return res.status(400).json({
          success: false,
          error: 'RUT inválido'
        });
      }

      const { data: client, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({ 
            success: false, 
            error: 'Cliente no encontrado' 
          });
        }
        throw error;
      }

      return res.status(200).json({ 
        success: true, 
        data: client,
        message: 'Cliente actualizado exitosamente' 
      });
    }

    // DELETE /api/clients/[id] - Eliminar cliente
    if (req.method === 'DELETE') {
      // Verificar si tiene ascensores
      const { count: elevatorCount } = await supabase
        .from('elevators')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', id);

      if (elevatorCount && elevatorCount > 0) {
        return res.status(400).json({
          success: false,
          error: `No se puede eliminar el cliente. Tiene ${elevatorCount} ascensor(es) asociado(s). Elimine los ascensores primero.`
        });
      }

      // Verificar solicitudes activas
      const { count: activeRequests } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', id)
        .in('status', ['pending', 'in_progress']);

      if (activeRequests && activeRequests > 0) {
        return res.status(400).json({
          success: false,
          error: `No se puede eliminar el cliente. Tiene ${activeRequests} solicitud(es) activa(s). Complete o cancele las solicitudes primero.`
        });
      }

      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ 
        success: true, 
        message: 'Cliente eliminado exitosamente' 
      });
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Método no permitido' 
    });

  } catch (error: any) {
    console.error('Error en /api/clients/[id]:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error interno del servidor' 
    });
  }
}

function validateRUT(rut: string): boolean {
  const cleanRUT = rut.replace(/\./g, '').replace(/-/g, '');
  if (cleanRUT.length < 2) return false;
  
  const body = cleanRUT.slice(0, -1);
  const dv = cleanRUT.slice(-1).toUpperCase();
  
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body.charAt(i)) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const calculatedDV = 11 - (sum % 11);
  const expectedDV = calculatedDV === 11 ? '0' : calculatedDV === 10 ? 'K' : calculatedDV.toString();
  
  return dv === expectedDV;
}
