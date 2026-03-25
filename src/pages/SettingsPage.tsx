import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { dataService } from '@/lib/services';
import { cn } from '@/lib/utils';
import { Building2, Mail, Save, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Organisme, EmailTemplate } from '@/types/database';

const TABS = [
  { id: 'organisme' as const, label: 'Organisme', icon: Building2 },
  { id: 'emails' as const, label: 'Emails', icon: Mail },
];

export function SettingsPage() {
  const [tab, setTab] = useState<'organisme' | 'emails'>('organisme');
  const [loading, setLoading] = useState(true);
  const [organisme, setOrganisme] = useState<Organisme | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingTpl, setSavingTpl] = useState<string | null>(null);

  // Organisme form state
  const [orgNom, setOrgNom] = useState('');
  const [orgSiret, setOrgSiret] = useState('');
  const [orgNda, setOrgNda] = useState('');
  const [orgCerts, setOrgCerts] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgTel, setOrgTel] = useState('');
  const [orgResp, setOrgResp] = useState('');
  const [orgPrefixe, setOrgPrefixe] = useState('');
  const [orgAdresse, setOrgAdresse] = useState('');

  useEffect(() => {
    Promise.all([dataService.getOrganisme(), dataService.getEmailTemplates()])
      .then(([org, tpls]) => {
        setOrganisme(org);
        setTemplates(tpls);
        if (org) {
          setOrgNom(org.nom); setOrgSiret(org.siret); setOrgNda(org.nda);
          setOrgCerts(org.certifications || ''); setOrgEmail(org.email_contact);
          setOrgTel(org.telephone); setOrgResp(org.responsable_pedagogique);
          setOrgPrefixe(org.prefixe_convention); setOrgAdresse(org.adresse);
        }
      })
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!organisme) return;
    setSavingOrg(true);
    try {
      const updated = await dataService.updateOrganisme({
        nom: orgNom, siret: orgSiret, nda: orgNda, certifications: orgCerts,
        email_contact: orgEmail, telephone: orgTel, responsable_pedagogique: orgResp,
        prefixe_convention: orgPrefixe, adresse: orgAdresse,
      });
      setOrganisme(updated);
      toast.success('Paramètres sauvegardés');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSavingOrg(false);
    }
  }

  async function handleSaveTemplate(tpl: EmailTemplate, newSubject: string, newBody: string) {
    setSavingTpl(tpl.id);
    try {
      const updated = await dataService.updateEmailTemplate(tpl.id, { subject: newSubject, body_html: newBody });
      if (updated) setTemplates(templates.map(t => t.id === tpl.id ? updated : t));
      toast.success('Template sauvegardé');
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSavingTpl(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-nikita-pink" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Paramètres</h1>
      <div className="flex gap-2 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px', tab === id ? 'border-nikita-pink text-nikita-pink' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300')}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {tab === 'organisme' && (
        <Card>
          <CardContent>
            {!organisme ? (
              <div className="py-8 text-center text-gray-400">Aucun organisme configuré.</div>
            ) : (
              <form className="space-y-4" onSubmit={handleSaveOrg}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Nom de l'organisme" value={orgNom} onChange={(e) => setOrgNom(e.target.value)} />
                  <Input label="SIRET" value={orgSiret} onChange={(e) => setOrgSiret(e.target.value)} />
                  <Input label="N° Déclaration d'Activité" value={orgNda} onChange={(e) => setOrgNda(e.target.value)} />
                  <Input label="Certifications" value={orgCerts} onChange={(e) => setOrgCerts(e.target.value)} />
                  <Input label="Email contact" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} />
                  <Input label="Téléphone" value={orgTel} onChange={(e) => setOrgTel(e.target.value)} />
                  <Input label="Responsable pédagogique" value={orgResp} onChange={(e) => setOrgResp(e.target.value)} />
                  <Input label="Préfixe convention" value={orgPrefixe} onChange={(e) => setOrgPrefixe(e.target.value)} />
                </div>
                <Textarea label="Adresse" value={orgAdresse} onChange={(e) => setOrgAdresse(e.target.value)} />
                <div className="flex justify-end"><Button type="submit" icon={<Save size={16} />} loading={savingOrg}>Enregistrer</Button></div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'emails' && (
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="py-8 text-center text-gray-400">Aucun template email configuré.</div>
          ) : templates.map((tpl) => (
            <TemplateEditor key={tpl.id} tpl={tpl} expanded={expandedTemplate === tpl.id}
              onToggle={() => setExpandedTemplate(expandedTemplate === tpl.id ? null : tpl.id)}
              onSave={(subject, body) => handleSaveTemplate(tpl, subject, body)}
              saving={savingTpl === tpl.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({ tpl, expanded, onToggle, onSave, saving }: {
  tpl: EmailTemplate; expanded: boolean; onToggle: () => void;
  onSave: (subject: string, body: string) => void; saving: boolean;
}) {
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body_html);

  return (
    <Card>
      <button className="w-full flex items-center justify-between px-6 py-4 text-left" onClick={onToggle}>
        <div>
          <h3 className="text-sm font-semibold text-gray-800">{tpl.type.replace(/_/g, ' ')}</h3>
          <p className="text-xs text-gray-500">{tpl.subject}</p>
        </div>
        {expanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {expanded && (
        <CardContent className="border-t border-gray-100">
          <div className="space-y-3">
            <Input label="Sujet" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Textarea label="Corps HTML" value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs min-h-[120px]" />
            <div>
              <p className="text-xs text-gray-500 mb-1">Variables disponibles :</p>
              <div className="flex flex-wrap gap-1">
                {tpl.variables_disponibles.map((v) => (
                  <span key={v} className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 rounded text-gray-600">{`{{${v}}}`}</span>
                ))}
              </div>
            </div>
            <div className="flex justify-end"><Button size="sm" icon={<Save size={14} />} onClick={() => onSave(subject, body)} loading={saving}>Sauvegarder</Button></div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
