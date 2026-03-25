import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input, SelectField, Textarea } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { dataService } from '@/lib/services';
import type { Formation } from '@/types/database';
import { formatMoney } from '@/lib/utils';
import {
  Building2,
  User,
  GraduationCap,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Loader2,
  Clock,
  Euro,
  MapPin,
} from 'lucide-react';

const STEPS = [
  { label: 'Entreprise', icon: Building2 },
  { label: 'Contact', icon: User },
  { label: 'Formation', icon: GraduationCap },
  { label: 'Confirmation', icon: CheckCircle },
];

interface FormData {
  raison_sociale: string;
  forme_juridique: string;
  siret: string;
  adresse: string;
  code_postal: string;
  ville: string;
  nb_salaries: string;
  secteur_activite: string;
  site_web: string;
  representant_prenom: string;
  representant_nom: string;
  representant_fonction: string;
  email: string;
  telephone: string;
  nb_participants: string;
  mode_participants: string;
  date_souhaitee_debut: string;
  opco_financement: string;
  opco_nom: string;
  handicap: string;
  recueil_besoins: string;
}

const INITIAL_FORM: FormData = {
  raison_sociale: '',
  forme_juridique: 'SAS',
  siret: '',
  adresse: '',
  code_postal: '',
  ville: '',
  nb_salaries: '',
  secteur_activite: '',
  site_web: '',
  representant_prenom: '',
  representant_nom: '',
  representant_fonction: '',
  email: '',
  telephone: '',
  nb_participants: '1',
  mode_participants: 'exact',
  date_souhaitee_debut: '',
  opco_financement: 'ne_sait_pas',
  opco_nom: '',
  handicap: 'non',
  recueil_besoins: '',
};

type FormErrors = Partial<Record<keyof FormData, string>>;

function validateStep(step: number, form: FormData): FormErrors {
  const errors: FormErrors = {};
  if (step === 0) {
    if (!form.raison_sociale.trim()) errors.raison_sociale = 'Requis';
    if (!form.siret.trim()) errors.siret = 'Requis';
    else if (form.siret.replace(/\s/g, '').length !== 14)
      errors.siret = 'Le SIRET doit contenir 14 chiffres';
    if (!form.adresse.trim()) errors.adresse = 'Requis';
    if (!form.code_postal.trim()) errors.code_postal = 'Requis';
    if (!form.ville.trim()) errors.ville = 'Requis';
  }
  if (step === 1) {
    if (!form.representant_prenom.trim()) errors.representant_prenom = 'Requis';
    if (!form.representant_nom.trim()) errors.representant_nom = 'Requis';
    if (!form.representant_fonction.trim()) errors.representant_fonction = 'Requis';
    if (!form.email.trim()) errors.email = 'Requis';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errors.email = 'Email invalide';
    if (!form.telephone.trim()) errors.telephone = 'Requis';
  }
  if (step === 2) {
    const nb = parseInt(form.nb_participants, 10);
    if (!nb || nb < 1) errors.nb_participants = 'Au moins 1 participant';
    if (form.opco_financement === 'oui' && !form.opco_nom.trim())
      errors.opco_nom = "Précisez le nom de l'OPCO";
  }
  return errors;
}

export function DemandeFormationPage() {
  const { formationId } = useParams<{ formationId: string }>();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formation, setFormation] = useState<Formation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [suiviToken, setSuiviToken] = useState<string | null>(null);

  useEffect(() => {
    if (!formationId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    dataService.getFormationById(formationId).then((f) => {
      if (!f || !f.actif) {
        setNotFound(true);
      } else {
        setFormation(f);
      }
      setLoading(false);
    });
  }, [formationId]);

  const updateField = useCallback(
    (field: keyof FormData, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    },
    [errors]
  );

  function handleNext() {
    const stepErrors = validateStep(step, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep(step + 1);
  }

  async function handleSubmit() {
    if (!formationId) return;
    setSubmitting(true);

    const result = await dataService.submitDemandeFormation(formationId, {
      raison_sociale: form.raison_sociale,
      forme_juridique: form.forme_juridique,
      siret: form.siret.replace(/\s/g, ''),
      adresse: form.adresse,
      code_postal: form.code_postal,
      ville: form.ville,
      nb_salaries: form.nb_salaries ? parseInt(form.nb_salaries, 10) : null,
      email: form.email,
      telephone: form.telephone,
      site_web: form.site_web || null,
      secteur_activite: form.secteur_activite || null,
      representant_prenom: form.representant_prenom,
      representant_nom: form.representant_nom,
      representant_fonction: form.representant_fonction,
      date_souhaitee_debut: form.date_souhaitee_debut || null,
      nb_participants: parseInt(form.nb_participants, 10) || 1,
      mode_participants: form.mode_participants as 'exact' | 'estimation' | 'ulterieur',
      handicap: form.handicap === 'oui',
      opco_financement: form.opco_financement === 'oui',
      opco_nom: form.opco_financement === 'oui' ? form.opco_nom : null,
      recueil_besoins: form.recueil_besoins || null,
    });

    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
      if (result.token) setSuiviToken(result.token);
    }
  }

  // --- LOADING ---
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nikita-gray">
        <Loader2 size={32} className="animate-spin text-nikita-pink" />
      </div>
    );
  }

  // --- NOT FOUND ---
  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nikita-gray px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Formation introuvable</h1>
          <p className="text-gray-600">
            Cette formation n'existe pas ou n'est plus disponible. Veuillez contacter l'organisme de formation.
          </p>
        </div>
      </div>
    );
  }

  // --- SUCCESS ---
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nikita-gray px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Demande enregistrée !</h1>
          <p className="text-gray-600 mb-2">
            Merci pour votre demande de formation{' '}
            <strong>{formation?.intitule}</strong>.
          </p>
          <p className="text-sm text-gray-500">
            Un email de confirmation vous a été envoyé à <strong>{form.email}</strong>.
            Notre équipe vous contactera dans les 24h pour la suite du processus.
          </p>
          {suiviToken && (
            <a
              href={`/suivi/${suiviToken}`}
              className="inline-block mt-4 text-nikita-pink hover:underline text-sm font-medium"
            >
              Suivre l'avancement de mon dossier →
            </a>
          )}
        </div>
      </div>
    );
  }

  // --- FORM ---
  return (
    <div className="min-h-screen bg-nikita-gray py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-nikita-pink rounded-xl flex items-center justify-center font-bold text-xl text-white mx-auto mb-3">
            N
          </div>
          <h1 className="text-xl font-bold text-gray-800">Demande de formation</h1>
          <p className="text-sm text-gray-500 mt-1">NIKITA — Organisme certifié Qualiopi</p>

          {/* Formation card */}
          {formation && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 text-left max-w-md mx-auto">
              <h2 className="font-semibold text-gray-900 text-base mb-2">{formation.intitule}</h2>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><Clock size={13} />{formation.duree_heures}h</span>
                <span className="flex items-center gap-1"><Euro size={13} />{formatMoney(formation.tarif_ht)} HT/pers.</span>
                <span className="flex items-center gap-1"><MapPin size={13} />{formation.modalite}</span>
              </div>
              {formation.objectifs && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{formation.objectifs}</p>
              )}
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  i === step
                    ? 'bg-nikita-pink text-white'
                    : i < step
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                )}
              >
                <s.icon size={14} />
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('w-8 h-0.5 mx-1', i < step ? 'bg-green-500' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        <Card>
          <CardContent>
            {/* Step 0: Entreprise */}
            {step === 0 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-800">Informations entreprise</h2>
                <Input label="Raison sociale *" value={form.raison_sociale} onChange={(e) => updateField('raison_sociale', e.target.value)} error={errors.raison_sociale} placeholder="Nom de l'entreprise" />
                <Input label="SIRET *" value={form.siret} onChange={(e) => updateField('siret', e.target.value)} error={errors.siret} placeholder="123 456 789 01234" maxLength={17} />
                <SelectField label="Forme juridique" value={form.forme_juridique} onChange={(e) => updateField('forme_juridique', e.target.value)} options={[
                  { value: 'SAS', label: 'SAS' }, { value: 'SARL', label: 'SARL' }, { value: 'EURL', label: 'EURL' },
                  { value: 'SA', label: 'SA' }, { value: 'SCI', label: 'SCI' }, { value: 'EIRL', label: 'EIRL' },
                  { value: 'Auto-entrepreneur', label: 'Auto-entrepreneur' }, { value: 'Association', label: 'Association' },
                ]} />
                <Input label="Adresse *" value={form.adresse} onChange={(e) => updateField('adresse', e.target.value)} error={errors.adresse} placeholder="Adresse complète" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Code postal *" value={form.code_postal} onChange={(e) => updateField('code_postal', e.target.value)} error={errors.code_postal} placeholder="69000" maxLength={5} />
                  <Input label="Ville *" value={form.ville} onChange={(e) => updateField('ville', e.target.value)} error={errors.ville} placeholder="Lyon" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nombre de salariés" type="number" value={form.nb_salaries} onChange={(e) => updateField('nb_salaries', e.target.value)} placeholder="Ex: 25" />
                  <Input label="Secteur d'activité" value={form.secteur_activite} onChange={(e) => updateField('secteur_activite', e.target.value)} placeholder="Ex: Conseil IT" />
                </div>
                <Input label="Site web" value={form.site_web} onChange={(e) => updateField('site_web', e.target.value)} placeholder="www.entreprise.fr" />
              </div>
            )}

            {/* Step 1: Contact */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-800">Personne de contact</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Prénom *" value={form.representant_prenom} onChange={(e) => updateField('representant_prenom', e.target.value)} error={errors.representant_prenom} placeholder="Jean" />
                  <Input label="Nom *" value={form.representant_nom} onChange={(e) => updateField('representant_nom', e.target.value)} error={errors.representant_nom} placeholder="Dupont" />
                </div>
                <Input label="Fonction *" value={form.representant_fonction} onChange={(e) => updateField('representant_fonction', e.target.value)} error={errors.representant_fonction} placeholder="Directeur général" />
                <Input label="Email *" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} error={errors.email} placeholder="contact@entreprise.fr" />
                <Input label="Téléphone *" value={form.telephone} onChange={(e) => updateField('telephone', e.target.value)} error={errors.telephone} placeholder="06 12 34 56 78" />
              </div>
            )}

            {/* Step 2: Formation details */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="font-semibold text-gray-800">Détails formation</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Nombre de participants *" type="number" min={1} value={form.nb_participants} onChange={(e) => updateField('nb_participants', e.target.value)} error={errors.nb_participants} placeholder="5" />
                  <SelectField label="Nombre" value={form.mode_participants} onChange={(e) => updateField('mode_participants', e.target.value)} options={[
                    { value: 'exact', label: 'Exact' }, { value: 'estimation', label: 'Estimation' }, { value: 'ulterieur', label: 'À préciser' },
                  ]} />
                </div>
                <Input label="Date souhaitée de début" type="date" value={form.date_souhaitee_debut} onChange={(e) => updateField('date_souhaitee_debut', e.target.value)} />
                <SelectField label="Financement OPCO" value={form.opco_financement} onChange={(e) => updateField('opco_financement', e.target.value)} options={[
                  { value: 'oui', label: 'Oui' }, { value: 'non', label: 'Non' }, { value: 'ne_sait_pas', label: 'Ne sait pas' },
                ]} />
                {form.opco_financement === 'oui' && (
                  <Input label="Nom de l'OPCO *" value={form.opco_nom} onChange={(e) => updateField('opco_nom', e.target.value)} error={errors.opco_nom} placeholder="Ex: Afdas, Atlas, Opco Commerce..." />
                )}
                <SelectField label="Personne en situation de handicap" value={form.handicap} onChange={(e) => updateField('handicap', e.target.value)} options={[
                  { value: 'non', label: 'Non' }, { value: 'oui', label: 'Oui, adaptation nécessaire' },
                ]} />
                <Textarea label="Besoins spécifiques / contexte" value={form.recueil_besoins} onChange={(e) => updateField('recueil_besoins', e.target.value)} placeholder="Décrivez vos objectifs, votre contexte métier, vos attentes spécifiques..." rows={4} />
              </div>
            )}

            {/* Step 3: Confirmation */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="font-semibold text-gray-800 text-center">Récapitulatif</h2>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wide">Entreprise</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Raison sociale</span><p className="font-medium">{form.raison_sociale}</p></div>
                    <div><span className="text-gray-500">SIRET</span><p className="font-medium font-mono text-xs">{form.siret}</p></div>
                    <div className="col-span-2"><span className="text-gray-500">Adresse</span><p className="font-medium">{form.adresse}, {form.code_postal} {form.ville}</p></div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wide">Contact</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Nom</span><p className="font-medium">{form.representant_prenom} {form.representant_nom}</p></div>
                    <div><span className="text-gray-500">Fonction</span><p className="font-medium">{form.representant_fonction}</p></div>
                    <div><span className="text-gray-500">Email</span><p className="font-medium">{form.email}</p></div>
                    <div><span className="text-gray-500">Téléphone</span><p className="font-medium">{form.telephone}</p></div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-gray-500 tracking-wide">Formation</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-500">Participants</span><p className="font-medium">{form.nb_participants}</p></div>
                    <div><span className="text-gray-500">Date souhaitée</span><p className="font-medium">{form.date_souhaitee_debut || 'Non précisée'}</p></div>
                    <div><span className="text-gray-500">OPCO</span><p className="font-medium">{form.opco_financement === 'oui' ? `Oui — ${form.opco_nom}` : form.opco_financement === 'non' ? 'Non' : 'Ne sait pas'}</p></div>
                    <div><span className="text-gray-500">Handicap</span><p className="font-medium">{form.handicap === 'oui' ? 'Oui' : 'Non'}</p></div>
                  </div>
                  {form.recueil_besoins && (
                    <div className="text-sm"><span className="text-gray-500">Besoins</span><p className="font-medium">{form.recueil_besoins}</p></div>
                  )}
                </div>

                <Button onClick={handleSubmit} loading={submitting} size="lg" className="w-full" icon={<CheckCircle size={18} />}>
                  Confirmer la demande
                </Button>
                <p className="text-[10px] text-gray-400 text-center">
                  En confirmant, vous acceptez que vos données soient traitées conformément à notre politique de confidentialité.
                </p>
              </div>
            )}

            {/* Navigation */}
            {step < 3 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <Button variant="ghost" onClick={() => { setErrors({}); setStep(step - 1); }} disabled={step === 0} icon={<ArrowLeft size={16} />}>
                  Précédent
                </Button>
                <Button onClick={handleNext} icon={<ArrowRight size={16} />}>
                  Suivant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
