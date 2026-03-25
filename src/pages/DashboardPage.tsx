import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, KPICard } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate, formatMoney, getClientFromSession } from '@/lib/utils';
import { dataService } from '@/lib/services';
import { FolderOpen, FileCheck, PenTool, Euro, Clock, Loader2, Plus, AlertTriangle, TrendingUp, ArrowRight, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Session, UserProfile } from '@/types/database';

export function DashboardPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dataService.getSessions(),
      dataService.getUsers().catch(() => [] as UserProfile[]),
    ]).then(([sessData, usersData]) => {
      setSessions(sessData);
      setPendingUsers(usersData.filter((u) => !u.is_validated));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalSessions = sessions.length;
  const enAttente = sessions.filter((s) => s.status === 'en_attente').length;
  const signees = sessions.filter((s) => s.status === 'signe').length;
  const annulees = sessions.filter((s) => s.status === 'annule').length;
  const caTotal = sessions.filter((s) => s.status === 'signe').reduce((sum, s) => sum + (s.montant_ht || 0), 0);
  const enCours = sessions.filter((s) => ['formulaire_recu', 'valide', 'convention_generee', 'envoye'].includes(s.status)).length;
  const nbClients = new Set(sessions.map((s) => getClientFromSession(s)?.raison_sociale).filter(Boolean)).size;
  const tauxConversion = totalSessions > 0 ? Math.round((signees / (totalSessions - annulees || 1)) * 100) : 0;

  // Sessions nécessitant une action
  const actionsRequises = sessions.filter((s) =>
    s.status === 'formulaire_recu' || s.status === 'convention_generee'
  ).slice(0, 5);

  // Nouvelles demandes (dernières 48h)
  const now = Date.now();
  const recentDemandes = sessions.filter((s) => {
    const created = new Date(s.created_at).getTime();
    return (now - created) < 48 * 60 * 60 * 1000 && s.status === 'formulaire_recu';
  });

  const caParMois: Record<string, number> = {};
  sessions.filter((s) => s.status === 'signe' && s.montant_ht).forEach((s) => {
    const month = new Date(s.created_at).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    caParMois[month] = (caParMois[month] || 0) + (s.montant_ht || 0);
  });
  const chartData = Object.entries(caParMois).map(([mois, ca]) => ({ mois, ca }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-nikita-pink" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <Button onClick={() => navigate('/sessions')} icon={<Plus size={16} />}>Nouvelle session</Button>
      </div>

      {/* Alertes */}
      {(pendingUsers.length > 0 || recentDemandes.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendingUsers.length > 0 && (
            <button
              onClick={() => navigate('/utilisateurs')}
              className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
            >
              <UserCheck size={16} className="text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700">
                {pendingUsers.length} utilisateur{pendingUsers.length > 1 ? 's' : ''} en attente de validation
              </span>
              <ArrowRight size={14} className="text-yellow-500" />
            </button>
          )}
          {recentDemandes.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <FolderOpen size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                {recentDemandes.length} nouvelle{recentDemandes.length > 1 ? 's' : ''} demande{recentDemandes.length > 1 ? 's' : ''} (48h)
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Total sessions" value={totalSessions} icon={<FolderOpen size={24} />} />
        <KPICard label="En attente" value={enAttente} icon={<Clock size={24} />} color="text-yellow-600" />
        <KPICard label="En cours" value={enCours} icon={<FileCheck size={24} />} color="text-blue-600" />
        <KPICard label="Signées" value={signees} icon={<PenTool size={24} />} color="text-green-600" />
        <KPICard label="CA signé" value={formatMoney(caTotal)} icon={<Euro size={24} />} color="text-nikita-pink" />
        <KPICard label="Taux conversion" value={`${tauxConversion}%`} icon={<TrendingUp size={24} />} color="text-indigo-600" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {chartData.length > 0 && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">CA mensuel (conventions signées)</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value))} />
                  <Bar dataKey="ca" fill="#FF00CC" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {actionsRequises.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-700">Actions requises</h2>
            </div>
            <div className="space-y-3">
              {actionsRequises.map((session) => {
                const client = getClientFromSession(session);
                const action = session.status === 'formulaire_recu' ? 'À valider' : 'Convention à envoyer';
                return (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => navigate(`/sessions/${session.id}`)}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{client?.raison_sociale || session.formation?.intitule || '—'}</div>
                      <div className="text-xs text-amber-700 mt-0.5">{action}</div>
                    </div>
                    <ArrowRight size={14} className="text-amber-500 shrink-0" />
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Dernières sessions</h2>
          <span className="text-xs text-gray-400">{nbClients} client{nbClients > 1 ? 's' : ''} actif{nbClients > 1 ? 's' : ''}</span>
        </div>
        {sessions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">Aucune session pour le moment. Créez votre première session.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Formation</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Montant HT</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.slice(0, 10).map((session) => {
                  const client = getClientFromSession(session);
                  return (
                    <tr key={session.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/sessions/${session.id}`)}>
                      <td className="px-6 py-3 font-medium text-gray-800">{session.formation?.intitule || '—'}</td>
                      <td className="px-6 py-3 text-gray-600">{client?.raison_sociale || '—'}</td>
                      <td className="px-6 py-3"><StatusBadge status={session.status} /></td>
                      <td className="px-6 py-3 text-gray-600">{formatMoney(session.montant_ht)}</td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{formatDate(session.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
