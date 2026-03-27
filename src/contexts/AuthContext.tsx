import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../lib/database.types';
import { activityLogger } from '../services/activityLogger';

interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  building_name?: string | null;
}

export interface ClientAccessItem {
  client_id: string;
  access_role: string | null;
  company_name: string | null;
  building_name: string | null;
  internal_alias: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  availableClients: ClientAccessItem[];
  selectedClientId: string | null;
  selectedClient: ClientAccessItem | null;
  setSelectedClientId: (clientId: string) => void;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CLIENT_STORAGE_KEY = 'mirega_selected_client_id';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableClients, setAvailableClients] = useState<ClientAccessItem[]>([]);
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        resetClientAccess();
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          resetClientAccess();
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const resetClientAccess = () => {
    setAvailableClients([]);
    setSelectedClientIdState(null);
    localStorage.removeItem(CLIENT_STORAGE_KEY);
  };

  const setSelectedClientId = (clientId: string) => {
    setSelectedClientIdState(clientId);
    localStorage.setItem(CLIENT_STORAGE_KEY, clientId);
  };

  const loadClientAccess = async (userId: string) => {
    const { data, error } = await supabase
      .from('client_user_access')
      .select(`
        client_id,
        access_role,
        clients (
          id,
          company_name,
          building_name,
          internal_alias
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    const normalized: ClientAccessItem[] =
      (data || [])
        .map((item: any) => ({
          client_id: item.client_id,
          access_role: item.access_role ?? null,
          company_name: item.clients?.company_name ?? null,
          building_name: item.clients?.building_name ?? null,
          internal_alias: item.clients?.internal_alias ?? null,
        }))
        .filter((item) => Boolean(item.client_id));

    setAvailableClients(normalized);

    if (normalized.length === 0) {
      setSelectedClientIdState(null);
      localStorage.removeItem(CLIENT_STORAGE_KEY);
      return null;
    }

    const savedClientId = localStorage.getItem(CLIENT_STORAGE_KEY);
    const resolvedClientId =
      savedClientId && normalized.some((item) => item.client_id === savedClientId)
        ? savedClientId
        : normalized[0].client_id;

    setSelectedClientIdState(resolvedClientId);
    localStorage.setItem(CLIENT_STORAGE_KEY, resolvedClientId);

    return normalized.find((item) => item.client_id === resolvedClientId) || normalized[0];
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setProfile(null);
        resetClientAccess();
        return;
      }

      if (data.role === 'client') {
        const selectedAccess = await loadClientAccess(userId);

        setProfile({
          ...data,
          building_name:
            selectedAccess?.internal_alias ||
            selectedAccess?.building_name ||
            selectedAccess?.company_name ||
            null,
        });
      } else {
        resetClientAccess();
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setProfile(null);
      resetClientAccess();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile || profile.role !== 'client') return;

    const selected =
      availableClients.find((item) => item.client_id === selectedClientId) || null;

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            building_name:
              selected?.internal_alias ||
              selected?.building_name ||
              selected?.company_name ||
              null,
          }
        : prev
    );
  }, [availableClients, selectedClientId, profile?.role]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        activityLogger.logLogin().catch(() => {});
      }

      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    activityLogger.logLogout().catch(() => {});
    await supabase.auth.signOut();
    setProfile(null);
    resetClientAccess();
  };

  const hasRole = (roles: UserRole | UserRole[]) => {
    if (!profile) return false;
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(profile.role);
  };

  const selectedClient =
    availableClients.find((item) => item.client_id === selectedClientId) || null;

  const value: AuthContextType = {
    user,
    profile,
    session,
    loading,
    availableClients,
    selectedClientId,
    selectedClient,
    setSelectedClientId,
    signIn,
    signOut,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}