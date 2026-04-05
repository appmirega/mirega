import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, UserPlus, Edit, Trash2, Search, CheckCircle, XCircle } from 'lucide-react';
import AdminForm from '../forms/AdminForm';
import TechnicianForm from '../forms/TechnicianForm';
import { ClientForm } from '../forms/ClientForm';
import { useAuth } from '../../contexts/AuthContext';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

type ViewMode =
  | 'list'
  | 'create-admin'
  | 'create-technician'
  | 'edit-admin'
  | 'edit-technician'
  | 'edit-client';
type RoleFilter = 'all' | 'admin' | 'technician' | 'client' | 'developer';

function mapProfileToClientForm(profile: Profile) {
  return {
    id: profile.id,
    company_name: profile.full_name || '',
    contact_name: profile.full_name || '',
    contact_person: profile.full_name || '',
    contact_email: profile.email || '',
    contact_phone: profile.phone || '',
  };
}

export function UsersView() {
  const { profile: currentUserProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    admins: 0,
    technicians: 0,
    clients: 0,
    developers: 0,
    active: 0,
    inactive: 0,
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    filterProfiles();
    calculateStats();
  }, [profiles, searchTerm, roleFilter, currentUserProfile]);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProfiles = () => {
    let filtered = [...profiles];

    if (currentUserProfile?.role === 'admin') {
      filtered = filtered.filter((p) => p.role !== 'developer');
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((p) => p.role === roleFilter);
    }

    setFilteredProfiles(filtered);
  };

  const calculateStats = () => {
    let visibleProfiles = [...profiles];

    if (currentUserProfile?.role === 'admin') {
      visibleProfiles = visibleProfiles.filter((p) => p.role !== 'developer');
    }

    setStats({
      total: visibleProfiles.length,
      admins: visibleProfiles.filter((p) => p.role === 'admin').length,
      technicians: visibleProfiles.filter((p) => p.role === 'technician').length,
      clients: visibleProfiles.filter((p) => p.role === 'client').length,
      developers: visibleProfiles.filter((p) => p.role === 'developer').length,
      active: visibleProfiles.filter((p) => p.is_active).length,
      inactive: visibleProfiles.filter((p) => !p.is_active).length,
    });
  };

  const resetToList = () => {
    setViewMode('list');
    setEditingProfile(null);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase.from('profiles').update({ is_active: !currentStatus }).eq('id', userId);

      if (error) throw error;
      loadProfiles();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Error al actualizar el estado del usuario');
    }
  };

  const handleEditUser = (profile: Profile) => {
    setEditingProfile(profile);

    if (profile.role === 'admin') {
      setViewMode('edit-admin');
      return;
    }

    if (profile.role === 'technician') {
      setViewMode('edit-technician');
      return;
    }

    if (profile.role === 'client') {
      setViewMode('edit-client');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);

      if (error) throw error;
      alert('Usuario eliminado exitosamente');
      loadProfiles();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar el usuario. Verifica que no tenga registros asociados.');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'developer':
        return 'Desarrollador';
      case 'admin':
        return 'Administrador';
      case 'technician':
        return 'Técnico';
      case 'client':
        return 'Cliente';
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'developer':
        return 'bg-purple-100 text-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'technician':
        return 'bg-green-100 text-green-800';
      case 'client':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (viewMode === 'create-admin' || viewMode === 'edit-admin') {
    return (
      <AdminForm
        existingProfile={viewMode === 'edit-admin' ? editingProfile : undefined}
        onSuccess={() => {
          resetToList();
          loadProfiles();
        }}
        onCancel={resetToList}
      />
    );
  }

  if (viewMode === 'create-technician' || viewMode === 'edit-technician') {
    return (
      <TechnicianForm
        existingProfile={viewMode === 'edit-technician' ? editingProfile : undefined}
        onSuccess={() => {
          resetToList();
          loadProfiles();
        }}
        onCancel={resetToList}
      />
    );
  }

  if (viewMode === 'edit-client' && editingProfile) {
    return (
      <ClientForm
        client={mapProfileToClientForm(editingProfile)}
        onSuccess={() => {
          resetToList();
          loadProfiles();
        }}
        onCancel={resetToList}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Gestión de Usuarios</h1>
          <p className="text-slate-600 mt-1">Administra todos los usuarios del sistema</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('create-admin')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <UserPlus className="w-4 h-4" />
            Crear Administrador
          </button>
          <button
            onClick={() => setViewMode('create-technician')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <UserPlus className="w-4 h-4" />
            Crear Técnico
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Usuarios</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{stats.total}</p>
            </div>
            <Users className="w-10 h-10 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Administradores</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{stats.admins}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Técnicos</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{stats.technicians}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Clientes</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{stats.clients}</p>
            </div>
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="technician">Técnicos</option>
            <option value="client">Clientes</option>
            {currentUserProfile?.role === 'developer' && <option value="developer">Desarrolladores</option>}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Usuario</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Contacto</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Rol</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Estado</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Creado</th>
                <th className="text-right py-3 px-4 font-semibold text-slate-700">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((profile) => (
                <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-slate-900">{profile.full_name}</p>
                      <p className="text-sm text-slate-500">ID: {profile.id.slice(0, 8)}...</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <p className="text-sm text-slate-700">{profile.email}</p>
                      <p className="text-sm text-slate-500">{profile.phone || 'Sin teléfono'}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(profile.role)}`}>
                      {getRoleLabel(profile.role)}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => toggleUserStatus(profile.id, profile.is_active)}
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        profile.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {profile.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {profile.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="py-4 px-4 text-sm text-slate-600">
                    {new Date(profile.created_at).toLocaleDateString('es-CL')}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {(profile.role === 'admin' || profile.role === 'technician' || profile.role === 'client') && (
                        <button
                          onClick={() => handleEditUser(profile)}
                          className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar usuario"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      )}

                      {profile.id !== currentUserProfile?.id && profile.role !== 'developer' && (
                        <button
                          onClick={() => handleDeleteUser(profile.id, profile.full_name)}
                          className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProfiles.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No se encontraron usuarios</h3>
            <p className="text-slate-500">Intenta ajustar los filtros de búsqueda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
