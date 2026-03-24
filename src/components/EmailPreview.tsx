import type { Session, Client, Organisme } from '@/types/database';

interface EmailPreviewProps {
  type: 'convention_envoi' | 'convention_signee' | 'opco_depot';
  session: Session;
  client: Client;
  organisme: Organisme;
}

/**
 * Renders an HTML email preview matching the NIKITA production design.
 * Header rose NIKITA FORMATION, documents joints, details table, CTA button.
 */
export function EmailPreview({ type, session, client, organisme }: EmailPreviewProps) {
  const formation = session.formation;
  const conventionUrl = `${window.location.origin}/conventions/client/${session.token}`;

  if (type === 'convention_envoi') {
    return (
      <div className="bg-gray-100 rounded-xl overflow-hidden text-sm max-h-[500px] overflow-y-auto">
        {/* Pink header */}
        <div className="bg-gradient-to-r from-nikita-pink to-nikita-accent px-6 py-4 flex items-center justify-between">
          <span className="text-white font-bold text-lg">NIKITA</span>
          <span className="text-white/80 font-semibold text-sm tracking-wider">FORMATION</span>
        </div>

        <div className="bg-white p-6 space-y-5">
          <div>
            <p className="font-semibold text-gray-800">Bonjour {client.representant_prenom} {client.representant_nom},</p>
            <p className="text-gray-600 mt-2">
              Comme convenu, je vous transmets les documents nécessaires à la mise en place de la formation
              « <strong>{formation?.intitule}</strong> », à destination de vos collaborateurs.
            </p>
          </div>

          {/* Documents joints */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
              📎 DOCUMENTS JOINTS
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
              <li>La convention de formation n° {session.convention_numero}</li>
              <li>Les conditions générales de vente</li>
              <li>Le règlement intérieur de l'organisme de formation</li>
            </ul>
          </div>

          {/* Recueil besoins */}
          {client.recueil_besoins && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                🎯 RECUEIL DES BESOINS ET OBJECTIFS
              </p>
              <p className="text-gray-600">
                À l'issue de nos discussions, vous avez exprimé plusieurs enjeux majeurs dans le cadre de ce projet :
              </p>
              <p className="text-gray-500 italic mt-2">{client.recueil_besoins}</p>
              <p className="text-gray-400 italic text-xs mt-2">
                Ces éléments guideront le calibrage des ateliers pratiques et des cas métiers présentés lors de la formation.
              </p>
            </div>
          )}

          {/* Details table */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="space-y-2">
              {[
                ['Durée', `${formation?.duree_heures || '—'}h par stagiaire`],
                ['Modalité', formation?.modalite || '—'],
                ['Lieu', session.lieu || 'Locaux NIKITA'],
                ['Participants', `${client.nb_participants} salarié(s)`],
                ['Formateurs', session.formateurs || 'Consultants IA Experts'],
                ['Dates', session.dates_formation || 'À définir'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                  <span className="text-gray-500 w-32">{label}</span>
                  <span className="font-semibold text-gray-800">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Handicap mention */}
          <p className="text-gray-600 text-xs">
            ♿ Aucune situation de handicap n'a été signalée à ce jour. Pour toute question ou si un aménagement est à prévoir, notre référent handicap <strong>{organisme.referent_handicap}</strong> reste à votre disposition : <span className="text-nikita-pink">{organisme.referent_handicap_email}</span>
          </p>

          <p className="text-gray-600">
            Merci de me confirmer réception et que les conditions techniques seront bien réunies.
          </p>
          <p className="text-gray-600">
            Vous pouvez consulter et signer votre convention en cliquant sur le bouton ci-dessous :
          </p>

          {/* CTA Button */}
          <div className="text-center py-4">
            <div className="inline-block bg-nikita-pink text-white font-semibold px-8 py-3 rounded-lg">
              Consulter et signer ma convention
            </div>
          </div>

          <p className="text-gray-400 text-[10px] text-center">
            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : {conventionUrl}
          </p>
        </div>

        {/* Footer */}
        <div className="bg-gray-100 px-6 py-4 text-center text-[10px] text-gray-400">
          {organisme.nom} · Organisme certifié {organisme.certifications} · NDA : {organisme.nda}
          <br />
          <span className="text-nikita-pink">{organisme.email_contact}</span> | {organisme.telephone}
        </div>
      </div>
    );
  }

  if (type === 'convention_signee') {
    return (
      <div className="bg-gray-100 rounded-xl overflow-hidden text-sm max-h-[400px] overflow-y-auto">
        <div className="bg-gradient-to-r from-nikita-pink to-nikita-accent px-6 py-4 flex items-center justify-between">
          <span className="text-white font-bold text-lg">NIKITA</span>
          <span className="text-white/80 font-semibold text-sm tracking-wider">FORMATION</span>
        </div>
        <div className="bg-white p-6 space-y-4">
          <p className="font-semibold text-gray-800">✅ Convention signée – Formation confirmée</p>
          <p className="text-gray-600">Bonjour {client.representant_prenom},</p>
          <p className="text-gray-600">
            Nous confirmons la bonne réception de votre convention signée pour la formation
            <strong> {formation?.intitule}</strong>.
          </p>
          <p className="text-gray-600">Vous recevrez une convocation 7 jours avant le début de la formation.</p>
          <p className="text-gray-600">Bien à vous,</p>
          <div className="border-t border-gray-200 pt-3 text-xs text-gray-500">
            <p className="font-medium">2 pièces jointes :</p>
            <p>📄 Convention-signee-{session.convention_numero}.pdf</p>
            <p>📄 Reglement-interieur.pdf</p>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'opco_depot') {
    return (
      <div className="bg-gray-100 rounded-xl overflow-hidden text-sm max-h-[400px] overflow-y-auto">
        <div className="bg-gradient-to-r from-nikita-pink to-nikita-accent px-6 py-4">
          <span className="text-white font-bold text-lg">{organisme.nom}</span>
        </div>
        <div className="bg-white p-6 space-y-4">
          <div className="text-center">
            <span className="inline-block bg-orange-100 text-orange-700 text-xs font-medium px-3 py-1 rounded-full">
              🏛️ Nouveau dossier OPCO déposé
            </span>
          </div>
          <p className="text-center font-bold text-gray-800">Un client vient de confirmer le dépôt de son dossier OPCO</p>
          <p className="text-center text-gray-500 text-xs">Voici les informations associées à cette demande.</p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            {[
              ['ENTREPRISE', client.raison_sociale],
              ['OPCO', client.opco_nom || '—'],
              ['FORMATION', formation?.intitule || '—'],
              ['N° DE CONVENTION', session.convention_numero || '—'],
              ['DATES', session.dates_formation || 'À définir'],
              ['NB STAGIAIRES', String(client.nb_participants)],
            ].map(([label, value]) => (
              <div key={label} className="flex border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                <span className="text-gray-400 text-xs w-40 uppercase">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </div>

          <div className="text-center pt-2">
            <div className="inline-block bg-nikita-pink text-white font-semibold px-6 py-2 rounded-lg text-sm">
              Voir les conventions →
            </div>
          </div>
        </div>

        <div className="bg-gray-100 px-6 py-4 text-center text-[10px] text-gray-400">
          {organisme.nom} · Organisme certifié {organisme.certifications} · NDA : {organisme.nda}
          <br />
          <span className="text-nikita-pink">{organisme.email_contact}</span> | {organisme.telephone}
        </div>
      </div>
    );
  }

  return null;
}
