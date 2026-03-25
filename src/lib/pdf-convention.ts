import jsPDF from 'jspdf';
import type { Session, Client, Organisme, Convention } from '@/types/database';
import { formatMoney } from './utils';

export function generateConventionPDF(
  session: Session,
  client: Client,
  organisme: Organisme,
  convention: Convention,
): void {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const marginLeft = 20;
  const marginRight = 20;
  const contentWidth = pageWidth - marginLeft - marginRight;
  let y = 20;

  // Helper functions
  function addText(text: string, x: number, yPos: number, options: { size?: number; bold?: boolean; color?: [number, number, number]; align?: 'left' | 'center' | 'right'; maxWidth?: number } = {}) {
    const { size = 10, bold = false, color = [51, 51, 51], align = 'left', maxWidth } = options;
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(color[0], color[1], color[2]);

    let xPos = x;
    if (align === 'center') xPos = pageWidth / 2;
    else if (align === 'right') xPos = pageWidth - marginRight;

    if (maxWidth) {
      doc.text(text, xPos, yPos, { maxWidth, align });
    } else {
      doc.text(text, xPos, yPos, { align });
    }
  }

  function addLine(yPos: number, color: [number, number, number] = [233, 30, 99]) {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.5);
    doc.line(marginLeft, yPos, pageWidth - marginRight, yPos);
  }

  function addSectionTitle(title: string, yPos: number): number {
    addText(title, marginLeft, yPos, { size: 11, bold: true, color: [233, 30, 99] });
    return yPos + 2;
  }

  // ========== HEADER ==========
  // Organisme name
  addText(organisme.nom.toUpperCase(), marginLeft, y, { size: 16, bold: true, color: [233, 30, 99] });
  y += 6;
  addText(`SIRET : ${organisme.siret}`, marginLeft, y, { size: 8, color: [120, 120, 120] });
  y += 4;
  addText(`NDA : ${organisme.nda}`, marginLeft, y, { size: 8, color: [120, 120, 120] });
  y += 4;
  if (organisme.certifications) {
    addText(`Certifications : ${organisme.certifications}`, marginLeft, y, { size: 8, color: [120, 120, 120] });
    y += 4;
  }
  addText(organisme.adresse, marginLeft, y, { size: 8, color: [120, 120, 120] });
  y += 4;
  addText(`${organisme.email_contact} | ${organisme.telephone}`, marginLeft, y, { size: 8, color: [120, 120, 120] });
  y += 10;

  // Title
  addLine(y);
  y += 8;
  addText('CONVENTION DE FORMATION PROFESSIONNELLE', 0, y, { size: 14, bold: true, align: 'center' });
  y += 6;
  addText(`N° ${convention.numero}`, 0, y, { size: 11, align: 'center', color: [120, 120, 120] });
  y += 8;
  addLine(y);
  y += 10;

  // ========== ARTICLE 1 — PARTIES ==========
  y = addSectionTitle('Article 1 — Parties', y);
  y += 6;

  addText('L\'organisme de formation :', marginLeft, y, { size: 9, bold: true });
  y += 5;
  addText(organisme.nom, marginLeft + 5, y, { size: 9 });
  y += 4;
  addText(`SIRET : ${organisme.siret} — NDA : ${organisme.nda}`, marginLeft + 5, y, { size: 8, color: [100, 100, 100] });
  y += 4;
  addText(organisme.adresse, marginLeft + 5, y, { size: 8, color: [100, 100, 100] });
  y += 4;
  addText(`Responsable pédagogique : ${organisme.responsable_pedagogique}`, marginLeft + 5, y, { size: 8, color: [100, 100, 100] });
  y += 8;

  addText('Le client :', marginLeft, y, { size: 9, bold: true });
  y += 5;
  addText(client.raison_sociale, marginLeft + 5, y, { size: 9 });
  y += 4;
  addText(`SIRET : ${client.siret}`, marginLeft + 5, y, { size: 8, color: [100, 100, 100] });
  y += 4;
  addText(`${client.adresse}, ${client.code_postal} ${client.ville}`, marginLeft + 5, y, { size: 8, color: [100, 100, 100] });
  y += 4;
  addText(`Représenté par : ${client.representant_prenom} ${client.representant_nom}`, marginLeft + 5, y, { size: 8, color: [100, 100, 100] });
  y += 10;

  // ========== ARTICLE 2 — OBJET ==========
  y = addSectionTitle('Article 2 — Objet de la formation', y);
  y += 6;

  const formation = session.formation;
  if (formation) {
    // Formation details table
    const tableData = [
      ['Intitulé', formation.intitule],
      ['Durée', `${formation.duree_heures} heures`],
      ['Modalité', formation.modalite],
      ['Dates', session.dates_formation || 'À définir'],
      ['Lieu', `${session.lieu || '—'}${session.ville ? ', ' + session.ville : ''}`],
      ['Nombre de participants', String(client.nb_participants)],
    ];
    if (session.formateurs) {
      tableData.push(['Formateur(s)', session.formateurs]);
    }

    tableData.forEach(([label, value]) => {
      addText(`${label} :`, marginLeft + 5, y, { size: 9, bold: true });
      addText(value, marginLeft + 55, y, { size: 9 });
      y += 5;
    });
  }
  y += 5;

  // ========== ARTICLE 3 — TARIFICATION ==========
  y = addSectionTitle('Article 3 — Conditions financières', y);
  y += 6;

  // Pricing box
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(marginLeft, y - 3, contentWidth, 30, 2, 2, 'F');

  addText(`Tarif unitaire HT :`, marginLeft + 5, y + 2, { size: 9 });
  addText(formatMoney(formation?.tarif_ht || 0) + ' / participant', marginLeft + 70, y + 2, { size: 9, bold: true });
  y += 6;
  addText(`Nombre de participants :`, marginLeft + 5, y + 2, { size: 9 });
  addText(String(client.nb_participants), marginLeft + 70, y + 2, { size: 9, bold: true });
  y += 6;
  addText(`Total HT :`, marginLeft + 5, y + 2, { size: 9 });
  addText(formatMoney(convention.total_ht), marginLeft + 70, y + 2, { size: 9, bold: true });
  y += 6;
  addText(`TVA (20%) :`, marginLeft + 5, y + 2, { size: 9 });
  addText(formatMoney(convention.tva), marginLeft + 70, y + 2, { size: 9, bold: true });
  y += 6;
  addText(`TOTAL TTC :`, marginLeft + 5, y + 2, { size: 10, bold: true, color: [233, 30, 99] });
  addText(formatMoney(convention.total_ttc), marginLeft + 70, y + 2, { size: 10, bold: true, color: [233, 30, 99] });
  y += 12;

  if (client.opco_financement) {
    addText(`Prise en charge OPCO : ${client.opco_nom || 'Oui'}`, marginLeft + 5, y, { size: 9, color: [30, 100, 200] });
    y += 8;
  }

  // ========== ARTICLE 4 — CONDITIONS GENERALES ==========
  y = addSectionTitle('Article 4 — Dispositions générales', y);
  y += 6;
  const conditions = [
    'La présente convention est conclue en application des dispositions du Livre III de la sixième partie du Code du travail relatif à la formation professionnelle continue.',
    'En cas d\'annulation par le client moins de 15 jours ouvrés avant le début de la formation, 50% du montant total sera dû.',
    'L\'organisme de formation s\'engage à mettre à disposition les moyens nécessaires au bon déroulement de la formation.',
  ];
  conditions.forEach((text) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    const lines = doc.splitTextToSize(text, contentWidth - 10);
    doc.text(lines, marginLeft + 5, y);
    y += lines.length * 4 + 3;
  });
  y += 5;

  // Check if we need a new page for signatures
  if (y > 240) {
    doc.addPage();
    y = 20;
  }

  // ========== SIGNATURES ==========
  y = addSectionTitle('Signatures', y);
  y += 6;

  const sigDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  addText(`Fait en deux exemplaires, le ${sigDate}`, 0, y, { size: 9, align: 'center', color: [100, 100, 100] });
  y += 10;

  // Signature boxes
  const boxWidth = (contentWidth - 10) / 2;

  // Left box — Organisme
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginLeft, y, boxWidth, 35, 2, 2);
  addText('Pour l\'organisme de formation', marginLeft + 5, y + 6, { size: 8, bold: true });
  addText(organisme.nom, marginLeft + 5, y + 12, { size: 8, color: [100, 100, 100] });
  addText('Signature :', marginLeft + 5, y + 20, { size: 8, color: [150, 150, 150] });

  // Right box — Client
  const rightX = marginLeft + boxWidth + 10;
  doc.roundedRect(rightX, y, boxWidth, 35, 2, 2);
  addText('Pour le client', rightX + 5, y + 6, { size: 8, bold: true });
  addText(client.raison_sociale, rightX + 5, y + 12, { size: 8, color: [100, 100, 100] });
  addText('Signature :', rightX + 5, y + 20, { size: 8, color: [150, 150, 150] });

  // ========== FOOTER ==========
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`${organisme.nom} — SIRET ${organisme.siret} — NDA ${organisme.nda}`, pageWidth / 2, 287, { align: 'center' });
    doc.text(`Page ${i}/${pageCount}`, pageWidth / 2, 291, { align: 'center' });
  }

  // Save
  doc.save(`Convention_${convention.numero.replace(/\//g, '-')}.pdf`);
}
