import { supabase } from '@/lib/supabase';

export async function createServiceRequest(data: any) {
  const { error } = await supabase
    .from('service_requests')
    .insert([{
      ...data,
      status: 'new'
    }]);

  if (error) throw error;
}

export async function createWorkOrderFromRequest(request: any) {
  const { data: workOrder, error } = await supabase
    .from('work_orders')
    .insert([{
      client_id: request.client_id,
      elevator_id: request.elevator_id,
      description: request.description,
      service_request_id: request.id
    }])
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('service_requests')
    .update({ work_order_id: workOrder.id })
    .eq('id', request.id);

  return workOrder;
}