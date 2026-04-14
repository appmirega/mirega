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

const HEADER_HEIGHT = 24;
const HEADER_GAP = 6;

const SECTION_BAR_HEIGHT = 7;
const SECTION_BAR_GAP_BELOW = 6;

const GENERAL_INFO_ROW_HEIGHT = 8;
const GENERAL_INFO_LABEL_WIDTH = 24;
const GENERAL_INFO_GAP = 4;

const LEGEND_TOP_GAP = 5;
const LEGEND_BOTTOM_GAP = 7;

const CHECKLIST_SECTION_TOP_GAP = 4;
const CHECKLIST_SECTION_BOTTOM_GAP = 5;

const SIGNATURE_BLOCK_WIDTH = 92;
const SIGNATURE_BOX_HEIGHT = 22;
const SIGNATURE_TITLE_HEIGHT = 6;

const PHOTO_CELL_W = 56;
const PHOTO_CELL_H = 34;
const PHOTO_CELL_GAP_X = 4;
const PHOTO_CELL_GAP_Y = 4;
const PHOTO_LEFT_PADDING = 3;

const MAX_OBSERVATION_LINES_ON_CHECKLIST = 4;
const MAX_OBSERVATION_LINES_ON_PHOTO_BLOCK = 2;

const STATUS_LABELS: Record<MaintenanceQuestionStatus, string> = {
  approved: 'Aprobado',
  rejected: 'Rechazado',
  not_applicable: 'Pospuesto / No aplica',
  out_of_period: 'No corresponde',
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
  blue: '#2f46a1',
  green: '#44ac4c',
  red: '#e11d2e',
  amber: '#f59e0b',
  gray: '#6b7280',
  dark: '#111827',
  lightBorder: '#cbd5e1',
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

function sanitizeText(value?: string | null, fallback = 'Sin información'): string {
  if (!value) return fallback;
  const cleaned = value
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
}

function formatDate(dateStr?: string | null, fallback = 'No registrado'): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return sanitizeText(dateStr, fallback);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}/${d.getFullYear()}`;
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

function getStatusColors(status: MaintenanceQuestionStatus): [number, number, number] {
  if (status === 'approved') return hexToRgb(COLORS.green);
  if (status === 'rejected') return hexToRgb(COLORS.red);
  if (status === 'out_of_period') return hexToRgb(COLORS.amber);
  return hexToRgb(COLORS.gray);
}

function getImageFormat(src?: string | null): 'PNG' | 'JPEG' {
  if (!src) return 'JPEG';
  const normalized = src.toLowerCase();
  return normalized.includes('png') || normalized.startsWith('data:image/png')
    ? 'PNG'
    : 'JPEG';
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

function buildCompanyLine(): string {
  return `${COMPANY_INFO.name} | ${COMPANY_INFO.address} | ${COMPANY_INFO.phone} | ${COMPANY_INFO.email} | ${COMPANY_INFO.website}`;
}

function drawHeader(doc: jsPDF, logoImg: HTMLImageElement | null): number {
  const topY = MARGIN;
  const blueRgb = hexToRgb(COLORS.blue);
  const darkRgb = hexToRgb(COLORS.dark);

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, topY, CONTENT_WIDTH, HEADER_HEIGHT);

  if (logoImg) {
    try {
      doc.addImage(logoImg, 'PNG', MARGIN + 5, topY + 5, 18, 13);
    } catch (error) {
      console.error('No se pudo dibujar el logo', error);
    }
  }

  doc.setTextColor(...darkRgb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(COMPANY_INFO.reportTitle, PAGE_WIDTH / 2, topY + 8.5, {
    align: 'center',
  });

  doc.setFontSize(11.3);
  doc.text(COMPANY_INFO.reportSubtitle, PAGE_WIDTH / 2, topY + 15.2, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(...blueRgb);

  const companyLine = buildCompanyLine();
  doc.text(companyLine, PAGE_WIDTH / 2, topY + 20.4, {
    align: 'center',
    maxWidth: CONTENT_WIDTH - 36,
  });

  return topY + HEADER_HEIGHT + HEADER_GAP;
}

function drawSectionBar(doc: jsPDF, text: string, y: number): number {
  doc.setFillColor(...hexToRgb(COLORS.blue));
  doc.rect(MARGIN, y, CONTENT_WIDTH, SECTION_BAR_HEIGHT, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.4);
  doc.setTextColor(255, 255, 255);
  doc.text(text, MARGIN + 3, y + 4.8);

  return y + SECTION_BAR_HEIGHT + SECTION_BAR_GAP_BELOW;
}

function drawLabeledField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  w: number
): void {
  const labelW = GENERAL_INFO_LABEL_WIDTH;
  const valueW = w - labelW;

  doc.setFillColor(...hexToRgb(COLORS.blue));
  doc.rect(x, y, labelW, GENERAL_INFO_ROW_HEIGHT, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(255, 255, 255);
  doc.text(label, x + 1.5, y + 5.1);

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.setFillColor(255, 255, 255);
  doc.rect(x + labelW, y, valueW, GENERAL_INFO_ROW_HEIGHT, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.9);
  doc.setTextColor(0, 0, 0);

  const singleLine = doc.splitTextToSize(sanitizeText(value, ''), valueW - 3)[0] || '';
  doc.text(singleLine, x + labelW + 1.8, y + 5.1);
}

function drawGeneralInfo(doc: jsPDF, data: MaintenanceChecklistPDFData, y: number): number {
  y = drawSectionBar(
    doc,
    `INFORMACIÓN GENERAL${data.folioNumber ? ` · FOLIO ${data.folioNumber}` : ''}`,
    y
  );

  const colWidth = (CONTENT_WIDTH - GENERAL_INFO_GAP) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + GENERAL_INFO_GAP;

  drawLabeledField(doc, 'Cliente', sanitizeText(data.clientName, ''), leftX, y, colWidth);
  drawLabeledField(
    doc,
    'Periodo',
    `${MONTHS[data.month - 1] || data.month} ${data.year}`,
    rightX,
    y,
    colWidth
  );
  y += GENERAL_INFO_ROW_HEIGHT + 2;

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
  y += GENERAL_INFO_ROW_HEIGHT + 2;

  drawLabeledField(doc, 'Fecha', formatDate(data.completionDate), leftX, y, colWidth);
  drawLabeledField(doc, 'Técnico', sanitizeText(data.technicianName, ''), rightX, y, colWidth);
  y += GENERAL_INFO_ROW_HEIGHT + 2;

  const halfLeft = (colWidth - 2) / 2;
  drawLabeledField(
    doc,
    'Últ. cert.',
    sanitizeText(data.lastCertificationDate, 'No legible'),
    leftX,
    y,
    halfLeft
  );
  drawLabeledField(
    doc,
    'Próx. cert.',
    sanitizeText(data.nextCertificationDate, 'No legible'),
    leftX + halfLeft + 2,
    y,
    halfLeft
  );
  drawLabeledField(
    doc,
    'Vigencia',
    getCertificationStatusText(data.certificationStatus),
    rightX,
    y,
    colWidth
  );

  return y + GENERAL_INFO_ROW_HEIGHT;
}

function drawLegend(doc: jsPDF, y: number): number {
  y += LEGEND_TOP_GAP;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(...hexToRgb(COLORS.dark));
  doc.text('Simbología:', MARGIN, y);

  const items: Array<[string, MaintenanceQuestionStatus]> = [
    ['Aprobado', 'approved'],
    ['Rechazado', 'rejected'],
    ['No corresponde', 'out_of_period'],
    ['Pospuesto / No aplica', 'not_applicable'],
  ];

  let x = MARGIN + 18;

  for (const [label, status] of items) {
    const rgb = getStatusColors(status);

    doc.setFillColor(...rgb);
    doc.roundedRect(x, y - 4.2, 4.2, 4.2, 0.6, 0.6, 'F');
    x += 6;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(0, 0, 0);
    doc.text(label, x, y - 0.4);

    x += doc.getTextWidth(label) + 7;
  }

  return y + LEGEND_BOTTOM_GAP;
}

function ensureChecklistPage(
  doc: jsPDF,
  currentY: number,
  neededHeight: number,
  logoImg: HTMLImageElement | null
): number {
  if (currentY + neededHeight <= PAGE_HEIGHT - 22) return currentY;

  doc.addPage();
  let y = drawHeader(doc, logoImg);
  y = drawSectionBar(doc, 'CHECKLIST TÉCNICO', y);
  return y;
}

function trimObservationForChecklist(
  doc: jsPDF,
  text: string,
  width: number
): { lines: string[]; overflow: boolean } {
  const lines = doc.splitTextToSize(`Observación: ${sanitizeText(text, '')}`, width);
  if (lines.length <= MAX_OBSERVATION_LINES_ON_CHECKLIST) {
    return { lines, overflow: false };
  }

  const trimmed = lines.slice(0, MAX_OBSERVATION_LINES_ON_CHECKLIST);
  const lastIndex = trimmed.length - 1;
  trimmed[lastIndex] =
    trimmed[lastIndex].length > 3
      ? `${trimmed[lastIndex].slice(0, -3)}...`
      : `${trimmed[lastIndex]}...`;

  return { lines: trimmed, overflow: true };
}

function drawQuestionRow(
  doc: jsPDF,
  question: MaintenanceChecklistQuestion,
  y: number,
  overflowObservations: number[]
): number {
  const boxX = MARGIN;
  const boxW = CONTENT_WIDTH;
  const chipW = 31;
  const chipH = 6;
  const leftPadding = 3;
  const textWidth = boxW - chipW - 11;

  const questionLines = doc.splitTextToSize(
    `${question.number}. ${sanitizeText(question.text, '')}`,
    textWidth
  );

  let observationLines: string[] = [];
  let hasObservationOverflow = false;

  if (question.observations?.trim()) {
    const result = trimObservationForChecklist(doc, question.observations.trim(), textWidth - 1);
    observationLines = result.lines;
    hasObservationOverflow = result.overflow;

    if (hasObservationOverflow) {
      overflowObservations.push(question.number);
    }
  }

  const questionHeight = questionLines.length * 3.7;
  const observationHeight = observationLines.length ? observationLines.length * 3.3 + 1.5 : 0;
  const footerHintHeight = hasObservationOverflow ? 3.5 : 0;
  const rowHeight = Math.max(10, questionHeight + observationHeight + footerHintHeight + 4);

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.setFillColor(...hexToRgb(COLORS.lightFill));
  doc.roundedRect(boxX, y, boxW, rowHeight, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...hexToRgb(COLORS.dark));
  doc.text(questionLines, boxX + leftPadding, y + 4.7);

  let currentTextY = y + 4.7 + questionHeight;

  if (observationLines.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.4);
    doc.setTextColor(60, 60, 60);
    doc.text(observationLines, boxX + leftPadding, currentTextY);
    currentTextY += observationLines.length * 3.3 + 0.8;
  }

  if (hasObservationOverflow) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...hexToRgb(COLORS.blue));
    doc.text('Continúa en Observaciones adicionales.', boxX + leftPadding, y + rowHeight - 1.8);
  }

  const chipX = boxX + boxW - chipW - 3;
  const chipY = y + 2.2;
  const statusRgb = getStatusColors(question.status);

  doc.setFillColor(...statusRgb);
  doc.roundedRect(chipX, chipY, chipW, chipH, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.7);
  doc.setTextColor(255, 255, 255);
  doc.text(STATUS_LABELS[question.status], chipX + chipW / 2, chipY + 4.1, {
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
  let y = drawSectionBar(doc, 'CHECKLIST TÉCNICO', startY);
  const overflowObservations: number[] = [];
  let currentSection = '';

  for (const question of data.questions) {
    const questionTextLines = doc.splitTextToSize(
      `${question.number}. ${sanitizeText(question.text, '')}`,
      CONTENT_WIDTH - 42
    );

    const observationLines = question.observations?.trim()
      ? doc.splitTextToSize(
          `Observación: ${sanitizeText(question.observations, '')}`,
          CONTENT_WIDTH - 44
        )
      : [];

    const estimatedRowHeight =
      8 +
      questionTextLines.length * 3.7 +
      Math.min(observationLines.length, MAX_OBSERVATION_LINES_ON_CHECKLIST) * 3.3 +
      7;

    if (question.section !== currentSection) {
      const sectionHeightNeeded = CHECKLIST_SECTION_TOP_GAP + 4.2 + CHECKLIST_SECTION_BOTTOM_GAP + estimatedRowHeight;

      y = ensureChecklistPage(doc, y, sectionHeightNeeded, logoImg);
      y += CHECKLIST_SECTION_TOP_GAP;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.7);
      doc.setTextColor(...hexToRgb(COLORS.blue));
      doc.text(sanitizeText(question.section, '').toUpperCase(), MARGIN, y);

      y += CHECKLIST_SECTION_BOTTOM_GAP;
      currentSection = question.section;
    } else {
      y = ensureChecklistPage(doc, y, estimatedRowHeight + 2, logoImg);
    }

    y = drawQuestionRow(doc, question, y, overflowObservations);
  }

  return overflowObservations;
}

function drawSignature(doc: jsPDF, data: MaintenanceChecklistPDFData, baseY: number): number {
  const x = (PAGE_WIDTH - SIGNATURE_BLOCK_WIDTH) / 2;
  const blueRgb = hexToRgb(COLORS.blue);

  doc.setFillColor(...blueRgb);
  doc.roundedRect(x, baseY, SIGNATURE_BLOCK_WIDTH, SIGNATURE_TITLE_HEIGHT, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `RECEPCIONADO POR: ${sanitizeText(data.signature?.signerName, 'SIN FIRMA').toUpperCase()}`,
    PAGE_WIDTH / 2,
    baseY + 4.2,
    { align: 'center' }
  );

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(
    x,
    baseY + SIGNATURE_TITLE_HEIGHT + 1.5,
    SIGNATURE_BLOCK_WIDTH,
    SIGNATURE_BOX_HEIGHT,
    1,
    1,
    'FD'
  );

  if (data.signature?.signatureDataUrl) {
    try {
      const imgW = SIGNATURE_BLOCK_WIDTH - 18;
      const imgH = SIGNATURE_BOX_HEIGHT - 6;
      doc.addImage(
        data.signature.signatureDataUrl,
        'PNG',
        x + (SIGNATURE_BLOCK_WIDTH - imgW) / 2,
        baseY + SIGNATURE_TITLE_HEIGHT + 4,
        imgW,
        imgH
      );
    } catch (error) {
      console.error('No se pudo dibujar la firma', error);
    }
  }

  return baseY + SIGNATURE_TITLE_HEIGHT + SIGNATURE_BOX_HEIGHT + 4;
}

function drawAdditionalObservationsPage(
  doc: jsPDF,
  data: MaintenanceChecklistPDFData,
  logoImg: HTMLImageElement | null,
  overflowObservationQuestionNumbers: number[]
): void {
  const set = new Set(overflowObservationQuestionNumbers);
  const extraObservations = data.questions.filter(
    (q) => q.observations?.trim() && set.has(q.number)
  );

  if (!extraObservations.length) return;

  doc.addPage();
  let y = drawHeader(doc, logoImg);
  y = drawSectionBar(doc, 'OBSERVACIONES ADICIONALES', y);

  for (const question of extraObservations) {
    const lines = doc.splitTextToSize(
      `Observación completa: ${sanitizeText(question.observations, '')}`,
      CONTENT_WIDTH - 6
    );
    const blockHeight = 10 + lines.length * 3.6;

    if (y + blockHeight > PAGE_HEIGHT - 18) {
      doc.addPage();
      y = drawHeader(doc, logoImg);
      y = drawSectionBar(doc, 'OBSERVACIONES ADICIONALES', y);
    }

    doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, blockHeight, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.3);
    doc.setTextColor(...hexToRgb(COLORS.dark));
    doc.text(`[${question.number}] ${sanitizeText(question.text, '')}`, MARGIN + 3, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(lines, MARGIN + 3, y + 10);

    y += blockHeight + 3;
  }
}

function getPhotoGridRows(photoCount: number): number {
  if (photoCount <= 0) return 0;
  return photoCount <= 2 ? 1 : 2;
}

function getPhotoBlockHeight(question: MaintenanceChecklistQuestion): number {
  const photos = (question.photos || []).filter(Boolean);
  const photoCount = photos.length;
  if (!photoCount) return 0;

  const titleHeight = 11;
  const questionLineCount = 1 + Math.max(0, Math.ceil(sanitizeText(question.text, '').length / 70) - 1);
  const questionHeight = questionLineCount * 3.4 + 1.5;

  let observationHeight = 0;
  if (question.observations?.trim()) {
    observationHeight = MAX_OBSERVATION_LINES_ON_PHOTO_BLOCK * 3.2 + 2;
  }

  const rows = getPhotoGridRows(photoCount);
  const imagesHeight =
    rows === 1
      ? PHOTO_CELL_H
      : PHOTO_CELL_H * 2 + PHOTO_CELL_GAP_Y;

  return titleHeight + questionHeight + observationHeight + imagesHeight + 8;
}

function drawSinglePhoto(
  doc: jsPDF,
  photo: string,
  x: number,
  y: number,
  loadedImages: Map<string, HTMLImageElement | null>
): void {
  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.rect(x, y, PHOTO_CELL_W, PHOTO_CELL_H);

  const img = loadedImages.get(photo || '');
  if (!img || !img.width || !img.height) return;

  const ratio = Math.min(PHOTO_CELL_W / img.width, PHOTO_CELL_H / img.height);
  const drawW = img.width * ratio;
  const drawH = img.height * ratio;
  const drawX = x + (PHOTO_CELL_W - drawW) / 2;
  const drawY = y + (PHOTO_CELL_H - drawH) / 2;

  try {
    doc.addImage(img, getImageFormat(photo), drawX, drawY, drawW, drawH);
  } catch (error) {
    console.error('No se pudo dibujar foto del checklist', error);
  }
}

function drawPhotoBlock(
  doc: jsPDF,
  question: MaintenanceChecklistQuestion,
  y: number,
  loadedImages: Map<string, HTMLImageElement | null>
): number {
  const photos = (question.photos || []).filter(Boolean);
  const photoCount = photos.length;
  const blockHeight = getPhotoBlockHeight(question);

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, blockHeight, 1, 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(...hexToRgb(COLORS.blue));
  doc.text(`RESPALDO FOTOGRÁFICO · PREGUNTA ${question.number}`, MARGIN + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(0, 0, 0);

  const questionLines = doc.splitTextToSize(sanitizeText(question.text, ''), CONTENT_WIDTH - 6);
  doc.text(questionLines, MARGIN + 3, y + 10);

  let currentY = y + 10 + questionLines.length * 3.3 + 1.5;

  if (question.observations?.trim()) {
    const obsLines = doc
      .splitTextToSize(`Observación: ${sanitizeText(question.observations, '')}`, CONTENT_WIDTH - 6)
      .slice(0, MAX_OBSERVATION_LINES_ON_PHOTO_BLOCK);

    doc.setFont('helvetica', 'italic');
    doc.text(obsLines, MARGIN + 3, currentY);
    currentY += obsLines.length * 3.2 + 2;
  }

  const gridStartX = MARGIN + PHOTO_LEFT_PADDING;
  const maxColumns = 3;

  for (let i = 0; i < photoCount; i += 1) {
    const row = Math.floor(i / maxColumns);
    const col = i % maxColumns;

    const x = gridStartX + col * (PHOTO_CELL_W + PHOTO_CELL_GAP_X);
    const imgY = currentY + row * (PHOTO_CELL_H + PHOTO_CELL_GAP_Y);

    drawSinglePhoto(doc, photos[i], x, imgY, loadedImages);
  }

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

  const uniqueUrls = Array.from(
    new Set(
      questionsWithPhotos.flatMap((q) => (q.photos || []).filter(Boolean) as string[])
    )
  );

  const loadedEntries = await Promise.all(
    uniqueUrls.map(async (url) => [url, await loadImage(url)] as const)
  );
  const loadedImages = new Map<string, HTMLImageElement | null>(loadedEntries);

  doc.addPage();
  let y = drawHeader(doc, logoImg);
  y = drawSectionBar(doc, 'RESPALDO FOTOGRÁFICO', y);

  for (const question of questionsWithPhotos) {
    const blockHeight = getPhotoBlockHeight(question);

    if (y + blockHeight > PAGE_HEIGHT - 18) {
      doc.addPage();
      y = drawHeader(doc, logoImg);
      y = drawSectionBar(doc, 'RESPALDO FOTOGRÁFICO', y);
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

  const overflowObservationQuestionNumbers = drawChecklistPages(doc, data, y, logoImg);

  doc.setPage(doc.getNumberOfPages());
  const signatureY = Math.max(248, Math.min(PAGE_HEIGHT - 40, PAGE_HEIGHT - 40));
  drawSignature(doc, data, signatureY);

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