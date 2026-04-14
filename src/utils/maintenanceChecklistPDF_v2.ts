import jsPDF from 'jspdf';
import { COMPANY_INFO } from '../config/company';

export type CertificationStatus =
  | 'sin_info'
  | 'vigente'
  | 'vencida'
  | 'por_vencer'
  | 'no_legible';

export type MaintenanceQuestionStatus =
  | 'approved'
  | 'rejected'
  | 'not_applicable'
  | 'out_of_period';

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
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = PAGE_HEIGHT - 6;

const STATUS_LABELS: Record<MaintenanceQuestionStatus, string> = {
  approved: 'Aprobado',
  rejected: 'Rechazado',
  not_applicable: 'Pospuesto / No aplica',
  out_of_period: 'No corresponde al periodo',
};

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const COLORS = {
  blue: '#273a8f',
  green: '#44ac4c',
  red: '#e1162b',
  amber: '#f59e0b',
  gray: '#6b7280',
  dark: '#111827',
  lightBorder: '#d1d5db',
  lightFill: '#f8fafc',
};

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

function formatDate(dateStr?: string | null, fallback = 'No registrado'): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1
  ).padStart(2, '0')}/${d.getFullYear()}`;
}

function getCertificationStatusText(status?: CertificationStatus): string {
  switch (status) {
    case 'vigente':
      return 'Vigente';
    case 'vencida':
      return 'Vencida';
    case 'por_vencer':
      return 'Por vencer';
    case 'no_legible':
      return 'No legible';
    default:
      return 'No legible';
  }
}

function sanitizeText(value?: string | null, fallback = 'Sin información'): string {
  const text = value?.trim();
  return text ? text : fallback;
}

function getStatusColors(status: MaintenanceQuestionStatus): [number, number, number] {
  if (status === 'approved') return hexToRgb(COLORS.green);
  if (status === 'rejected') return hexToRgb(COLORS.red);
  if (status === 'out_of_period') return hexToRgb(COLORS.amber);
  return hexToRgb(COLORS.gray);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

function getImageFormat(src?: string | null): 'PNG' | 'JPEG' {
  if (!src) return 'JPEG';
  const normalized = src.toLowerCase();
  return normalized.includes('png') || normalized.startsWith('data:image/png')
    ? 'PNG'
    : 'JPEG';
}

function drawHeader(doc: jsPDF, logoImg: HTMLImageElement | null): number {
  const topY = MARGIN;
  const headerHeight = 24;
  const blueRgb = hexToRgb(COLORS.blue);
  const darkRgb = hexToRgb(COLORS.dark);

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, topY, CONTENT_WIDTH, headerHeight);

  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', MARGIN + 3, topY + 3, 22, 16);
    } catch (error) {
      console.error('No se pudo dibujar el logo', error);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...darkRgb);
  doc.text(COMPANY_INFO.reportTitle, PAGE_WIDTH / 2, topY + 8.5, {
    align: 'center',
  });

  doc.setFontSize(11.5);
  doc.text(COMPANY_INFO.reportSubtitle, PAGE_WIDTH / 2, topY + 15, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...blueRgb);
  const line = `${COMPANY_INFO.name} | ${COMPANY_INFO.address} | ${COMPANY_INFO.phone} | ${COMPANY_INFO.email} | ${COMPANY_INFO.website}`;
  doc.text(line, PAGE_WIDTH / 2, topY + 21, {
    align: 'center',
    maxWidth: CONTENT_WIDTH - 32,
  });

  return topY + headerHeight + 5;
}

function drawSectionTitle(doc: jsPDF, text: string, y: number): number {
  const blueRgb = hexToRgb(COLORS.blue);
  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(text, MARGIN + 3, y + 4.8);
  return y + 10;
}

function drawLabeledField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number
): void {
  const blueRgb = hexToRgb(COLORS.blue);
  const labelW = Math.min(32, Math.max(22, doc.getTextWidth(label) + 5));
  const valueW = w - labelW;

  doc.setFillColor(...blueRgb);
  doc.rect(x, y, labelW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(label, x + 1.5, y + 4.1);

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.setFillColor(255, 255, 255);
  doc.rect(x + labelW, y, valueW, 6, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(doc.splitTextToSize(value, valueW - 3)[0] || '', x + labelW + 1.5, y + 4.1);
}

function drawGeneralInfo(
  doc: jsPDF,
  data: MaintenanceChecklistPDFData,
  startY: number
): number {
  let y = drawSectionTitle(
    doc,
    `INFORMACIÓN GENERAL${data.folioNumber ? ` · FOLIO ${data.folioNumber}` : ''}`,
    startY
  );

  const colGap = 4;
  const colWidth = (CONTENT_WIDTH - colGap) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + colGap;

  drawLabeledField(doc, 'Cliente', sanitizeText(data.clientName, ''), leftX, y, colWidth);
  drawLabeledField(
    doc,
    'Periodo',
    `${MONTHS[data.month - 1] || data.month} ${data.year}`,
    rightX,
    y,
    colWidth
  );
  y += 7.5;

  drawLabeledField(
    doc,
    'Dirección',
    sanitizeText(data.clientAddress, 'Sin dirección'),
    leftX,
    y,
    colWidth
  );
  drawLabeledField(
    doc,
    'Ascensor',
    data.elevatorNumber ? `Ascensor ${data.elevatorNumber}` : 'No especificado',
    rightX,
    y,
    colWidth
  );
  y += 7.5;

  drawLabeledField(doc, 'Fecha', formatDate(data.completionDate), leftX, y, colWidth);
  drawLabeledField(
    doc,
    'Técnico',
    sanitizeText(data.technicianName, ''),
    rightX,
    y,
    colWidth
  );
  y += 7.5;

  drawLabeledField(
    doc,
    'Últ. cert.',
    sanitizeText(data.lastCertificationDate, 'No legible'),
    leftX,
    y,
    colWidth / 2 - 2
  );
  drawLabeledField(
    doc,
    'Próx. cert.',
    sanitizeText(data.nextCertificationDate, 'No legible'),
    leftX + colWidth / 2 + 2,
    y,
    colWidth / 2 - 2
  );
  drawLabeledField(
    doc,
    'Vigencia',
    getCertificationStatusText(data.certificationStatus),
    rightX,
    y,
    colWidth
  );

  return y + 10;
}

function drawLegend(doc: jsPDF, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...hexToRgb(COLORS.dark));
  doc.text('Simbología:', MARGIN, y);

  const items: Array<[string, MaintenanceQuestionStatus]> = [
    ['Aprobado', 'approved'],
    ['Rechazado', 'rejected'],
    ['No corresponde', 'out_of_period'],
    ['Pospuesto / No aplica', 'not_applicable'],
  ];

  let x = MARGIN + 18;
  items.forEach(([label, status]) => {
    const rgb = getStatusColors(status);
    doc.setFillColor(...rgb);
    doc.roundedRect(x, y - 3.8, 4.2, 4.2, 0.6, 0.6, 'F');
    x += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, y - 0.5);
    x += doc.getTextWidth(label) + 7;
  });

  return y + 4;
}

function ensureChecklistPage(
  doc: jsPDF,
  currentY: number,
  neededHeight: number,
  logoImg: HTMLImageElement | null,
  sectionTitle = 'CHECKLIST TÉCNICO'
): number {
  if (currentY + neededHeight <= PAGE_HEIGHT - 22) return currentY;

  doc.addPage();
  let y = drawHeader(doc, logoImg);
  y = drawSectionTitle(doc, sectionTitle, y);
  return y;
}

function drawQuestionRow(
  doc: jsPDF,
  question: MaintenanceChecklistQuestion,
  y: number,
  fullObservationIndices: number[]
): number {
  const borderRgb = hexToRgb(COLORS.lightBorder);
  const fillRgb = hexToRgb(COLORS.lightFill);
  const darkRgb = hexToRgb(COLORS.dark);
  const statusRgb = getStatusColors(question.status);

  const leftPad = 3;
  const boxX = MARGIN;
  const boxW = CONTENT_WIDTH;
  const textW = boxW - 42;
  const questionLabel = `${question.number}. ${question.text}`;
  const questionLines = doc.splitTextToSize(questionLabel, textW);
  const hasObservation = !!question.observations?.trim();
  const observationPrefix = 'Observación: ';

  let observationLines: string[] = [];
  let observationFits = true;

  if (hasObservation) {
    const allObsLines = doc.splitTextToSize(
      `${observationPrefix}${question.observations?.trim()}`,
      textW - 2
    );

    if (allObsLines.length > 4) {
      observationFits = false;
      observationLines = allObsLines.slice(0, 4);
      const last = observationLines[3] || '';
      observationLines[3] =
        last.length > 3 ? `${last.slice(0, -3)}...` : `${last}...`;
      fullObservationIndices.push(question.number);
    } else {
      observationLines = allObsLines;
    }
  }

  const questionHeight = questionLines.length * 3.6;
  const observationHeight = observationLines.length
    ? observationLines.length * 3.3 + 1.5
    : 0;
  const rowHeight = Math.max(10, questionHeight + observationHeight + 4);

  doc.setDrawColor(...borderRgb);
  doc.setFillColor(...fillRgb);
  doc.roundedRect(boxX, y, boxW, rowHeight, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.3);
  doc.setTextColor(...darkRgb);
  doc.text(questionLines, boxX + leftPad, y + 4.5);

  if (observationLines.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(65, 65, 65);
    doc.text(
      observationLines,
      boxX + leftPad + 1,
      y + 4.5 + questionHeight
    );

    if (!observationFits) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(...hexToRgb(COLORS.blue));
      doc.text(
        'Continúa en Observaciones adicionales.',
        boxX + leftPad + 1,
        y + rowHeight - 1.8
      );
    }
  }

  const chipW = 31;
  const chipH = 6;
  const chipX = boxX + boxW - chipW - 3;
  const chipY = y + 2.2;

  doc.setFillColor(...statusRgb);
  doc.roundedRect(chipX, chipY, chipW, chipH, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.text(STATUS_LABELS[question.status], chipX + chipW / 2, chipY + 4, {
    align: 'center',
  });

  return y + rowHeight + 2.5;
}

function drawChecklistPages(
  doc: jsPDF,
  data: MaintenanceChecklistPDFData,
  startY: number,
  logoImg: HTMLImageElement | null
): number[] {
  let y = drawSectionTitle(doc, 'CHECKLIST TÉCNICO', startY);
  const overflowObservations: number[] = [];
  let currentSection = '';

  data.questions.forEach((question) => {
    const questionTextLines = doc.splitTextToSize(
      `${question.number}. ${question.text}`,
      CONTENT_WIDTH - 42
    );
    const observationLines = question.observations?.trim()
      ? doc.splitTextToSize(
          `Observación: ${question.observations.trim()}`,
          CONTENT_WIDTH - 44
        )
      : [];

    const estimatedHeight =
      8 +
      questionTextLines.length * 3.6 +
      Math.min(observationLines.length, 4) * 3.3 +
      8;

    if (question.section !== currentSection) {
      y = ensureChecklistPage(doc, y, estimatedHeight + 10, logoImg);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...hexToRgb(COLORS.blue));
      doc.text(question.section.toUpperCase(), MARGIN, y);
      y += 4.5;
      currentSection = question.section;
    } else {
      y = ensureChecklistPage(doc, y, estimatedHeight, logoImg);
    }

    y = drawQuestionRow(doc, question, y, overflowObservations);
  });

  return overflowObservations;
}

function drawSignature(doc: jsPDF, data: MaintenanceChecklistPDFData, y: number): number {
  const blueRgb = hexToRgb(COLORS.blue);
  const boxW = 76;
  const boxH = 20;
  const x = PAGE_WIDTH - MARGIN - boxW;

  doc.setFillColor(...blueRgb);
  doc.roundedRect(x, y, boxW, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `RECEPCIONADO POR: ${data.signature?.signerName?.toUpperCase() || 'SIN FIRMA'}`,
    x + 2,
    y + 4.1
  );

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.roundedRect(x, y + 7, boxW, boxH, 1, 1, 'FD');

  if (data.signature?.signatureDataUrl) {
    try {
      doc.addImage(data.signature.signatureDataUrl, 'PNG', x + 8, y + 10, boxW - 16, boxH - 6);
    } catch (error) {
      console.error('No se pudo dibujar la firma', error);
    }
  }

  return y + boxH + 9;
}

function drawAdditionalObservationsPage(
  doc: jsPDF,
  data: MaintenanceChecklistPDFData,
  logoImg: HTMLImageElement | null,
  overflowObservationQuestionNumbers: number[]
): void {
  const longObservationSet = new Set(overflowObservationQuestionNumbers);
  const extraObservations = data.questions.filter(
    (q) => q.observations?.trim() && longObservationSet.has(q.number)
  );

  if (!extraObservations.length) return;

  doc.addPage();
  let y = drawHeader(doc, logoImg);
  y = drawSectionTitle(doc, 'OBSERVACIONES ADICIONALES', y);

  extraObservations.forEach((question) => {
    const fullText = `Observación completa: ${question.observations?.trim()}`;
    const lines = doc.splitTextToSize(fullText, CONTENT_WIDTH - 6);
    const needed = 10 + lines.length * 3.8;

    if (y + needed > PAGE_HEIGHT - 18) {
      doc.addPage();
      y = drawHeader(doc, logoImg);
      y = drawSectionTitle(doc, 'OBSERVACIONES ADICIONALES', y);
    }

    doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, needed, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(...hexToRgb(COLORS.dark));
    doc.text(`[${question.number}] ${question.text}`, MARGIN + 3, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.6);
    doc.text(lines, MARGIN + 3, y + 10);

    y += needed + 3;
  });
}

function getPhotoBlockHeight(photoCount: number, hasObservation: boolean): number {
  if (photoCount <= 0) return 0;
  if (photoCount <= 2) return hasObservation ? 96 : 90;
  return hasObservation ? 145 : 138;
}

function drawPhotoBlock(
  doc: jsPDF,
  question: MaintenanceChecklistQuestion,
  y: number,
  loadedImages: Map<string, HTMLImageElement | null>
): number {
  const photos = (question.photos || []).filter(Boolean);
  const hasObservation = !!question.observations?.trim();
  const titleY = y;
  const blockHeight = getPhotoBlockHeight(photos.length, hasObservation);

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, blockHeight, 1, 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(...hexToRgb(COLORS.blue));
  doc.text(`RESPALDO FOTOGRÁFICO · PREGUNTA ${question.number}`, MARGIN + 3, titleY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.7);
  doc.setTextColor(0, 0, 0);
  const qLines = doc.splitTextToSize(question.text, CONTENT_WIDTH - 6);
  doc.text(qLines, MARGIN + 3, titleY + 9.8);

  let cursorY = titleY + 9.8 + qLines.length * 3.4 + 1.5;

  if (hasObservation) {
    const obsLines = doc.splitTextToSize(
      `Observación: ${question.observations?.trim()}`,
      CONTENT_WIDTH - 6
    );
    const limited = obsLines.slice(0, 2);
    doc.setFont('helvetica', 'italic');
    doc.text(limited, MARGIN + 3, cursorY);
    cursorY += limited.length * 3.2 + 2;
  }

  const gap = 4;
  const usableW = CONTENT_WIDTH - 6;
  const innerX = MARGIN + 3;
  const cellW = (usableW - gap) / 2;
  const rows = photos.length <= 2 ? 1 : 2;
  const cellH = rows === 1 ? 58 : 27.5;

  photos.forEach((photo, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = innerX + col * (cellW + gap);
    const imgY = cursorY + row * (cellH + 4);

    doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
    doc.rect(x, imgY, cellW, cellH);

    const img = loadedImages.get(photo || '');
    if (!img || !img.width || !img.height) return;

    const ratio = Math.min(cellW / img.width, cellH / img.height);
    const drawW = img.width * ratio;
    const drawH = img.height * ratio;
    const drawX = x + (cellW - drawW) / 2;
    const drawY = imgY + (cellH - drawH) / 2;

    try {
      doc.addImage(img, getImageFormat(photo), drawX, drawY, drawW, drawH);
    } catch (error) {
      console.error('No se pudo dibujar foto del checklist', error);
    }
  });

  return y + blockHeight + 4;
}

async function drawPhotoPages(
  doc: jsPDF,
  data: MaintenanceChecklistPDFData,
  logoImg: HTMLImageElement | null
): Promise<void> {
  const questionsWithPhotos = data.questions.filter(
    (q) => (q.photos || []).filter(Boolean).length > 0
  );

  if (!questionsWithPhotos.length) return;

  const uniquePhotoUrls = Array.from(
    new Set(
      questionsWithPhotos.flatMap((q) => (q.photos || []).filter(Boolean) as string[])
    )
  );

  const loadedEntries = await Promise.all(
    uniquePhotoUrls.map(async (url) => [url, await loadImage(url)] as const)
  );

  const loadedImages = new Map<string, HTMLImageElement | null>(loadedEntries);

  doc.addPage();
  let y = drawHeader(doc, logoImg);
  y = drawSectionTitle(doc, 'RESPALDO FOTOGRÁFICO', y);

  for (const question of questionsWithPhotos) {
    const photoCount = (question.photos || []).filter(Boolean).length;
    const blockHeight = getPhotoBlockHeight(photoCount, !!question.observations?.trim());

    if (y + blockHeight > PAGE_HEIGHT - 18) {
      doc.addPage();
      y = drawHeader(doc, logoImg);
      y = drawSectionTitle(doc, 'RESPALDO FOTOGRÁFICO', y);
    }

    y = drawPhotoBlock(doc, question, y, loadedImages);
  }
}

function addPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text('Documento generado por MIREGA', MARGIN, FOOTER_Y);
    doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN, FOOTER_Y, {
      align: 'right',
    });
  }
}

export async function generateMaintenanceChecklistPDF(
  data: MaintenanceChecklistPDFData
): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
  });

  const logoImg = await loadImage('/logo_color.png');

  let y = drawHeader(doc, logoImg);
  y = drawGeneralInfo(doc, data, y);
  y = drawLegend(doc, y);

  const overflowObservationQuestionNumbers = drawChecklistPages(
    doc,
    data,
    y + 2,
    logoImg
  );

  doc.setPage(doc.getNumberOfPages());
  drawSignature(doc, data, PAGE_HEIGHT - 36);

  drawAdditionalObservationsPage(
    doc,
    data,
    logoImg,
    overflowObservationQuestionNumbers
  );

  await drawPhotoPages(doc, data, logoImg);
  addPageNumbers(doc);

  return doc.output('blob');
}