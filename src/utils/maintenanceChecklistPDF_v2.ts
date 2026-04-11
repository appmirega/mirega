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
  | 'out_of_period';

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
  doc.rect(leftCol, y, subLabelWidth, fieldHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Última Certif.:', leftCol + 1.5, y + 4.2);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...blueRgb);
  doc.setLineWidth(0.3);
  doc.rect(leftCol + subLabelWidth, y, subFieldWidth, fieldHeight);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(data.lastCertificationDate || 'No legible', leftCol + subLabelWidth + 2, y + 4.2);

  const proxX = leftCol + subLabelWidth + subFieldWidth;
  doc.setFillColor(...blueRgb);
  doc.setTextColor(255, 255, 255);
  doc.rect(proxX, y, subLabelWidth, fieldHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Próxima Certif.:', proxX + 1.5, y + 4.2);

  doc.setFillColor(255, 255, 255);
  doc.rect(proxX + subLabelWidth, y, subFieldWidth, fieldHeight);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(data.nextCertificationDate || 'No legible', proxX + subLabelWidth + 2, y + 4.2);

  drawField('Vigencia:', getCertificationStatusText(data.certificationStatus), rightCol, y);

  return y + fieldHeight + 6;
}

function drawLegend(doc: jsPDF, y: number): number {
  const greenRgb = hexToRgb(COLORS.green);
  const redRgb = hexToRgb(COLORS.red);
  const cyanRgb: [number, number, number] = [100, 180, 220];
  const grayRgb: [number, number, number] = [180, 180, 180];

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Simbología del checklist:', MARGIN, y);

  doc.setFont('helvetica', 'normal');
  let x = MARGIN + 42;
  const circleRadius = 2.5;
  const spacing = 8;

  doc.text('Aprobado:', x, y);
  x += doc.getTextWidth('Aprobado:') + 3;
  doc.setFillColor(...greenRgb);
  doc.circle(x, y - 1.5, circleRadius, 'F');
  x += circleRadius * 2 + spacing;

  doc.text('Rechazado:', x, y);
  x += doc.getTextWidth('Rechazado:') + 3;
  doc.setFillColor(...redRgb);
  doc.circle(x, y - 1.5, circleRadius, 'F');
  x += circleRadius * 2 + spacing;

  doc.text('No corresponde al periodo:', x, y);
  x += doc.getTextWidth('No corresponde al periodo:') + 3;
  doc.setFillColor(...cyanRgb);
  doc.circle(x, y - 1.5, circleRadius, 'F');
  x += circleRadius * 2 + spacing;

  doc.text('No aplica:', x, y);
  x += doc.getTextWidth('No aplica:') + 3;
  doc.setFillColor(...grayRgb);
  doc.circle(x, y - 1.5, circleRadius, 'F');

  return y + 5;
}

function drawChecklist(doc: jsPDF, data: MaintenanceChecklistPDFData, startY: number): number {
  let y = startY;
  const blueRgb = hexToRgb(COLORS.blue);

  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('CHECKLIST MANTENIMIENTO', MARGIN + 3, y + 5.5);

  y += 12;

  const orderedQuestions = [...data.questions].sort((a, b) => a.number - b.number);
  const leftQuestions = orderedQuestions.slice(0, 25);
  const rightQuestions = orderedQuestions.slice(25, 50);

  const colWidth = (PAGE_WIDTH - 2 * MARGIN - 4) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + 4;

  const greenRgb = hexToRgb(COLORS.green);
  const redRgb = hexToRgb(COLORS.red);
  const cyanRgb: [number, number, number] = [100, 180, 220];
  const grayRgb: [number, number, number] = [180, 180, 180];

  const drawColumn = (questions: MaintenanceChecklistQuestion[], x: number, startYCol: number) => {
    let yCol = startYCol;
    let lastSection = '';

    doc.setTextColor(0, 0, 0);

    questions.forEach((q) => {
      if (q.section !== lastSection) {
        if (lastSection !== '') {
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.2);
          doc.line(x, yCol - 1, x + colWidth - 1, yCol - 1);
          yCol += 2;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...blueRgb);
        doc.text(q.section.toUpperCase(), x, yCol);
        yCol += 5;
        lastSection = q.section;
      }

      const questionText = `${q.number}. ${q.text}`;
      const textWidth = colWidth - 10;
      const lines = doc.splitTextToSize(questionText, textWidth);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      doc.text(lines, x + 1, yCol);

      const boxSize = 5;
      const innerBoxSize = 3.5;
      const boxX = x + colWidth - boxSize - 1;
      const lineHeight = lines.length * 2.8;
      const boxY = yCol - 2 + lineHeight / 2 - boxSize / 2;

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(boxX, boxY, boxSize, boxSize, 0.5, 0.5, 'FD');

      if (q.status === 'approved') {
        doc.setFillColor(...greenRgb);
      } else if (q.status === 'rejected') {
        doc.setFillColor(...redRgb);
      } else if (q.status === 'out_of_period') {
        doc.setFillColor(...cyanRgb);
      } else {
        doc.setFillColor(...grayRgb);
      }

      const innerX = boxX + (boxSize - innerBoxSize) / 2;
      const innerY = boxY + (boxSize - innerBoxSize) / 2;
      doc.roundedRect(innerX, innerY, innerBoxSize, innerBoxSize, 0.3, 0.3, 'F');

      yCol += Math.max(5, lineHeight + 2);
    });

    return yCol;
  };

  const yLeft = drawColumn(leftQuestions, leftX, y);
  const yRight = drawColumn(rightQuestions, rightX, y);

  return Math.max(yLeft, yRight) + 4;
}

function drawSignature(doc: jsPDF, data: MaintenanceChecklistPDFData, y: number) {
  const blueRgb = hexToRgb(COLORS.blue);
  const boxW = 65;
  const boxH = 18;
  const centerX = (PAGE_WIDTH - boxW) / 2;

  doc.setFillColor(...blueRgb);
  doc.rect(centerX, y, boxW, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);

  const signerName = data.signature?.signerName?.toUpperCase() || 'SIN FIRMA';
  doc.text(`RECEPCIONADO POR: ${signerName}`, centerX + 2, y + 3.5);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...blueRgb);
  doc.setLineWidth(0.5);
  doc.rect(centerX, y + 6, boxW, boxH);

  if (data.signature?.signatureDataUrl) {
    try {
      doc.addImage(
        data.signature.signatureDataUrl,
        'PNG',
        centerX + 10,
        y + 10,
        boxW - 20,
        boxH - 8
      );
    } catch (e) {
      console.error('Error al cargar firma:', e);
    }
  }
}

function drawObservationsPage(
  doc: jsPDF,
  data: MaintenanceChecklistPDFData,
  logoDataUrl: string | null
) {
  const rejected = [...data.questions]
    .filter((q) => q.status === 'rejected' && q.observations && q.observations.trim() !== '')
    .sort((a, b) => a.number - b.number);

  const additional = [...(data.additionalObservations || [])].sort((a, b) => a.order - b.order);

  if (rejected.length === 0 && additional.length === 0) return;

  doc.addPage();
  let y = drawHeader(doc, logoDataUrl);

  const blueRgb = hexToRgb(COLORS.blue);
  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('OBSERVACIONES Y RESUMEN', MARGIN + 3, y + 5.5);

  y += 12;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (rejected.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones levantadas en el checklist', MARGIN, y);
    y += 6;

    rejected.forEach((q, index) => {
      const title = `${index + 1}. [Pregunta ${q.number}] ${q.text}`;
      const titleLines = doc.splitTextToSize(title, PAGE_WIDTH - 2 * MARGIN);
      const obsLines = doc.splitTextToSize(q.observations || '', PAGE_WIDTH - 2 * MARGIN - 4);

      if (y + titleLines.length * 4 + obsLines.length * 4 + 8 > PAGE_HEIGHT - 15) {
        doc.addPage();
        y = drawHeader(doc, logoDataUrl);
      }

      doc.setFont('helvetica', 'bold');
      doc.text(titleLines, MARGIN, y);
      y += titleLines.length * 4;

      doc.setFont('helvetica', 'normal');
      doc.text(obsLines, MARGIN + 2, y + 1);
      y += obsLines.length * 4 + 5;
    });
  }

  if (additional.length > 0) {
    if (y > PAGE_HEIGHT - 40) {
      doc.addPage();
      y = drawHeader(doc, logoDataUrl);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones adicionales', MARGIN, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    additional.forEach((obs) => {
      const lines = doc.splitTextToSize(`Observación ${obs.order}: ${obs.text}`, PAGE_WIDTH - 2 * MARGIN);
      if (y + lines.length * 4 + 4 > PAGE_HEIGHT - 15) {
        doc.addPage();
        y = drawHeader(doc, logoDataUrl);
      }
      doc.text(lines, MARGIN + 2, y);
      y += lines.length * 4 + 4;
    });
  }
}

async function drawPhotoGrid(doc: jsPDF, photos: string[], y: number) {
  const startX = MARGIN;
  const gap = 4;
  const photoW = (PAGE_WIDTH - 2 * MARGIN - gap * 3) / 4;
  const photoH = 32;

  const slots = [photos[0] || '', photos[1] || '', photos[2] || '', photos[3] || ''];
  const loadedImages = await Promise.all(
    slots.map(async (url) => {
      if (!url) return null;
      return await fetchImageAsDataUrl(url);
    })
  );

  for (let i = 0; i < 4; i++) {
    const x = startX + i * (photoW + gap);

    doc.setDrawColor(210, 210, 210);
    doc.setFillColor(248, 250, 252);
    doc.rect(x, y, photoW, photoH, 'FD');

    const dataUrl = loadedImages[i];

    if (dataUrl) {
      try {
        doc.addImage(dataUrl, inferImageFormat(dataUrl), x, y, photoW, photoH);
      } catch (e) {
        console.error('Error insertando imagen en PDF:', e);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(180, 0, 0);
        doc.text('ERROR IMG', x + photoW / 2, y + photoH / 2, { align: 'center' });
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`FOTO ${i + 1}`, x + photoW / 2, y + photoH / 2, { align: 'center' });
    }
  }
}

function getPhotoQuestions(data: MaintenanceChecklistPDFData) {
  return [...data.questions]
    .filter(
      (q) =>
        q.status !== 'not_applicable' &&
        q.status !== 'out_of_period' &&
        questionRequiresPhotos(q)
    )
    .sort((a, b) => a.number - b.number);
}

async function drawPhotographicRecord(
  doc: jsPDF,
  data: MaintenanceChecklistPDFData,
  logoDataUrl: string | null
) {
  const questions = getPhotoQuestions(data);
  if (questions.length === 0) return;

  doc.addPage();
  let y = drawHeader(doc, logoDataUrl);

  const blueRgb = hexToRgb(COLORS.blue);
  const lightGrayRgb = hexToRgb(COLORS.lightGray);
  const redRgb = hexToRgb(COLORS.red);

  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('REGISTRO FOTOGRÁFICO', MARGIN + 3, y + 5.5);
  y += 12;

  let currentSection = '';

  for (const q of questions) {
    const photos = (q.photos || []).filter(Boolean).slice(0, 4);
    const title = `${q.number}.- ${q.text}`;
    const titleLines = doc.splitTextToSize(title, PAGE_WIDTH - 2 * MARGIN);

    const blockHeight =
      (q.section !== currentSection ? 10 : 0) +
      titleLines.length * 4 +
      (q.status === 'rejected' ? 8 : 0) +
      36 + 4;

    if (y + blockHeight > PAGE_HEIGHT - 15) {
      doc.addPage();
      y = drawHeader(doc, logoDataUrl);
      doc.setFillColor(...blueRgb);
      doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('REGISTRO FOTOGRÁFICO', MARGIN + 3, y + 5.5);
      y += 12;
      currentSection = '';
    }

    if (q.section !== currentSection) {
      doc.setFillColor(...lightGrayRgb);
      doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...blueRgb);
      doc.text(q.section.toUpperCase(), MARGIN + 2, y + 4.8);
      y += 10;
      currentSection = q.section;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(titleLines, MARGIN, y);
    y += titleLines.length * 4 + 2;

    if (q.status === 'rejected') {
      doc.setFillColor(...redRgb);
      doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 6, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text('OBSERVACIÓN NEGATIVA', MARGIN + 2, y + 4.2);
      y += 8;
    }

    await drawPhotoGrid(doc, photos, y);
    y += 36;
  }
}

function addPageNumbers(doc: jsPDF) {
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 5, { align: 'right' });
    doc.text('Documento generado por MIREGA', MARGIN, PAGE_HEIGHT - 5);
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

  const logoDataUrl = await loadLogoDataUrl('/logo_color.png');

  let y = drawHeader(doc, logoDataUrl);
  y = drawGeneralInfo(doc, data, y);
  y = drawLegend(doc, y);
  y = drawChecklist(doc, data, y);

  drawSignature(doc, data, PAGE_HEIGHT - 32);
  drawObservationsPage(doc, data, logoDataUrl);
  await drawPhotographicRecord(doc, data, logoDataUrl);
  addPageNumbers(doc);

  return doc.output('blob');
}