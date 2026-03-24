import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, SelectField } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { formatMoney, getClientFromSession, cn } from '@/lib/utils';
import { dataService } from '@/lib/services';
import { STATUS_LABELS } from '@/types/database';
import type { Session, SessionStatus, Formation } from '@/types/database';
import { Search, Plus, FileText, Loader2 } from 'lucide-react';

const FILTER_OPTIONS: (SessionStatus | 'all')[] = ['all', 'en_attente', 'formulaire_recu', 'valide', 'convention_generee', 'envoye', 'signe', 'annule'];

export function SessionsPage() {
  const [filter, setFilter] = useState<SessionStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const [newFormationId, setNewFormationId] = useState('');
  const [newDates, setNewDates] = useState('');
  const [newVille, setNewVille] = useState('');
  const [newLieu, setNewLieu] = useState('');
  const [newFormateurs, setNewFormateurs] = useState('');

  useEffect(() => {
    Promise.all([dataService.getSessions(), dataService.getFormations()])
      .then(([s, f]) => { setSessions(s); setFormations(f); })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let result = [...sessions];
    if (filter !== 'all') result = result.filter((s) => s.status === filter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const client = getClientFromSession(s);
        return s.formation?.intitule?.toLowerCase().includes(q) || client?.raison_sociale?.toLowerCase().includes(q) || s.convention_numero?.toLowerCase().includes(q);
      });
    }
    return result;
  }, [filter, search, sessions]);

  async function handleCreate() {
    if (!newFormationId) { toast.error('Sélectionnez une formation'); return; }
    setCreating(true);
    try {
      const formation = formations.find(f => f.id === newFormationId);
      const session = await dataService.createSession({
        formation_id: newFormationId,
        dates_formation: newDates || null,
        ville: newVille || null,
        lieu: newLieu || null,
        formateurs: newFormateurs,
        montant_ht: formation?.tarif_ht || null,
      });
      setSessions([session, ...sessions]);
      setShowCreateModal(false);
      setNewFormationId(''); setNewDates(''); setNewVille(''); setNewLieu(''); setNewFormateurs('');
      toast.success('Session créée avec succès');
      navigate(`/sessions/${session.id}`);
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-nikita-pink" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Sessions</h1>
        <Button icon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>Nouvelle session</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1.5 text-xs font-medium rounded-full transition-colors', filter === f ? 'bg-nikita-pink text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {f === 'all' ? 'Toutes' : STATUS_LABELS[f]}
            {f !== 'all' && ` (${sessions.filter((s) => s.status === f).length})`}
          </button>
        ))}
      </div>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par formation, client, numéro..." icon={<Search size={16} />} />

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<FileText size={48} />} title="Aucune session" description="Aucune session ne correspond à vos critères." action={<Button size="sm" onClick={() => setShowCreateModal(true)} icon={<Plus size={14} />}>Créer une session</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Formation</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Montant HT</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Dates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((session) => {
                  const client = getClientFromSession(session);
                  return (
                    <tr key={session.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => navigate(`/sessions/${session.id}`)}>
                      <td className="px-6 py-3 font-medium text-gray-800">{session.formation?.intitule || '—'}</td>
                      <td className="px-6 py-3 text-gray-600">{client?.raison_sociale || <span className="text-gray-400">—</span>}</td>
                      <td className="px-6 py-3"><StatusBadge status={session.status} /></td>
                      <td className="px-6 py-3 text-gray-600">{session.montant_ht ? formatMoney(session.montant_ht) : <span className="text-gray-400">—</span>}</td>
                      <td className="px-6 py-3 text-gray-500 text-xs">{session.dates_formation || <span className="text-gray-400">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nouvelle session" size="lg"
        footer={<><Button variant="outline" onClick={() => setShowCreateModal(false)}>Annuler</Button><Button onClick={handleCreate} loading={creating}>Créer la session</Button></>}
      >
        <div className="space-y-4">
          <SelectField label="Formation" value={newFormationId} onChange={(e) => setNewFormationId(e.target.value)}
            options={formations.filter(f => f.actif).map(f => ({ value: f.id, label: `${f.intitule} (${f.duree_heures}h — ${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(f.tarif_ht)} HT)` }))} />
          <Input label="Dates de formation" value={newDates} onChange={(e) => setNewDates(e.target.value)} placeholder="Ex: 15-16 avril 2026" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ville" value={newVille} onChange={(e) => setNewVille(e.target.value)} placeholder="Lyon" />
            <Input label="Lieu" value={newLieu} onChange={(e) => setNewLieu(e.target.value)} placeholder="Salle de formation" />
          </div>
          <Input label="Formateur(s)" value={newFormateurs} onChange={(e) => setNewFormateurs(e.target.value)} placeholder="Nom du/des formateur(s)" />
        </div>
      </Modal>
    </div>
  );
}
