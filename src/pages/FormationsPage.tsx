import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, SelectField } from '@/components/ui/Input';
import { mockFormations } from '@/data/mock';
import { formatMoney, cn } from '@/lib/utils';
import { Plus, Clock, Euro, MapPin } from 'lucide-react';
import type { Formation } from '@/types/database';

export function FormationsPage() {
  const [formations] = useState(mockFormations);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Formation | null>(null);

  function openEdit(f: Formation) { setSelected(f); setModalOpen(true); }
  function openNew() { setSelected(null); setModalOpen(true); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Formations</h1>
        <Button icon={<Plus size={16} />} onClick={openNew}>Nouvelle formation</Button>
      </div>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={selected ? 'Modifier la formation' : 'Nouvelle formation'} size="lg"
        footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button><Button onClick={() => setModalOpen(false)}>{selected ? 'Enregistrer' : 'Créer'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Intitulé" defaultValue={selected?.intitule} placeholder="Ex: IA pour PME — Fondamentaux" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Durée (heures)" type="number" defaultValue={selected?.duree_heures} />
            <Input label="Tarif HT (€/personne)" type="number" defaultValue={selected?.tarif_ht} />
          </div>
          <SelectField label="Modalité" defaultValue={selected?.modalite} options={[{ value: 'Présentiel', label: 'Présentiel' }, { value: 'Distanciel', label: 'Distanciel' }, { value: 'Hybride', label: 'Hybride' }]} />
          <Textarea label="Objectifs" defaultValue={selected?.objectifs} placeholder="Objectifs de la formation..." />
          <Textarea label="Programme" defaultValue={selected?.programme} placeholder="Programme détaillé..." />
        </div>
      </Modal>
    </div>
  );
}
