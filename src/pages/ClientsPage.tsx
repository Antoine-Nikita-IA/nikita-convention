import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { dataService } from '@/lib/services';
import { formatDate } from '@/lib/utils';
import { Search, Building2, Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { Client, UserProfile } from '@/types/database';

export function ClientsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [clients, setClients] = useState<Client[]>([]);
  const [apporteurs, setApporteurs] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    const isApporteur = user?.role === 'apporteur_affaire';
    const fetcher = isApporteur && user?.id
      ? dataService.getClientsByApporteurId(user.id)
      : dataService.getClients();

    const promises: Promise<unknown>[] = [fetcher];
    // Admin loads apporteurs list for assignment
    if (isAdmin) {
      promises.push(
        dataService.getUsers().then((users) =>
          users.filter((u) => u.role === 'apporteur_affaire' && u.is_validated && u.is_active)
        )
      );
    }

    Promise.all(promises)
      .then(([c, a]) => {
        setClients(c as Client[]);
        if (a) setApporteurs(a as UserProfile[]);
      })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [user]);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) => c.raison_sociale.toLowerCase().includes(q) || c.siret?.includes(q) || c.email.toLowerCase().includes(q) || c.ville.toLowerCase().includes(q));
  }, [search, clients]);

  async function handleAssignApporteur(clientId: string, apporteurId: string) {
    const ok = await dataService.assignClientToApporteur(clientId, apporteurId);
    if (ok) {
      toast.success('Apporteur attribué');
      // Update local state
      setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, apporteur_id: apporteurId || null } : c));
      if (selected?.id === clientId) setSelected({ ...selected, apporteur_id: apporteurId || null });
    } else {
      toast.error('Erreur lors de l\'attribution');
    }
  }

  function getApporteurName(apporteurId?: string | null): string {
    if (!apporteurId) return '—';
    const a = apporteurs.find((u) => u.id === apporteurId);
    return a ? `${a.first_name} ${a.last_name}` : '—';
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-nikita-pink" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Clients</h1>
        <span className="text-sm text-gray-500">{clients.length} client{clients.length > 1 ? 's' : ''}</span>
      </div>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, SIRET, email, ville..." icon={<Search size={16} />} />
      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<Building2 size={48} />} title="Aucun client" description={clients.length === 0 ? "Les clients apparaîtront ici après leur première inscription." : "Aucun client ne correspond à votre recherche."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Raison sociale</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ville</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Participants</th>
                  {isAdmin && <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Apporteur</th>}
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                    <td className="px-6 py-3 font-medium text-gray-800">{c.raison_sociale}</td>
                    <td className="px-6 py-3 text-gray-600">{c.email}</td>
                    <td className="px-6 py-3 text-gray-600">{c.ville}</td>
                    <td className="px-6 py-3 text-center">{c.nb_participants}</td>
                    {isAdmin && (
                      <td className="px-6 py-3 text-gray-600 text-xs">
                        {c.apporteur_id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                            <UserCheck size={12} />
                            {getApporteurName(c.apporteur_id)}
                          </span>
                        ) : (
                          <span className="text-gray-400">Non attribué</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-3 text-gray-500 text-xs">{formatDate(c.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.raison_sociale || 'Client'} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500 text-xs">Raison sociale</span><p className="font-medium">{selected.raison_sociale}</p></div>
              <div><span className="text-gray-500 text-xs">Forme juridique</span><p className="font-medium">{selected.forme_juridique || '—'}</p></div>
              <div><span className="text-gray-500 text-xs">SIRET</span><p className="font-medium font-mono">{selected.siret || '—'}</p></div>
              <div><span className="text-gray-500 text-xs">Email</span><p className="font-medium">{selected.email}</p></div>
              <div><span className="text-gray-500 text-xs">Téléphone</span><p className="font-medium">{selected.telephone}</p></div>
              <div><span className="text-gray-500 text-xs">Site web</span><p className="font-medium">{selected.site_web || '—'}</p></div>
              <div className="col-span-2"><span className="text-gray-500 text-xs">Adresse</span><p className="font-medium">{selected.adresse}, {selected.code_postal} {selected.ville}</p></div>
              <div><span className="text-gray-500 text-xs">Représentant</span><p className="font-medium">{selected.representant_prenom} {selected.representant_nom} — {selected.representant_fonction}</p></div>
              <div><span className="text-gray-500 text-xs">Participants</span><p className="font-medium">{selected.nb_participants} ({selected.mode_participants})</p></div>
              <div><span className="text-gray-500 text-xs">Handicap</span><p className="font-medium">{selected.handicap ? 'Oui' : 'Non'}</p></div>
              <div><span className="text-gray-500 text-xs">OPCO</span><p className="font-medium">{selected.opco_financement ? selected.opco_nom || 'Oui' : 'Non'}</p></div>
            </div>

            {/* Admin: Assign apporteur */}
            {isAdmin && apporteurs.length > 0 && (
              <div className="pt-4 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Apporteur d'affaire rattaché</label>
                <select
                  value={selected.apporteur_id || ''}
                  onChange={(e) => handleAssignApporteur(selected.id, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nikita-pink/30 focus:border-nikita-pink"
                >
                  <option value="">— Aucun —</option>
                  {apporteurs.map((a) => (
                    <option key={a.id} value={a.id}>{a.first_name} {a.last_name} ({a.email})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
