import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SignatureCanvas } from '@/components/ui/SignatureCanvas';
import { formatMoney, getClientFromSession } from '@/lib/utils';
import { dataService } from '@/lib/services';
import { toast } from 'sonner';
import type { Session, Client, Organisme, Stagiaire, DocumentFormation } from '@/types/database';
import {
  FileText,
  CheckCircle,
  Download,
  Shield,
  AlertCircle,
  Loader2,
  Clock,
  ExternalLink,
  Upload,
  Pen,
  Trash2,
  FileIcon,
} from 'lucide-react';

export function ConventionClientPage() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [organisme, setOrganisme] = useState<Organisme | null>(null);
  const [stagiaires, setStagiaires] = useState<Stagiaire[]>([]);
  const [documents, setDocuments] = useState<DocumentFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const [signed, setSigned] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    Promise.all([
      dataService.getSessionByToken(token),
      dataService.getOrganisme(),
    ]).then(([s, org]) => {
      if (!s) { setInvalid(true); setLoading(false); return; }
      setSession(s);
      setOrganisme(org);
      const c = getClientFromSession(s);
      if (c) setClient(c);
      else dataService.getClientBySessionId(s.id).then(setClient);
      dataService.getStagiairesBySessionId(s.id).then(setStagiaires);
      dataService.getDocumentsForSession(s.id).then(setDocuments);
      if (s.status === 'signe') setSigned(true);
      setLoading(false);
    });
  }, [token]);

  function handleSignature(dataUrl: string) {
    setSignatureData(dataUrl);
    toast.success('Signature apposée — vous pouvez maintenant valider.');
  }

  async function handleSubmit() {
    if ((!signatureData && !uploadedFile) || !token) return;
    setSubmitting(true);
    const result = await dataService.signConvention(token, signatureData || 'uploaded-scan');
    setSubmitting(false);
    if (result.success) {
      setSigned(true);
      toast.success('Convention signée avec succès !');
    } else {
      toast.error('Erreur lors de la signature. Veuillez réessayer.');
    }
  }

  // ============================================================================
  // LOADING / ERROR STATES
  // ============================================================================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-nikita-pink" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Lien invalide</h1>
          <p className="text-gray-600">Ce lien de convention n'est pas valide ou a expiré.</p>
        </div>
      </div>
    );
  }

  if (session && !['convention_generee', 'envoye', 'signe'].includes(session.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <Clock size={48} className="text-yellow-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Convention en préparation</h1>
          <p className="text-gray-600 mb-4">Votre convention est en cours de préparation.</p>
          {token && (
            <a href={`/suivi/${token}`} className="text-nikita-pink hover:underline text-sm font-medium inline-flex items-center gap-1">
              Suivre l'avancement <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // POST-SIGNATURE: THANK YOU PAGE (inspired by prod screenshot 9)
  // ============================================================================
  if (signed) {
    const formation = session?.formation;
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header bar */}
        <div className="bg-gradient-to-r from-nikita-pink to-nikita-accent h-16 flex items-center px-6">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <span className="text-nikita-pink font-bold text-lg">N</span>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-nikita-pink/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-nikita-pink" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Merci à vous !</h1>
          <p className="text-gray-600 mb-1">
            Votre convention <strong>{session?.convention_numero}</strong> a bien été transmise à NIKITA.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Vous allez recevoir un email de confirmation dans quelques instants.
          </p>

          <Card className="text-left mb-8">
            <CardContent>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wide">Formation</span>
                  <p className="font-medium text-gray-800">{formation?.intitule || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-400 text-xs uppercase tracking-wide">Dates</span>
                  <p className="font-medium text-gray-800">{session?.dates_formation || 'À définir'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <p className="text-sm text-gray-500">
            Une question ? Contactez-nous à{' '}
            <a href={`mailto:${organisme?.email_contact}`} className="text-nikita-pink hover:underline">
              {organisme?.email_contact}
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="text-center py-8 border-t border-gray-200 mt-8">
          <div className="w-8 h-8 bg-nikita-pink/10 rounded-lg flex items-center justify-center mx-auto mb-2">
            <span className="text-nikita-pink font-bold text-sm">N</span>
          </div>
          <p className="text-xs text-gray-400">
            {organisme?.nom} — Organisme certifié {organisme?.certifications} — {organisme?.ville}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {organisme?.email_contact} | {organisme?.telephone}
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN: CONVENTION PAGE (inspired by prod screenshots 2-4)
  // ============================================================================
  const formation = session?.formation;
  const montantHT = session?.montant_ht || 0;
  const montantTTC = session?.montant_ttc || montantHT * 1.2;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Pink header bar */}
      <div className="bg-gradient-to-r from-nikita-pink to-nikita-accent">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <span className="text-nikita-pink font-bold text-lg">N</span>
          </div>
          <div className="bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <Clock size={14} />
            Convention en attente de signature
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Convention header card */}
        <Card>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                <FileText size={20} className="text-gray-500" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">
                  Convention de formation — {session?.convention_numero}
                </h1>
                <p className="text-sm text-gray-600 mt-0.5">
                  Bonjour <strong>{client?.representant_prenom} {client?.representant_nom}</strong>,
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Veuillez consulter votre convention ci-dessous, puis confirmer sa réception en bas de page.
                </p>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-6 text-sm">
              <div>
                <span className="text-gray-400 text-xs">Formation</span>
                <p className="font-medium text-gray-800">{formation?.intitule}</p>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Dates</span>
                <p className="font-medium text-gray-800">{session?.dates_formation || 'À définir'}</p>
              </div>
            </div>

            {/* Budget */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <span className="text-gray-400 text-xs">Budget</span>
              <p className="font-medium text-gray-800 mt-0.5">
                {formatMoney(montantHT)} <span className="text-gray-400 text-xs">HT</span>
                <span className="text-gray-300 mx-2">·</span>
                {formatMoney(montantTTC)} <span className="text-gray-400 text-xs">TTC</span>
              </p>
            </div>

            {/* Participants */}
            {stagiaires.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-gray-400 text-xs">Participants ({stagiaires.length})</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {stagiaires.map((s) => (
                    <span key={s.id} className="bg-gray-100 text-gray-700 text-xs font-medium px-3 py-1 rounded-full">
                      {s.prenom} {s.nom.charAt(0)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Convention PDF preview (simulated) */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Convention de formation</h2>
              <Button variant="outline" size="sm" icon={<Download size={14} />}
                onClick={() => toast.info('Téléchargement du PDF...')}>
                Télécharger la convention
              </Button>
            </div>

            {/* Simulated PDF preview */}
            <div className="border border-gray-200 rounded-lg bg-white p-8 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="w-12 h-12 bg-nikita-pink/10 rounded-lg flex items-center justify-center mb-2">
                    <span className="text-nikita-pink font-bold">N</span>
                  </div>
                  <p className="text-xs text-gray-400">{organisme?.ville}</p>
                </div>
                <div className="text-right">
                  <h3 className="font-bold text-lg text-gray-800">CONVENTION DE FORMATION</h3>
                  <p className="text-nikita-pink font-semibold text-sm">PROFESSIONNELLE</p>
                  <p className="text-xs text-gray-500">Article L.6353-1 et suivants du Code du travail</p>
                  <div className="inline-block border border-nikita-pink text-nikita-pink text-xs font-medium px-2 py-0.5 rounded mt-1">
                    N° {session?.convention_numero}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 text-sm space-y-3">
                <p className="text-gray-700">
                  Entre l'organisme de formation <strong>{organisme?.nom}</strong>,
                  SIRET {organisme?.siret}, NDA : {organisme?.nda}, et
                  l'entreprise <strong>{client?.raison_sociale}</strong>,
                  SIRET {client?.siret},
                  représentée par <strong>{client?.representant_prenom} {client?.representant_nom}</strong>,
                  {client?.representant_fonction},
                  il est convenu d'organiser au profit des salariés de l'Entreprise une action de formation intitulée :
                  « <strong>{formation?.intitule}</strong> ».
                </p>
                <div>
                  <p className="font-semibold text-gray-800">Objectifs généraux :</p>
                  <p className="text-gray-600">{formation?.objectifs}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 text-xs">Durée</span>
                  <p className="font-medium">{formation?.duree_heures}h par stagiaire</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Modalité</span>
                  <p className="font-medium">{formation?.modalite}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Lieu</span>
                  <p className="font-medium">{session?.lieu || 'Locaux NIKITA'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Participants</span>
                  <p className="font-medium">{client?.nb_participants} salarié(s)</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Formateurs</span>
                  <p className="font-medium">{session?.formateurs || 'Consultants IA Experts'}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs">Dates</span>
                  <p className="font-medium">{session?.dates_formation || 'À définir'}</p>
                </div>
              </div>

              {/* Handicap notice (as seen in prod screenshot 1) */}
              <div className="text-sm text-gray-600 flex items-start gap-2">
                <span className="shrink-0">♿</span>
                <p>
                  Aucune situation de handicap n'a été signalée à ce jour.
                  Pour toute question ou si un aménagement est à prévoir,
                  notre référent handicap <strong>{organisme?.referent_handicap}</strong> reste
                  à votre disposition : <a href={`mailto:${organisme?.referent_handicap_email}`}
                  className="text-nikita-pink hover:underline">{organisme?.referent_handicap_email}</a>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents joints */}
        {documents.length > 0 && (
          <Card>
            <CardContent>
              <h2 className="font-semibold text-gray-800 mb-4">Documents joints</h2>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        doc.type === 'fiche_pedagogique' ? 'bg-blue-100' :
                        doc.type === 'cgv' ? 'bg-orange-100' :
                        'bg-purple-100'
                      }`}>
                        <FileIcon size={16} className={
                          doc.type === 'fiche_pedagogique' ? 'text-blue-600' :
                          doc.type === 'cgv' ? 'text-orange-600' :
                          'text-purple-600'
                        } />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{doc.nom}</p>
                        <p className="text-xs text-gray-500">{doc.description}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" icon={<Download size={14} />}
                      onClick={() => toast.info(`Téléchargement de ${doc.nom}...`)}>
                      {''}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Signature section (inspired by prod screenshots 3-4) */}
        <Card className="border-2 border-nikita-pink/20">
          <CardContent>
            <h2 className="font-semibold text-gray-800 mb-1">Signer la convention</h2>
            <p className="text-sm text-gray-500 mb-6">
              Apposez votre signature manuscrite ci-dessous, puis validez.
              En signant, vous acceptez les termes de la convention et attestez avoir reçu tous les documents.
            </p>

            {/* Signature canvas */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Pen size={14} className="text-nikita-pink" /> Signez dans le cadre ci-dessous
                </p>
              </div>

              {signatureData ? (
                <div className="space-y-3">
                  <div className="border-2 border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <CheckCircle size={18} className="text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-700">Signature apposée</p>
                        <p className="text-xs text-green-600">
                          Signataire : <strong>{client?.representant_prenom} {client?.representant_nom}</strong>
                        </p>
                        <p className="text-xs text-green-500">
                          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          {' à '}
                          {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg border border-green-200 p-3 inline-block">
                      <img src={signatureData} alt="Signature" className="max-h-16" />
                    </div>
                  </div>
                  <button onClick={() => setSignatureData(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <Trash2 size={12} /> Refaire la signature
                  </button>
                </div>
              ) : (
                <>
                  <SignatureCanvas onSave={handleSignature} />
                  {!signatureData && (
                    <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={12} /> La signature est requise pour valider la convention.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Upload scan option */}
            <div className="border border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Joindre un document signé scanné (optionnel)</p>
                <p className="text-xs text-gray-500">PDF ou image — remplace la signature ci-dessus</p>
              </div>
              <label className="cursor-pointer">
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setUploadedFile(f); toast.success(`Fichier ${f.name} chargé`); }
                  }} />
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors">
                  <Upload size={14} /> Choisir un fichier
                </span>
              </label>
            </div>
            {uploadedFile && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle size={12} /> {uploadedFile.name}
              </p>
            )}

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!signatureData && !uploadedFile}
              icon={<Shield size={16} />}
              className="w-full mt-6"
              size="lg"
            >
              Signer et valider la convention
            </Button>
            <p className="text-[10px] text-gray-400 text-center mt-2">
              Votre signature électronique a la même valeur juridique qu'une signature manuscrite (art. 1366 Code civil).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
