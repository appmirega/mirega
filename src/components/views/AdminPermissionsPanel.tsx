import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Shield, Users, Save, Eye, EyeOff, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { getViewsForRole } from '../../utils/viewPermissions';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export function AdminPermissionsPanel() {
  const [activeTab, setActiveTab] = useState<'technician' | 'client'>('technician');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [enabledViews, setEnabledViews] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, [activeTab]);

  useEffect(() => {
    if (selectedProfile) {
      loadViewPermissions(selectedProfile.id);
    }
  }, [selectedProfile]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('role', activeTab)
        .order('full_name');

      if (error) throw error;
      setProfiles(data || []);
      if (data && data.length > 0) {
        setSelectedProfile(data[0]);
      } else {
        setSelectedProfile(null);
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadViewPermissions = async (profileId: string) => {
    try {
      // Obtener el perfil para saber su rol
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', profileId)
        .single();

      if (profileError) throw profileError;

      const { data, error } = await supabase
        .from('profile_permissions')
        .select('permission_key, is_enabled')
        .eq('profile_id', profileId);

      if (error) throw error;

      const enabled = new Set<string>();
      if (data && data.length > 0) {
        data.forEach(perm => {
          if (perm.is_enabled) {
            enabled.add(perm.permission_key);
          }
        });
      } else {
        // Si no hay permisos guardados, usar defaults del rol del perfil
        const userRole = profileData.role as 'technician' | 'client';
        const defaultViews = getViewsForRole(userRole);
        defaultViews.forEach(view => enabled.add(view.key));
      }

      setEnabledViews(enabled);
    } catch (error) {
      console.error('Error loading view permissions:', error);
    }
  };

  const toggleView = (viewKey: string) => {
    const newEnabled = new Set(enabledViews);
    if (newEnabled.has(viewKey)) {
      newEnabled.delete(viewKey);
    } else {
      newEnabled.add(viewKey);
    }
    setEnabledViews(newEnabled);
  };

  const enableAllViews = () => {
    const allKeys = getViewsForRole(activeTab).map(v => v.key);
    setEnabledViews(new Set(allKeys));
  };

  const disableAllViews = () => {
    setEnabledViews(new Set());
  };

  const savePermissions = async () => {
    if (!selectedProfile) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      // Eliminar permisos existentes
      await supabase
        .from('profile_permissions')
        .delete()
        .eq('profile_id', selectedProfile.id);

      // Insertar nuevos permisos (todas las vistas del rol)
      const allViews = getViewsForRole(activeTab);
      const permissionsToInsert = allViews.map(view => ({
        profile_id: selectedProfile.id,
        permission_key: view.key,
        is_enabled: enabledViews.has(view.key),
        granted_by: user.id,
      }));

      const { error } = await supabase
        .from('profile_permissions')
        .insert(permissionsToInsert);

      if (error) throw error;

      alert('Permisos guardados exitosamente');
    } catch (error: any) {
      console.error('Error saving permissions:', error);
      alert('Error al guardar permisos: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getRoleLabel = () => {
    return activeTab === 'technician' ? 'Técnicos' : 'Clientes';
  };

  const availableViews = getViewsForRole(activeTab);
  const enabledCount = enabledViews.size;
  const totalCount = availableViews.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Shield className="w-8 h-8 text-green-600" />
          Control de Vistas
        </h1>
        <p className="text-slate-600 mt-1">
          Activa o desactiva las vistas disponibles para Técnicos y Clientes
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium">Gestión de Permisos</p>
          <p className="text-blue-700">
            Como administrador, puedes controlar las vistas y funciones disponibles para Técnicos y Clientes.
            Activa o desactiva los permisos según las necesidades de cada usuario.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 flex gap-2">
        <button
          onClick={() => setActiveTab('technician')}
          className={`flex-1 px-4 py-3 rounded-lg font-medium transition ${
            activeTab === 'technician'
              ? 'bg-green-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Técnicos
        </button>
        <button
          onClick={() => setActiveTab('client')}
          className={`flex-1 px-4 py-3 rounded-lg font-medium transition ${
            activeTab === 'client'
              ? 'bg-green-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Clientes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Perfiles */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-bold text-slate-900 mb-3">{getRoleLabel()}</h3>

            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No hay {getRoleLabel().toLowerCase()} registrados
              </p>
            ) : (
              <div className="space-y-2">
                {profiles.map(profile => (
                  <button
                    key={profile.id}
                    onClick={() => setSelectedProfile(profile)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                      selectedProfile?.id === profile.id
                        ? 'bg-green-50 border border-green-200 text-green-900'
                        : 'bg-slate-50 border border-transparent hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <p className="font-medium truncate">{profile.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{profile.email}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel de Vistas */}
        <div className="lg:col-span-3">
          {selectedProfile ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{selectedProfile.full_name}</h3>
                  <p className="text-sm text-slate-500">{selectedProfile.email}</p>
                  <p className="text-sm text-green-600 mt-1">
                    {enabledCount} de {totalCount} vistas habilitadas
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={enableAllViews}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Habilitar Todas
                  </button>
                  <button
                    onClick={disableAllViews}
                    className="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Deshabilitar Todas
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {availableViews.map((view, index) => {
                  const isEnabled = enabledViews.has(view.key);
                  return (
                    <div
                      key={view.key}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 transition ${
                        isEnabled
                          ? 'border-green-400 bg-green-50'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className={`font-medium ${isEnabled ? 'text-green-900' : 'text-slate-700'}`}>
                            {view.label}
                          </p>
                          <p className="text-xs text-slate-500">{view.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleView(view.key)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                          isEnabled
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-slate-300 text-slate-600 hover:bg-slate-400'
                        }`}
                      >
                        {isEnabled ? (
                          <>
                            <Eye className="w-4 h-4" />
                            Activado
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-4 h-4" />
                            Desactivado
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">
                Selecciona un perfil para gestionar sus vistas
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
