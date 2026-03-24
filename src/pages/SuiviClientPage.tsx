import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate, getClientFromSession } from '@/lib/utils';
import { toast } from 'sonner';
import { dataService } from '@/lib/services';
import type { Session, SuiviEtape, Organisme, DocumentFormation } from '@/types/database';
import { ETAPE_LABELS } from '@/types/database';
import {
  Check,
  AlertCircle,
  Phone,
  Mail,
  Loader2,
  Download,
  FileText,
  FileIcon,
  CalendarDays,
  CheckCircle,
} from 'lucide-react';

export function SuiviClientPage() {
  const { token } = useParams<{ token: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [etapes, setEtapes] = useState<SuiviEtape[]>([]);
  const [organisme, setOrganisme] = useState<Organisme | null>(null);
  const [documents, setDocuments] = useState<DocumentFormation[]>([]);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!token) { setInvalid(true); setLoading(false); return; }
    Promise.all([
      dataService.getSessionByToken(token),
      dataService.getOrganisme(),
    ]).then(([s, org]) => {
      if (!s) { setInvalid(true); setLoading(false); return; }
      setSession(s);
      setOrganisme(org);
      Promise.all([
        dataService.getSuiviEtapesBySessionId(s.id),
        dataService.getDocumentsForSession(s.id),
      ]).then(([e, d]) => {
        setEtapes(e);
        setDocuments(d);
        setLoading(false);
      });
    });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-nikita-pink" />
      </div>
    );
  }

  if (invalid || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Lien invalide</h1>
          <p className="text-gray-600">Ce lien de suivi n'est pas valide ou a expiré.</p>
        </div>
      </div>
    );
  }

  const client = getClientFromSession(session);

  // Build all 6 steps
  const allSteps = Array.from({ length: 6 }, (_, i) => {
    const num = i + 1;
    const etape = etapes.find((e) => e.etape_numero === num);
    const label = ETAPE_LABELS[num];
    return {
      numero: num,
      titre: label.titre,
      description: label.descriptionClient,
      timing: label.timing,
      statut: etape?.statut || 'a_venir',
      date: etape?.date_realisation,
      commentaire: etape?.commentaire,
      action: etape?.action_requise,
    };
  });

  const isSigned = session.status === 'signe';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Pink header bar */}
      <div className="bg-gradient-to-r from-nikita-pink to-nikita-accent">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <span className="text-nikita-pink font-bold text-lg">N</span>
          </div>
          <span className="text-white/80 text-sm font-medium">Suivi de votre dossier de formation</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Dossier header */}
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-nikita-pink uppercase tracking-wide mb-1">Votre dossier</p>
            <h1 className="text-xl font-bold text-gray-800">{session.formation?.intitule || 'Formation'}</h1>
            <p className="text-sm text-gray-500">{organisme?.nom}</p>
            {(client?.date_souhaitee_debut || session.dates_formation) && (
              <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 rounded-full px-3 py-1">
                <CalendarDays size={14} />
                Date souhaitée : {session.dates_formation || client?.date_souhaitee_debut}
              </div>
            )}
          </CardContent>
        </Card>

        {/* HORIZONTAL WORKFLOW (inspired by prod screenshot 5) */}
        <Card>
          <CardContent>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-6">Avancement de votre dossier</p>

            {/* Desktop horizontal */}
            <div className="hidden md:block">
              <div className="flex items-start">
                {allSteps.map((step, i) => {
                  const isComplete = step.statut === 'complete';
                  const isActive = step.statut === 'en_cours';
                  const isBlocked = step.statut === 'bloquee';

                  return (
                    <div key={step.numero} className="flex-1 relative">
                      {/* Connector line */}
                      {i < allSteps.length - 1 && (
                        <div className={`absolute top-5 left-[calc(50%+16px)] right-0 h-0.5 ${
                          isComplete ? 'bg-emerald-400' : 'bg-gray-200'
                        }`} />
                      )}

                      <div className="flex flex-col items-center text-center px-1">
                        {/* Circle */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold z-10 ${
                          isComplete ? 'bg-emerald-400 text-white' :
                          isActive ? 'bg-blue-500 text-white' :
                          isBlocked ? 'bg-red-500 text-white' :
                          'bg-gray-200 text-gray-500'
                        }`}>
                          {isComplete ? <Check size={18} /> : step.numero}
                        </div>

                        {/* Timing badge */}
                        <div className={`mt-2 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          isComplete ? 'bg-emerald-100 text-emerald-700' :
                          isActive ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {step.timing}
                        </div>

                        {/* Title */}
                        <p className={`mt-2 text-xs font-semibold leading-tight ${
                          isComplete ? 'text-gray-800' : 'text-gray-500'
                        }`}>
                          {step.titre}
                        </p>

                        {/* Description */}
                        <p className="mt-1 text-[10px] text-gray-400 leading-tight max-w-[120px]">
                          {step.description}
                        </p>

                        {/* Date if complete */}
                        {step.date && (
                          <p className="mt-1 text-[10px] text-emerald-600 flex items-center gap-0.5">
                            <Check size={10} /> {formatDate(step.date)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile vertical */}
            <div className="md:hidden space-y-0">
              {allSteps.map((step, i) => {
                const isComplete = step.statut === 'complete';
                const isActive = step.statut === 'en_cours';
                return (
                  <div key={step.numero} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isComplete ? 'bg-emerald-400 text-white' :
                        isActive ? 'bg-blue-500 text-white' :
                        'bg-gray-200 text-gray-500'
                      }`}>
                        {isComplete ? <Check size={14} /> : step.numero}
                      </div>
                      {i < allSteps.length - 1 && (
                        <div className={`w-0.5 flex-1 min-h-[20px] ${isComplete ? 'bg-emerald-300' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <div className="pb-4 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-semibold ${isComplete ? 'text-gray-800' : 'text-gray-500'}`}>{step.titre}</p>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          isComplete ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}>{step.timing}</span>
                      </div>
                      <p className="text-xs text-gray-400">{step.description}</p>
                      {step.date && <p className="text-[10px] text-emerald-600 mt-0.5">{formatDate(step.date)}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Documents de formation (inspired by prod screenshot 5 bottom) */}
        {documents.length > 0 && (
          <Card>
            <CardContent>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Documents de formation</p>
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className={`flex items-center justify-between p-4 rounded-lg border ${
                    doc.type === 'fiche_pedagogique' ? 'border-blue-200 bg-blue-50/50' :
                    doc.type === 'cgv' ? 'border-orange-200 bg-orange-50/50' :
                    'border-purple-200 bg-purple-50/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        doc.type === 'fiche_pedagogique' ? 'bg-blue-100' :
                        doc.type === 'cgv' ? 'bg-orange-100' :
                        'bg-purple-100'
                      }`}>
                        <FileIcon size={18} className={
                          doc.type === 'fiche_pedagogique' ? 'text-blue-600' :
                          doc.type === 'cgv' ? 'text-orange-600' :
                          'text-purple-600'
                        } />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{doc.nom}</p>
                        <p className="text-xs text-gray-500">{doc.description}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" icon={<Download size={14} />}
                      onClick={() => toast.info(`Téléchargement de ${doc.nom}...`)}>
                      Télécharger
                    </Button>
                  </div>
                ))}

                {/* Fiche pédagogique de la formation spécifique */}
                {session.formation && (
                  <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100">
                        <FileText size={18} className="text-gray-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          Fiche pédagogique {session.formation.intitule}
                        </p>
                        <p className="text-xs text-gray-500">Programme détaillé de la formation</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" icon={<Download size={14} />}
                      onClick={() => toast.info('Téléchargement...')}>
                      Télécharger
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Convention signée disponible */}
        {isSigned && (
          <Card className="border-2 border-green-200">
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-700">Convention signée disponible</p>
                    <p className="text-xs text-green-600">Téléchargez votre exemplaire de la convention de formation</p>
                  </div>
                </div>
                <Button size="sm" icon={<Download size={14} />}
                  onClick={() => toast.info('Téléchargement de la convention signée...')}
                  className="bg-green-600 hover:bg-green-700 text-white">
                  Télécharger ma convention
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Convention link if available but not signed */}
        {token && ['convention_generee', 'envoye'].includes(session.status) && (
          <Card className="border-2 border-nikita-pink/20">
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-nikita-pink/10 flex items-center justify-center">
                    <FileText size={20} className="text-nikita-pink" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Convention en attente de signature</p>
                    <p className="text-xs text-gray-500">Consultez et signez votre convention de formation</p>
                  </div>
                </div>
                <a href={`/conventions/client/${token}`}>
                  <Button size="sm" icon={<FileText size={14} />}>
                    Signer la convention
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card>
          <CardContent>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Besoin d'aide ?</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <a href={`mailto:${organisme?.email_contact}`}
                className="flex items-center gap-2 text-gray-600 hover:text-nikita-pink transition-colors">
                <Mail size={14} /> {organisme?.email_contact}
              </a>
              <a href={`tel:${organisme?.telephone?.replace(/\s/g, '')}`}
                className="flex items-center gap-2 text-gray-600 hover:text-nikita-pink transition-colors">
                <Phone size={14} /> {organisme?.telephone}
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
