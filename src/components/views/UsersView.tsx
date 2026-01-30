import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, UserPlus, Edit, Trash2, Search, Filter, CheckCircle, XCircle } from 'lucide-react';
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

type ViewMode = 'list' | 'create-admin' | 'create-technician' | 'edit-admin' | 'edit-technician';
type RoleFilter = 'all' | 'admin' | 'technician' | 'client' | 'developer';

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
  }, [profiles, searchTerm, roleFilter]);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

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

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

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
    } else if (profile.role === 'technician') {
      setViewMode('edit-technician');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

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
          setViewMode('list');
          setEditingProfile(null);
          loadProfiles();
        }}
        onCancel={() => {
          setViewMode('list');
          setEditingProfile(null);
        }}
      />
    );
  }

  if (viewMode === 'create-technician' || viewMode === 'edit-technician') {
    return (
      <TechnicianForm
        existingProfile={viewMode === 'edit-technician' ? editingProfile : undefined}
        onSuccess={() => {
          setViewMode('list');
          setEditingProfile(null);
          loadProfiles();
        }}
        onCancel={() => {
          setViewMode('list');
          setEditingProfile(null);
        }}
      />
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
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <Filter className="w-5 h-5 text-slate-600 self-center" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los Roles</option>
              {currentUserProfile?.role === 'developer' && (
                <option value="developer">Desarrolladores</option>
              )}
              <option value="admin">Administradores</option>
              <option value="technician">Técnicos</option>
              <option value="client">Clientes</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">No se encontraron usuarios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Usuario
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Email
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Teléfono
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Rol
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Estado
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Fecha Creación
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((profile) => (
                  <tr key={profile.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{profile.full_name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-slate-600">{profile.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-slate-600">{profile.phone || 'N/A'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getRoleColor(
                          profile.role
                        )}`}
                      >
                        {getRoleLabel(profile.role)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {profile.is_active ? (
                        <span className="flex items-center gap-1 text-sm text-green-600 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Activo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-sm text-red-600 font-medium">
                          <XCircle className="w-4 h-4" />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm text-slate-600">
                        {new Date(profile.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {(profile.role === 'admin' || profile.role === 'technician') && (
                          <button
                            onClick={() => handleEditUser(profile)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Editar usuario"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => toggleUserStatus(profile.id, profile.is_active)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                            profile.is_active
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                          title={profile.is_active ? 'Desactivar usuario' : 'Activar usuario'}
                        >
                          {profile.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                        {profile.role !== 'developer' && profile.id !== currentUserProfile?.id && (
                          <button
                            onClick={() => handleDeleteUser(profile.id, profile.full_name)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
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
        )}
      </div>
    </div>
  );
}
