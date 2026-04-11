import jsPDF from 'jspdf';

export type CertificationStatus = 'sin_info' | 'vigente' | 'vencida' | 'por_vencer' | 'no_legible';
export type MaintenanceQuestionStatus = 'approved' | 'rejected' | 'not_applicable' | 'out_of_period';

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
  gray: '#d1d5db',
  lightGray: '#f3f4f6',
  cyan: '#7dd3fc',
};

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
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
    case 'vigente': return 'Vigente';
    case 'vencida': return 'Vencida';
    case 'por_vencer': return 'Por vencer';
    case 'no_legible': return 'No legible';
    default: return 'No legible';
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

function addHeader(doc: jsPDF, logoDataUrl: string | null) {
  const darkBlue = hexToRgb(COLORS.blue);
  const centerX = PAGE_WIDTH / 2;
  const y = MARGIN;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, inferImageFormat(logoDataUrl), MARGIN, y + 2, 24, 18);
    } catch (e) {
      console.error('Error logo:', e);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkBlue);
  doc.setFontSize(16);
  doc.text('INFORME MANTENIMIENTO', centerX, y + 8, { align: 'center' });
  doc.setFontSize(13);
  doc.text('INSPECCIÓN MENSUAL', centerX, y + 15, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(
    'MIREGA ASCENSORES LTDA. | Pedro de Valdivia N°255 – Of. 202, Providencia | +56956087972 | contacto@mirega.cl | www.mirega.cl',
    centerX,
    y + 22,
    { align: 'center' }
  );

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + 25, PAGE_WIDTH - MARGIN, y + 25);
  return y + 30;
}

function drawSectionTitle(
  doc: jsPDF,
  title: string,
  y: number,
  fill = COLORS.blue,
  textColor: [number, number, number] = [255, 255, 255]
) {
  doc.setFillColor(...hexToRgb(fill));
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  doc.text(title, MARGIN + 3, y + 5.5);
  return y + 12;
}

function drawGeneralInfo(doc: jsPDF, data: MaintenanceChecklistPDFData, startY: number) {
  let y = drawSectionTitle(doc, 'INFORMACIÓN GENERAL', startY);

  const blueRgb = hexToRgb(COLORS.blue);
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
    doc.text(value, x + labelWidth + 2, yPos + 4.2);
  };

  drawField('Cliente:', data.clientName || '', leftCol, y);
  drawField('Periodo:', MONTHS[data.month - 1] || '', rightCol, y);
  y += fieldHeight + 1.5;

  drawField('Dirección:', data.clientAddress || '', leftCol, y);
  drawField(
    'N° Ascensor:',
    data.elevatorNumber ? `Ascensor ${data.elevatorNumber}` : 'No especificado',
    rightCol,
    y
  );
  y += fieldHeight + 1.5;

  drawField('Fecha:', formatDate(data.completionDate), leftCol, y);
  drawField('Técnico:', data.technicianName || '', rightCol, y);
  y += fieldHeight + 1.5;

  drawField('Última Certif.:', data.lastCertificationDate || 'No legible', leftCol, y);
  drawField('Próxima Certif.:', data.nextCertificationDate || 'No legible', rightCol, y);
  y += fieldHeight + 1.5;

  drawField('Vigencia:', getCertificationStatusText(data.certificationStatus), leftCol, y);
  drawField('Folio:', data.folioNumber ? String(data.folioNumber) : 'Pendiente', rightCol, y);

  return y + 8;
}

function drawLegend(doc: jsPDF, y: number) {
  const greenRgb = hexToRgb(COLORS.green);
  const redRgb = hexToRgb(COLORS.red);
  const cyanRgb = hexToRgb(COLORS.cyan);
  const grayRgb = hexToRgb(COLORS.gray);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Simbología del checklist:', MARGIN, y);

  doc.setFont('helvetica', 'normal');
  let x = MARGIN + 42;
  const circleRadius = 2.5;
  const spacing = 8;

  doc.text('Aprobado:', x, y); x += doc.getTextWidth('Aprobado:') + 3;
  doc.setFillColor(...greenRgb); doc.circle(x, y - 1.5, circleRadius, 'F'); x += circleRadius * 2 + spacing;

  doc.text('Observación:', x, y); x += doc.getTextWidth('Observación:') + 3;
  doc.setFillColor(...redRgb); doc.circle(x, y - 1.5, circleRadius, 'F'); x += circleRadius * 2 + spacing;

  doc.text('Fuera de periodo:', x, y); x += doc.getTextWidth('Fuera de periodo:') + 3;
  doc.setFillColor(...cyanRgb); doc.circle(x, y - 1.5, circleRadius, 'F'); x += circleRadius * 2 + spacing;

  doc.text('No aplica:', x, y); x += doc.getTextWidth('No aplica:') + 3;
  doc.setFillColor(...grayRgb); doc.circle(x, y - 1.5, circleRadius, 'F');

  return y + 5;
}

function drawChecklist(doc: jsPDF, data: MaintenanceChecklistPDFData, startY: number) {
  let y = drawSectionTitle(doc, 'CHECKLIST MANTENIMIENTO', startY);

  const orderedQuestions = [...data.questions].sort((a, b) => a.number - b.number);
  const grouped = orderedQuestions.reduce((acc, q) => {
    if (!acc[q.section]) acc[q.section] = [];
    acc[q.section].push(q);
    return acc;
  }, {} as Record<string, MaintenanceChecklistQuestion[]>);

  const orderedSections: string[] = [];
  orderedQuestions.forEach((q) => {
    if (!orderedSections.includes(q.section)) orderedSections.push(q.section);
  });

  const leftSections = orderedSections.filter((_, i) => i % 2 === 0);
  const rightSections = orderedSections.filter((_, i) => i % 2 !== 0);

  const colWidth = 90;
  const leftX = MARGIN;
  const rightX = PAGE_WIDTH / 2 + 5;
  let leftY = y;
  let rightY = y;

  const drawQuestionStatus = (x: number, yPos: number, status: MaintenanceQuestionStatus) => {
    let fillColor = COLORS.gray;
    if (status === 'approved') fillColor = COLORS.green;
    else if (status === 'rejected') fillColor = COLORS.red;
    else if (status === 'out_of_period') fillColor = COLORS.cyan;

    doc.setFillColor(...hexToRgb(fillColor));
    doc.setDrawColor(100, 100, 100);
    doc.roundedRect(x, yPos - 3.5, 4.5, 4.5, 0.8, 0.8, 'FD');
  };

  const drawColumn = (sectionNames: string[], startX: number, startYPos: number) => {
    let currentY = startYPos;

    sectionNames.forEach((section) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...hexToRgb(COLORS.blue));
      doc.text(section.toUpperCase(), startX, currentY);
      currentY += 5;

      grouped[section].forEach((q) => {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.3);
        doc.setTextColor(0, 0, 0);
        const text = `${q.number}. ${q.text}`;
        const lines = doc.splitTextToSize(text, colWidth - 8);
        doc.text(lines, startX + 1, currentY);
        drawQuestionStatus(startX + colWidth - 6, currentY + 1.8, q.status);
        currentY += Math.max(lines.length * 3.5, 5);
      });

      currentY += 3;
    });

    return currentY;
  };

  leftY = drawColumn(leftSections, leftX, leftY);
  rightY = drawColumn(rightSections, rightX, rightY);

  return Math.max(leftY, rightY) + 4;
}

function drawSignature(doc: jsPDF, data: MaintenanceChecklistPDFData, y: number) {
  if (!data.signature) return;

  const boxW = 80;
  const boxH = 24;
  const centerX = PAGE_WIDTH / 2 - boxW / 2;

  doc.setFillColor(...hexToRgb(COLORS.blue));
  doc.rect(centerX, y, boxW, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(`RECEPCIONADO POR: ${data.signature.signerName || ''}`, centerX + 2, y + 4);

  doc.setDrawColor(...hexToRgb(COLORS.blue));
  doc.rect(centerX, y + 6, boxW, boxH);

  if (data.signature.signatureDataUrl) {
    try {
      doc.addImage(data.signature.signatureDataUrl, 'PNG', centerX + 10, y + 10, boxW - 20, boxH - 8);
    } catch (e) {
      console.error('Error firma:', e);
    }
  }
}

function drawFooter(doc: jsPDF, pageNumber: number, totalPages: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Documento generado por MIREGA', MARGIN, PAGE_HEIGHT - 8);
  doc.text(`Página ${pageNumber} de ${totalPages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' });
}

function drawObservationsSummaryPage(doc: jsPDF, data: MaintenanceChecklistPDFData, logoDataUrl: string | null) {
  doc.addPage();
  let y = addHeader(doc, logoDataUrl);
  y = drawSectionTitle(doc, 'OBSERVACIONES Y RESUMEN', y);

  const rejectedQuestions = [...data.questions]
    .filter((q) => q.status === 'rejected' && q.observations?.trim())
    .sort((a, b) => a.number - b.number);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  if (rejectedQuestions.length === 0) {
    doc.text('No se registraron observaciones negativas en el checklist.', MARGIN, y);
    y += 8;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones levantadas en el checklist', MARGIN, y);
    y += 6;

    rejectedQuestions.forEach((q, index) => {
      if (y > PAGE_HEIGHT - 25) {
        doc.addPage();
        y = addHeader(doc, logoDataUrl);
        y = drawSectionTitle(doc, 'OBSERVACIONES Y RESUMEN', y);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const title = `${index + 1}. [Pregunta ${q.number}] ${q.text}`;
      const titleLines = doc.splitTextToSize(title, PAGE_WIDTH - 2 * MARGIN);
      doc.text(titleLines, MARGIN, y);
      y += titleLines.length * 4;

      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(q.observations || '', PAGE_WIDTH - 2 * MARGIN);
      doc.text(obsLines, MARGIN + 2, y + 1);
      y += obsLines.length * 4 + 5;
    });
  }

  if (data.additionalObservations?.length) {
    if (y > PAGE_HEIGHT - 40) {
      doc.addPage();
      y = addHeader(doc, logoDataUrl);
    }

    y = drawSectionTitle(doc, 'OBSERVACIONES ADICIONALES', y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    data.additionalObservations.forEach((obs) => {
      const text = `Observación ${obs.order}: ${obs.text}`;
      const lines = doc.splitTextToSize(text, PAGE_WIDTH - 2 * MARGIN);
      if (y + lines.length * 4 + 4 > PAGE_HEIGHT - 20) {
        doc.addPage();
        y = addHeader(doc, logoDataUrl);
        y = drawSectionTitle(doc, 'OBSERVACIONES ADICIONALES', y);
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

async function drawPhotographicRecord(doc: jsPDF, data: MaintenanceChecklistPDFData, logoDataUrl: string | null) {
  const questions = getPhotoQuestions(data);
  if (questions.length === 0) return;

  doc.addPage();
  let y = addHeader(doc, logoDataUrl);
  y = drawSectionTitle(doc, 'REGISTRO FOTOGRÁFICO', y);

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
      y = addHeader(doc, logoDataUrl);
      y = drawSectionTitle(doc, 'REGISTRO FOTOGRÁFICO', y);
      currentSection = '';
    }

    if (q.section !== currentSection) {
      doc.setFillColor(...hexToRgb(COLORS.lightGray));
      doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...hexToRgb(COLORS.blue));
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
      doc.setFillColor(...hexToRgb(COLORS.red));
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
    drawFooter(doc, i, totalPages);
  }
}

export async function generateMaintenanceChecklistPDF(data: MaintenanceChecklistPDFData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const logoDataUrl = await loadLogoDataUrl('/logo_color.png');

  let y = addHeader(doc, logoDataUrl);
  y = drawGeneralInfo(doc, data, y);
  y = drawLegend(doc, y);
  y = drawChecklist(doc, data, y);
  drawSignature(doc, data, PAGE_HEIGHT - 32);

  drawObservationsSummaryPage(doc, data, logoDataUrl);
  await drawPhotographicRecord(doc, data, logoDataUrl);
  addPageNumbers(doc);

  return doc.output('blob');
}
