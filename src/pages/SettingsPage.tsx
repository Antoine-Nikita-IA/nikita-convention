import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { mockOrganisme, mockEmailTemplates } from '@/data/mock';
import { cn } from '@/lib/utils';
import { Building2, Mail, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const TABS = [
  { id: 'organisme' as const, label: 'Organisme', icon: Building2 },
  { id: 'emails' as const, label: 'Emails', icon: Mail },
];

export function SettingsPage() {
  const [tab, setTab] = useState<'organisme' | 'emails'>('organisme');
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Paramètres</h1>
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', tab === id ? 'border-nikita-pink text-nikita-pink' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {tab === 'organisme' && (
        <Card>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); toast.success('Paramètres sauvegardés'); }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Nom de l'organisme" defaultValue={mockOrganisme.nom} />
                <Input label="SIRET" defaultValue={mockOrganisme.siret} />
                <Input label="N° Déclaration d'Activité" defaultValue={mockOrganisme.nda} />
                <Input label="Certifications" defaultValue={mockOrganisme.certifications} />
                <Input label="Email contact" type="email" defaultValue={mockOrganisme.email_contact} />
                <Input label="Téléphone" defaultValue={mockOrganisme.telephone} />
                <Input label="Responsable pédagogique" defaultValue={mockOrganisme.responsable_pedagogique} />
                <Input label="Préfixe convention" defaultValue={mockOrganisme.prefixe_convention} />
              </div>
              <Textarea label="Adresse" defaultValue={mockOrganisme.adresse} />
              <div className="flex justify-end"><Button type="submit" icon={<Save size={16} />}>Enregistrer</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'emails' && (
        <div className="space-y-3">
          {mockEmailTemplates.map((tpl) => (
            <Card key={tpl.id}>
              <button className="w-full flex items-center justify-between px-6 py-4 text-left" onClick={() => setExpandedTemplate(expandedTemplate === tpl.id ? null : tpl.id)}>
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">{tpl.type.replace(/_/g, ' ')}</h3>
                  <p className="text-xs text-gray-500">{tpl.subject}</p>
                </div>
                {expandedTemplate === tpl.id ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
              </button>
              {expandedTemplate === tpl.id && (
                <CardContent className="border-t border-gray-100">
                  <div className="space-y-3">
                    <Input label="Sujet" defaultValue={tpl.subject} />
                    <Textarea label="Corps HTML" defaultValue={tpl.body_html} className="font-mono text-xs min-h-[120px]" />
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Variables disponibles :</p>
                      <div className="flex flex-wrap gap-1">
                        {tpl.variables_disponibles.map((v) => (
                          <span key={v} className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 rounded text-gray-600">{`{{${v}}}`}</span>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end"><Button size="sm" icon={<Save size={14} />}>Sauvegarder</Button></div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
