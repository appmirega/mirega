import jsPDF from 'jspdf';

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
  | 'out_of_period'
  | 'postponed';

export type ElevatorType = 'hydraulic' | 'electromechanical';

export interface MaintenanceChecklistQuestion {
  id?: string;
  number: number;
  section: string;
  text: string;
  status: MaintenanceQuestionStatus;
  observations?: string | null;
  photos?: string[];
}

export interface AdditionalObservation {
  order: number;
  text: string;
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
  elevatorType?: ElevatorType;
  month: number;
  year: number;
  completionDate?: string;
  lastCertificationDate?: string | null;
  nextCertificationDate?: string | null;
  technicianName: string;
  certificationStatus?: CertificationStatus;
  questions: MaintenanceChecklistQuestion[];
  additionalObservations?: AdditionalObservation[];
  signature?: ChecklistSignatureInfo | null;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 10;

const COLORS = {
  blue: '#273a8f',
  green: '#44ac4c',
  red: '#e1162b',
  black: '#1d1d1b',
  gray: '#b4b4b4',
  cyan: '#64b4dc',
  lightGray: '#eef2f7',
};

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const SPECIAL_EXTERNAL_QUESTION_NUMBERS = new Set([9, 14, 15, 17, 31, 32, 33]);

const EXCLUDED_PHOTO_PATTERNS = [
  'cable de suspensión',
  'cables de suspensión',
  'suspensión',
  'prueba de freno',
  'funcionamiento de freno',
  'freno',
  'pruebas de limitador',
  'prueba de limitador',
  'limitador',
  'cuñas',
  'cuña',
];

const HYDRAULIC_SECTION_NAME = 'GRUPO HIDRÁULICO, CILINDRO Y VÁLVULAS';

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16),
  ];
}

function normalizeText(text?: string | null) {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function questionRequiresPhotos(question: MaintenanceChecklistQuestion) {
  if (SPECIAL_EXTERNAL_QUESTION_NUMBERS.has(question.number)) return false;

  const q = normalizeText(question.text);
  return !EXCLUDED_PHOTO_PATTERNS.some((pattern) => q.includes(normalizeText(pattern)));
}

function formatDate(dateStr?: string | null, fallback = 'No registrado'): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
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

function inferImageFormat(dataUrlOrMime: string): 'PNG' | 'JPEG' {
  const v = dataUrlOrMime.toLowerCase();
  if (v.includes('image/png') || v.includes('.png')) return 'PNG';
  return 'JPEG';
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo convertir blob a data URL'));
    };
    reader.onerror = () => reject(new Error('Error leyendo imagen'));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src, { mode: 'cors' });
    if (!response.ok) {
      console.error('No se pudo descargar imagen:', src, response.status);
      return null;
    }

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      console.error('El recurso no es imagen:', src, blob.type);
      return null;
    }

    return await blobToDataUrl(blob);
  } catch (error) {
    console.error('Error cargando imagen remota:', src, error);
    return null;
  }
}

async function loadLogoDataUrl(src: string): Promise<string | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function getApplicableQuestions(data: MaintenanceChecklistPDFData): MaintenanceChecklistQuestion[] {
  const ordered = [...data.questions].sort((a, b) => a.number - b.number);

  if (data.elevatorType === 'electromechanical') {
    return ordered.filter((q) => normalizeText(q.section) !== normalizeText(HYDRAULIC_SECTION_NAME));
  }

  return ordered;
}

function drawHeader(doc: jsPDF, logoDataUrl: string | null): number {
  let y = MARGIN;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, inferImageFormat(logoDataUrl), MARGIN, y, 25, 20);
    } catch (e) {
      console.error('Error al cargar logo:', e);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...hexToRgb(COLORS.black));
  doc.text('INFORME MANTENIMIENTO', PAGE_WIDTH / 2, y + 10, { align: 'center' });

  doc.setFontSize(14);
  doc.text('INSPECCIÓN MENSUAL', PAGE_WIDTH / 2, y + 18, { align: 'center' });

  y += 25;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  const contactInfo =
    'MIREGA ASCENSORES LTDA. | Av. Pedro de Valdivia 273 - Of. 1406 Providencia | +56956087972 | contacto@mirega.cl | www.mirega.cl';
  doc.text(contactInfo, PAGE_WIDTH / 2, y, { align: 'center' });

  return y + 8;
}

function drawGeneralInfo(doc: jsPDF, data: MaintenanceChecklistPDFData, startY: number): number {
  let y = startY;
  const blueRgb = hexToRgb(COLORS.blue);

  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('INFORMACIÓN GENERAL', MARGIN + 3, y + 5.5);

  const folioText = data.folioNumber ? `FOLIO: ${data.folioNumber}` : 'FOLIO: PENDIENTE';
  doc.text(folioText, PAGE_WIDTH - MARGIN - 3, y + 5.5, { align: 'right' });

  y += 10;

  const fieldHeight = 6;
  const labelWidth = 35;
  const leftCol = MARGIN;
  const rightCol = PAGE_WIDTH / 2;

  const drawField = (label: string, value: string, x: number, yPos: number, width?: number) => {
    const fieldWidth = width || (PAGE_WIDTH / 2 - MARGIN - labelWidth);

    doc.setFillColor(...blueRgb);
    doc.setTextColor(255, 255, 255);
    doc.rect(x, yPos, labelWidth, fieldHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label, x + 1.5, yPos + 4.2);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...blueRgb);
    doc.setLineWidth(0.3);
    doc.rect(x + labelWidth, yPos, fieldWidth, fieldHeight);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(value || '', x + labelWidth + 2, yPos + 4.2);
  };

  drawField('Edificio:', data.clientName || '', leftCol, y);
  drawField('Periodo:', MONTHS[data.month - 1] || '', rightCol, y);
  y += fieldHeight + 1.5;

  drawField('Dirección:', data.clientAddress || '', leftCol, y);
  const ascensorText = data.elevatorNumber ? `Ascensor ${data.elevatorNumber}` : 'No especificado';
  drawField('N° Ascensor:', ascensorText, rightCol, y);
  y += fieldHeight + 1.5;

  drawField('Fecha:', formatDate(data.completionDate), leftCol, y);
  drawField('Técnico:', data.technicianName || '', rightCol, y);
  y += fieldHeight + 1.5;

  const leftSectionWidth = PAGE_WIDTH / 2 - MARGIN;
  const subLabelWidth = 28;
  const subFieldWidth = (leftSectionWidth - 2 * subLabelWidth) / 2;

  doc.setFillColor(...blueRgb);
  doc.setTextColor(255, 255, 255);
 