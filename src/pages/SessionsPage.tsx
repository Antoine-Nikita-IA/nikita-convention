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
import { Search, Plus, FileText, Loader2, Filter, X, SortAsc, SortDesc } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const FILTER_OPTIONS: (SessionStatus | 'all')[] = ['all', 'en_attente', 'formulaire_recu', 'valide', 'convention_generee', 'envoye', 'signe', 'annule'];

type SortField = 'date' | 'formation' | 'client' | 'montant';

export function SessionsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<SessionStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const isApporteur = user?.role === 'apporteur_affaire';

  // Advanced filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterFormation, setFilterFormation] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterMontantMin, setFilterMontantMin] = useState('');
  const [filterMontantMax, setFilterMontantMax] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState(false);

  const [newFormationId, setNewFormationId] = useState('');
  const [newDates, setNewDates] = useState('');
  const [newVille, setNewVille] = useState('');
  const [newLieu, setNewLieu] = useState('');
  const [newFormateurs, setNewFormateurs] = useState('');

  useEffect(() => {
    const sessionsFetcher = isApporteur && user?.id
      ? dataService.getSessionsByApporteurId(user.id)
      : dataService.getSessions();
    Promise.all([sessionsFetcher, dataService.getFormations()])
      .then(([s, f]) => { setSessions(s); setFormations(f); })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [user]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterFormation) count++;
    if (filterDateFrom) count++;
    if (filterDateTo) count++;
    if (filterMontantMin) count++;
    if (filterMontantMax) count++;
    return count;
  }, [filterFormation, filterDateFrom, filterDateTo, filterMontantMin, filterMontantMax]);

  function clearAdvancedFilters() {
    setFilterFormation('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterMontantMin('');
    setFilterMontantMax('');
  }

  const filtered = useMemo(() => {
    let result = [...sessions];

    // Status filter
    if (filter !== 'all') result = result.filter((s) => s.status === filter);

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((s) => {
        const client = getClientFromSession(s);
        return s.formation?.intitule?.toLowerCase().includes(q) || client?.raison_sociale?.toLowerCase().includes(q) || s.convention_numero?.toLowerCase().includes(q);
      });
    }

    // Formation filter
    if (filterFormation) {
      result = result.filter((s) => s.formation_id === filterFormation);
    }

    // Date filters (based on created_at)
    if (filterDateFrom) {
      const from = new Date(filterDateFrom);
      result = result.filter((s) => new Date(s.created_at) >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((s) => new Date(s.created_at) <= to);
    }

    // Montant filters
    if (filterMontantMin) {
      const min = parseFloat(filterMontantMin);
      result = result.filter((s) => (s.montant_ht || 0) >= min);
    }
    if (filterMontantMax) {
      const max = parseFloat(filterMontantMax);
      result = result.filter((s) => (s.montant_ht || 0) <= max);
    }

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          break;
        case 'formation':
          cmp = (a.formation?.intitule || '').localeCompare(b.formation?.intitule || '');
          break;
        case 'client': {
          const ca = getClientFromSession(a)?.raison_sociale || '';
          const cb = getClientFromSession(b)?.raison_sociale || '';
          cmp = ca.localeCompare(cb);
          break;
        }
        case 'montant':
          cmp = (a.montant_ht || 0) - (b.montant_ht || 0);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [filter, search, sessions, filterFormation, filterDateFrom, filterDateTo, filterMontantMin, filterMontantMax, sortField, sortAsc]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'formation' || field === 'client');
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortAsc ? <SortAsc size={12} className="inline ml-1" /> : <SortDesc size={12} className="inline ml-1" />;
  };

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
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Sessions</h1>
        {!isApporteur && <Button icon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>Nouvelle session</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTER_OPTIONS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1.5 text-xs font-medium rounded-full transition-colors', filter === f ? 'bg-nikita-pink text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600')}>
            {f === 'all' ? 'Toutes' : STATUS_LABELS[f]}
            {f !== 'all' && ` (${sessions.filter((s) => s.status === f).length})`}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par formation, client, numéro..." icon={<Search size={16} />} />
        </div>
        <Button
          variant={showAdvancedFilters ? 'primary' : 'outline'}
          size="sm"
          icon={<Filter size={16} />}
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          Filtres{activeFiltersCount > 0 && ` (${activeFiltersCount})`}
        </Button>
      </div>

      {/* Advanced filters panel */}
      {showAdvancedFilters && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Filtres avancés</h3>
            {activeFiltersCount > 0 && (
              <button onClick={clearAdvancedFilters} className="text-xs text-nikita-pink hover:underline flex items-center gap-1">
                <X size={12} /> Réinitialiser
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <SelectField
              label="Formation"
              value={filterFormation}
              onChange={(e) => setFilterFormation(e.target.value)}
              options={formations.map(f => ({ value: f.id, label: f.intitule }))}
            />
            <Input
              label="Date début"
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
            <Input
              label="Date fin"
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Montant min"
                type="number"
                value={filterMontantMin}
                onChange={(e) => setFilterMontantMin(e.target.value)}
                placeholder="0"
              />
              <Input
                label="Montant max"
                type="number"
                value={filterMontantMax}
                onChange={(e) => setFilterMontantMax(e.target.value)}
                placeholder="∞"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{filtered.length} session{filtered.length > 1 ? 's' : ''}{filter !== 'all' || activeFiltersCount > 0 ? ' (filtré)' : ''}</span>
        <span>Total HT : {formatMoney(filtered.reduce((sum, s) => sum + (s.montant_ht || 0), 0))}</span>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<FileText size={48} />} title="Aucune session" description="Aucune session ne correspond à vos critères." action={!isApporteur ? <Button size="sm" onClick={() => setShowCreateModal(true)} icon={<Plus size={14} />}>Créer une session</Button> : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => toggleSort('formation')}>
                    Formation <SortIcon field="formation" />
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => toggleSort('client')}>
                    Client <SortIcon field="client" />
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Statut</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Convention</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => toggleSort('montant')}>
                    Montant HT <SortIcon field="montant" />
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none" onClick={() => toggleSort('date')}>
                    Créée le <SortIcon field="date" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((session) => {
                  const client = getClientFromSession(session);
                  return (
                    <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors" onClick={() => navigate(`/sessions/${session.id}`)}>
                      <td className="px-6 py-3 font-medium text-gray-800 dark:text-gray-200">{session.formation?.intitule || '—'}</td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{client?.raison_sociale || <span className="text-gray-400 dark:text-gray-600">—</span>}</td>
                      <td className="px-6 py-3"><StatusBadge status={session.status} /></td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">{session.convention_numero || <span className="text-gray-300 dark:text-gray-600">—</span>}</td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-400">{session.montant_ht ? formatMoney(session.montant_ht) : <span className="text-gray-400 dark:text-gray-600">—</span>}</td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(session.created_at).toLocaleDateString('fr-FR')}</td>
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
