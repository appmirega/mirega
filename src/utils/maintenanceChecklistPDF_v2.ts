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

export type ElevatorPdfType = 'hydraulic' | 'electromechanical';

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
  elevatorType?: ElevatorPdfType;
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

function filterQuestionsForElevatorType(
  questions: MaintenanceChecklistQuestion[],
  elevatorType?: ElevatorPdfType
) {
  if (elevatorType === 'electromechanical') {
    return questions.filter(
      (q) => normalizeText(q.section) !== normalizeText('GRUPO HIDRÁULICO, CILINDRO Y VÁLVULAS')
    );
  }
  return questions;
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
  doc.setTextColor(60, 60