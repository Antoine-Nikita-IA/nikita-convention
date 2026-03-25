-- NIKITA Convention Platform - Supabase SQL Schema
-- Production-ready schema with RLS, triggers, and functions
-- Aligned with TypeScript types as source of truth

-- ============================================================================
-- 1. EXTENSIONS & ENUMS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Status enums for sessions - matched to TypeScript SessionStatus
CREATE TYPE session_status AS ENUM (
  'en_attente',
  'formulaire_recu',
  'valide',
  'convention_generee',
  'envoye',
  'signe',
  'annule'
);

-- Status enums for suivi etapes (step tracking)
CREATE TYPE etape_statut AS ENUM (
  'a_venir',
  'en_cours',
  'complete',
  'bloquee'
);

-- Email types - matched to TypeScript EmailType
CREATE TYPE email_type AS ENUM (
  'confirmation_inscription',
  'convention_envoi',
  'guide_opco',
  'relance_convention',
  'relance_liste_stagiaires',
  'lien_inscription',
  'convention_signee',
  'opco_depot'
);

-- Document types - matched to TypeScript DocumentType
CREATE TYPE document_type AS ENUM (
  'fiche_pedagogique',
  'cgv',
  'reglement_interieur',
  'convention_pdf',
  'convention_signee'
);

-- User role type
CREATE TYPE user_role AS ENUM (
  'admin',
  'user',
  'apporteur_affaire'
);

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Organismes (Training organizations)
CREATE TABLE IF NOT EXISTS organisme (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(255) NOT NULL,
  prefixe_convention VARCHAR(50) NOT NULL,
  siret VARCHAR(14) NOT NULL UNIQUE,
  nda VARCHAR(20) NOT NULL UNIQUE,
  adresse TEXT NOT NULL,
  ville VARCHAR(100) NOT NULL,
  responsable_pedagogique VARCHAR(255) NOT NULL,
  referent_handicap VARCHAR(255) NOT NULL,
  referent_handicap_email VARCHAR(255) NOT NULL,
  email_contact VARCHAR(255) NOT NULL,
  telephone VARCHAR(20) NOT NULL,
  certifications VARCHAR(255),
  logo_url TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE organisme IS 'Organismes de formation (NIKITA, etc.)';

CREATE INDEX idx_organisme_user_id ON organisme(user_id);
CREATE INDEX idx_organisme_siret ON organisme(siret);

-- Formations (Training catalog)
CREATE TABLE IF NOT EXISTS formations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  intitule VARCHAR(255) NOT NULL,
  duree_heures NUMERIC(10,2) NOT NULL,
  tarif_ht NUMERIC(12,2) NOT NULL,
  modalite VARCHAR(50) NOT NULL CHECK (modalite IN ('Présentiel', 'Distanciel', 'Hybride')),
  objectifs TEXT,
  programme TEXT,
  actif BOOLEAN DEFAULT TRUE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE formations IS 'Catalogue des formations';

CREATE INDEX idx_formations_user_id ON formations(user_id);
CREATE INDEX idx_formations_actif ON formations(actif);
CREATE INDEX idx_formations_intitule_search ON formations USING GIN(to_tsvector('french', intitule));

-- Sessions (Convention requests)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(100) UNIQUE NOT NULL,
  formation_id UUID NOT NULL REFERENCES formations(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  status session_status DEFAULT 'en_attente',
  dates_formation VARCHAR(255),
  date_debut DATE,
  horaires VARCHAR(100),
  lieu VARCHAR(255),
  ville VARCHAR(100),
  formateurs TEXT,
  notes_internes TEXT,
  convention_pdf_url TEXT,
  convention_signee_url TEXT,
  convention_numero VARCHAR(50) UNIQUE,
  montant_ht NUMERIC(12,2),
  montant_ttc NUMERIC(12,2),
  nb_participants INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE sessions IS 'Sessions de formation et demandes de convention';

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_formation_id ON sessions(formation_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);

-- Clients (Company requesting training)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  raison_sociale VARCHAR(255) NOT NULL,
  forme_juridique VARCHAR(100),
  siret VARCHAR(14),
  adresse TEXT NOT NULL,
  code_postal VARCHAR(10) NOT NULL,
  ville VARCHAR(100) NOT NULL,
  nb_salaries INTEGER,
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(20) NOT NULL,
  site_web VARCHAR(255),
  secteur_activite VARCHAR(100),
  representant_prenom VARCHAR(100) NOT NULL,
  representant_nom VARCHAR(100) NOT NULL,
  representant_fonction VARCHAR(100) NOT NULL,
  date_souhaitee_debut DATE,
  nb_participants INTEGER NOT NULL,
  mode_participants VARCHAR(20) NOT NULL CHECK (mode_participants IN ('exact', 'estimation', 'ulterieur')),
  handicap BOOLEAN DEFAULT FALSE,
  opco_financement BOOLEAN DEFAULT FALSE,
  opco_nom VARCHAR(255),
  recueil_besoins TEXT,
  besoins_specifiques TEXT,
  situation_handicap TEXT,
  apporteur_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE clients IS 'Entreprises et clients demandant les formations';

CREATE INDEX idx_clients_session_id ON clients(session_id);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_raison_sociale_search ON clients USING GIN(to_tsvector('french', raison_sociale));

-- Conventions (Convention tracking)
CREATE TABLE IF NOT EXISTS conventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  numero VARCHAR(50) UNIQUE NOT NULL,
  total_ht NUMERIC(12,2) NOT NULL,
  tva NUMERIC(12,2) NOT NULL,
  total_ttc NUMERIC(12,2) NOT NULL,
  pdf_url TEXT,
  signed_pdf_url TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE conventions IS 'Conventions générées pour les sessions';

CREATE INDEX idx_conventions_session_id ON conventions(session_id);
CREATE INDEX idx_conventions_numero ON conventions(numero);

-- Stagiaires (Training participants)
CREATE TABLE IF NOT EXISTS stagiaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prenom VARCHAR(100) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  fonction VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE stagiaires IS 'Stagiaires inscrits pour les sessions';

CREATE INDEX idx_stagiaires_session_id ON stagiaires(session_id);
CREATE INDEX idx_stagiaires_client_id ON stagiaires(client_id);

-- Session logs (Status change audit trail)
CREATE TABLE IF NOT EXISTS session_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ancien_statut session_status NOT NULL,
  nouveau_statut session_status NOT NULL,
  note TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE session_logs IS 'Journalisation des changements de statut de sessions';

CREATE INDEX idx_session_logs_session_id ON session_logs(session_id);
CREATE INDEX idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX idx_session_logs_created_at ON session_logs(created_at DESC);

-- Suivi étapes (Step tracking for each session)
CREATE TABLE IF NOT EXISTS suivi_etapes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  etape_numero SMALLINT NOT NULL CHECK (etape_numero >= 1 AND etape_numero <= 6),
  statut etape_statut DEFAULT 'a_venir',
  date_realisation DATE,
  commentaire TEXT,
  action_requise TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, etape_numero)
);

COMMENT ON TABLE suivi_etapes IS 'Suivi des 6 étapes pour chaque session';

CREATE INDEX idx_suivi_etapes_session_id ON suivi_etapes(session_id);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type email_type NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  variables_disponibles TEXT[] DEFAULT '{}',
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE email_templates IS 'Modèles d''emails pour la communication';

CREATE INDEX idx_email_templates_type ON email_templates(type);

-- Email logs (Email delivery tracking)
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type email_type NOT NULL,
  destinataire VARCHAR(255) NOT NULL,
  sujet VARCHAR(255) NOT NULL,
  statut VARCHAR(20) NOT NULL CHECK (statut IN ('envoye', 'erreur', 'rebondi')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE email_logs IS 'Journalisation des emails envoyés';

CREATE INDEX idx_email_logs_session_id ON email_logs(session_id);
CREATE INDEX idx_email_logs_destinataire ON email_logs(destinataire);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at DESC);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  formation_id UUID REFERENCES formations(id) ON DELETE CASCADE,
  type document_type NOT NULL,
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  taille VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE documents IS 'Documents des formations (fiches pédagogiques, CGV, etc.)';

CREATE INDEX idx_documents_formation_id ON documents(formation_id);
CREATE INDEX idx_documents_type ON documents(type);

-- User profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  organisme_id UUID,
  email VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  role user_role DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  is_validated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Profils utilisateurs';

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- ============================================================================
-- 3. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp trigger to all major tables
CREATE TRIGGER update_organisme_updated_at BEFORE UPDATE ON organisme
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_formations_updated_at BEFORE UPDATE ON formations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conventions_updated_at BEFORE UPDATE ON conventions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suivi_etapes_updated_at BEFORE UPDATE ON suivi_etapes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique tokens for sessions
CREATE OR REPLACE FUNCTION generate_session_token()
RETURNS VARCHAR AS $$
DECLARE
  v_token VARCHAR(100);
BEGIN
  LOOP
    v_token := substring(md5(random()::text || clock_timestamp()::text), 1, 50);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM sessions WHERE token = v_token);
  END LOOP;
  RETURN v_token;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate token if not provided
CREATE OR REPLACE FUNCTION set_session_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.token IS NULL THEN
    NEW.token := generate_session_token();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_token_generation BEFORE INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION set_session_token();

-- Function to log session status changes
CREATE OR REPLACE FUNCTION log_session_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO session_logs (session_id, ancien_statut, nouveau_statut, user_id)
    VALUES (NEW.id, OLD.status, NEW.status, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_status_log AFTER UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION log_session_status_change();

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE organisme ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE conventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stagiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suivi_etapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4.1 Organisme Policies
-- ============================================================================

CREATE POLICY organisme_select_authenticated ON organisme FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY organisme_insert_authenticated ON organisme FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY organisme_update_authenticated ON organisme FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4.2 Formations Policies
-- ============================================================================

CREATE POLICY formations_select_authenticated ON formations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY formations_insert_authenticated ON formations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY formations_update_authenticated ON formations FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4.3 Sessions Policies
-- ============================================================================

-- Authenticated user (organisme owner) can view own sessions
CREATE POLICY sessions_select_owner ON sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Allow anonymous access via session token for public pages
CREATE POLICY sessions_select_anonymous ON sessions FOR SELECT
  USING (
    NOT auth.role() = 'authenticated' AND
    token = current_setting('app.session_token', true)
  );

-- Authenticated user can insert new sessions
CREATE POLICY sessions_insert_authenticated ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owner can update their sessions
CREATE POLICY sessions_update_owner ON sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can do anything for server operations
CREATE POLICY sessions_all_service_role ON sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4.4 Clients Policies
-- ============================================================================

-- Authenticated user can view clients of their sessions
CREATE POLICY clients_select_owner ON clients FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Allow anonymous access via session token
CREATE POLICY clients_select_anonymous ON clients FOR SELECT
  USING (
    NOT auth.role() = 'authenticated' AND
    session_id IN (
      SELECT id FROM sessions WHERE token = current_setting('app.session_token', true)
    )
  );

-- Authenticated user can insert clients
CREATE POLICY clients_insert_authenticated ON clients FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Allow anonymous insertion via session token (form submission)
CREATE POLICY clients_insert_anonymous ON clients FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE token = current_setting('app.session_token', true)
    )
  );

-- Owner can update
CREATE POLICY clients_update_owner ON clients FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Service role can do anything
CREATE POLICY clients_all_service_role ON clients FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4.5 Conventions Policies
-- ============================================================================

CREATE POLICY conventions_select_owner ON conventions FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Allow anonymous access via session token
CREATE POLICY conventions_select_anonymous ON conventions FOR SELECT
  USING (
    NOT auth.role() = 'authenticated' AND
    session_id IN (
      SELECT id FROM sessions WHERE token = current_setting('app.session_token', true)
    )
  );

CREATE POLICY conventions_insert_authenticated ON conventions FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY conventions_update_owner ON conventions FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY conventions_all_service_role ON conventions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4.6 Stagiaires Policies
-- ============================================================================

CREATE POLICY stagiaires_select_owner ON stagiaires FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY stagiaires_select_anonymous ON stagiaires FOR SELECT
  USING (
    NOT auth.role() = 'authenticated' AND
    session_id IN (
      SELECT id FROM sessions WHERE token = current_setting('app.session_token', true)
    )
  );

CREATE POLICY stagiaires_insert_authenticated ON stagiaires FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY stagiaires_insert_anonymous ON stagiaires FOR INSERT
  WITH CHECK (
    NOT auth.role() = 'authenticated' AND
    session_id IN (
      SELECT id FROM sessions WHERE token = current_setting('app.session_token', true)
    )
  );

CREATE POLICY stagiaires_update_owner ON stagiaires FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY stagiaires_all_service_role ON stagiaires FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 4.7 Other Tables Policies
-- ============================================================================

-- Session logs - view only for owners
CREATE POLICY session_logs_select_owner ON session_logs FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY session_logs_all_service_role ON session_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Suivi etapes - view and update for owners
CREATE POLICY suivi_etapes_select_owner ON suivi_etapes FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY suivi_etapes_select_anonymous ON suivi_etapes FOR SELECT
  USING (
    NOT auth.role() = 'authenticated' AND
    session_id IN (
      SELECT id FROM sessions WHERE token = current_setting('app.session_token', true)
    )
  );

CREATE POLICY suivi_etapes_update_owner ON suivi_etapes FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY suivi_etapes_all_service_role ON suivi_etapes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Email templates - view for all authenticated users, manage for service role
CREATE POLICY email_templates_select_all ON email_templates FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY email_templates_all_service_role ON email_templates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Email logs - view for owners
CREATE POLICY email_logs_select_owner ON email_logs FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY email_logs_insert_service ON email_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY email_logs_all_service_role ON email_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Documents - view for authenticated users
CREATE POLICY documents_select_all ON documents FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY documents_manage_service ON documents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- User profiles - view own profile
CREATE POLICY user_profiles_select_self ON user_profiles FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY user_profiles_update_self ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY user_profiles_all_service_role ON user_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- 5. VIEWS
-- ============================================================================

-- View for session pipeline counts
CREATE OR REPLACE VIEW v_session_pipeline AS
SELECT
  s.user_id,
  s.status,
  COUNT(*) as count,
  MAX(s.updated_at) as last_update
FROM sessions s
GROUP BY s.user_id, s.status;

COMMENT ON VIEW v_session_pipeline IS 'Vue du pipeline de sessions par statut';

-- View for active sessions with details
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT
  s.*,
  f.intitule as formation_intitule,
  c.raison_sociale as client_name,
  COUNT(DISTINCT st.id) as nb_stagiaires
FROM sessions s
LEFT JOIN formations f ON s.formation_id = f.id
LEFT JOIN clients c ON s.id = c.session_id
LEFT JOIN stagiaires st ON s.id = st.session_id
WHERE s.status NOT IN ('annule')
GROUP BY s.id, f.intitule, c.raison_sociale;

COMMENT ON VIEW v_active_sessions IS 'Vue des sessions actives avec détails';

-- ============================================================================
-- 6. SEED DATA - Email Templates
-- ============================================================================

INSERT INTO email_templates (type, subject, body_html, variables_disponibles)
VALUES
  (
    'confirmation_inscription'::email_type,
    'Confirmation de votre demande de formation',
    '<p>Madame, Monsieur,</p><p>Merci d''avoir transmis votre demande de formation <strong>{formation_intitule}</strong>.</p><p>Nous avons bien reçu votre dossier et le traitons actuellement. Vous recevrez prochainement la convention de formation à signer.</p><p>Cordialement,<br/>{organisme_nom}</p>',
    ARRAY['formation_intitule', 'organisme_nom']
  ),
  (
    'convention_envoi'::email_type,
    'Convention de formation - Signature requise',
    '<p>Madame, Monsieur,</p><p>Veuillez trouver en pièce jointe la convention de formation relative à <strong>{formation_intitule}</strong>.</p><p>Nous vous demandons de la signer et de nous la retourner dans les meilleurs délais via le lien suivant: <a href="{lien_signature}">{lien_signature}</a></p><p>Cordialement,<br/>{organisme_nom}</p>',
    ARRAY['formation_intitule', 'organisme_nom', 'lien_signature']
  ),
  (
    'convention_signee'::email_type,
    'Convention signée - Confirmation de réception',
    '<p>Madame, Monsieur,</p><p>Merci d''avoir retourné la convention signée. Nous l''avons bien reçue et traitons actuellement votre dossier pour transmission à l''OPCO.</p><p>Vous serez tenu informé de l''avancée de votre demande.</p><p>Cordialement,<br/>{organisme_nom}</p>',
    ARRAY['organisme_nom']
  ),
  (
    'relance_convention'::email_type,
    'Relance - Convention en attente de signature',
    '<p>Madame, Monsieur,</p><p>Votre convention de formation <strong>{formation_intitule}</strong> est en attente de signature depuis {jours_attente} jours.</p><p>Nous vous demandons de la signer d''urgence via le lien suivant: <a href="{lien_signature}">{lien_signature}</a></p><p>Cordialement,<br/>{organisme_nom}</p>',
    ARRAY['formation_intitule', 'jours_attente', 'lien_signature', 'organisme_nom']
  ),
  (
    'relance_liste_stagiaires'::email_type,
    'Relance - Liste des stagiaires attendue',
    '<p>Madame, Monsieur,</p><p>Nous vous demandons de nous communiquer la liste des stagiaires participants à la formation <strong>{formation_intitule}</strong> en utilisant le lien suivant: <a href="{lien_stagiaires}">{lien_stagiaires}</a></p><p>Cordialement,<br/>{organisme_nom}</p>',
    ARRAY['formation_intitule', 'lien_stagiaires', 'organisme_nom']
  ),
  (
    'lien_inscription'::email_type,
    'Accès à votre dossier de formation',
    '<p>Madame, Monsieur,</p><p>Vous pouvez accéder à votre dossier de formation en cliquant sur le lien suivant: <a href="{lien_acces}">{lien_acces}</a></p><p>Ce lien vous permet de consulter l''avancée de votre demande et de transmettre les documents nécessaires.</p><p>Cordialement,<br/>{organisme_nom}</p>',
    ARRAY['lien_acces', 'organisme_nom']
  ),
  (
    'guide_opco'::email_type,
    'Guide d''aide - Financement OPCO',
    '<p>Madame, Monsieur,</p><p>Veuillez trouver en pièce jointe un guide d''aide concernant le financement de votre formation par votre OPCO.</p><p>N''hésitez pas à nous contacter pour toute question.</p><p>Cordialement,<br/>{organisme_nom}</p>',
    ARRAY['organisme_nom']
  ),
  (
    'opco_depot'::email_type,
    'Votre dossier a été transmis à l''OPCO',
    '<p>Madame, Monsieur,</p><p>Votre demande de formation a été transmise à votre OPCO <strong>{opco_nom}</strong> pour financement.</p><p>Vous serez informé de la décision de l''OPCO dans un délai de 15 à 20 jours ouvrables.</p><p>Cordialement,<br/>{organisme_nom}</p>',
    ARRAY['opco_nom', 'organisme_nom']
  )
ON CONFLICT DO NOTHING;
