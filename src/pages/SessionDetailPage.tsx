import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { WorkflowBar } from '@/components/ui/WorkflowBar';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { EmailPreview } from '@/components/EmailPreview';
import { formatDate, formatMoney, getClientFromSession } from '@/lib/utils';
import { dataService } from '@/lib/services';
import { mockSessions, mockStagiaires, mockEmailLogs, mockClients, mockOrganisme } from '@/data/mock';
import { getNextStatuses, STATUS_LABELS } from '@/types/database';
import type { SessionStatus, EmailLog, Stagiaire } from '@/types/database';
import {
  ArrowLeft,
  Send,
  RefreshCw,
  FileDown,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Link2,
  Copy,
  Eye,
  Trash2,
  ExternalLink,
  Clock,
  History,
} from 'lucide-react';

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const session = mockSessions.find((s) => s.id === id);
  const [currentStatus, setCurrentStatus] = useState<SessionStatus>(
    session?.status || 'en_attente'
  );
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [stagiaires, setStagiaires] = useState<Stagiaire[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showEmailPreview, setShowEmailPreview] = useState<'convention_envoi' | 'convention_signee' | 'opco_depot' | null>(null);
  const [showSendLink, setShowSendLink] = useState(false);
  const [showValidate, setShowValidate] = useState(false);
  const [showAddStagiaire, setShowAddStagiaire] = useState(false);
  const [showSessionLogs, setShowSessionLogs] = useState(false);

  // Forms
  const [linkEmail, setLinkEmail] = useState('');
  const [validateForm, setValidateForm] = useState({
    dates_formation: session?.dates_formation || '',
    lieu: session?.lieu || '',
    ville: session?.ville || '',
    formateurs: session?.formateurs || '',
    montant_ht: String(session?.montant_ht || ''),
  });
  const [stagiaireForm, setStagiaireForm] = useState({
    prenom: '',
    nom: '',
    email: '',
    fonction: '',
  });
  const [sessionLogs, setSessionLogs] = useState<
    { id: string; ancien_statut: string; nouveau_statut: string; note: string | null; created_at: string }[]
  >([]);

  useEffect(() => {
    if (!id) return;
    setEmailLogs(mockEmailLogs.filter((e) => e.session_id === id));
    setStagiaires(mockStagiaires.filter((s) => s.session_id === id));
  }, [id, currentStatus]);

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Session introuvable</p>
        <Button variant="outline" onClick={() => navigate('/sessions')} className="mt-4">
          Retour aux sessions
        </Button>
      </div>
    );
  }

  const client = getClientFromSession(session) || mockClients.find((c) => c.session_id === id);
  const nextStatuses = getNextStatuses(currentStatus);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  async function handleSendInscriptionLink() {
    if (!linkEmail.trim() || !id) return;
    setActionLoading(true);
    const result = await dataService.sendInscriptionLink(id, linkEmail.trim());
    setActionLoading(false);
    if (result.success) {
      toast.success(`Lien d'inscription envoyé à ${linkEmail}`);
      setEmailLogs(mockEmailLogs.filter((e) => e.session_id === id));
      setShowSendLink(false);
      setLinkEmail('');
    }
  }

  async function handleValidate() {
    if (!id) return;
    setActionLoading(true);
    const result = await dataService.validateSession(id, {
      dates_formation: validateForm.dates_formation || undefined,
      lieu: validateForm.lieu || undefined,
      ville: validateForm.ville || undefined,
      formateurs: validateForm.formateurs || undefined,
      montant_ht: validateForm.montant_ht ? parseFloat(validateForm.montant_ht) : undefined,
    });
    setActionLoading(false);
    if (result) {
      setCurrentStatus('valide');
      toast.success('Demande validée !');
      setShowValidate(false);
    }
  }

  async function handleGenerateConvention() {
    if (!id) return;
    setActionLoading(true);
    const result = await dataService.generateConvention(id);
    setActionLoading(false);
    if (result.success && result.convention) {
      setCurrentStatus('convention_generee');
      toast.success(`Convention ${result.convention.numero} générée — ${formatMoney(result.convention.total_ttc)} TTC`);
    } else {
      toast.error('Erreur lors de la génération. Vérifiez les données client.');
    }
  }

  async function handleSendConvention() {
    if (!id) return;
    setActionLoading(true);
    const result = await dataService.sendConvention(id);
    setActionLoading(false);
    if (result.success) {
      setCurrentStatus('envoye');
      setEmailLogs(mockEmailLogs.filter((e) => e.session_id === id));
      toast.success('Convention envoyée au client !');
    }
  }

  async function handleRelance(type: 'relance_convention' | 'relance_liste_stagiaires') {
    if (!id) return;
    setActionLoading(true);
    const result = await dataService.relanceClient(id, type);
    setActionLoading(false);
    if (result.success) {
      setEmailLogs(mockEmailLogs.filter((e) => e.session_id === id));
      toast.success('Relance envoyée !');
    }
  }

  async function handleCancel() {
    if (!id) return;
    setActionLoading(true);
    await dataService.updateSessionStatus(id, 'annule', 'Annulé manuellement');
    setActionLoading(false);
    setCurrentStatus('annule');
    toast.success('Session annulée');
  }

  async function handleAddStagiaire() {
    if (!stagiaireForm.prenom || !stagiaireForm.nom || !stagiaireForm.email) return;
    setActionLoading(true);
    await dataService.addStagiaire({
      session_id: id,
      client_id: client?.id || '',
      ...stagiaireForm,
    });
    setActionLoading(false);
    setStagiaires(mockStagiaires.filter((s) => s.session_id === id));
    setStagiaireForm({ prenom: '', nom: '', email: '', fonction: '' });
    setShowAddStagiaire(false);
    toast.success('Stagiaire ajouté');
  }

  async function handleRemoveStagiaire(stagId: string) {
    await dataService.removeStagiaire(stagId);
    setStagiaires(mockStagiaires.filter((s) => s.session_id === id));
    toast.success('Stagiaire supprimé');
  }

  function copyLink(type: 'inscription' | 'convention' | 'suivi') {
    const token = session!.token;
    const urls = {
      inscription: dataService.getInscriptionUrl(token),
      convention: dataService.getConventionUrl(token),
      suivi: dataService.getSuiviUrl(token),
    };
    navigator.clipboard.writeText(urls[type]);
    toast.success(`Lien ${type} copié !`);
  }

  async function loadSessionLogs() {
    if (!id) return;
    const logs = await dataService.getSessionLogsBySessionId(id);
    setSessionLogs(logs);
    setShowSessionLogs(true);
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/sessions')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">
            {session.formation?.intitule || 'Session'}
          </h1>
          <p className="text-sm text-gray-500">
            {session.convention_numero || `Session #${session.id.slice(0, 8)}`}
          </p>
        </div>
        <StatusBadge status={currentStatus} />
      </div>

      <WorkflowBar currentStatus={currentStatus} />

      {/* Quick links */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          icon={<Link2 size={14} />}
          onClick={() => copyLink('inscription')}
        >
          Lien inscription
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Link2 size={14} />}
          onClick={() => copyLink('convention')}
        >
          Lien convention
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Link2 size={14} />}
          onClick={() => copyLink('suivi')}
        >
          Lien suivi
        </Button>
        <Button variant="ghost" size="sm" icon={<History size={14} />} onClick={loadSessionLogs}>
          Historique
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-700">Client</h2>
            </CardHeader>
            <CardContent>
              {client ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Raison sociale</span>
                    <p className="font-medium">{client.raison_sociale}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">SIRET</span>
                    <p className="font-medium font-mono text-xs">{client.siret}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Email</span>
                    <p className="font-medium">{client.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Téléphone</span>
                    <p className="font-medium">{client.telephone}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Représentant</span>
                    <p className="font-medium">
                      {client.representant_prenom} {client.representant_nom}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Participants</span>
                    <p className="font-medium">{client.nb_participants}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Adresse</span>
                    <p className="font-medium">
                      {client.adresse}, {client.code_postal} {client.ville}
                    </p>
                  </div>
                  {client.opco_financement && (
                    <div className="col-span-2">
                      <span className="text-gray-500">OPCO</span>
                      <p className="font-medium text-blue-600">{client.opco_nom || 'Oui'}</p>
                    </div>
                  )}
                  {client.recueil_besoins && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Besoins exprimés</span>
                      <p className="font-medium text-sm">{client.recueil_besoins}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-400 mb-3">Aucun client rattaché</p>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Send size={14} />}
                      onClick={() => setShowSendLink(true)}
                    >
                      Envoyer le lien d'inscription
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Copy size={14} />}
                      onClick={() => copyLink('inscription')}
                    >
                      Copier le lien
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Formation */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-700">Formation</h2>
            </CardHeader>
            <CardContent>
              {session.formation ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Intitulé</span>
                    <p className="font-medium">{session.formation.intitule}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Durée</span>
                    <p className="font-medium">{session.formation.duree_heures}h</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Modalité</span>
                    <p className="font-medium">{session.formation.modalite}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Tarif HT / pers.</span>
                    <p className="font-medium">{formatMoney(session.formation.tarif_ht)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Dates</span>
                    <p className="font-medium">{session.dates_formation || '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Lieu</span>
                    <p className="font-medium">
                      {session.lieu || '—'}
                      {session.ville ? `, ${session.ville}` : ''}
                    </p>
                  </div>
                  {session.formateurs && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Formateurs</span>
                      <p className="font-medium">{session.formateurs}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Aucune formation associée</p>
              )}
            </CardContent>
          </Card>

          {/* Stagiaires */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                  Stagiaires ({stagiaires.length}
                  {client?.nb_participants ? ` / ${client.nb_participants}` : ''})
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<UserPlus size={14} />}
                  onClick={() => setShowAddStagiaire(true)}
                >
                  Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {stagiaires.length > 0 ? (
                <div className="space-y-2">
                  {stagiaires.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {s.prenom} {s.nom}
                        </p>
                        <p className="text-xs text-gray-500">{s.fonction}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500">{s.email}</p>
                        <button
                          onClick={() => handleRemoveStagiaire(s.id)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Aucun stagiaire inscrit</p>
              )}
            </CardContent>
          </Card>

          {/* Notes internes */}
          {session.notes_internes && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-gray-700">Notes internes</h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{session.notes_internes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Actions */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-700">Actions</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currentStatus === 'en_attente' && (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      icon={<Send size={16} />}
                      className="w-full"
                      onClick={() => setShowSendLink(true)}
                    >
                      Envoyer lien inscription
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Copy size={14} />}
                      className="w-full"
                      onClick={() => copyLink('inscription')}
                    >
                      Copier le lien
                    </Button>
                    <p className="text-xs text-gray-400 text-center pt-1">
                      En attente du formulaire client
                    </p>
                  </div>
                )}

                {currentStatus === 'formulaire_recu' && (
                  <div className="space-y-2">
                    <Button
                      onClick={() => {
                        setValidateForm({
                          dates_formation: session.dates_formation || '',
                          lieu: session.lieu || '',
                          ville: session.ville || '',
                          formateurs: session.formateurs || '',
                          montant_ht: String(session.montant_ht || ''),
                        });
                        setShowValidate(true);
                      }}
                      icon={<CheckCircle size={16} />}
                      className="w-full"
                    >
                      Valider la demande
                    </Button>
                    <p className="text-xs text-gray-400 text-center pt-1">
                      Vérifiez les infos client puis validez
                    </p>
                  </div>
                )}

                {currentStatus === 'valide' && (
                  <div className="space-y-2">
                    <Button
                      onClick={handleGenerateConvention}
                      loading={actionLoading}
                      icon={<FileDown size={16} />}
                      className="w-full"
                    >
                      Générer la convention
                    </Button>
                    <p className="text-xs text-gray-400 text-center pt-1">
                      Calcul automatique des montants
                    </p>
                  </div>
                )}

                {currentStatus === 'convention_generee' && (
                  <div className="space-y-2">
                    <Button
                      onClick={() => setShowEmailPreview('convention_envoi')}
                      variant="outline"
                      icon={<Eye size={16} />}
                      className="w-full"
                      size="sm"
                    >
                      Aperçu de l'email
                    </Button>
                    <Button
                      onClick={handleSendConvention}
                      loading={actionLoading}
                      icon={<Send size={16} />}
                      className="w-full"
                    >
                      Envoyer la convention
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink size={14} />}
                      className="w-full"
                      onClick={() => copyLink('convention')}
                    >
                      Copier lien convention
                    </Button>
                    {session.convention_numero && (
                      <p className="text-xs text-gray-500 text-center font-mono">
                        {session.convention_numero}
                      </p>
                    )}
                  </div>
                )}

                {currentStatus === 'envoye' && (
                  <div className="space-y-2">
                    <div className="bg-orange-50 text-orange-700 text-sm p-3 rounded-lg text-center">
                      <Clock size={16} className="inline mr-1 mb-0.5" />
                      En attente de signature client
                    </div>
                    <Button
                      variant="outline"
                      icon={<RefreshCw size={16} />}
                      className="w-full"
                      onClick={() => handleRelance('relance_convention')}
                      loading={actionLoading}
                    >
                      Relancer le client
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Send size={14} />}
                      className="w-full"
                      onClick={handleSendConvention}
                    >
                      Renvoyer la convention
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink size={14} />}
                      className="w-full"
                      onClick={() => copyLink('convention')}
                    >
                      Copier lien signature
                    </Button>
                  </div>
                )}

                {currentStatus === 'signe' && (
                  <div className="space-y-2">
                    <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg text-center font-medium">
                      <CheckCircle size={16} className="inline mr-1 mb-0.5" />
                      Convention signée
                    </div>
                    {client?.opco_financement && (
                      <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg">
                        <p className="font-medium">OPCO : {client.opco_nom || 'Oui'}</p>
                        <p className="mt-1">Prochaine étape : préparer le dossier OPCO</p>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ExternalLink size={14} />}
                      className="w-full"
                      onClick={() => copyLink('suivi')}
                    >
                      Copier lien suivi client
                    </Button>
                  </div>
                )}

                {currentStatus === 'annule' && (
                  <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg text-center font-medium">
                    <XCircle size={16} className="inline mr-1 mb-0.5" />
                    Session annulée
                  </div>
                )}

                {nextStatuses.includes('annule') && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleCancel}
                    icon={<XCircle size={14} />}
                    className="w-full mt-4"
                  >
                    Annuler la session
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Montant */}
          {(session.montant_ht || currentStatus === 'convention_generee' || currentStatus === 'envoye' || currentStatus === 'signe') && session.montant_ht && (
            <Card className="p-4">
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Montant TTC</p>
                <p className="text-2xl font-bold text-nikita-pink mt-1">
                  {formatMoney(session.montant_ttc || session.montant_ht * 1.2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">HT : {formatMoney(session.montant_ht)}</p>
                {session.convention_numero && (
                  <p className="text-xs text-gray-400 mt-1 font-mono">{session.convention_numero}</p>
                )}
              </div>
            </Card>
          )}

          {/* Email history */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-gray-700">Historique emails</h2>
            </CardHeader>
            <CardContent>
              {emailLogs.length > 0 ? (
                <div className="space-y-3">
                  {emailLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm">
                      {log.statut === 'envoye' ? (
                        <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                      ) : log.statut === 'erreur' ? (
                        <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{log.sujet}</p>
                        <p className="text-xs text-gray-500">
                          {log.destinataire} — {formatDate(log.created_at)}
                        </p>
                        {log.error_message && (
                          <p className="text-xs text-red-500 mt-0.5">{log.error_message}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">Aucun email envoyé</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODALS */}
      {/* ================================================================== */}

      {/* Send inscription link */}
      <Modal
        open={showSendLink}
        onClose={() => setShowSendLink(false)}
        title="Envoyer le lien d'inscription"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSendLink(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSendInscriptionLink}
              loading={actionLoading}
              disabled={!linkEmail.trim()}
              icon={<Send size={16} />}
            >
              Envoyer
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Le client recevra un email avec le lien vers le formulaire d'inscription pour la
            formation <strong>{session.formation?.intitule}</strong>.
          </p>
          <Input
            label="Email du destinataire"
            type="email"
            value={linkEmail}
            onChange={(e) => setLinkEmail(e.target.value)}
            placeholder="contact@client.fr"
          />
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            <p className="font-medium mb-1">Lien qui sera envoyé :</p>
            <code className="block bg-white rounded px-2 py-1 text-nikita-pink break-all">
              {dataService.getInscriptionUrl(session.token)}
            </code>
          </div>
        </div>
      </Modal>

      {/* Validate session */}
      <Modal
        open={showValidate}
        onClose={() => setShowValidate(false)}
        title="Valider la demande"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowValidate(false)}>
              Annuler
            </Button>
            <Button onClick={handleValidate} loading={actionLoading} icon={<CheckCircle size={16} />}>
              Valider
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Complétez ou ajustez les informations de la session avant validation.
          </p>
          <Input
            label="Dates de formation"
            value={validateForm.dates_formation}
            onChange={(e) =>
              setValidateForm((prev) => ({ ...prev, dates_formation: e.target.value }))
            }
            placeholder="Ex: 15-16 avril 2026"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Lieu"
              value={validateForm.lieu}
              onChange={(e) => setValidateForm((prev) => ({ ...prev, lieu: e.target.value }))}
              placeholder="Centre de formation Lyon"
            />
            <Input
              label="Ville"
              value={validateForm.ville}
              onChange={(e) => setValidateForm((prev) => ({ ...prev, ville: e.target.value }))}
              placeholder="Lyon"
            />
          </div>
          <Input
            label="Formateurs"
            value={validateForm.formateurs}
            onChange={(e) =>
              setValidateForm((prev) => ({ ...prev, formateurs: e.target.value }))
            }
            placeholder="Nom(s) des formateurs"
          />
          <Input
            label="Montant HT total (€)"
            type="number"
            value={validateForm.montant_ht}
            onChange={(e) =>
              setValidateForm((prev) => ({ ...prev, montant_ht: e.target.value }))
            }
            placeholder="Calculé auto si vide"
          />
          {client && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
              <p className="font-medium mb-1">Récap client</p>
              <p>
                {client.raison_sociale} — {client.nb_participants} participants —{' '}
                {client.opco_financement ? `OPCO: ${client.opco_nom}` : 'Sans OPCO'}
              </p>
              {client.recueil_besoins && (
                <p className="mt-1 text-gray-600">Besoins : {client.recueil_besoins}</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Add stagiaire */}
      <Modal
        open={showAddStagiaire}
        onClose={() => setShowAddStagiaire(false)}
        title="Ajouter un stagiaire"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddStagiaire(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddStagiaire}
              loading={actionLoading}
              disabled={!stagiaireForm.prenom || !stagiaireForm.nom || !stagiaireForm.email}
              icon={<UserPlus size={16} />}
            >
              Ajouter
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Prénom *"
              value={stagiaireForm.prenom}
              onChange={(e) =>
                setStagiaireForm((prev) => ({ ...prev, prenom: e.target.value }))
              }
              placeholder="Prénom"
            />
            <Input
              label="Nom *"
              value={stagiaireForm.nom}
              onChange={(e) =>
                setStagiaireForm((prev) => ({ ...prev, nom: e.target.value }))
              }
              placeholder="Nom"
            />
          </div>
          <Input
            label="Email *"
            type="email"
            value={stagiaireForm.email}
            onChange={(e) =>
              setStagiaireForm((prev) => ({ ...prev, email: e.target.value }))
            }
            placeholder="email@entreprise.fr"
          />
          <Input
            label="Fonction"
            value={stagiaireForm.fonction}
            onChange={(e) =>
              setStagiaireForm((prev) => ({ ...prev, fonction: e.target.value }))
            }
            placeholder="Ex: Chef de projet"
          />
        </div>
      </Modal>

      {/* Session logs */}
      <Modal
        open={showSessionLogs}
        onClose={() => setShowSessionLogs(false)}
        title="Historique des changements"
        size="lg"
      >
        {sessionLogs.length > 0 ? (
          <div className="space-y-3">
            {sessionLogs
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-nikita-pink mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {STATUS_LABELS[log.ancien_statut as SessionStatus] || log.ancien_statut} →{' '}
                      {STATUS_LABELS[log.nouveau_statut as SessionStatus] || log.nouveau_statut}
                    </p>
                    {log.note && <p className="text-xs text-gray-500">{log.note}</p>}
                    <p className="text-xs text-gray-400">{formatDate(log.created_at)}</p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">Aucun changement enregistré</p>
        )}
      </Modal>

      {/* Email preview */}
      <Modal
        open={!!showEmailPreview}
        onClose={() => setShowEmailPreview(null)}
        title={
          showEmailPreview === 'convention_envoi' ? 'Aperçu email — Envoi convention' :
          showEmailPreview === 'convention_signee' ? 'Aperçu email — Convention signée' :
          showEmailPreview === 'opco_depot' ? 'Aperçu email — Dépôt OPCO' :
          'Aperçu email'
        }
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setShowEmailPreview(null)}>Fermer</Button>
        }
      >
        {showEmailPreview && client && (
          <EmailPreview
            type={showEmailPreview}
            session={session}
            client={client}
            organisme={mockOrganisme}
          />
        )}
        {!client && (
          <p className="text-sm text-gray-400 text-center py-8">
            Client requis pour générer l'aperçu email.
          </p>
        )}
      </Modal>
    </div>
  );
}
