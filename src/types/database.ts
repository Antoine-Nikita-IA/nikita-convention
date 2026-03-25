// Types pour NIKITA Convention

export type SessionStatus =
  | 'en_attente'
  | 'formulaire_recu'
  | 'valide'
  | 'convention_generee'
  | 'envoye'
  | 'signe'
  | 'annule';

export type EtapeStatut = 'a_venir' | 'en_cours' | 'complete' | 'bloquee';

export type EmailType =
  | 'confirmation_inscription'
  | 'convention_envoi'
  | 'guide_opco'
  | 'relance_convention'
  | 'relance_liste_stagiaires'
  | 'lien_inscription'
  | 'convention_signee'
  | 'opco_depot';

export type DocumentType = 'fiche_pedagogique' | 'cgv' | 'reglement_interieur' | 'convention_pdf' | 'convention_signee';

export interface DocumentFormation {
  id: string;
  formation_id: string | null; // null = document global organisme
  type: DocumentType;
  nom: string;
  description: string;
  url: string;
  taille: string; // "1.2 Mo"
  created_at: string;
}

export type UserRole = 'admin' | 'user' | 'apporteur_affaire';

export interface Organisme {
  id: string;
  nom: string;
  prefixe_convention: string;
  siret: string;
  nda: string;
  adresse: string;
  ville: string;
  responsable_pedagogique: string;
  referent_handicap: string;
  referent_handicap_email: string;
  email_contact: string;
  telephone: string;
  certifications: string;
  logo_url: string | null;
  user_id: string;
}

export interface Formation {
  id: string;
  intitule: string;
  duree_heures: number;
  tarif_ht: number;
  modalite: 'Présentiel' | 'Distanciel' | 'Hybride';
  objectifs: string;
  programme: string;
  actif: boolean;
  user_id: string;
  created_at: string;
}

export interface Client {
  id: string;
  session_id: string;
  raison_sociale: string;
  forme_juridique: string;
  siret: string;
  adresse: string;
  code_postal: string;
  ville: string;
  nb_salaries: number | null;
  email: string;
  telephone: string;
  site_web: string | null;
  secteur_activite: string | null;
  representant_prenom: string;
  representant_nom: string;
  representant_fonction: string;
  date_souhaitee_debut: string | null;
  nb_participants: number;
  mode_participants: 'exact' | 'estimation' | 'ulterieur';
  handicap: boolean;
  opco_financement: boolean;
  opco_nom: string | null;
  recueil_besoins: string | null;
  apporteur_id?: string | null;
  submitted_at: string;
}

export interface Session {
  id: string;
  token: string;
  formation_id: string;
  user_id: string;
  status: SessionStatus;
  dates_formation: string | null;
  date_debut: string | null;
  horaires: string;
  lieu: string | null;
  ville: string | null;
  formateurs: string;
  notes_internes: string | null;
  convention_pdf_url: string | null;
  convention_signee_url: string | null;
  convention_numero: string | null;
  montant_ht: number | null;
  montant_ttc: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  formation?: Formation;
  client?: Client | Client[];
  convention?: Convention;
}

export interface Convention {
  id: string;
  session_id: string;
  numero: string;
  total_ht: number;
  tva: number;
  total_ttc: number;
  pdf_url: string | null;
  signed_pdf_url: string | null;
  signed_at: string | null;
}

export interface Stagiaire {
  id: string;
  session_id: string;
  client_id: string;
  prenom: string;
  nom: string;
  email: string;
  fonction: string;
}

export interface SessionLog {
  id: string;
  session_id: string;
  ancien_statut: SessionStatus;
  nouveau_statut: SessionStatus;
  note: string | null;
  user_id: string | null;
  created_at: string;
}

export interface SuiviEtape {
  id: string;
  session_id: string;
  etape_numero: number;
  statut: EtapeStatut;
  date_realisation: string | null;
  commentaire: string | null;
  action_requise: string | null;
}

export interface EmailTemplate {
  id: string;
  type: EmailType;
  subject: string;
  body_html: string;
  variables_disponibles: string[];
  updated_by: string | null;
}

export interface EmailLog {
  id: string;
  session_id: string;
  type: EmailType;
  destinataire: string;
  sujet: string;
  statut: 'envoye' | 'erreur' | 'rebondi';
  error_message: string | null;
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  organisme_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  is_validated: boolean;
  created_at?: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  user: 'Utilisateur',
  apporteur_affaire: "Apporteur d'affaire",
};

// Constants
export const STATUS_LABELS: Record<SessionStatus, string> = {
  en_attente: 'En attente',
  formulaire_recu: 'Formulaire reçu',
  valide: 'Validé',
  convention_generee: 'Convention générée',
  envoye: 'Envoyé',
  signe: 'Signé',
  annule: 'Annulé',
};

export const STATUS_COLORS: Record<SessionStatus, string> = {
  en_attente: 'bg-gray-100 text-gray-700',
  formulaire_recu: 'bg-blue-100 text-blue-700',
  valide: 'bg-yellow-100 text-yellow-700',
  convention_generee: 'bg-purple-100 text-purple-700',
  envoye: 'bg-orange-100 text-orange-700',
  signe: 'bg-green-100 text-green-700',
  annule: 'bg-red-100 text-red-700',
};

export const WORKFLOW_ORDER: SessionStatus[] = [
  'en_attente',
  'formulaire_recu',
  'valide',
  'convention_generee',
  'envoye',
  'signe',
];

export const STATUS_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  en_attente: ['formulaire_recu', 'annule'],
  formulaire_recu: ['valide', 'annule'],
  valide: ['convention_generee', 'annule'],
  convention_generee: ['envoye', 'annule'],
  envoye: ['signe', 'annule'],
  signe: [],
  annule: [],
};

export const ETAPE_LABELS: Record<number, { titre: string; description: string; timing: string; descriptionClient: string }> = {
  1: { titre: 'Demande de formation', description: 'Formulaire d\'inscription complété', timing: 'Jour J', descriptionClient: 'Votre demande a été enregistrée' },
  2: { titre: 'Convention non engageante', description: 'Convention générée et envoyée', timing: 'J+1', descriptionClient: 'Convention à signer pour lancer le processus' },
  3: { titre: 'Convention bipartite signée', description: 'Convention signée par le client', timing: 'J+2', descriptionClient: 'Convention signée, prête pour envoi OPCO' },
  4: { titre: 'Demande d\'envoi OPCO', description: 'Dossier transmis à l\'OPCO', timing: 'J+5 max', descriptionClient: 'Votre dossier est en cours d\'analyse par l\'OPCO' },
  5: { titre: 'Retour financement OPCO', description: 'Réponse OPCO reçue', timing: 'J+15 à J+20', descriptionClient: 'L\'OPCO a communiqué sa décision de prise en charge' },
  6: { titre: 'GO / NOGO final', description: 'Décision finale formation', timing: 'J+20', descriptionClient: 'Décision finale pour le lancement de la formation' },
};

export function canTransitionTo(from: SessionStatus, to: SessionStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStatuses(current: SessionStatus): SessionStatus[] {
  return STATUS_TRANSITIONS[current] || [];
}
