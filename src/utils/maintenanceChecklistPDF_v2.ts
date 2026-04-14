import jsPDF from 'jspdf';
import { getSpecialTestMetadata } from '../lib/checklistRules';

export type CertificationStatus = 'sin_info' | 'vigente' | 'vencida' | 'por_vencer' | 'no_legible';
export type MaintenanceQuestionStatus = 'approved' | 'rejected' | 'not_applicable' | 'out_of_period' | 'pending';

export interface MaintenanceChecklistQuestion {
  number: number;
  section: string;
  text: string;
  status: MaintenanceQuestionStatus;
  observations?: string | null;
  photos?: string[];
}

export interface ChecklistSignatureInfo {
  signerName: string;
  signedAt: string;
  signatureDataUrl: string;
}

export interface MaintenanceChecklistPDFData {
  checklistId: string | number;
  folioNumber?: number | string;
  clientName: string;
  clientAddress?: string | null;
  elevatorNumber?: number;
  month: number;
  year: number;
  completionDate?: string;
  lastCertificationDate?: string | null;
  nextCertificationDate?: string | null;
  technicianName: string;
  certificationStatus?: CertificationStatus;
  questions: MaintenanceChecklistQuestion[];
  signature?: ChecklistSignatureInfo | null;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 10;
const COLORS = {
  blue: '#273a8f',
  green: '#44ac4c',
  red: '#e1162b',
  gray: '#9ca3af',
  black: '#1d1d1b',
};
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
}

function formatDate(dateStr?: string | null, fallback = 'No registrado'): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function getCertificationStatusText(status?: CertificationStatus): string {
  switch (status) {
    case 'vigente': return 'Vigente';
    case 'vencida': return 'Vencida';
    case 'por_vencer': return 'Por vencer';
    case 'no_legible': return 'No legible';
    default: return 'Sin información';
  }
}

function getStatusLabel(status: MaintenanceQuestionStatus) {
  switch (status) {
    case 'approved': return 'Aprobado';
    case 'rejected': return 'Rechazado';
    case 'not_applicable': return 'Pospuesto / No aplica';
    case 'out_of_period': return 'Fuera de periodo';
    default: return 'Pendiente';
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function getImageFormat(src: string): 'PNG' | 'JPEG' {
  const normalized = src.toLowerCase();
  if (normalized.includes('data:image/png') || normalized.endsWith('.png')) return 'PNG';
  return 'JPEG';
}

function drawHeader(doc: jsPDF, logoImg: HTMLImageElement | null) {
  const blue = hexToRgb(COLORS.blue);
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', MARGIN, MARGIN, 24, 18);
    } catch (error) {
      console.error('Error al dibujar logo del PDF:', error);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...hexToRgb(COLORS.black));
  doc.text('INFORME DE MANTENIMIENTO', PAGE_WIDTH / 2, MARGIN + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Checklist técnico de mantenimiento', PAGE_WIDTH / 2, MARGIN + 15, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(...blue);
  doc.text('MIREGA ASCENSORES LTDA. · contacto@mirega.cl', PAGE_WIDTH / 2, MARGIN + 21, { align: 'center' });

  return MARGIN + 28;
}

function drawInfoField(doc: jsPDF, label: string, value: string, x: number, y: number, labelWidth: number, totalWidth: number) {
  const blue = hexToRgb(COLORS.blue);
  doc.setFillColor(...blue);
  doc.rect(x, y, labelWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(label, x + 1.5, y + 4.2);

  doc.setDrawColor(...blue);
  doc.setFillColor(255, 255, 255);
  doc.rect(x + labelWidth, y, totalWidth - labelWidth, 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(value || '-', x + labelWidth + 2, y + 4.2);
}

function drawGeneralInfo(doc: jsPDF, data: MaintenanceChecklistPDFData, startY: number) {
  const blue = hexToRgb(COLORS.blue);
  let y = startY;
  doc.setFillColor(...blue);
  doc.rect(MARGIN, y, PAGE_WIDTH - (MARGIN * 2), 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('INFORMACIÓN GENERAL', MARGIN + 3, y + 5.5);
  doc.text(`Folio: ${data.folioNumber ?? 'Pendiente'}`, PAGE_WIDTH - MARGIN - 3, y + 5.5, { align: 'right' });
  y += 11;

  const leftX = MARGIN;
  const rightX = PAGE_WIDTH / 2;
  const totalWidth = PAGE_WIDTH / 2 - MARGIN;
  const labelWidth = 30;

  drawInfoField(doc, 'Cliente', data.clientName || '-', leftX, y, labelWidth, totalWidth);
  drawInfoField(doc, 'Periodo', `${MONTHS[data.month - 1] || '-'} ${data.year}`, rightX, y, labelWidth, totalWidth);
  y += 7.5;
  drawInfoField(doc, 'Dirección', data.clientAddress || '-', leftX, y, labelWidth, totalWidth);
  drawInfoField(doc, 'Ascensor', data.elevatorNumber ? `Ascensor ${data.elevatorNumber}` : '-', rightX, y, labelWidth, totalWidth);
  y += 7.5;
  drawInfoField(doc, 'Fecha', formatDate(data.completionDate), leftX, y, labelWidth, totalWidth);
  drawInfoField(doc, 'Técnico', data.technicianName || '-', rightX, y, labelWidth, totalWidth);
  y += 7.5;
  drawInfoField(doc, 'Últ. Cert.', formatDate(data.lastCertificationDate, 'No legible'), leftX, y, labelWidth, totalWidth);
  drawInfoField(doc, 'Vigencia', getCertificationStatusText(data.certificationStatus), rightX, y, labelWidth, totalWidth);
  y += 10;

  return y;
}

function drawLegend(doc: jsPDF, startY: number) {
  const items = [
    { label: 'Aprobado', color: hexToRgb(COLORS.green) },
    { label: 'Rechazado', color: hexToRgb(COLORS.red) },
    { label: 'Pospuesto / No aplica', color: hexToRgb(COLORS.gray) },
  ];

  let x = MARGIN;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  for (const item of items) {
    doc.setFillColor(...item.color);
    doc.roundedRect(x, startY, 5, 5, 0.6, 0.6, 'F');
    doc.text(item.label, x + 8, startY + 4.1);
    x += 55;
  }

  return startY + 8;
}

function ensurePage(doc: jsPDF, y: number, requiredHeight: number, logoImg: HTMLImageElement | null) {
  if (y + requiredHeight <= PAGE_HEIGHT - 20) return y;
  doc.addPage();
  return drawHeader(doc, logoImg);
}

function drawChecklist(doc: jsPDF, data: MaintenanceChecklistPDFData, startY: number, logoImg: HTMLImageElement | null) {
  const blue = hexToRgb(COLORS.blue);
  let y = startY;

  doc.setFillColor(...blue);
  doc.rect(MARGIN, y, PAGE_WIDTH - (MARGIN * 2), 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('CHECKLIST', MARGIN + 3, y + 5.5);
  y += 11;

  let currentSection = '';
  for (const question of data.questions) {
    const obs = question.observations && !question.observations.startsWith('__special_test__|')
      ? question.observations.trim()
      : '';
    const specialMeta = getSpecialTestMetadata(question.observations);
    const note = specialMeta?.action === 'postponed'
      ? `Prueba pospuesta${specialMeta.reason ? `: ${specialMeta.reason}` : ''}`
      : specialMeta?.action === 'go'
        ? 'Derivada a vista de prueba'
        : obs;

    const questionLines = doc.splitTextToSize(`${question.number}. ${question.text}`, 150);
    const noteLines = note ? doc.splitTextToSize(note, 145) : [];
    const requiredHeight = 7 + (questionLines.length * 3.5) + (noteLines.length ? noteLines.length * 3.5 + 4 : 0) + (currentSection !== question.section ? 8 : 0);
    y = ensurePage(doc, y, requiredHeight, logoImg);

    if (question.section !== currentSection) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...blue);
      doc.text(question.section.toUpperCase(), MARGIN, y);
      y += 5;
      currentSection = question.section;
    }

    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(MARGIN, y - 1, PAGE_WIDTH - (MARGIN * 2), requiredHeight - 2, 1, 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(questionLines, MARGIN + 3, y + 3);

    const statusColor = question.status === 'approved'
      ? hexToRgb(COLORS.green)
      : question.status === 'rejected'
        ? hexToRgb(COLORS.red)
        : hexToRgb(COLORS.gray);

    doc.setFillColor(...statusColor);
    doc.roundedRect(PAGE_WIDTH - MARGIN - 24, y + 1, 18, 6, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(getStatusLabel(question.status), PAGE_WIDTH - MARGIN - 15, y + 5, { align: 'center' });

    y += questionLines.length * 3.5 + 3;

    if (noteLines.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(70, 70, 70);
      doc.text(noteLines, MARGIN + 3, y + 1);
      y += noteLines.length * 3.5 + 2;
    }

    y += 3;
  }

  return y;
}

function drawSignature(doc: jsPDF, data: MaintenanceChecklistPDFData, y: number) {
  if (!data.signature) return;
  const blue = hexToRgb(COLORS.blue);
  const boxWidth = 70;
  const x = (PAGE_WIDTH - boxWidth) / 2;

  doc.setFillColor(...blue);
  doc.rect(x, y, boxWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`RECEPCIONADO POR: ${data.signature.signerName || 'SIN FIRMA'}`, x + 2, y + 4.2);

  doc.setDrawColor(...blue);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y + 7, boxWidth, 20);

  try {
    doc.addImage(data.signature.signatureDataUrl, 'PNG', x + 10, y + 10, boxWidth - 20, 10);
  } catch (error) {
    console.error('No se pudo agregar la firma al PDF:', error);
  }
}

function drawObservationsPages(doc: jsPDF, data: MaintenanceChecklistPDFData, logoImg: HTMLImageElement | null) {
  const questions = data.questions.filter((question) => {
    const raw = question.observations?.trim();
    return raw && !raw.startsWith('__special_test__|');
  });
  if (questions.length === 0) return;

  doc.addPage();
  let y = drawHeader(doc, logoImg);
  const blue = hexToRgb(COLORS.blue);
  doc.setFillColor(...blue);
  doc.rect(MARGIN, y, PAGE_WIDTH - (MARGIN * 2), 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('OBSERVACIONES', MARGIN + 3, y + 5.5);
  y += 12;

  for (const question of questions) {
    const lines = doc.splitTextToSize(`[${question.number}] ${question.text}`, 185);
    const obsLines = doc.splitTextToSize(`Observación: ${question.observations}`, 182);
    const requiredHeight = lines.length * 4 + obsLines.length * 4 + 10;
    y = ensurePage(doc, y, requiredHeight, logoImg);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4 + 1;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(obsLines, MARGIN + 2, y);
    y += obsLines.length * 4 + 5;
  }
}

async function drawPhotoPages(doc: jsPDF, data: MaintenanceChecklistPDFData, logoImg: HTMLImageElement | null) {
  const questionsWithPhotos = data.questions.filter((question) => (question.photos?.length ?? 0) > 0);
  for (const question of questionsWithPhotos) {
    doc.addPage();
    let y = drawHeader(doc, logoImg);
    const blue = hexToRgb(COLORS.blue);
    doc.setFillColor(...blue);
    doc.rect(MARGIN, y, PAGE_WIDTH - (MARGIN * 2), 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(`RESPALDO FOTOGRÁFICO · PREGUNTA ${question.number}`, MARGIN + 3, y + 5.5);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const questionLines = doc.splitTextToSize(question.text, PAGE_WIDTH - (MARGIN * 2));
    doc.text(questionLines, MARGIN, y);
    y += questionLines.length * 4 + 4;

    const obs = question.observations && !question.observations.startsWith('__special_test__|')
      ? question.observations.trim()
      : '';
    if (obs) {
      const obsLines = doc.splitTextToSize(`Observación: ${obs}`, PAGE_WIDTH - (MARGIN * 2));
      doc.setFont('helvetica', 'italic');
      doc.text(obsLines, MARGIN, y);
      y += obsLines.length * 4 + 4;
    }

    const slots = [
      { x: MARGIN, y, w: 88, h: 75 },
      { x: 112, y, w: 88, h: 75 },
      { x: MARGIN, y: y + 84, w: 88, h: 75 },
      { x: 112, y: y + 84, w: 88, h: 75 },
    ];

    const photos = question.photos ?? [];
    for (let i = 0; i < Math.min(photos.length, 4); i++) {
      const photoUrl = photos[i];
      const slot = slots[i];
      doc.setDrawColor(200, 200, 200);
      doc.rect(slot.x, slot.y, slot.w, slot.h);
      const img = await loadImage(photoUrl);
      if (!img) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`No se pudo cargar la foto ${i + 1}`, slot.x + slot.w / 2, slot.y + slot.h / 2, { align: 'center' });
        continue;
      }

      const ratio = Math.min(slot.w / img.width, slot.h / img.height);
      const drawW = img.width * ratio;
      const drawH = img.height * ratio;
      const drawX = slot.x + (slot.w - drawW) / 2;
      const drawY = slot.y + (slot.h - drawH) / 2;

      try {
        doc.addImage(img, getImageFormat(photoUrl), drawX, drawY, drawW, drawH);
      } catch (error) {
        console.error('No se pudo agregar foto al PDF:', error);
        doc.text(`Error al insertar foto ${i + 1}`, slot.x + slot.w / 2, slot.y + slot.h / 2, { align: 'center' });
      }
    }
  }
}

function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();
  for (let index = 1; index <= totalPages; index++) {
    doc.setPage(index);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${index} de ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 5, { align: 'right' });
    doc.text('Documento generado por MIREGA', MARGIN, PAGE_HEIGHT - 5);
  }
}

export async function generateMaintenanceChecklistPDF(data: MaintenanceChecklistPDFData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const logoImg = await loadImage('/logo_color.png');

  let y = drawHeader(doc, logoImg);
  y = drawGeneralInfo(doc, data, y);
  y = drawLegend(doc, y);
  y = drawChecklist(doc, data, y, logoImg);
  drawSignature(doc, data, Math.min(PAGE_HEIGHT - 38, y + 6));
  drawObservationsPages(doc, data, logoImg);
  await drawPhotoPages(doc, data, logoImg);
  addPageNumbers(doc);

  return doc.output('blob');
}
