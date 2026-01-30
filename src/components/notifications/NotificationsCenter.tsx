import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Bell,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  // ...existing code...
  Trash2,
  Check,
  ArrowRight
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  read_at: string | null;
  work_order_id: string | null;
  priority: string;
  created_at: string;
  action_url: string | null;
  related_user?: {
    full_name: string;
  };
}

interface NotificationsCenterProps {
  onNavigate?: (url: string) => void;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({ onNavigate }) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (profile?.id) {
      loadNotifications();
      // Suscribirse a cambios en tiempo real
      subscribeToNotifications();
    }
  }, [profile?.id]);

  const loadNotifications = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          type,
          title,
          message,
          is_read,
          read_at,
          work_order_id,
          priority,
          created_at,
          action_url,
          related_user:related_user_id (
            full_name
          )
        `)
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const transformedData = (data || []).map(n => ({
        ...n,
        related_user: Array.isArray(n.related_user) && n.related_user.length > 0 
          ? n.related_user[0] 
          : n.related_user
      }));

      setNotifications(transformedData as any);
      setUnreadCount(transformedData.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToNotifications = () => {
    if (!profile?.id) return;

    const subscription = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profile.id}`
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(notifications.map(n =>
        n.id === notificationId ? { ...n, is_read: true } : n
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', profile.id)
        .eq('is_read', false);

      if (error) throw error;

      loadNotifications();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.action_url && onNavigate) {
      onNavigate(notification.action_url);
      setShowDropdown(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'work_order_assigned':
        return <Zap className="w-4 h-4 text-blue-600" />;
      case 'work_order_approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'work_order_rejected':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'work_order_closed':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'approval_requested':
        return <Clock className="w-4 h-4 text-orange-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-50 border-red-200';
      case 'high':
        return 'bg-orange-50 border-orange-200';
      case 'normal':
        return 'bg-slate-50 border-slate-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'normal':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffMs = now.getTime() - notifTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Hace unos segundos';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return notifTime.toLocaleDateString('es-CL');
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-slate-100 rounded-lg transition"
      >
        <Bell className="w-5 h-5 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notificaciones ({notifications.length})
            </h3>
            <button
              onClick={() => setShowDropdown(false)}
              className="p-1 hover:bg-slate-200 rounded-lg transition"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {/* Acciones */}
          {unreadCount > 0 && (
            <div className="px-4 py-2 border-b border-slate-200 flex gap-2">
              <button
                onClick={markAllAsRead}
                className="flex-1 text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition font-medium"
              >
                Marcar todas como leídas
              </button>
            </div>
          )}

          {/* Notificaciones */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 text-sm">No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-l-4 transition cursor-pointer hover:bg-slate-50 ${
                      getPriorityColor(notification.priority)
                    } ${notification.is_read ? 'opacity-75' : 'font-semibold'}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold text-slate-900">
                              {notification.title}
                            </h4>
                            <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                              {notification.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {notification.priority !== 'normal' && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityBadgeColor(notification.priority)}`}>
                                {notification.priority === 'urgent' ? '🔴' : '🟠'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-slate-500">
                            {formatTime(notification.created_at)}
                          </span>

                          <div className="flex items-center gap-1">
                            {!notification.is_read && (
                              <span className="inline-block w-2 h-2 rounded-full bg-blue-600"></span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="p-1 hover:bg-slate-200 rounded transition opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3 h-3 text-slate-500 hover:text-red-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <a
                href="/notifications"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate?.('/notifications');
                  setShowDropdown(false);
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 transition"
              >
                Ver todas las notificaciones
                <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Backdrop para cerrar dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};
