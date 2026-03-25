import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { dataService } from '@/lib/services';
import type { Client, Session } from '@/types/database';
import { STATUS_LABELS, STATUS_COLORS } from '@/types/database';
import { Users, FileText, TrendingUp, Clock, Building2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ApporteurDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const [clientsData, sessionsData] = await Promise.all([
        dataService.getClientsByApporteurId(user.id),
        dataService.getSessionsByApporteurId(user.id),
      ]);
      setClients(clientsData);
      setSessions(sessionsData);
    } catch {
      // Silent fail
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nikita-pink" />
      </div>
    );
  }

  const sessionsEnCours = sessions.filter((s) => !['signe', 'annule'].includes(s.status));
  const sessionsSignees = sessions.filter((s) => s.status === 'signe');
  const caTotal = sessionsSignees.reduce((sum, s) => sum + (s.montant_ht || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bonjour, {user?.first_name} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Voici le résumé de votre activité</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building2 size={20} className="text-blue-600" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Mes clients</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{clients.length}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-orange-600" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Sessions en cours</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{sessionsEnCours.length}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <FileText size={20} className="text-green-600" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Conventions signées</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{sessionsSignees.length}</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-purple-600" />
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">CA généré (HT)</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {caTotal.toLocaleString('fr-FR')} €
          </div>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mes clients */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users size={18} />
              Mes clients
            </h2>
            <span className="text-xs text-gray-500">{clients.length} client{clients.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {clients.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Aucun client rattaché pour le moment
              </div>
            ) : (
              clients.slice(0, 8).map((client) => (
                <div key={client.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-gray-900">{client.raison_sociale}</div>
                      <div className="text-xs text-gray-500">{client.ville} — {client.email}</div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {client.nb_participants} participant{client.nb_participants > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sessions en cours */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText size={18} />
              Sessions en cours
            </h2>
            <span className="text-xs text-gray-500">{sessionsEnCours.length} session{sessionsEnCours.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-gray-50">
            {sessionsEnCours.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                Aucune session en cours
              </div>
            ) : (
              sessionsEnCours.slice(0, 8).map((session) => {
                const client = Array.isArray(session.client) ? session.client[0] : session.client;
                return (
                  <button
                    key={session.id}
                    onClick={() => navigate(`/sessions/${session.id}`)}
                    className="w-full px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm text-gray-900">
                          {session.formation?.intitule || 'Formation'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {client?.raison_sociale || 'Client en attente'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${STATUS_COLORS[session.status]}`}>
                          {STATUS_LABELS[session.status]}
                        </span>
                        <ArrowRight size={14} className="text-gray-300" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
