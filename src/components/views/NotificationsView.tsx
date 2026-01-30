import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Bell,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  X,
  Trash2,
  Filter,
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata: any;
}

interface StoppedElevatorNotification {
  id: string;
  type: 'stopped_elevator';
  title: string;
  message: string;
  is_read: false;
  created_at: string;
  metadata: {
    visit_id: string;
    building_name: string;
    elevator_id: string;
  };
}

interface Reminder {
  id: string;
  title: string;
  description: string;
  due_date: string;
  priority: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  created_by: {
    full_name: string;
  };
  assigned_to: {
    full_name: string;
  };
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

type ViewTab = 'notifications' | 'reminders';

export function NotificationsView() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ViewTab>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stoppedElevatorNotifications, setStoppedElevatorNotifications] = useState<StoppedElevatorNotification[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all');

  const [reminderForm, setReminderForm] = useState({
    title: '',
    description: '',
    assigned_to_id: '',
    due_date: '',
    priority: 'medium',
  });

  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);

  useEffect(() => {
    loadNotifications();
    loadStoppedElevators();
    loadReminders();
    if (profile?.role === 'admin' || profile?.role === 'technician') {
      loadUsers();
    }
  }, [profile]);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .or(`recipient_id.eq.${profile?.id},recipient_id.is.null`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStoppedElevators = async () => {
    try {
      const { data, error } = await supabase
        .from('emergency_visits')
        .select(`
          id,
          visit_date,
          completed_at,
          final_status,
          elevators:emergency_visit_elevators!inner(
            elevator:elevators!inner(
              id,
              building:clients!inner(
                building_name,
                address
              )
            )
          )
        `)
        .eq('status', 'completed')
        .eq('final_status', 'stopped')
        .is('reactivation_date', null);

      if (error) throw error;

      // Convertir los ascensores detenidos a notificaciones
      const stoppedNotifications: StoppedElevatorNotification[] = (data || []).map((visit: any) => {
        const elevator = visit.elevators[0]?.elevator;
        const buildingName = elevator?.building?.building_name || 'Desconocido';
        const address = elevator?.building?.address || '';

        return {
          id: `stopped-${visit.id}`,
          type: 'stopped_elevator',
          title: '🚨 Ascensor Detenido',
          message: `El ascensor en ${buildingName}${address ? ` (${address})` : ''} está detenido y requiere atención urgente`,
          is_read: false,
          created_at: visit.completed_at || visit.visit_date,
          metadata: {
            visit_id: visit.id,
            building_name: buildingName,
            elevator_id: elevator?.id,
          },
        };
      });

      setStoppedElevatorNotifications(stoppedNotifications);
    } catch (error) {
      console.error('Error loading stopped elevators:', error);
    }
  };

  const loadReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select(`
          *,
          created_by:created_by_id (full_name),
          assigned_to:assigned_to_id (full_name)
        `)
        .or(`created_by_id.eq.${profile?.id},assigned_to_id.eq.${profile?.id}`)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setReminders(data || []);
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['admin', 'technician'])
        .order('full_name');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      setNotifications(
        notifications.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', notificationId);

      if (error) throw error;
      setNotifications(notifications.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const createReminder = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase.from('reminders').insert({
        ...reminderForm,
        created_by_id: profile?.id,
      });

      if (error) throw error;

      alert('Recordatorio creado exitosamente');
      setShowReminderForm(false);
      setReminderForm({
        title: '',
        description: '',
        assigned_to_id: '',
        due_date: '',
        priority: 'medium',
      });
      loadReminders();
    } catch (error: any) {
      console.error('Error creating reminder:', error);
      alert(error.message || 'Error al crear recordatorio');
    }
  };

  const completeReminder = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', reminderId);

      if (error) throw error;
      loadReminders();
    } catch (error) {
      console.error('Error completing reminder:', error);
    }
  };

  const deleteReminder = async (reminderId: string) => {
    if (!confirm('¿Estás seguro de eliminar este recordatorio?')) return;

    try {
      const { error } = await supabase.from('reminders').delete().eq('id', reminderId);

      if (error) throw error;
      setReminders(reminders.filter((r) => r.id !== reminderId));
    } catch (error) {
      console.error('Error deleting reminder:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'maintenance':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'emergency':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'stopped_elevator':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'work_order_closed':
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case 'reminder':
        return <Clock className="w-5 h-5 text-purple-600" />;
      default:
        return <Bell className="w-5 h-5 text-slate-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-slate-600 bg-slate-50';
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterRead === 'unread') return !n.is_read;
    if (filterRead === 'read') return n.is_read;
    return true;
  });

  // Combinar notificaciones regulares con ascensores detenidos
  const allNotifications = [
    ...stoppedElevatorNotifications,
    ...filteredNotifications
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const canCreateReminders = profile?.role === 'admin' || profile?.role === 'technician';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Notificaciones</h1>
          <p className="text-slate-600 mt-1">Centro de notificaciones y recordatorios</p>
        </div>
        {canCreateReminders && activeTab === 'reminders' && (
          <button
            onClick={() => setShowReminderForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Crear Recordatorio
          </button>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-3 font-medium transition ${
            activeTab === 'notifications'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificaciones
            {(notifications.filter((n) => !n.is_read).length + stoppedElevatorNotifications.length) > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {notifications.filter((n) => !n.is_read).length + stoppedElevatorNotifications.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('reminders')}
          className={`px-4 py-3 font-medium transition ${
            activeTab === 'reminders'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Recordatorios
            {reminders.filter((r) => r.status === 'pending').length > 0 && (
              <span className="bg-yellow-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {reminders.filter((r) => r.status === 'pending').length}
              </span>
            )}
          </div>
        </button>
      </div>

      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-600" />
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Todas' },
                { value: 'unread', label: 'No leídas' },
                { value: 'read', label: 'Leídas' },
              ].map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setFilterRead(filter.value as any)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                    filterRead === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : allNotifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">No hay notificaciones</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-lg shadow-sm border p-4 ${
                    notification.type === 'stopped_elevator' 
                      ? 'border-red-300 bg-red-50'
                      : notification.is_read 
                        ? 'border-slate-200' 
                        : 'border-blue-300 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900 mb-1">{notification.title}</h3>
                      <p className="text-sm text-slate-600 mb-2">{notification.message}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(notification.created_at).toLocaleString('es-ES')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {notification.type !== 'stopped_elevator' && !notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                          title="Marcar como leída"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {notification.type !== 'stopped_elevator' && (
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'reminders' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : reminders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">No hay recordatorios</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className={`bg-white rounded-lg shadow-sm border p-4 ${
                    reminder.status === 'completed'
                      ? 'border-slate-200 opacity-60'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">{reminder.title}</h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(
                            reminder.priority
                          )}`}
                        >
                          {reminder.priority === 'high'
                            ? 'Alta'
                            : reminder.priority === 'medium'
                            ? 'Media'
                            : 'Baja'}
                        </span>
                        {reminder.status === 'completed' && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                            Completado
                          </span>
                        )}
                      </div>
                      {reminder.description && (
                        <p className="text-sm text-slate-600 mb-3">{reminder.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-500">Vence:</span>{' '}
                          <span className="text-slate-900 font-medium">
                            {new Date(reminder.due_date).toLocaleString('es-ES')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">Asignado a:</span>{' '}
                          <span className="text-slate-900">{reminder.assigned_to.full_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Creado por:</span>{' '}
                          <span className="text-slate-900">{reminder.created_by.full_name}</span>
                        </div>
                      </div>
                    </div>
                    {reminder.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => completeReminder(reminder.id)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition"
                          title="Marcar como completado"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteReminder(reminder.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showReminderForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">Crear Recordatorio</h3>
              <button
                onClick={() => setShowReminderForm(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={createReminder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Título <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={reminderForm.title}
                  onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={reminderForm.description}
                  onChange={(e) =>
                    setReminderForm({ ...reminderForm, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Asignar a <span className="text-red-600">*</span>
                </label>
                <select
                  value={reminderForm.assigned_to_id}
                  onChange={(e) =>
                    setReminderForm({ ...reminderForm, assigned_to_id: e.target.value })
                  }
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Seleccionar usuario</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fecha y Hora <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={reminderForm.due_date}
                    onChange={(e) =>
                      setReminderForm({ ...reminderForm, due_date: e.target.value })
                    }
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Prioridad
                  </label>
                  <select
                    value={reminderForm.priority}
                    onChange={(e) =>
                      setReminderForm({ ...reminderForm, priority: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Crear Recordatorio
                </button>
                <button
                  type="button"
                  onClick={() => setShowReminderForm(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
