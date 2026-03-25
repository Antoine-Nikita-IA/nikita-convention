import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, KPICard } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDate, formatMoney, getClientFromSession } from '@/lib/utils';
import { dataService } from '@/lib/services';
import { STATUS_LABELS } from '@/types/database';
import {
  FolderOpen, FileCheck, PenTool, Euro, Clock, Loader2, Plus, AlertTriangle,
  TrendingUp, ArrowRight, UserCheck, Download, BarChart3,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { Session, SessionStatus, UserProfile } from '@/types/database';

const PIE_COLORS = ['#f59e0b', '#3b82f6', '#6366f1', '#ec4899', '#f97316', '#22c55e', '#ef4444'];

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

  // ====== KPIs ======
  const totalSessions = sessions.length;
  const enAttente = sessions.filter((s) => s.status === 'en_attente').length;
  const signees = sessions.filter((s) => s.status === 'signe').length;
  const annulees = sessions.filter((s) => s.status === 'annule').length;
  const caTotal = sessions.filter((s) => s.status === 'signe').reduce((sum, s) => sum + (s.montant_ht || 0), 0);
  const enCours = sessions.filter((s) => ['formulaire_recu', 'valide', 'convention_generee', 'envoye'].includes(s.status)).length;
  const nbClients = new Set(sessions.map((s) => getClientFromSession(s)?.raison_sociale).filter(Boolean)).size;
  const tauxConversion = totalSessions > 0 ? Math.round((signees / (totalSessions - annulees || 1)) * 100) : 0;

  // ====== CA pipeline (en cours) ======
  const caPipeline = sessions
    .filter((s) => ['formulaire_recu', 'valide', 'convention_generee', 'envoye'].includes(s.status))
    .reduce((sum, s) => sum + (s.montant_ht || 0), 0);

  // ====== Actions requises ======
  const actionsRequises = sessions.filter((s) =>
    s.status === 'formulaire_recu' || s.status === 'convention_generee'
  ).slice(0, 5);

  // ====== Nouvelles demandes (48h) ======
  const now = Date.now();
  const recentDemandes = sessions.filter((s) => {
    const created = new Date(s.created_at).getTime();
    return (now - created) < 48 * 60 * 60 * 1000 && s.status === 'formulaire_recu';
  });

  // ====== CA mensuel ======
  const chartData = useMemo(() => {
    const caParMois: Record<string, { signe: number; pipeline: number }> = {};
    sessions.forEach((s) => {
      if (!s.montant_ht) return;
      const month = new Date(s.created_at).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      if (!caParMois[month]) caParMois[month] = { signe: 0, pipeline: 0 };
      if (s.status === 'signe') {
        caParMois[month].signe += s.montant_ht;
      } else if (!['annule', 'en_attente'].includes(s.status)) {
        caParMois[month].pipeline += s.montant_ht;
      }
    });
    return Object.entries(caParMois).map(([mois, data]) => ({ mois, ...data }));
  }, [sessions]);

  // ====== Pipeline par statut (Pie chart) ======
  const pipelineData = useMemo(() => {
    const statuses: SessionStatus[] = ['en_attente', 'formulaire_recu', 'valide', 'convention_generee', 'envoye', 'signe', 'annule'];
    return statuses
      .map((status) => ({
        name: STATUS_LABELS[status],
        value: sessions.filter((s) => s.status === status).length,
        status,
      }))
      .filter((d) => d.value > 0);
  }, [sessions]);

  // ====== Top formations ======
  const topFormations = useMemo(() => {
    const map: Record<string, { intitule: string; count: number; ca: number; signees: number }> = {};
    sessions.forEach((s) => {
      const name = s.formation?.intitule || 'Sans formation';
      if (!map[name]) map[name] = { intitule: name, count: 0, ca: 0, signees: 0 };
      map[name].count++;
      if (s.status === 'signe') {
        map[name].ca += s.montant_ht || 0;
        map[name].signees++;
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [sessions]);

  // ====== CSV export ======
  function exportSessionsCSV() {
    const headers = ['Formation', 'Client', 'Statut', 'Convention', 'Montant HT', 'Montant TTC', 'Dates', 'Ville', 'Créée le'];
    const rows = sessions.map((s) => {
      const client = getClientFromSession(s);
      return [
        s.formation?.intitule || '',
        client?.raison_sociale || '',
        STATUS_LABELS[s.status],
        s.convention_numero || '',
        s.montant_ht?.toString() || '',
        s.montant_ttc?.toString() || (s.montant_ht ? (s.montant_ht * 1.2).toString() : ''),
        s.dates_formation || '',
        s.ville || '',
        new Date(s.created_at).toLocaleDateString('fr-FR'),
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sessions_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-nikita-pink" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={exportSessionsCSV}>Export CSV</Button>
          <Button onClick={() => navigate('/sessions')} icon={<Plus size={16} />}>Nouvelle session</Button>
        </div>
      </div>

      {/* Alertes */}
      {(pendingUsers.length > 0 || recentDemandes.length > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendingUsers.length > 0 && (
            <button onClick={() => navigate('/utilisateurs')} className="flex items-center gap-2 px-4 py-2.5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors">
              <UserCheck size={16} className="text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{pendingUsers.length} utilisateur{pendingUsers.length > 1 ? 's' : ''} en attente de validation</span>
              <ArrowRight size={14} className="text-yellow-500" />
            </button>
          )}
          {recentDemandes.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <FolderOpen size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{recentDemandes.length} nouvelle{recentDemandes.length > 1 ? 's' : ''} demande{recentDemandes.length > 1 ? 's' : ''} (48h)</span>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KPICard label="Total sessions" value={totalSessions} icon={<FolderOpen size={24} />} />
        <KPICard label="En attente" value={enAttente} icon={<Clock size={24} />} color="text-yellow-600" />
        <KPICard label="En cours" value={enCours} icon={<FileCheck size={24} />} color="text-blue-600" />
        <KPICard label="Signées" value={signees} icon={<PenTool size={24} />} color="text-green-600" />
        <KPICard label="CA signé" value={formatMoney(caTotal)} icon={<Euro size={24} />} color="text-nikita-pink" />
        <KPICard label="CA pipeline" value={formatMoney(caPipeline)} icon={<BarChart3 size={24} />} color="text-indigo-600" />
        <KPICard label="Taux conversion" value={`${tauxConversion}%`} icon={<TrendingUp size={24} />} color="text-emerald-600" />
        <KPICard label="Clients" value={nbClients} icon={<UserCheck size={24} />} color="text-gray-600" />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* CA mensuel (stacked bar) */}
        {chartData.length > 0 && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">CA mensuel</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="mois" tick={{ fontSize: 11 }} stroke="#888" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#888" />
                  <Tooltip
                    formatter={(value, name) => [
                      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(value)),
                      name === 'signe' ? 'Signé' : 'Pipeline',
                    ]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                  <Bar dataKey="signe" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} name="signe" />
                  <Bar dataKey="pipeline" stackId="a" fill="#6366f1" radius={[4, 4, 0, 0]} name="pipeline" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500" /> Signé</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500" /> Pipeline</span>
            </div>
          </Card>
        )}

        {/* Pipeline pie chart */}
        {pipelineData.length > 0 && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Répartition par statut</h2>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">
                    {pipelineData.map((_entry, i) => (
                      <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }} />
                  <Legend formatter={(value) => <span className="text-xs">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Second row: actions + top formations */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Actions requises */}
        {actionsRequises.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Actions requises</h2>
            </div>
            <div className="space-y-3">
              {actionsRequises.map((session) => {
                const client = getClientFromSession(session);
                const action = session.status === 'formulaire_recu' ? 'À valider' : 'Convention à envoyer';
                return (
                  <div key={session.id} className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors" onClick={() => navigate(`/sessions/${session.id}`)}>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{client?.raison_sociale || session.formation?.intitule || '—'}</div>
                      <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{action}</div>
                    </div>
                    <ArrowRight size={14} className="text-amber-500 shrink-0" />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Top formations */}
        {topFormations.length > 0 && (
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top formations</h2>
            <div className="space-y-3">
              {topFormations.map((f, i) => (
                <div key={f.intitule} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-nikita-pink/10 text-nikita-pink flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{f.intitule}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{f.count} session{f.count > 1 ? 's' : ''} — {f.signees} signée{f.signees > 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">{formatMoney(f.ca)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Dernières sessions */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Dernières sessions</h2>
          <span className="text-xs text-gray-400">{nbClients} client{nbClients > 1 ? 's' : ''} actif{nbClients > 1 ? 's' : ''}</span>
        </div>
        {sessions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">Aucune session pour le moment. Créez votre première session.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Formation</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Client</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Montant HT</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sessions.slice(0, 10).map((session) => {
                  const client = getClientFromSession(session);
                  return (
                    <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors" onClick={() => navigate(`/sessions/${session.id}`)}>
                      <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-200">{session.formation?.intitule || '—'}</td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{client?.raison_sociale || '—'}</td>
                      <td className="px-6 py-3"><StatusBadge status={session.status} /></td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{formatMoney(session.montant_ht)}</td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(session.created_at)}</td>
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
