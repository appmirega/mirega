import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../lib/database.types';
import {
  getDefaultEnabledViewKeys,
  isManagedView,
} from '../utils/viewPermissions';

export function useViewPermissions() {
  const { profile } = useAuth();
  const [enabledViews, setEnabledViews] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPermissions = async () => {
      if (!profile?.id || !profile.role) {
        if (!cancelled) {
          setEnabledViews(new Set());
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      try {
        const defaultViews = getDefaultEnabledViewKeys(profile.role as UserRole);

        const { data, error } = await supabase
          .from('profile_permissions')
          .select('permission_key, is_enabled')
          .eq('profile_id', profile.id);

        if (error) throw error;

        if (!data || data.length === 0) {
          if (!cancelled) {
            setEnabledViews(defaultViews);
          }
          return;
        }

        const enabled = new Set<string>();
        data.forEach((perm) => {
          if (perm.is_enabled) {
            enabled.add(perm.permission_key);
          }
        });

        if (!cancelled) {
          setEnabledViews(enabled);
        }
      } catch (error) {
        console.error('Error loading current user view permissions:', error);

        if (!cancelled) {
          setEnabledViews(
            profile.role
              ? getDefaultEnabledViewKeys(profile.role as UserRole)
              : new Set()
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPermissions();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, profile?.role]);

  const canAccessView = useMemo(() => {
    return (viewKey: string) => {
      if (!profile?.role) return false;

      if (!isManagedView(viewKey)) {
        return true;
      }

      return enabledViews.has(viewKey);
    };
  }, [enabledViews, profile?.role]);

  return {
    enabledViews,
    loading,
    canAccessView,
  };
}