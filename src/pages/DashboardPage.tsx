import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, KPICard } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { formatDate, formatMoney, getClientFromSession } from '@/lib/utils';
import { dataService } from '@/lib/services';
import { FolderOpen, FileCheck, PenTool, Euro, Clock, Users, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Session } from '@/types/database';

export function DashboardPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dataService.getSessions().then((data) => {
      setSessions(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalSessions = sessions.length;
  const enAttente = sessions.filter((s) => s.status === 'en_attente').length;
  const signees = sessions.filter((s) => s.status === 'signe').length;
  const caTotal = sessions.filter((s) => s.status === 'signe').reduce((sum, s) => sum + (s.montant_ht || 0), 0);
  const enCours = sessions.filter((s) => ['formulaire_recu', 'valide', 'convention_generee', 'envoye'].includes(s.status)).length;
  const nbClients = new Set(sessions.map((s) => getClientFromSession(s)?.raison_sociale).filter(Boolean)).size;

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
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Total sessions" value={totalSessions} icon={<FolderOpen size={24} />} />
        <KPICard label="En attente" value={enAttente} icon={<Clock size={24} />} color="text-yellow-600" />
        <KPICard label="En cours" value={enCours} icon={<FileCheck size={24} />} color="text-blue-600" />
        <KPICard label="Signées" value={signees} icon={<PenTool size={24} />} color="text-green-600" />
        <KPICard label="CA signé" value={formatMoney(caTotal)} icon={<Euro size={24} />} color="text-nikita-pink" />
        <KPICard label="Clients" value={nbClients} icon={<Users size={24} />} />
      </div>

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

      <Card>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Dernières sessions</h2>
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
