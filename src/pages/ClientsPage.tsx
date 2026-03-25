import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { dataService } from '@/lib/services';
import { formatDate } from '@/lib/utils';
import { Search, Building2, Loader2, UserCheck, Filter, X, Download } from 'lucide-react';
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

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterVille, setFilterVille] = useState('');
  const [filterOpco, setFilterOpco] = useState<'' | 'oui' | 'non'>('');
  const [filterApporteur, setFilterApporteur] = useState('');

  useEffect(() => {
    const isApporteur = user?.role === 'apporteur_affaire';
    const fetcher = isApporteur && user?.id
      ? dataService.getClientsByApporteurId(user.id)
      : dataService.getClients();

    const promises: Promise<unknown>[] = [fetcher];
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

  const villes = useMemo(() => {
    return [...new Set(clients.map((c) => c.ville).filter(Boolean))].sort();
  }, [clients]);

  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (filterVille) c++;
    if (filterOpco) c++;
    if (filterApporteur) c++;
    return c;
  }, [filterVille, filterOpco, filterApporteur]);

  const filtered = useMemo(() => {
    let result = [...clients];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.raison_sociale.toLowerCase().includes(q) ||
        c.siret?.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.ville.toLowerCase().includes(q)
      );
    }
    if (filterVille) result = result.filter((c) => c.ville === filterVille);
    if (filterOpco === 'oui') result = result.filter((c) => c.opco_financement);
    if (filterOpco === 'non') result = result.filter((c) => !c.opco_financement);
    if (filterApporteur) result = result.filter((c) => c.apporteur_id === filterApporteur);
    return result;
  }, [search, clients, filterVille, filterOpco, filterApporteur]);

  function clearFilters() {
    setFilterVille('');
    setFilterOpco('');
    setFilterApporteur('');
  }

  function exportClientsCSV() {
    const headers = ['Raison sociale', 'SIRET', 'Email', 'Téléphone', 'Adresse', 'CP', 'Ville', 'Représentant', 'Participants', 'OPCO', 'Nom OPCO', 'Date inscription'];
    const rows = filtered.map((c) => [
      c.raison_sociale, c.siret || '', c.email, c.telephone,
      c.adresse, c.code_postal, c.ville,
      `${c.representant_prenom} ${c.representant_nom}`,
      String(c.nb_participants),
      c.opco_financement ? 'Oui' : 'Non', c.opco_nom || '',
      new Date(c.submitted_at).toLocaleDateString('fr-FR'),
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clients_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  async function handleAssignApporteur(clientId: string, apporteurId: string) {
    const ok = await dataService.assignClientToApporteur(clientId, apporteurId);
    if (ok) {
      toast.success('Apporteur attribué');
      setClients((prev) => prev.map((c) => c.id === clientId ? { ...c, apporteur_id: apporteurId || null } : c));
      if (selected?.id === clientId) setSelected({ ...selected, apporteur_id: apporteurId || null });
    } else {
      toast.error("Erreur lors de l'attribution");
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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Clients</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={exportClientsCSV}>Export CSV</Button>
          <span className="text-sm text-gray-500 dark:text-gray-400">{filtered.length} client{filtered.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom, SIRET, email, ville..." icon={<Search size={16} />} />
        </div>
        <Button
          variant={showFilters ? 'primary' : 'outline'}
          size="sm"
          icon={<Filter size={16} />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filtres{activeFiltersCount > 0 && ` (${activeFiltersCount})`}
        </Button>
      </div>

      {showFilters && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filtres avancés</h3>
            {activeFiltersCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-nikita-pink hover:underline flex items-center gap-1">
                <X size={12} /> Réinitialiser
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SelectField label="Ville" value={filterVille} onChange={(e) => setFilterVille(e.target.value)}
              options={villes.map((v) => ({ value: v, label: v }))} />
            <SelectField label="Financement OPCO" value={filterOpco} onChange={(e) => setFilterOpco(e.target.value as '' | 'oui' | 'non')}
              options={[{ value: 'oui', label: 'Avec OPCO' }, { value: 'non', label: 'Sans OPCO' }]} />
            {isAdmin && apporteurs.length > 0 && (
              <SelectField label="Apporteur" value={filterApporteur} onChange={(e) => setFilterApporteur(e.target.value)}
                options={apporteurs.map((a) => ({ value: a.id, label: `${a.first_name} ${a.last_name}` }))} />
            )}
          </div>
        </Card>
      )}

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<Building2 size={48} />} title="Aucun client" description={clients.length === 0 ? "Les clients apparaîtront ici après leur première inscription." : "Aucun client ne correspond à votre recherche."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Raison sociale</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ville</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Participants</th>
                  {isAdmin && <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Apporteur</th>}
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                    <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-200">{c.raison_sociale}</td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{c.email}</td>
                    <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{c.ville}</td>
                    <td className="px-6 py-3 text-center text-gray-600 dark:text-gray-400">{c.nb_participants}</td>
                    {isAdmin && (
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400 text-xs">
                        {c.apporteur_id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                            <UserCheck size={12} />
                            {getApporteurName(c.apporteur_id)}
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">Non attribué</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDate(c.submitted_at)}</td>
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
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">Raison sociale</span><p className="font-medium dark:text-gray-200">{selected.raison_sociale}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">Forme juridique</span><p className="font-medium dark:text-gray-200">{selected.forme_juridique || '—'}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">SIRET</span><p className="font-medium font-mono dark:text-gray-200">{selected.siret || '—'}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">Email</span><p className="font-medium dark:text-gray-200">{selected.email}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">Téléphone</span><p className="font-medium dark:text-gray-200">{selected.telephone}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">Site web</span><p className="font-medium dark:text-gray-200">{selected.site_web || '—'}</p></div>
              <div className="col-span-2"><span className="text-gray-500 dark:text-gray-400 text-xs">Adresse</span><p className="font-medium dark:text-gray-200">{selected.adresse}, {selected.code_postal} {selected.ville}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">Représentant</span><p className="font-medium dark:text-gray-200">{selected.representant_prenom} {selected.representant_nom} — {selected.representant_fonction}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">Participants</span><p className="font-medium dark:text-gray-200">{selected.nb_participants} ({selected.mode_participants})</p></div>
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">Handicap</span><p className="font-medium dark:text-gray-200">{selected.handicap ? 'Oui' : 'Non'}</p></div>
              <div><span className="text-gray-500 dark:text-gray-400 text-xs">OPCO</span><p className="font-medium dark:text-gray-200">{selected.opco_financement ? selected.opco_nom || 'Oui' : 'Non'}</p></div>
            </div>

            {isAdmin && apporteurs.length > 0 && (
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Apporteur d'affaire rattaché</label>
                <select
                  value={selected.apporteur_id || ''}
                  onChange={(e) => handleAssignApporteur(selected.id, e.target.value)}
                  className="input-field"
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
