import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { dataService } from '@/lib/services';
import { formatDate } from '@/lib/utils';
import { Search, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Client } from '@/types/database';

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    dataService.getClients()
      .then(setClients)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!search) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) => c.raison_sociale.toLowerCase().includes(q) || c.siret?.includes(q) || c.email.toLowerCase().includes(q) || c.ville.toLowerCase().includes(q));
  }, [search, clients]);

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
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">SIRET</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Ville</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Participants</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelected(c)}>
                    <td className="px-6 py-3 font-medium text-gray-800">{c.raison_sociale}</td>
                    <td className="px-6 py-3 text-gray-500 font-mono text-xs">{c.siret || '—'}</td>
                    <td className="px-6 py-3 text-gray-600">{c.email}</td>
                    <td className="px-6 py-3 text-gray-600">{c.ville}</td>
                    <td className="px-6 py-3 text-center">{c.nb_participants}</td>
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
        )}
      </Modal>
    </div>
  );
}
