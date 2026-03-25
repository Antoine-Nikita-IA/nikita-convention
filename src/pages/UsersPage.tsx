import { useState, useEffect } from 'react';
import { dataService } from '@/lib/services';
import type { UserProfile, UserRole } from '@/types/database';
import { ROLE_LABELS } from '@/types/database';
import { toast } from 'sonner';
import { UserCheck, UserX, Shield, Search, Users, CheckCircle, Clock, XCircle } from 'lucide-react';

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'admin', label: 'Administrateur', color: 'bg-purple-100 text-purple-700' },
  { value: 'apporteur_affaire', label: "Apporteur d'affaire", color: 'bg-blue-100 text-blue-700' },
  { value: 'user', label: 'Utilisateur', color: 'bg-gray-100 text-gray-700' },
];

function getRoleColor(role: UserRole): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.color || 'bg-gray-100 text-gray-700';
}

function getStatusBadge(user: UserProfile) {
  if (!user.is_validated) return { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock };
  if (!user.is_active) return { label: 'Désactivé', color: 'bg-red-100 text-red-700', icon: XCircle };
  return { label: 'Actif', color: 'bg-green-100 text-green-700', icon: CheckCircle };
}

export function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('apporteur_affaire');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await dataService.getUsers();
      setUsers(data);
    } catch {
      toast.error('Erreur lors du chargement des utilisateurs');
    }
    setLoading(false);
  }

  async function handleValidate(userId: string, role: UserRole) {
    const ok = await dataService.validateUser(userId, role);
    if (ok) {
      toast.success('Utilisateur validé');
      setValidatingId(null);
      loadUsers();
    } else {
      toast.error('Erreur lors de la validation');
    }
  }

  async function handleDeactivate(userId: string) {
    const ok = await dataService.deactivateUser(userId);
    if (ok) {
      toast.success('Utilisateur désactivé');
      loadUsers();
    } else {
      toast.error('Erreur');
    }
  }

  async function handleReactivate(userId: string) {
    const ok = await dataService.validateUser(userId, 'user');
    if (ok) {
      toast.success('Utilisateur réactivé');
      loadUsers();
    }
  }

  async function handleChangeRole(userId: string, newRole: UserRole) {
    const ok = await dataService.updateUser(userId, { role: newRole });
    if (ok) {
      toast.success(`Rôle mis à jour : ${ROLE_LABELS[newRole]}`);
      loadUsers();
    }
  }

  const filtered = users.filter((u) => {
    const matchSearch = !search || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'pending' && !u.is_validated) ||
      (filterStatus === 'active' && u.is_validated && u.is_active) ||
      (filterStatus === 'inactive' && !u.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  const pendingCount = users.filter((u) => !u.is_validated).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nikita-pink" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestion des utilisateurs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{users.length} utilisateur{users.length > 1 ? 's' : ''} au total</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <Clock size={16} className="text-yellow-600" />
            <span className="text-sm font-medium text-yellow-700">{pendingCount} en attente de validation</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nikita-pink/30 focus:border-nikita-pink bg-white dark:bg-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          {[
            { value: 'all', label: 'Tous' },
            { value: 'pending', label: 'En attente' },
            { value: 'active', label: 'Actifs' },
            { value: 'inactive', label: 'Inactifs' },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterStatus === s.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nikita-pink/30 bg-white dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="all">Tous les rôles</option>
          <option value="admin">Admin</option>
          <option value="apporteur_affaire">Apporteur d'affaire</option>
          <option value="user">Utilisateur</option>
        </select>
      </div>

      {/* User cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users size={40} className="mx-auto mb-3 text-gray-300" />
            <p>Aucun utilisateur trouvé</p>
          </div>
        ) : (
          filtered.map((user) => {
            const status = getStatusBadge(user);
            const StatusIcon = status.icon;
            const isValidating = validatingId === user.id;

            return (
              <div key={user.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-nikita-pink/10 flex items-center justify-center text-sm font-medium text-nikita-pink flex-shrink-0">
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 dark:text-white truncate">{user.first_name} {user.last_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Role badge */}
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getRoleColor(user.role)}`}>
                      {ROLE_LABELS[user.role]}
                    </span>

                    {/* Status badge */}
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${status.color}`}>
                      <StatusIcon size={12} />
                      {status.label}
                    </span>

                    {/* Actions */}
                    {!user.is_validated ? (
                      isValidating ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedRole}
                            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                            className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg"
                          >
                            <option value="apporteur_affaire">Apporteur d'affaire</option>
                            <option value="admin">Admin</option>
                            <option value="user">Utilisateur</option>
                          </select>
                          <button
                            onClick={() => handleValidate(user.id, selectedRole)}
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                          >
                            Valider
                          </button>
                          <button
                            onClick={() => setValidatingId(null)}
                            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setValidatingId(user.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nikita-pink text-white text-xs font-medium rounded-lg hover:bg-nikita-pink/90 transition-colors"
                        >
                          <UserCheck size={14} />
                          Valider
                        </button>
                      )
                    ) : user.is_active ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeRole(user.id, e.target.value as UserRole)}
                          className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-white"
                        >
                          <option value="admin">Admin</option>
                          <option value="apporteur_affaire">Apporteur d'affaire</option>
                          <option value="user">Utilisateur</option>
                        </select>
                        <button
                          onClick={() => handleDeactivate(user.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Désactiver"
                        >
                          <UserX size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleReactivate(user.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200"
                      >
                        <Shield size={14} />
                        Réactiver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
