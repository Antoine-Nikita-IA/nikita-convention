import { supabase, isSupabaseConfigured } from './supabase';
import {
  mockSessions,
  mockFormations,
  mockClients,
  mockStagiaires,
  mockEmailLogs,
  mockOrganisme,
  mockEmailTemplates,
  mockSessionLogs,
  mockSuiviEtapes,
  mockDocuments,
} from '@/data/mock';
import type {
  Session,
  Formation,
  Client,
  Stagiaire,
  EmailLog,
  Organisme,
  EmailTemplate,
  SessionLog,
  DocumentFormation,
  SuiviEtape,
  SessionStatus,
  Convention,
  UserProfile,
  UserRole,
} from '@/types/database';
import { generateConventionNumero, calculateTTC, calculateTVA } from './utils';

// ============================================================================
// MOCK HELPERS (fallback when Supabase not configured)
// ============================================================================
function delay<T>(data: T, ms = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

let idCounter = Date.now();
function uid(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

// ============================================================================
// SUPABASE DATA SERVICE
// ============================================================================
const supabaseService = {
  // ---------- SESSIONS ----------
  async getSessions(): Promise<Session[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, formation:formations(*), client:clients(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapSession);
  },

  async getSessionById(id: string): Promise<Session | null> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, formation:formations(*), client:clients(*), convention:conventions(*)')
      .eq('id', id)
      .single();
    if (error) return null;
    return data ? mapSession(data) : null;
  },

  async getSessionByToken(token: string): Promise<Session | null> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, formation:formations(*), client:clients(*), convention:conventions(*)')
      .eq('token', token)
      .single();
    if (error) return null;
    return data ? mapSession(data) : null;
  },

  async updateSessionStatus(id: string, newStatus: SessionStatus, note?: string): Promise<boolean> {
    // Get current session for old status
    const { data: current } = await supabase
      .from('sessions')
      .select('status')
      .eq('id', id)
      .single();
    if (!current) return false;

    const { error } = await supabase
      .from('sessions')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) return false;

    // Create session log
    await supabase.from('session_logs').insert({
      session_id: id,
      ancien_statut: current.status,
      nouveau_statut: newStatus,
      note: note || null,
    });

    return true;
  },

  async updateSession(id: string, data: Partial<Session>): Promise<Session | null> {
    const { formation, client, convention, ...updateData } = data as Record<string, unknown>;
    void formation; void client; void convention;
    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', id);
    if (error) return null;
    return this.getSessionById(id);
  },

  async createSession(data: Partial<Session>): Promise<Session> {
    const token = `tok_${Math.random().toString(36).slice(2, 18)}`;
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        formation_id: data.formation_id,
        token,
        status: 'en_attente',
        dates_formation: data.dates_formation || null,
        date_debut: data.date_debut || null,
        horaires: data.horaires || '9h-17h',
        lieu: data.lieu || null,
        ville: data.ville || null,
        formateurs: data.formateurs || '',
        notes_internes: data.notes_internes || null,
        montant_ht: data.montant_ht || null,
        montant_ttc: data.montant_ttc || null,
      })
      .select('*, formation:formations(*)')
      .single();
    if (error) throw error;

    // Initialize suivi étape 1
    await supabase.from('suivi_etapes').insert({
      session_id: newSession.id,
      etape_numero: 1,
      statut: 'a_venir',
      action_requise: 'Formulaire à recevoir',
    });

    return mapSession(newSession);
  },

  // ---------- WORKFLOW: Submit inscription ----------
  async submitInscription(
    token: string,
    clientData: Omit<Client, 'id' | 'session_id' | 'submitted_at'>
  ): Promise<{ success: boolean; session?: Session; client?: Client }> {
    // Find session by token
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('token', token)
      .single();
    if (!session || session.status !== 'en_attente') return { success: false };

    // Create client
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        session_id: session.id,
        ...clientData,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (clientError) return { success: false };

    // Update session status
    await supabase
      .from('sessions')
      .update({ status: 'formulaire_recu' })
      .eq('id', session.id);

    // Log
    await supabase.from('session_logs').insert({
      session_id: session.id,
      ancien_statut: 'en_attente',
      nouveau_statut: 'formulaire_recu',
      note: `Formulaire reçu de ${newClient.raison_sociale}`,
    });

    // Update suivi étape 1
    await supabase
      .from('suivi_etapes')
      .update({
        statut: 'complete',
        date_realisation: new Date().toISOString(),
        commentaire: `Demande reçue de ${newClient.raison_sociale}`,
        action_requise: null,
      })
      .eq('session_id', session.id)
      .eq('etape_numero', 1);

    // Email log
    await supabase.from('email_logs').insert({
      session_id: session.id,
      type: 'confirmation_inscription',
      destinataire: newClient.email,
      sujet: `Confirmation d'inscription — Formation`,
      statut: 'envoye',
    });

    const updatedSession = await this.getSessionByToken(token);
    return { success: true, session: updatedSession || undefined, client: newClient };
  },

  // ---------- WORKFLOW: Validate session ----------
  async validateSession(
    sessionId: string,
    updates?: { dates_formation?: string; lieu?: string; ville?: string; formateurs?: string; montant_ht?: number }
  ): Promise<Session | null> {
    const updateData: Record<string, unknown> = { status: 'valide' };
    if (updates) {
      if (updates.dates_formation) updateData.dates_formation = updates.dates_formation;
      if (updates.lieu) updateData.lieu = updates.lieu;
      if (updates.ville) updateData.ville = updates.ville;
      if (updates.formateurs) updateData.formateurs = updates.formateurs;
      if (updates.montant_ht) {
        updateData.montant_ht = updates.montant_ht;
        updateData.montant_ttc = calculateTTC(updates.montant_ht);
      }
    }

    const { error } = await supabase
      .from('sessions')
      .update(updateData)
      .eq('id', sessionId);
    if (error) return null;

    await supabase.from('session_logs').insert({
      session_id: sessionId,
      ancien_statut: 'formulaire_recu',
      nouveau_statut: 'valide',
      note: 'Demande client validée',
    });

    return this.getSessionById(sessionId);
  },

  // ---------- WORKFLOW: Generate convention ----------
  async generateConvention(sessionId: string): Promise<{
    success: boolean;
    session?: Session;
    convention?: Convention;
  }> {
    const session = await this.getSessionById(sessionId);
    if (!session || session.status !== 'valide') return { success: false };

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    if (!client) return { success: false };

    const nbParticipants = client.nb_participants || 1;
    const tarifParPersonne = session.formation?.tarif_ht || 0;
    const totalHT = session.montant_ht || tarifParPersonne * nbParticipants;
    const tva = calculateTVA(totalHT);
    const totalTTC = calculateTTC(totalHT);

    // Count existing conventions for numbering
    const { count } = await supabase
      .from('conventions')
      .select('*', { count: 'exact', head: true });
    const conventionNumero = generateConventionNumero((count || 0) + 1);

    // Create convention
    const { data: convention, error: convError } = await supabase
      .from('conventions')
      .insert({
        session_id: sessionId,
        numero: conventionNumero,
        total_ht: totalHT,
        tva,
        total_ttc: totalTTC,
        pdf_url: `convention-${conventionNumero.toLowerCase()}.pdf`,
      })
      .select()
      .single();
    if (convError) return { success: false };

    // Update session
    await supabase
      .from('sessions')
      .update({
        status: 'convention_generee',
        convention_numero: conventionNumero,
        convention_pdf_url: convention.pdf_url,
        montant_ht: totalHT,
        montant_ttc: totalTTC,
      })
      .eq('id', sessionId);

    await supabase.from('session_logs').insert({
      session_id: sessionId,
      ancien_statut: 'valide',
      nouveau_statut: 'convention_generee',
      note: `Convention ${conventionNumero} générée — ${totalTTC} € TTC`,
    });

    const updatedSession = await this.getSessionById(sessionId);
    return { success: true, session: updatedSession || undefined, convention };
  },

  // ---------- WORKFLOW: Send convention ----------
  async sendConvention(sessionId: string): Promise<{ success: boolean; emailLog?: EmailLog }> {
    const { data: session } = await supabase
      .from('sessions')
      .select('*, formation:formations(*)')
      .eq('id', sessionId)
      .single();
    if (!session || session.status !== 'convention_generee') return { success: false };

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    if (!client) return { success: false };

    // Create email log
    const { data: emailLog } = await supabase
      .from('email_logs')
      .insert({
        session_id: sessionId,
        type: 'convention_envoi',
        destinataire: client.email,
        sujet: `Convention de formation ${session.convention_numero} — ${session.formation?.intitule || 'Formation'}`,
        statut: 'envoye',
      })
      .select()
      .single();

    // Update session status
    await supabase
      .from('sessions')
      .update({ status: 'envoye' })
      .eq('id', sessionId);

    await supabase.from('session_logs').insert({
      session_id: sessionId,
      ancien_statut: 'convention_generee',
      nouveau_statut: 'envoye',
      note: `Convention envoyée à ${client.email}`,
    });

    // Update suivi étape 2
    await supabase.from('suivi_etapes').upsert({
      session_id: sessionId,
      etape_numero: 2,
      statut: 'complete',
      date_realisation: new Date().toISOString(),
      commentaire: 'Convention envoyée pour signature',
    }, { onConflict: 'session_id,etape_numero' });

    // OPCO guide email if applicable
    if (client.opco_financement && client.opco_nom) {
      await supabase.from('email_logs').insert({
        session_id: sessionId,
        type: 'guide_opco',
        destinataire: client.email,
        sujet: `Guide financement OPCO ${client.opco_nom}`,
        statut: 'envoye',
      });
    }

    return { success: true, emailLog: emailLog || undefined };
  },

  // ---------- WORKFLOW: Sign convention ----------
  async signConvention(
    token: string,
    signatureDataUrl: string
  ): Promise<{ success: boolean; session?: Session }> {
    const { data: session } = await supabase
      .from('sessions')
      .select('*')
      .eq('token', token)
      .single();
    if (!session || session.status !== 'envoye') return { success: false };

    const signedUrl = `convention-${session.convention_numero?.toLowerCase()}-signed.pdf`;

    // Update session
    await supabase
      .from('sessions')
      .update({
        status: 'signe',
        convention_signee_url: signedUrl,
      })
      .eq('id', session.id);

    // Update convention
    await supabase
      .from('conventions')
      .update({
        signed_at: new Date().toISOString(),
        signed_pdf_url: signedUrl,
      })
      .eq('session_id', session.id);

    // Store signature on client
    await supabase
      .from('clients')
      .update({ signature_data_url: signatureDataUrl })
      .eq('session_id', session.id);

    await supabase.from('session_logs').insert({
      session_id: session.id,
      ancien_statut: 'envoye',
      nouveau_statut: 'signe',
      note: 'Convention signée électroniquement par le client',
    });

    // Suivi étape 3
    await supabase.from('suivi_etapes').upsert({
      session_id: session.id,
      etape_numero: 3,
      statut: 'complete',
      date_realisation: new Date().toISOString(),
      commentaire: 'Convention signée par le client',
    }, { onConflict: 'session_id,etape_numero' });

    const updatedSession = await this.getSessionByToken(token);
    return { success: true, session: updatedSession || undefined };
  },

  // ---------- WORKFLOW: Send inscription link ----------
  async sendInscriptionLink(sessionId: string, email: string): Promise<{ success: boolean; emailLog?: EmailLog }> {
    const { data: session } = await supabase
      .from('sessions')
      .select('*, formation:formations(*)')
      .eq('id', sessionId)
      .single();
    if (!session) return { success: false };

    const { data: emailLog } = await supabase
      .from('email_logs')
      .insert({
        session_id: sessionId,
        type: 'lien_inscription',
        destinataire: email,
        sujet: `Inscription formation ${session.formation?.intitule || 'Formation'} — NIKITA`,
        statut: 'envoye',
      })
      .select()
      .single();

    return { success: true, emailLog: emailLog || undefined };
  },

  // ---------- WORKFLOW: Relance ----------
  async relanceClient(sessionId: string, type: 'relance_convention' | 'relance_liste_stagiaires'): Promise<{
    success: boolean;
    emailLog?: EmailLog;
  }> {
    const { data: session } = await supabase
      .from('sessions')
      .select('convention_numero')
      .eq('id', sessionId)
      .single();
    if (!session) return { success: false };

    const { data: client } = await supabase
      .from('clients')
      .select('email')
      .eq('session_id', sessionId)
      .single();
    if (!client) return { success: false };

    const subjects = {
      relance_convention: `Relance — Convention ${session.convention_numero} en attente de signature`,
      relance_liste_stagiaires: `Liste nominative des stagiaires — ${session.convention_numero}`,
    };

    const { data: emailLog } = await supabase
      .from('email_logs')
      .insert({
        session_id: sessionId,
        type,
        destinataire: client.email,
        sujet: subjects[type],
        statut: 'envoye',
      })
      .select()
      .single();

    return { success: true, emailLog: emailLog || undefined };
  },

  // ---------- FORMATIONS ----------
  async getFormations(): Promise<Formation[]> {
    const { data } = await supabase
      .from('formations')
      .select('*')
      .eq('actif', true)
      .order('created_at', { ascending: false });
    return data || [];
  },

  async getFormationById(id: string): Promise<Formation | null> {
    const { data } = await supabase.from('formations').select('*').eq('id', id).single();
    return data || null;
  },

  async createFormation(data: Partial<Formation>): Promise<Formation> {
    const { data: newFormation, error } = await supabase
      .from('formations')
      .insert({
        intitule: data.intitule || '',
        duree_heures: data.duree_heures || 0,
        tarif_ht: data.tarif_ht || 0,
        modalite: data.modalite || 'Présentiel',
        objectifs: data.objectifs || '',
        programme: data.programme || '',
        actif: true,
      })
      .select()
      .single();
    if (error) throw error;
    return newFormation;
  },

  async updateFormation(id: string, data: Partial<Formation>): Promise<Formation | null> {
    const { data: updated, error } = await supabase
      .from('formations')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) return null;
    return updated;
  },

  async deleteFormation(id: string): Promise<boolean> {
    const { error } = await supabase.from('formations').delete().eq('id', id);
    return !error;
  },

  // ---------- CLIENTS ----------
  async getClients(): Promise<Client[]> {
    const { data } = await supabase.from('clients').select('*').order('submitted_at', { ascending: false });
    return data || [];
  },

  async getClientBySessionId(sessionId: string): Promise<Client | null> {
    const { data } = await supabase.from('clients').select('*').eq('session_id', sessionId).single();
    return data || null;
  },

  // ---------- STAGIAIRES ----------
  async getStagiairesBySessionId(sessionId: string): Promise<Stagiaire[]> {
    const { data } = await supabase.from('stagiaires').select('*').eq('session_id', sessionId);
    return data || [];
  },

  async addStagiaire(data: Partial<Stagiaire>): Promise<Stagiaire> {
    const { data: newStag, error } = await supabase
      .from('stagiaires')
      .insert({
        session_id: data.session_id,
        client_id: data.client_id,
        prenom: data.prenom || '',
        nom: data.nom || '',
        email: data.email || '',
        fonction: data.fonction || '',
      })
      .select()
      .single();
    if (error) throw error;
    return newStag;
  },

  async removeStagiaire(id: string): Promise<boolean> {
    const { error } = await supabase.from('stagiaires').delete().eq('id', id);
    return !error;
  },

  // ---------- EMAIL LOGS ----------
  async getEmailLogsBySessionId(sessionId: string): Promise<EmailLog[]> {
    const { data } = await supabase
      .from('email_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    return data || [];
  },

  // ---------- SESSION LOGS ----------
  async getSessionLogsBySessionId(sessionId: string): Promise<SessionLog[]> {
    const { data } = await supabase
      .from('session_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    return data || [];
  },

  // ---------- SUIVI ETAPES ----------
  async getSuiviEtapesBySessionId(sessionId: string): Promise<SuiviEtape[]> {
    const { data } = await supabase
      .from('suivi_etapes')
      .select('*')
      .eq('session_id', sessionId)
      .order('etape_numero', { ascending: true });
    return data || [];
  },

  async updateSuiviEtape(
    sessionId: string,
    etapeNumero: number,
    data: Partial<SuiviEtape>
  ): Promise<SuiviEtape | null> {
    const { data: updated } = await supabase
      .from('suivi_etapes')
      .upsert({
        session_id: sessionId,
        etape_numero: etapeNumero,
        statut: data.statut || 'a_venir',
        date_realisation: data.date_realisation || null,
        commentaire: data.commentaire || null,
        action_requise: data.action_requise || null,
      }, { onConflict: 'session_id,etape_numero' })
      .select()
      .single();
    return updated || null;
  },

  // ---------- ORGANISME ----------
  async getOrganisme(): Promise<Organisme> {
    const { data } = await supabase.from('organisme').select('*').single();
    if (data) return data;
    // Fallback to mock if no organisme in DB
    return { ...mockOrganisme };
  },

  async updateOrganisme(data: Partial<Organisme>): Promise<Organisme> {
    const { data: current } = await supabase.from('organisme').select('id').single();
    if (current) {
      const { data: updated } = await supabase
        .from('organisme')
        .update(data)
        .eq('id', current.id)
        .select()
        .single();
      if (updated) return updated;
    }
    return { ...mockOrganisme, ...data } as Organisme;
  },

  // ---------- EMAIL TEMPLATES ----------
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    const { data } = await supabase.from('email_templates').select('*');
    return data || [];
  },

  async updateEmailTemplate(id: string, data: Partial<EmailTemplate>): Promise<EmailTemplate | null> {
    const { data: updated } = await supabase
      .from('email_templates')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    return updated || null;
  },

  // ---------- DOCUMENTS ----------
  async getDocumentsForSession(sessionId: string): Promise<DocumentFormation[]> {
    const { data: session } = await supabase
      .from('sessions')
      .select('formation_id')
      .eq('id', sessionId)
      .single();
    if (!session) return [];

    const { data } = await supabase
      .from('documents')
      .select('*')
      .or(`formation_id.eq.${session.formation_id},formation_id.is.null`);
    return data || [];
  },

  async getDocumentsByFormationId(formationId: string): Promise<DocumentFormation[]> {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .or(`formation_id.eq.${formationId},formation_id.is.null`);
    return data || [];
  },

  // ---------- USER MANAGEMENT ----------
  async getUsers(): Promise<UserProfile[]> {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    return (data || []).map((u: Record<string, unknown>) => ({
      id: u.id as string,
      user_id: u.user_id as string,
      organisme_id: (u.organisme_id as string) || '',
      email: u.email as string,
      first_name: (u.first_name as string) || '',
      last_name: (u.last_name as string) || '',
      role: (u.role as UserRole) || 'user',
      is_active: (u.is_active as boolean) ?? true,
      is_validated: (u.is_validated as boolean) ?? false,
      created_at: u.created_at as string | undefined,
    }));
  },

  async updateUser(id: string, data: Partial<UserProfile>): Promise<UserProfile | null> {
    const { id: _id, user_id: _uid, email: _email, created_at: _ca, ...updateData } = data;
    void _id; void _uid; void _email; void _ca;
    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error || !updated) return null;
    return updated as unknown as UserProfile;
  },

  async validateUser(id: string, role: UserRole): Promise<boolean> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_validated: true, role, is_active: true })
      .eq('id', id);
    return !error;
  },

  async deactivateUser(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: false })
      .eq('id', id);
    return !error;
  },

  async getClientsByApporteurId(apporteurId: string): Promise<Client[]> {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('apporteur_id', apporteurId)
      .order('submitted_at', { ascending: false });
    return data || [];
  },

  async assignClientToApporteur(clientId: string, apporteurId: string): Promise<boolean> {
    const { error } = await supabase
      .from('clients')
      .update({ apporteur_id: apporteurId })
      .eq('id', clientId);
    return !error;
  },

  async getSessionsByApporteurId(apporteurId: string): Promise<Session[]> {
    // Get clients for this apporteur, then get their sessions
    const { data: clients } = await supabase
      .from('clients')
      .select('session_id')
      .eq('apporteur_id', apporteurId);
    if (!clients || clients.length === 0) return [];

    const sessionIds = clients.map((c: { session_id: string }) => c.session_id);
    const { data } = await supabase
      .from('sessions')
      .select('*, formation:formations(*), client:clients(*)')
      .in('id', sessionIds)
      .order('created_at', { ascending: false });
    return (data || []).map(mapSession);
  },

  async registerUser(email: string, password: string, firstName: string, lastName: string): Promise<{ success: boolean; error?: string }> {
    // Sign up via Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    if (error) return { success: false, error: error.message };
    if (!data.user) return { success: false, error: 'Erreur lors de la création du compte' };

    // Create user profile (unvalidated)
    const { error: profileError } = await supabase.from('user_profiles').insert({
      id: data.user.id,
      user_id: data.user.id,
      email,
      first_name: firstName,
      last_name: lastName,
      role: 'user',
      is_active: false,
      is_validated: false,
    });
    if (profileError) return { success: false, error: profileError.message };

    return { success: true };
  },

  // ---------- HELPERS ----------
  getInscriptionUrl(token: string): string {
    return `${window.location.origin}/inscription/${token}`;
  },
  getConventionUrl(token: string): string {
    return `${window.location.origin}/conventions/client/${token}`;
  },
  getSuiviUrl(token: string): string {
    return `${window.location.origin}/suivi/${token}`;
  },
};

// ============================================================================
// MOCK DATA SERVICE (fallback)
// ============================================================================
const mockService = {
  async getSessions(): Promise<Session[]> {
    return delay([...mockSessions]);
  },
  async getSessionById(id: string): Promise<Session | null> {
    return delay(mockSessions.find((s) => s.id === id) || null);
  },
  async getSessionByToken(token: string): Promise<Session | null> {
    return delay(mockSessions.find((s) => s.token === token) || null);
  },
  async updateSessionStatus(id: string, newStatus: SessionStatus, note?: string): Promise<boolean> {
    const session = mockSessions.find((s) => s.id === id);
    if (!session) return delay(false);
    const oldStatus = session.status;
    session.status = newStatus;
    session.updated_at = new Date().toISOString();
    mockSessionLogs.push({
      id: uid('log'), session_id: id, ancien_statut: oldStatus, nouveau_statut: newStatus,
      note: note || null, user_id: 'auth-001', created_at: new Date().toISOString(),
    });
    return delay(true);
  },
  async updateSession(id: string, data: Partial<Session>): Promise<Session | null> {
    const session = mockSessions.find((s) => s.id === id);
    if (!session) return delay(null);
    Object.assign(session, data, { updated_at: new Date().toISOString() });
    return delay(session);
  },
  async createSession(data: Partial<Session>): Promise<Session> {
    const formation = mockFormations.find((f) => f.id === data.formation_id);
    const newSession: Session = {
      id: uid('sess'), token: `tok_${Math.random().toString(36).slice(2, 18)}`,
      formation_id: data.formation_id || '', user_id: 'auth-001', status: 'en_attente',
      dates_formation: data.dates_formation || null, date_debut: data.date_debut || null,
      horaires: data.horaires || '9h-17h', lieu: data.lieu || null, ville: data.ville || null,
      formateurs: data.formateurs || '', notes_internes: data.notes_internes || null,
      convention_pdf_url: null, convention_signee_url: null, convention_numero: null,
      montant_ht: data.montant_ht || null, montant_ttc: data.montant_ttc || null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), formation,
    };
    mockSessions.unshift(newSession);
    return delay(newSession);
  },
  async submitInscription(
    token: string,
    clientData: Omit<Client, 'id' | 'session_id' | 'submitted_at'>
  ): Promise<{ success: boolean; session?: Session; client?: Client }> {
    const session = mockSessions.find((s) => s.token === token);
    if (!session || session.status !== 'en_attente') return delay({ success: false });
    const newClient: Client = { id: uid('client'), session_id: session.id, ...clientData, submitted_at: new Date().toISOString() };
    mockClients.push(newClient);
    session.status = 'formulaire_recu';
    session.client = newClient;
    session.updated_at = new Date().toISOString();
    mockSessionLogs.push({ id: uid('log'), session_id: session.id, ancien_statut: 'en_attente', nouveau_statut: 'formulaire_recu', note: `Formulaire reçu de ${newClient.raison_sociale}`, user_id: null, created_at: new Date().toISOString() });
    return delay({ success: true, session, client: newClient });
  },
  async validateSession(sessionId: string, updates?: { dates_formation?: string; lieu?: string; ville?: string; formateurs?: string; montant_ht?: number }): Promise<Session | null> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'formulaire_recu') return delay(null);
    if (updates) {
      if (updates.dates_formation) session.dates_formation = updates.dates_formation;
      if (updates.lieu) session.lieu = updates.lieu;
      if (updates.ville) session.ville = updates.ville;
      if (updates.formateurs) session.formateurs = updates.formateurs;
      if (updates.montant_ht) { session.montant_ht = updates.montant_ht; session.montant_ttc = calculateTTC(updates.montant_ht); }
    }
    session.status = 'valide';
    session.updated_at = new Date().toISOString();
    return delay(session);
  },
  async generateConvention(sessionId: string): Promise<{ success: boolean; session?: Session; convention?: Convention }> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'valide') return delay({ success: false });
    const client = mockClients.find((c) => c.session_id === sessionId);
    if (!client) return delay({ success: false });
    const formation = session.formation || mockFormations.find((f) => f.id === session.formation_id);
    const totalHT = session.montant_ht || (formation?.tarif_ht || 0) * (client.nb_participants || 1);
    const tva = calculateTVA(totalHT);
    const totalTTC = calculateTTC(totalHT);
    const existingConventions = mockSessions.filter((s) => s.convention_numero).length;
    const conventionNumero = generateConventionNumero(existingConventions + 1);
    const convention: Convention = { id: uid('conv'), session_id: sessionId, numero: conventionNumero, total_ht: totalHT, tva, total_ttc: totalTTC, pdf_url: `${conventionNumero.toLowerCase()}.pdf`, signed_pdf_url: null, signed_at: null };
    session.status = 'convention_generee';
    session.convention_numero = conventionNumero;
    session.convention_pdf_url = convention.pdf_url;
    session.montant_ht = totalHT;
    session.montant_ttc = totalTTC;
    session.convention = convention;
    session.updated_at = new Date().toISOString();
    return delay({ success: true, session, convention });
  },
  async sendConvention(sessionId: string): Promise<{ success: boolean; emailLog?: EmailLog }> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'convention_generee') return delay({ success: false });
    const client = mockClients.find((c) => c.session_id === sessionId);
    if (!client) return delay({ success: false });
    const emailLog: EmailLog = { id: uid('email'), session_id: sessionId, type: 'convention_envoi', destinataire: client.email, sujet: `Convention ${session.convention_numero}`, statut: 'envoye', error_message: null, created_at: new Date().toISOString() };
    mockEmailLogs.push(emailLog);
    session.status = 'envoye';
    session.updated_at = new Date().toISOString();
    return delay({ success: true, emailLog });
  },
  async signConvention(token: string, _signatureDataUrl: string): Promise<{ success: boolean; session?: Session }> {
    const session = mockSessions.find((s) => s.token === token);
    if (!session || session.status !== 'envoye') return delay({ success: false });
    session.status = 'signe';
    session.convention_signee_url = `${session.convention_numero?.toLowerCase()}-signed.pdf`;
    session.updated_at = new Date().toISOString();
    if (session.convention) { session.convention.signed_at = new Date().toISOString(); session.convention.signed_pdf_url = session.convention_signee_url; }
    return delay({ success: true, session });
  },
  async sendInscriptionLink(sessionId: string, email: string): Promise<{ success: boolean; emailLog?: EmailLog }> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session) return delay({ success: false });
    const emailLog: EmailLog = { id: uid('email'), session_id: sessionId, type: 'lien_inscription', destinataire: email, sujet: `Inscription formation — NIKITA`, statut: 'envoye', error_message: null, created_at: new Date().toISOString() };
    mockEmailLogs.push(emailLog);
    return delay({ success: true, emailLog });
  },
  async relanceClient(sessionId: string, type: 'relance_convention' | 'relance_liste_stagiaires'): Promise<{ success: boolean; emailLog?: EmailLog }> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session) return delay({ success: false });
    const client = mockClients.find((c) => c.session_id === sessionId);
    if (!client) return delay({ success: false });
    const emailLog: EmailLog = { id: uid('email'), session_id: sessionId, type, destinataire: client.email, sujet: `Relance — ${session.convention_numero}`, statut: 'envoye', error_message: null, created_at: new Date().toISOString() };
    mockEmailLogs.push(emailLog);
    return delay({ success: true, emailLog });
  },
  async getFormations(): Promise<Formation[]> { return delay([...mockFormations]); },
  async getFormationById(id: string): Promise<Formation | null> { return delay(mockFormations.find((f) => f.id === id) || null); },
  async createFormation(data: Partial<Formation>): Promise<Formation> {
    const f: Formation = { id: uid('form'), intitule: data.intitule || '', duree_heures: data.duree_heures || 0, tarif_ht: data.tarif_ht || 0, modalite: data.modalite || 'Présentiel', objectifs: data.objectifs || '', programme: data.programme || '', actif: true, user_id: 'auth-001', created_at: new Date().toISOString() };
    mockFormations.push(f);
    return delay(f);
  },
  async updateFormation(id: string, data: Partial<Formation>): Promise<Formation | null> {
    const f = mockFormations.find((f) => f.id === id);
    if (f) { Object.assign(f, data); return delay(f); }
    return delay(null);
  },
  async deleteFormation(id: string): Promise<boolean> {
    const idx = mockFormations.findIndex((f) => f.id === id);
    if (idx >= 0) { mockFormations.splice(idx, 1); return delay(true); }
    return delay(false);
  },
  async getClients(): Promise<Client[]> { return delay([...mockClients]); },
  async getClientBySessionId(sessionId: string): Promise<Client | null> { return delay(mockClients.find((c) => c.session_id === sessionId) || null); },
  async getStagiairesBySessionId(sessionId: string): Promise<Stagiaire[]> { return delay(mockStagiaires.filter((s) => s.session_id === sessionId)); },
  async addStagiaire(data: Partial<Stagiaire>): Promise<Stagiaire> {
    const s: Stagiaire = { id: uid('stag'), session_id: data.session_id || '', client_id: data.client_id || '', prenom: data.prenom || '', nom: data.nom || '', email: data.email || '', fonction: data.fonction || '' };
    mockStagiaires.push(s);
    return delay(s);
  },
  async removeStagiaire(id: string): Promise<boolean> {
    const idx = mockStagiaires.findIndex((s) => s.id === id);
    if (idx >= 0) { mockStagiaires.splice(idx, 1); return delay(true); }
    return delay(false);
  },
  async getEmailLogsBySessionId(sessionId: string): Promise<EmailLog[]> { return delay(mockEmailLogs.filter((e) => e.session_id === sessionId)); },
  async getSessionLogsBySessionId(sessionId: string): Promise<SessionLog[]> { return delay(mockSessionLogs.filter((l) => l.session_id === sessionId)); },
  async getSuiviEtapesBySessionId(sessionId: string): Promise<SuiviEtape[]> { return delay(mockSuiviEtapes.filter((e) => e.session_id === sessionId)); },
  async updateSuiviEtape(sessionId: string, etapeNumero: number, data: Partial<SuiviEtape>): Promise<SuiviEtape | null> {
    const etape = mockSuiviEtapes.find((e) => e.session_id === sessionId && e.etape_numero === etapeNumero);
    if (etape) { Object.assign(etape, data); return delay(etape); }
    const newEtape: SuiviEtape = { id: uid('etape'), session_id: sessionId, etape_numero: etapeNumero, statut: data.statut || 'a_venir', date_realisation: data.date_realisation || null, commentaire: data.commentaire || null, action_requise: data.action_requise || null };
    mockSuiviEtapes.push(newEtape);
    return delay(newEtape);
  },
  async getOrganisme(): Promise<Organisme> { return delay({ ...mockOrganisme }); },
  async updateOrganisme(data: Partial<Organisme>): Promise<Organisme> { Object.assign(mockOrganisme, data); return delay({ ...mockOrganisme }); },
  async getEmailTemplates(): Promise<EmailTemplate[]> { return delay([...mockEmailTemplates]); },
  async updateEmailTemplate(id: string, data: Partial<EmailTemplate>): Promise<EmailTemplate | null> {
    const tpl = mockEmailTemplates.find((t) => t.id === id);
    if (tpl) { Object.assign(tpl, data); return delay(tpl); }
    return delay(null);
  },
  async getDocumentsForSession(sessionId: string): Promise<DocumentFormation[]> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session) return delay([]);
    return delay(mockDocuments.filter((d) => d.formation_id === session.formation_id || d.formation_id === null));
  },
  async getDocumentsByFormationId(formationId: string): Promise<DocumentFormation[]> {
    return delay(mockDocuments.filter((d) => d.formation_id === formationId || d.formation_id === null));
  },
  // ---------- USER MANAGEMENT (mock) ----------
  async getUsers(): Promise<UserProfile[]> {
    return delay([
      { id: 'u-001', user_id: 'auth-001', organisme_id: 'org-001', email: 'antoine@agencenikita.com', first_name: 'Antoine', last_name: 'Admin', role: 'admin' as UserRole, is_active: true, is_validated: true },
      { id: 'u-002', user_id: 'auth-002', organisme_id: 'org-001', email: 'marie@example.com', first_name: 'Marie', last_name: 'Dupont', role: 'apporteur_affaire' as UserRole, is_active: true, is_validated: true },
      { id: 'u-003', user_id: 'auth-003', organisme_id: 'org-001', email: 'jean@example.com', first_name: 'Jean', last_name: 'Martin', role: 'user' as UserRole, is_active: false, is_validated: false },
    ]);
  },
  async updateUser(_id: string, _data: Partial<UserProfile>): Promise<UserProfile | null> { return delay(null); },
  async validateUser(_id: string, _role: UserRole): Promise<boolean> { return delay(true); },
  async deactivateUser(_id: string): Promise<boolean> { return delay(true); },
  async getClientsByApporteurId(_apporteurId: string): Promise<Client[]> { return delay([]); },
  async assignClientToApporteur(_clientId: string, _apporteurId: string): Promise<boolean> { return delay(true); },
  async getSessionsByApporteurId(_apporteurId: string): Promise<Session[]> { return delay([]); },
  async registerUser(_email: string, _password: string, _firstName: string, _lastName: string): Promise<{ success: boolean; error?: string }> { return delay({ success: true }); },
  getInscriptionUrl(token: string): string { return `${window.location.origin}/inscription/${token}`; },
  getConventionUrl(token: string): string { return `${window.location.origin}/conventions/client/${token}`; },
  getSuiviUrl(token: string): string { return `${window.location.origin}/suivi/${token}`; },
};

// ============================================================================
// HELPER: Map Supabase row to Session type with joined data
// ============================================================================
function mapSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    token: row.token as string,
    formation_id: row.formation_id as string,
    user_id: row.user_id as string,
    status: row.status as SessionStatus,
    dates_formation: row.dates_formation as string | null,
    date_debut: row.date_debut as string | null,
    horaires: (row.horaires as string) || '9h-17h',
    lieu: row.lieu as string | null,
    ville: row.ville as string | null,
    formateurs: (row.formateurs as string) || '',
    notes_internes: row.notes_internes as string | null,
    convention_pdf_url: row.convention_pdf_url as string | null,
    convention_signee_url: row.convention_signee_url as string | null,
    convention_numero: row.convention_numero as string | null,
    montant_ht: row.montant_ht as number | null,
    montant_ttc: row.montant_ttc as number | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    formation: row.formation as Formation | undefined,
    client: row.client as Client | Client[] | undefined,
    convention: row.convention as Convention | undefined,
  };
}

// ============================================================================
// EXPORT: Auto-select Supabase or Mock based on configuration
// ============================================================================
export const dataService = isSupabaseConfigured ? supabaseService : mockService;
