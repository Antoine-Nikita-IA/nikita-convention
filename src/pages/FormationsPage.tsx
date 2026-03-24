import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, SelectField } from '@/components/ui/Input';
import { dataService } from '@/lib/services';
import { formatMoney, cn } from '@/lib/utils';
import { Plus, Clock, Euro, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Formation } from '@/types/database';

export function FormationsPage() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Formation | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [intitule, setIntitule] = useState('');
  const [duree, setDuree] = useState('');
  const [tarif, setTarif] = useState('');
  const [modalite, setModalite] = useState('Présentiel');
  const [objectifs, setObjectifs] = useState('');
  const [programme, setProgramme] = useState('');

  useEffect(() => {
    dataService.getFormations()
      .then(setFormations)
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  function openEdit(f: Formation) {
    setSelected(f);
    setIntitule(f.intitule);
    setDuree(String(f.duree_heures));
    setTarif(String(f.tarif_ht));
    setModalite(f.modalite);
    setObjectifs(f.objectifs || '');
    setProgramme(f.programme || '');
    setModalOpen(true);
  }

  function openNew() {
    setSelected(null);
    setIntitule(''); setDuree(''); setTarif(''); setModalite('Présentiel'); setObjectifs(''); setProgramme('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!intitule || !duree || !tarif) { toast.error('Remplissez les champs obligatoires'); return; }
    setSaving(true);
    try {
      const payload = {
        intitule,
        duree_heures: Number(duree),
        tarif_ht: Number(tarif),
        modalite: modalite as 'Présentiel' | 'Distanciel' | 'Hybride',
        objectifs: objectifs || undefined,
        programme: programme || undefined,
        actif: true,
      };
      if (selected) {
        const updated = await dataService.updateFormation(selected.id, payload);
        if (updated) setFormations(formations.map(f => f.id === selected.id ? updated : f));
        toast.success('Formation mise à jour');
      } else {
        const created = await dataService.createFormation(payload);
        setFormations([created, ...formations]);
        toast.success('Formation créée');
      }
      setModalOpen(false);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-nikita-pink" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Formations</h1>
        <Button icon={<Plus size={16} />} onClick={openNew}>Nouvelle formation</Button>
      </div>
      {formations.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-4">Aucune formation dans le catalogue.</p>
          <Button onClick={openNew} icon={<Plus size={16} />}>Ajouter une formation</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {formations.map((f) => (
            <Card key={f.id} onClick={() => openEdit(f)} className="p-5 hover:border-nikita-pink/30">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-800 text-sm leading-tight">{f.intitule}</h3>
                <span className={cn('px-2 py-0.5 text-[10px] font-medium rounded-full', f.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                  {f.actif ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="space-y-2 text-xs text-gray-500">
                <div className="flex items-center gap-2"><Clock size={13} />{f.duree_heures}h de formation</div>
                <div className="flex items-center gap-2"><Euro size={13} />{formatMoney(f.tarif_ht)} HT / personne</div>
                <div className="flex items-center gap-2"><MapPin size={13} />{f.modalite}</div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Modifier la formation' : 'Nouvelle formation'} size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button><Button onClick={handleSave} loading={saving}>{selected ? 'Enregistrer' : 'Créer'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Intitulé" value={intitule} onChange={(e) => setIntitule(e.target.value)} placeholder="Ex: IA pour PME — Fondamentaux" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Durée (heures)" type="number" value={duree} onChange={(e) => setDuree(e.target.value)} />
            <Input label="Tarif HT (€/personne)" type="number" value={tarif} onChange={(e) => setTarif(e.target.value)} />
          </div>
          <SelectField label="Modalité" value={modalite} onChange={(e) => setModalite(e.target.value)} options={[{ value: 'Présentiel', label: 'Présentiel' }, { value: 'Distanciel', label: 'Distanciel' }, { value: 'Hybride', label: 'Hybride' }]} />
          <Textarea label="Objectifs" value={objectifs} onChange={(e) => setObjectifs(e.target.value)} placeholder="Objectifs de la formation..." />
          <Textarea label="Programme" value={programme} onChange={(e) => setProgramme(e.target.value)} placeholder="Programme détaillé..." />
        </div>
      </Modal>
    </div>
  );
}
