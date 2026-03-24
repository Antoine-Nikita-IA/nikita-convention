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
} from '@/types/database';
import { generateConventionNumero, calculateTTC, calculateTVA } from './utils';

// Simulate async delay for realistic behavior
function delay<T>(data: T, ms = 100): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

// Generate unique IDs
let idCounter = Date.now();
function uid(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export const dataService = {
  // ============================================================================
  // SESSIONS
  // ============================================================================
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

    // Create session log
    mockSessionLogs.push({
      id: uid('log'),
      session_id: id,
      ancien_statut: oldStatus,
      nouveau_statut: newStatus,
      note: note || null,
      user_id: 'auth-001',
      created_at: new Date().toISOString(),
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
      id: uid('sess'),
      token: `tok_${Math.random().toString(36).slice(2, 18)}`,
      formation_id: data.formation_id || '',
      user_id: 'auth-001',
      status: 'en_attente',
      dates_formation: data.dates_formation || null,
      date_debut: data.date_debut || null,
      horaires: data.horaires || '9h-17h',
      lieu: data.lieu || null,
      ville: data.ville || null,
      formateurs: data.formateurs || '',
      notes_internes: data.notes_internes || null,
      convention_pdf_url: null,
      convention_signee_url: null,
      convention_numero: null,
      montant_ht: data.montant_ht || null,
      montant_ttc: data.montant_ttc || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      formation,
    };
    mockSessions.unshift(newSession);

    // Initialize suivi étape 1
    mockSuiviEtapes.push({
      id: uid('etape'),
      session_id: newSession.id,
      etape_numero: 1,
      statut: 'a_venir',
      date_realisation: null,
      commentaire: null,
      action_requise: 'Formulaire à recevoir',
    });

    return delay(newSession);
  },

  // ============================================================================
  // WORKFLOW: Submit client inscription form (public)
  // ============================================================================
  async submitInscription(
    token: string,
    clientData: Omit<Client, 'id' | 'session_id' | 'submitted_at'>
  ): Promise<{ success: boolean; session?: Session; client?: Client }> {
    const session = mockSessions.find((s) => s.token === token);
    if (!session) return delay({ success: false });
    if (session.status !== 'en_attente')
      return delay({ success: false });

    // Create client
    const newClient: Client = {
      id: uid('client'),
      session_id: session.id,
      ...clientData,
      submitted_at: new Date().toISOString(),
    };
    mockClients.push(newClient);

    // Update session
    session.status = 'formulaire_recu';
    session.client = newClient;
    session.updated_at = new Date().toISOString();

    // Log transition
    mockSessionLogs.push({
      id: uid('log'),
      session_id: session.id,
      ancien_statut: 'en_attente',
      nouveau_statut: 'formulaire_recu',
      note: `Formulaire reçu de ${newClient.raison_sociale}`,
      user_id: null,
      created_at: new Date().toISOString(),
    });

    // Update suivi étape 1
    const etape1 = mockSuiviEtapes.find(
      (e) => e.session_id === session.id && e.etape_numero === 1
    );
    if (etape1) {
      etape1.statut = 'complete';
      etape1.date_realisation = new Date().toISOString();
      etape1.commentaire = `Demande reçue de ${newClient.raison_sociale}`;
      etape1.action_requise = null;
    }

    // Add email log (confirmation)
    mockEmailLogs.push({
      id: uid('email'),
      session_id: session.id,
      type: 'confirmation_inscription',
      destinataire: newClient.email,
      sujet: `Confirmation d'inscription — ${session.formation?.intitule || 'Formation'}`,
      statut: 'envoye',
      error_message: null,
      created_at: new Date().toISOString(),
    });

    return delay({ success: true, session, client: newClient });
  },

  // ============================================================================
  // WORKFLOW: Validate client request (admin)
  // ============================================================================
  async validateSession(
    sessionId: string,
    updates?: { dates_formation?: string; lieu?: string; ville?: string; formateurs?: string; montant_ht?: number }
  ): Promise<Session | null> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'formulaire_recu') return delay(null);

    // Apply updates
    if (updates) {
      if (updates.dates_formation) session.dates_formation = updates.dates_formation;
      if (updates.lieu) session.lieu = updates.lieu;
      if (updates.ville) session.ville = updates.ville;
      if (updates.formateurs) session.formateurs = updates.formateurs;
      if (updates.montant_ht) {
        session.montant_ht = updates.montant_ht;
        session.montant_ttc = calculateTTC(updates.montant_ht);
      }
    }

    session.status = 'valide';
    session.updated_at = new Date().toISOString();

    mockSessionLogs.push({
      id: uid('log'),
      session_id: sessionId,
      ancien_statut: 'formulaire_recu',
      nouveau_statut: 'valide',
      note: 'Demande client validée',
      user_id: 'auth-001',
      created_at: new Date().toISOString(),
    });

    return delay(session);
  },

  // ============================================================================
  // WORKFLOW: Generate convention (admin)
  // ============================================================================
  async generateConvention(sessionId: string): Promise<{
    success: boolean;
    session?: Session;
    convention?: Convention;
  }> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'valide') return delay({ success: false });

    const client = mockClients.find((c) => c.session_id === sessionId);
    if (!client) return delay({ success: false });

    // Compute amounts
    const formation = session.formation || mockFormations.find((f) => f.id === session.formation_id);
    const nbParticipants = client.nb_participants || 1;
    const tarifParPersonne = formation?.tarif_ht || 0;
    const totalHT = session.montant_ht || tarifParPersonne * nbParticipants;
    const tva = calculateTVA(totalHT);
    const totalTTC = calculateTTC(totalHT);

    // Generate convention numero
    const existingConventions = mockSessions.filter((s) => s.convention_numero).length;
    const conventionNumero = generateConventionNumero(existingConventions + 1);

    // Create convention object
    const convention: Convention = {
      id: uid('conv'),
      session_id: sessionId,
      numero: conventionNumero,
      total_ht: totalHT,
      tva,
      total_ttc: totalTTC,
      pdf_url: `https://storage.example.com/${conventionNumero.toLowerCase()}.pdf`,
      signed_pdf_url: null,
      signed_at: null,
    };

    // Update session
    session.status = 'convention_generee';
    session.convention_numero = conventionNumero;
    session.convention_pdf_url = convention.pdf_url;
    session.montant_ht = totalHT;
    session.montant_ttc = totalTTC;
    session.convention = convention;
    session.updated_at = new Date().toISOString();

    mockSessionLogs.push({
      id: uid('log'),
      session_id: sessionId,
      ancien_statut: 'valide',
      nouveau_statut: 'convention_generee',
      note: `Convention ${conventionNumero} générée — ${totalTTC} € TTC`,
      user_id: null,
      created_at: new Date().toISOString(),
    });

    return delay({ success: true, session, convention });
  },

  // ============================================================================
  // WORKFLOW: Send convention to client (admin)
  // ============================================================================
  async sendConvention(sessionId: string): Promise<{ success: boolean; emailLog?: EmailLog }> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'convention_generee') return delay({ success: false });

    const client = mockClients.find((c) => c.session_id === sessionId);
    if (!client) return delay({ success: false });

    // Create email log
    const emailLog: EmailLog = {
      id: uid('email'),
      session_id: sessionId,
      type: 'convention_envoi',
      destinataire: client.email,
      sujet: `Convention de formation ${session.convention_numero} — ${session.formation?.intitule || 'Formation'}`,
      statut: 'envoye',
      error_message: null,
      created_at: new Date().toISOString(),
    };
    mockEmailLogs.push(emailLog);

    // Update session status
    session.status = 'envoye';
    session.updated_at = new Date().toISOString();

    mockSessionLogs.push({
      id: uid('log'),
      session_id: sessionId,
      ancien_statut: 'convention_generee',
      nouveau_statut: 'envoye',
      note: `Convention envoyée à ${client.email}`,
      user_id: 'auth-001',
      created_at: new Date().toISOString(),
    });

    // Update suivi étape 2
    const etape2 = mockSuiviEtapes.find(
      (e) => e.session_id === sessionId && e.etape_numero === 2
    );
    if (etape2) {
      etape2.statut = 'complete';
      etape2.date_realisation = new Date().toISOString();
      etape2.commentaire = 'Convention envoyée pour signature';
    } else {
      mockSuiviEtapes.push({
        id: uid('etape'),
        session_id: sessionId,
        etape_numero: 2,
        statut: 'complete',
        date_realisation: new Date().toISOString(),
        commentaire: 'Convention envoyée pour signature',
        action_requise: null,
      });
    }

    // If OPCO financing, send guide email too
    if (client.opco_financement && client.opco_nom) {
      mockEmailLogs.push({
        id: uid('email'),
        session_id: sessionId,
        type: 'guide_opco',
        destinataire: client.email,
        sujet: `Guide financement OPCO ${client.opco_nom}`,
        statut: 'envoye',
        error_message: null,
        created_at: new Date().toISOString(),
      });
    }

    return delay({ success: true, emailLog });
  },

  // ============================================================================
  // WORKFLOW: Sign convention (public client page)
  // ============================================================================
  async signConvention(
    token: string,
    _signatureDataUrl: string
  ): Promise<{ success: boolean; session?: Session }> {
    const session = mockSessions.find((s) => s.token === token);
    if (!session || session.status !== 'envoye') return delay({ success: false });

    session.status = 'signe';
    session.convention_signee_url = `https://storage.example.com/${session.convention_numero?.toLowerCase()}-signed.pdf`;
    session.updated_at = new Date().toISOString();

    if (session.convention) {
      session.convention.signed_at = new Date().toISOString();
      session.convention.signed_pdf_url = session.convention_signee_url;
    }

    mockSessionLogs.push({
      id: uid('log'),
      session_id: session.id,
      ancien_statut: 'envoye',
      nouveau_statut: 'signe',
      note: 'Convention signée électroniquement par le client',
      user_id: null,
      created_at: new Date().toISOString(),
    });

    // Update suivi étape 3
    const etape3 = mockSuiviEtapes.find(
      (e) => e.session_id === session.id && e.etape_numero === 3
    );
    if (etape3) {
      etape3.statut = 'complete';
      etape3.date_realisation = new Date().toISOString();
      etape3.commentaire = 'Convention signée par le client';
    } else {
      mockSuiviEtapes.push({
        id: uid('etape'),
        session_id: session.id,
        etape_numero: 3,
        statut: 'complete',
        date_realisation: new Date().toISOString(),
        commentaire: 'Convention signée par le client',
        action_requise: null,
      });
    }

    // Initialize étape 4 (OPCO)
    const client = mockClients.find((c) => c.session_id === session.id);
    if (client?.opco_financement) {
      mockSuiviEtapes.push({
        id: uid('etape'),
        session_id: session.id,
        etape_numero: 4,
        statut: 'a_venir',
        date_realisation: null,
        commentaire: null,
        action_requise: `Transmettre dossier à ${client.opco_nom || 'OPCO'}`,
      });
    }

    return delay({ success: true, session });
  },

  // ============================================================================
  // WORKFLOW: Send inscription link (admin)
  // ============================================================================
  async sendInscriptionLink(sessionId: string, email: string): Promise<{ success: boolean; emailLog?: EmailLog }> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session) return delay({ success: false });

    const emailLog: EmailLog = {
      id: uid('email'),
      session_id: sessionId,
      type: 'lien_inscription',
      destinataire: email,
      sujet: `Inscription formation ${session.formation?.intitule || 'Formation'} — NIKITA`,
      statut: 'envoye',
      error_message: null,
      created_at: new Date().toISOString(),
    };
    mockEmailLogs.push(emailLog);

    return delay({ success: true, emailLog });
  },

  // ============================================================================
  // WORKFLOW: Relance client (admin)
  // ============================================================================
  async relanceClient(sessionId: string, type: 'relance_convention' | 'relance_liste_stagiaires'): Promise<{
    success: boolean;
    emailLog?: EmailLog;
  }> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session) return delay({ success: false });

    const client = mockClients.find((c) => c.session_id === sessionId);
    if (!client) return delay({ success: false });

    const subjects = {
      relance_convention: `Relance — Convention ${session.convention_numero} en attente de signature`,
      relance_liste_stagiaires: `Liste nominative des stagiaires — ${session.convention_numero}`,
    };

    const emailLog: EmailLog = {
      id: uid('email'),
      session_id: sessionId,
      type,
      destinataire: client.email,
      sujet: subjects[type],
      statut: 'envoye',
      error_message: null,
      created_at: new Date().toISOString(),
    };
    mockEmailLogs.push(emailLog);

    return delay({ success: true, emailLog });
  },

  // ============================================================================
  // FORMATIONS
  // ============================================================================
  async getFormations(): Promise<Formation[]> {
    return delay([...mockFormations]);
  },
  async getFormationById(id: string): Promise<Formation | null> {
    return delay(mockFormations.find((f) => f.id === id) || null);
  },
  async createFormation(data: Partial<Formation>): Promise<Formation> {
    const newFormation: Formation = {
      id: uid('form'),
      intitule: data.intitule || '',
      duree_heures: data.duree_heures || 0,
      tarif_ht: data.tarif_ht || 0,
      modalite: data.modalite || 'Présentiel',
      objectifs: data.objectifs || '',
      programme: data.programme || '',
      actif: true,
      user_id: 'auth-001',
      created_at: new Date().toISOString(),
    };
    mockFormations.push(newFormation);
    return delay(newFormation);
  },
  async updateFormation(id: string, data: Partial<Formation>): Promise<Formation | null> {
    const formation = mockFormations.find((f) => f.id === id);
    if (formation) {
      Object.assign(formation, data);
      return delay(formation);
    }
    return delay(null);
  },

  // ============================================================================
  // CLIENTS
  // ============================================================================
  async getClients(): Promise<Client[]> {
    return delay([...mockClients]);
  },
  async getClientBySessionId(sessionId: string): Promise<Client | null> {
    return delay(mockClients.find((c) => c.session_id === sessionId) || null);
  },

  // ============================================================================
  // STAGIAIRES
  // ============================================================================
  async getStagiairesBySessionId(sessionId: string): Promise<Stagiaire[]> {
    return delay(mockStagiaires.filter((s) => s.session_id === sessionId));
  },
  async addStagiaire(data: Partial<Stagiaire>): Promise<Stagiaire> {
    const newStagiaire: Stagiaire = {
      id: uid('stag'),
      session_id: data.session_id || '',
      client_id: data.client_id || '',
      prenom: data.prenom || '',
      nom: data.nom || '',
      email: data.email || '',
      fonction: data.fonction || '',
    };
    mockStagiaires.push(newStagiaire);
    return delay(newStagiaire);
  },
  async removeStagiaire(id: string): Promise<boolean> {
    const idx = mockStagiaires.findIndex((s) => s.id === id);
    if (idx >= 0) {
      mockStagiaires.splice(idx, 1);
      return delay(true);
    }
    return delay(false);
  },

  // ============================================================================
  // EMAIL LOGS
  // ============================================================================
  async getEmailLogsBySessionId(sessionId: string): Promise<EmailLog[]> {
    return delay(mockEmailLogs.filter((e) => e.session_id === sessionId));
  },

  // ============================================================================
  // SESSION LOGS
  // ============================================================================
  async getSessionLogsBySessionId(sessionId: string): Promise<SessionLog[]> {
    return delay(mockSessionLogs.filter((l) => l.session_id === sessionId));
  },

  // ============================================================================
  // SUIVI ETAPES
  // ============================================================================
  async getSuiviEtapesBySessionId(sessionId: string): Promise<SuiviEtape[]> {
    return delay(mockSuiviEtapes.filter((e) => e.session_id === sessionId));
  },
  async updateSuiviEtape(
    sessionId: string,
    etapeNumero: number,
    data: Partial<SuiviEtape>
  ): Promise<SuiviEtape | null> {
    const etape = mockSuiviEtapes.find(
      (e) => e.session_id === sessionId && e.etape_numero === etapeNumero
    );
    if (etape) {
      Object.assign(etape, data);
      return delay(etape);
    }
    // Create if doesn't exist
    const newEtape: SuiviEtape = {
      id: uid('etape'),
      session_id: sessionId,
      etape_numero: etapeNumero,
      statut: data.statut || 'a_venir',
      date_realisation: data.date_realisation || null,
      commentaire: data.commentaire || null,
      action_requise: data.action_requise || null,
    };
    mockSuiviEtapes.push(newEtape);
    return delay(newEtape);
  },

  // ============================================================================
  // ORGANISME
  // ============================================================================
  async getOrganisme(): Promise<Organisme> {
    return delay({ ...mockOrganisme });
  },
  async updateOrganisme(data: Partial<Organisme>): Promise<Organisme> {
    Object.assign(mockOrganisme, data);
    return delay({ ...mockOrganisme });
  },

  // ============================================================================
  // EMAIL TEMPLATES
  // ============================================================================
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return delay([...mockEmailTemplates]);
  },
  async updateEmailTemplate(id: string, data: Partial<EmailTemplate>): Promise<EmailTemplate | null> {
    const tpl = mockEmailTemplates.find((t) => t.id === id);
    if (tpl) {
      Object.assign(tpl, data);
      return delay(tpl);
    }
    return delay(null);
  },

  // ============================================================================
  // DOCUMENTS
  // ============================================================================
  async getDocumentsForSession(sessionId: string): Promise<DocumentFormation[]> {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (!session) return delay([]);
    // Return formation-specific docs + global docs (CGV, RI)
    const docs = mockDocuments.filter(
      (d) => d.formation_id === session.formation_id || d.formation_id === null
    );
    return delay(docs);
  },
  async getDocumentsByFormationId(formationId: string): Promise<DocumentFormation[]> {
    return delay(
      mockDocuments.filter((d) => d.formation_id === formationId || d.formation_id === null)
    );
  },

  // ============================================================================
  // HELPERS
  // ============================================================================
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
