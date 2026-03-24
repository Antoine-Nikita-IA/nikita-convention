-- NIKITA Convention Platform - Supabase SQL Schema
-- Production-ready schema with RLS, triggers, and functions

-- ============================================================================
-- 1. EXTENSIONS & ENUMS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgtrgm";

-- Status enums for sessions
CREATE TYPE session_status AS ENUM (
  'en_attente',
  'convention_envoyee',
  'convention_signee',
  'dossier_opco_envoye',
  'retour_financement',
  'archivee',
  'annulee'
);

-- Status enums for suivi etapes (step tracking)
CREATE TYPE etape_statut AS ENUM (
  'a_venir',
  'en_cours',
  'complete',
  'bloquee'
);

-- Email types
CREATE TYPE email_type AS ENUM (
  'convention',
  'relance',
  'notification',
  'demande_signature',
  'confirmation'
);

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Organismes (Training organizations)
CREATE TABLE IF NOT EXISTS organisme_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisme_id UUID NOT NULL UNIQUE,
  nom VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(20),
  adresse TEXT,
  siret VARCHAR(14),
  qualiopi_numero VARCHAR(50),
  logo_url TEXT,
  site_web VARCHAR(255),
  conditions_generales TEXT,
  politique_confidentialite TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE organisme_settings IS 'Configuration des organismes de formation (NIKITA, etc.)';

-- Formations
CREATE TABLE IF NOT EXISTS formations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  organisme_id UUID NOT NULL,
  intitule VARCHAR(255) NOT NULL,
  duree_heures NUMERIC(10,2) NOT NULL,
  tarif_ht NUMERIC(10,2) NOT NULL,
  modalite VARCHAR(50) DEFAULT 'Présentiel',
  objectifs TEXT,
  programme TEXT,
  competences_acquises TEXT,
  public_cible TEXT,
  prerequis TEXT,
  actif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE formations IS 'Catalogue des formations offertes par les organismes';

CREATE INDEX idx_formations_user_id ON formations(user_id);
CREATE INDEX idx_formations_organisme_id ON formations(organisme_id);
CREATE INDEX idx_formations_actif ON formations(actif);

-- Sessions (Convention requests)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  organisme_id UUID NOT NULL,
  formation_id UUID NOT NULL REFERENCES formations(id) ON DELETE RESTRICT,
  token VARCHAR(50) UNIQUE,
  status session_status DEFAULT 'en_attente',
  dates_formation VARCHAR(255),
  date_debut DATE,
  date_fin DATE,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE sessions IS 'Sessions de formation et demandes de convention';

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_organisme_id ON sessions(organisme_id);
CREATE INDEX idx_sessions_formation_id ON sessions(formation_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_token ON sessions(token);

-- Clients (Demandes d'inscription - renamed for clarity)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  organisme_id UUID NOT NULL,
  raison_sociale VARCHAR(255) NOT NULL,
  siret VARCHAR(14),
  email_contact VARCHAR(255) NOT NULL,
  telephone_contact VARCHAR(20),
  contact_nom VARCHAR(255),
  contact_prenom VARCHAR(255),
  fonction_contact VARCHAR(100),
  adresse TEXT,
  code_postal VARCHAR(10),
  ville VARCHAR(100),
  convention_date DATE,
  convention_signataire_nom VARCHAR(255),
  convention_signataire_fonction VARCHAR(255),
  signature_data_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE clients IS 'Entreprises et clients demandant les formations';

CREATE INDEX idx_clients_session_id ON clients(session_id);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_organisme_id ON clients(organisme_id);

-- Conventions (Separate tracking for generated conventions)
CREATE TABLE IF NOT EXISTS conventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  convention_numero VARCHAR(50) UNIQUE,
  pdf_url TEXT,
  signed_pdf_url TEXT,
  date_envoi DATE,
  date_signature DATE,
  signature_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE conventions IS 'Conventions générées pour les sessions';

CREATE INDEX idx_conventions_session_id ON conventions(session_id);

-- Stagiaires (Training participants)
CREATE TABLE IF NOT EXISTS convention_stagiaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prenom VARCHAR(100) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  fonction VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE convention_stagiaires IS 'Stagiaires inscrits pour les sessions';

CREATE INDEX idx_stagiaires_session_id ON convention_stagiaires(session_id);
CREATE INDEX idx_stagiaires_client_id ON convention_stagiaires(client_id);

-- Session logs (Audit trail)
CREATE TABLE IF NOT EXISTS session_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE session_logs IS 'Journalisation des modifications de sessions';

CREATE INDEX idx_session_logs_session_id ON session_logs(session_id);
CREATE INDEX idx_session_logs_user_id ON session_logs(user_id);
CREATE INDEX idx_session_logs_created_at ON session_logs(created_at);

-- Suivi étapes (Step tracking for each session)
CREATE TABLE IF NOT EXISTS suivi_etapes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  etape_numero SMALLINT NOT NULL CHECK (etape_numero >= 1 AND etape_numero <= 6),
  statut etape_statut DEFAULT 'a_venir',
  date_realisation DATE,
  commentaire TEXT,
  action_requise VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, etape_numero)
);

COMMENT ON TABLE suivi_etapes IS 'Suivi des 6 étapes pour chaque session';

CREATE INDEX idx_suivi_etapes_session_id ON suivi_etapes(session_id);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisme_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  email_type email_type,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organisme_id, code)
);

COMMENT ON TABLE email_templates IS 'Modèles d''emails pour les différents statuts';

CREATE INDEX idx_email_templates_organisme_id ON email_templates(organisme_id);

-- Email logs
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT,
  status VARCHAR(20) DEFAULT 'sent',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE email_logs IS 'Journalisation des emails envoyés';

CREATE INDEX idx_email_logs_session_id ON email_logs(session_id);
CREATE INDEX idx_email_logs_recipient_email ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_sent_at ON email_logs(sent_at);

-- Email queue (For pending emails)
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  recipient_email VARCHAR(255) NOT NULL,
  variables JSONB,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  failed_attempts SMALLINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE email_queue IS 'File d''attente pour l''envoi d''emails';

CREATE INDEX idx_email_queue_session_id ON email_queue(session_id);
CREATE INDEX idx_email_queue_scheduled_at ON email_queue(scheduled_at);

-- Audit log (General audit trail)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  organisme_id UUID NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  action VARCHAR(10) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Journalisation générale des modifications pour audit';

CREATE INDEX idx_audit_log_organisme_id ON audit_log(organisme_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- User profiles (For auth integration)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  organisme_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Profils utilisateurs liés aux organismes';

CREATE INDEX idx_user_profiles_organisme_id ON user_profiles(organisme_id);

-- Cron executions (For scheduled tasks)
CREATE TABLE IF NOT EXISTS cron_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name VARCHAR(100) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE cron_executions IS 'Historique des exécutions des tâches planifiées';

-- Grille analyse besoins (Needs analysis grid)
CREATE TABLE IF NOT EXISTS grille_analyse_besoins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  contexte TEXT,
  objectifs TEXT,
  resultats_attendus TEXT,
  competences_visees TEXT,
  methodes_pedagogiques TEXT,
  ressources_necessaires TEXT,
  evaluation_plan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE grille_analyse_besoins IS 'Analyse des besoins pour chaque formation';

CREATE INDEX idx_grille_session_id ON grille_analyse_besoins(session_id);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX idx_session_logs_created_at ON session_logs(created_at DESC);

-- Full-text search indexes
CREATE INDEX idx_formations_intitule_search ON formations USING GIN(to_tsvector('french', intitule));
CREATE INDEX idx_clients_raison_sociale_search ON clients USING GIN(to_tsvector('french', raison_sociale));

-- ============================================================================
-- 4. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply timestamp trigger to all major tables
CREATE TRIGGER update_formations_updated_at BEFORE UPDATE ON formations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organisme_settings_updated_at BEFORE UPDATE ON organisme_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suivi_etapes_updated_at BEFORE UPDATE ON suivi_etapes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate convention numbers
CREATE OR REPLACE FUNCTION generate_convention_numero(p_organisme_id UUID, p_formation_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_year VARCHAR(4);
  v_month VARCHAR(2);
  v_seq VARCHAR(4);
  v_numero VARCHAR(50);
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_month := TO_CHAR(NOW(), 'MM');
  v_seq := TO_CHAR(
    (SELECT COALESCE(COUNT(*), 0) + 1 FROM sessions 
     WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
     AND organisme_id = p_organisme_id), '0000');
  v_numero := v_year || v_month || v_seq;
  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_session_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'archivee' OR OLD.status = 'annulee' THEN
    RAISE EXCEPTION 'Cannot modify archived or cancelled session';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER session_status_validation BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION validate_session_status_transition();

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE formations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE suivi_etapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE conventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE convention_stagiaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE grille_analyse_besoins ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_executions ENABLE ROW LEVEL SECURITY;

-- Session policies
CREATE POLICY session_select_policy ON sessions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM user_profiles WHERE organisme_id = sessions.organisme_id));

CREATE POLICY session_insert_policy ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY session_update_policy ON sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Formation policies
CREATE POLICY formation_select_policy ON formations FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM user_profiles WHERE organisme_id = formations.organisme_id));

CREATE POLICY formation_insert_policy ON formations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY formation_update_policy ON formations FOR UPDATE
  USING (auth.uid() = user_id);

-- Client policies
CREATE POLICY client_select_policy ON clients FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM user_profiles WHERE organisme_id = clients.organisme_id));

CREATE POLICY client_insert_policy ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Email template policies
CREATE POLICY email_template_select_policy ON email_templates FOR SELECT
  USING (auth.uid() IN (SELECT id FROM user_profiles WHERE organisme_id = email_templates.organisme_id));

CREATE POLICY email_template_update_policy ON email_templates FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM user_profiles WHERE organisme_id = email_templates.organisme_id));

-- ============================================================================
-- 6. VIEWS
-- ============================================================================

-- View for session pipeline counts
CREATE OR REPLACE VIEW v_session_pipeline AS
SELECT
  s.organisme_id,
  s.status,
  COUNT(*) as count,
  MAX(s.updated_at) as last_update
FROM sessions s
GROUP BY s.organisme_id, s.status;

COMMENT ON VIEW v_session_pipeline IS 'Vue du pipeline de sessions par statut';

-- View for active sessions
CREATE OR REPLACE VIEW v_active_sessions AS
SELECT
  s.*,
  f.intitule as formation_intitule,
  c.raison_sociale as client_name,
  COUNT(DISTINCT cs.id) as nb_stagiaires
FROM sessions s
LEFT JOIN formations f ON s.formation_id = f.id
LEFT JOIN clients c ON s.id = c.session_id
LEFT JOIN convention_stagiaires cs ON s.id = cs.session_id
WHERE s.status NOT IN ('archivee', 'annulee')
GROUP BY s.id, f.intitule, c.raison_sociale;

COMMENT ON VIEW v_active_sessions IS 'Vue des sessions actives avec détails';

-- ============================================================================
-- 7. SEED DATA - Default Email Templates
-- ============================================================================

-- Insert default email templates (organization-agnostic base templates)
INSERT INTO email_templates (organisme_id, code, email_type, subject, body, variables)
VALUES
  (
    '00000000-0000-0000-0000-000000000000'::UUID,
    'convention_envoyee',
    'convention'::email_type,
    'Convention de formation - {formation_intitule}',
    'Madame, Monsieur,\n\nEn pièce jointe se trouve la convention de formation relative à {formation_intitule}.\n\nMerci de la retourner signée dans les meilleurs délais.\n\nCordialement,\n{organisme_nom}',
    ARRAY['formation_intitule', 'organisme_nom']
  ),
  (
    '00000000-0000-0000-0000-000000000000'::UUID,
    'convention_signee_confirmation',
    'confirmation'::email_type,
    'Confirmation de signature - Convention reçue',
    'Merci d''avoir retourné la convention signée.\nNous l''avons bien reçue et traitons actuellement votre dossier pour la transmission à l''OPCO.\n\nCordialement,\n{organisme_nom}',
    ARRAY['organisme_nom']
  ),
  (
    '00000000-0000-0000-0000-000000000000'::UUID,
    'relance_convention',
    'relance'::email_type,
    'Relance - Convention en attente de signature',
    'Madame, Monsieur,\n\nVotre convention de formation est en attente de signature depuis {jours_attente} jours.\n\nMerci de la retourner au plus tôt à {organisme_email}.\n\nCordialement,\n{organisme_nom}',
    ARRAY['jours_attente', 'organisme_email', 'organisme_nom']
  );

COMMENT ON TABLE email_templates IS 'Modèles d''emails pour la communication avec les clients';
