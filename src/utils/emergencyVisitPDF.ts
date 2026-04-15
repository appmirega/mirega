import jsPDF from 'jspdf';
import { COMPANY_INFO } from '../config/company';

export interface EmergencyElevatorInfo {
  elevator_number: number;
  brand: string;
  model: string;
  location_name: string;
  initial_status: 'operational' | 'stopped';
  final_status: 'operational' | 'observation' | 'stopped';
}

export interface EmergencyVisitPDFData {
  visitId: string;
  clientName: string;
  clientAddress?: string | null;
  visitDate: string;
  visitStartTime: string;
  visitEndTime: string;
  technicianName: string;
  elevators: EmergencyElevatorInfo[];
  failureDescription: string;
  failurePhoto1Url?: string | null;
  failurePhoto2Url?: string | null;
  resolutionSummary: string;
  resolutionPhoto1Url?: string | null;
  resolutionPhoto2Url?: string | null;
  failureCause: 'normal_use' | 'third_party' | 'part_lifespan';
  finalStatus: 'operational' | 'observation' | 'stopped';
  observationUntil?: string | null;
  receiverName: string;
  signatureDataUrl: string;
  completedAt: string;
  serviceRequestType?: 'repair' | 'parts' | 'support' | null;
  serviceRequestDescription?: string | null;
  serviceRequestPriority?: 'low' | 'medium' | 'high' | 'critical' | null;
  serviceRequestTitle?: string | null;
}

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 10;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = PAGE_HEIGHT - 8;

const HEADER_HEIGHT = 24;
const HEADER_GAP = 6;
const SECTION_BAR_HEIGHT = 7;
const SECTION_BAR_GAP_BELOW = 5;

const COLORS = {
  blue: '#2f46a1',
  green: '#44ac4c',
  red: '#e11d2e',
  orange: '#f59e0b',
  yellow: '#fbbf24',
  black: '#1d1d1b',
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

function formatDate(dateStr: string, fallback = 'No registrado'): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return sanitizeText(dateStr, fallback);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}/${d.getFullYear()}`;
}

function formatTime(timeStr: string): string {
  if (!timeStr) return 'No registrado';
  const parts = timeStr.split(':');
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return sanitizeText(timeStr, 'No registrado');
}

function getFailureCauseLabel(cause: string): string {
  switch (cause) {
    case 'normal_use':
      return 'Falla por uso';
    case 'third_party':
      return 'Daño de terceros';
    case 'part_lifespan':
      return 'Vida útil del repuesto';
    default:
      return 'No especificado';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'operational':
      return 'Operativo';
    case 'observation':
      return 'En observación';
    case 'stopped':
      return 'Detenido';
    default:
      return 'No especificado';
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.error('Error al cargar imagen:', src);
      resolve(null);
    };
  });
}

function getImageFormat(src: string): 'PNG' | 'JPEG' {
  const normalized = src.toLowerCase();
  return normalized.includes('png') || normalized.startsWith('data:image/png')
    ? 'PNG'
    : 'JPEG';
}

function buildCompanyLine(): string {
  return `${COMPANY_INFO.name} | ${COMPANY_INFO.address} | ${COMPANY_INFO.phone} | ${COMPANY_INFO.email} | ${COMPANY_INFO.website}`;
}

function drawHeader(doc: jsPDF, logoImg: HTMLImageElement | null, logoSrc: string): number {
  const topY = MARGIN;
  const blueRgb = hexToRgb(COLORS.blue);
  const darkRgb = hexToRgb(COLORS.dark);

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, topY, CONTENT_WIDTH, HEADER_HEIGHT);

  if (logoImg) {
    try {
      doc.addImage(logoImg, getImageFormat(logoSrc), MARGIN + 5, topY + 5, 18, 13);
    } catch (error) {
      console.error('No se pudo dibujar el logo', error);
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkRgb);
  doc.setFontSize(16);
  doc.text('REPORTE DE EMERGENCIA', PAGE_WIDTH / 2, topY + 8.5, {
    align: 'center',
  });

  doc.setFontSize(11.3);
  doc.text('SERVICIO DE ATENCIÓN', PAGE_WIDTH / 2, topY + 15.2, {
    align: 'center',
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(...blueRgb);
  doc.text(buildCompanyLine(), PAGE_WIDTH / 2, topY + 20.4, {
    align: 'center',
    maxWidth: CONTENT_WIDTH - 36,
  });

  return topY + HEADER_HEIGHT + HEADER_GAP;
}

function drawSectionBar(doc: jsPDF, text: string, y: number, colorHex = COLORS.blue): number {
  doc.setFillColor(...hexToRgb(colorHex));
  doc.rect(MARGIN, y, CONTENT_WIDTH, SECTION_BAR_HEIGHT, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
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
  width: number
): void {
  const labelWidth = 28;
  const fieldHeight = 7;
  const valueWidth = width - labelWidth;

  doc.setFillColor(...hexToRgb(COLORS.blue));
  doc.rect(x, y, labelWidth, fieldHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(label, x + 1.5, y + 4.7);

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.setFillColor(255, 255, 255);
  doc.rect(x + labelWidth, y, valueWidth, fieldHeight, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(0, 0, 0);
  const line = doc.splitTextToSize(sanitizeText(value, ''), valueWidth - 3)[0] || '';
  doc.text(line, x + labelWidth + 1.5, y + 4.7);
}

function drawGeneralInfo(doc: jsPDF, data: EmergencyVisitPDFData, startY: number): number {
  let y = drawSectionBar(doc, 'INFORMACIÓN GENERAL', startY);

  const colGap = 4;
  const colWidth = (CONTENT_WIDTH - colGap) / 2;
  const leftX = MARGIN;
  const rightX = MARGIN + colWidth + colGap;

  drawLabeledField(doc, 'Edificio', sanitizeText(data.clientName, ''), leftX, y, colWidth);
  drawLabeledField(doc, 'Fecha', formatDate(data.visitDate), rightX, y, colWidth);
  y += 8.5;

  drawLabeledField(
    doc,
    'Dirección',
    sanitizeText(data.clientAddress, 'No especificada'),
    leftX,
    y,
    colWidth
  );
  drawLabeledField(doc, 'Hora inicio', formatTime(data.visitStartTime), rightX, y, colWidth);
  y += 8.5;

  drawLabeledField(doc, 'Técnico', sanitizeText(data.technicianName, ''), leftX, y, colWidth);
  drawLabeledField(doc, 'Hora cierre', formatTime(data.visitEndTime), rightX, y, colWidth);

  return y + 10;
}

function drawElevators(doc: jsPDF, data: EmergencyVisitPDFData, startY: number): number {
  let barColor = COLORS.green;
  const hasObservation = data.elevators.some((e) => e.final_status === 'observation');
  const hasStopped = data.elevators.some((e) => e.final_status === 'stopped');

  if (hasStopped) barColor = COLORS.red;
  else if (hasObservation) barColor = COLORS.yellow;

  let y = drawSectionBar(doc, 'ASCENSORES ATENDIDOS', startY, barColor);

  const colWidths = [38, 37, 38, 77];
  const rowHeight = 7;
  const headers = ['Ascensor', 'Estado inicial', 'Estado final', 'Clasificación de la falla'];

  doc.setFillColor(230, 230, 230);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);

  let x = MARGIN;
  headers.forEach((header, i) => {
    doc.rect(x, y, colWidths[i], rowHeight, 'FD');
    doc.text(header, x + colWidths[i] / 2, y + 4.5, { align: 'center' });
    x += colWidths[i];
  });

  y += rowHeight;

  doc.setFont('helvetica', 'normal');
  data.elevators.forEach((elevator) => {
    x = MARGIN;

    doc.rect(x, y, colWidths[0], rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.text(`Ascensor N° ${elevator.elevator_number}`, x + colWidths[0] / 2, y + 4.5, {
      align: 'center',
    });
    x += colWidths[0];

    doc.setFont('helvetica', 'normal');
    doc.rect(x, y, colWidths[1], rowHeight);
    doc.text(
      elevator.initial_status === 'operational' ? 'Operativo' : 'Detenido',
      x + colWidths[1] / 2,
      y + 4.5,
      { align: 'center' }
    );
    x += colWidths[1];

    doc.rect(x, y, colWidths[2], rowHeight);
    doc.text(getStatusLabel(elevator.final_status), x + colWidths[2] / 2, y + 4.5, {
      align: 'center',
    });
    x += colWidths[2];

    doc.rect(x, y, colWidths[3], rowHeight);
    doc.setFontSize(7.2);
    const faultLabel = doc.splitTextToSize(getFailureCauseLabel(data.failureCause), colWidths[3] - 3)[0] || '';
    doc.text(faultLabel, x + 1.5, y + 4.5);

    y += rowHeight;
  });

  return y + 6;
}

function addPageWithHeader(doc: jsPDF, logoImg: HTMLImageElement | null, logoSrc: string): number {
  doc.addPage();
  return drawHeader(doc, logoImg, logoSrc);
}

function drawTextSection(
  doc: jsPDF,
  title: string,
  text: string,
  startY: number,
  logoImg: HTMLImageElement | null,
  logoSrc: string
): number {
  let y = startY;
  const blockHeightHint = 38;

  if (y + blockHeightHint > PAGE_HEIGHT - 24) {
    y = addPageWithHeader(doc, logoImg, logoSrc);
  }

  y = drawSectionBar(doc, title, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(0, 0, 0);

  const lines = doc.splitTextToSize(sanitizeText(text, 'Sin descripción'), CONTENT_WIDTH);
  lines.forEach((line: string) => {
    if (y > PAGE_HEIGHT - 18) {
      y = addPageWithHeader(doc, logoImg, logoSrc);
      y = drawSectionBar(doc, title, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(0, 0, 0);
    }
    doc.text(line, MARGIN, y);
    y += 4.5;
  });

  return y + 4;
}

function buildFinalStatusMessage(data: EmergencyVisitPDFData): string {
  const elevatorNumbers = data.elevators.map((e) => `N° ${e.elevator_number}`).join(', ');
  const plural = data.elevators.length > 1;

  const getPriorityLabel = (priority?: string | null): string => {
    switch (priority) {
      case 'critical':
        return 'CRÍTICA';
      case 'high':
        return 'ALTA';
      case 'medium':
        return 'MEDIA';
      case 'low':
        return 'BAJA';
      default:
        return 'MEDIA';
    }
  };

  let message = '';

  if (data.finalStatus === 'operational') {
    message = `Ascensor${plural ? 'es' : ''} ${elevatorNumbers} ${plural ? 'quedan' : 'queda'} operativo${plural ? 's' : ''} y sin anormalidades.`;

    if (data.serviceRequestType) {
      const priority = getPriorityLabel(data.serviceRequestPriority);
      message += '\n\n';

      if (data.serviceRequestType === 'parts') {
        message += `Se ha generado una solicitud de repuestos con prioridad ${priority}`;
        if (data.serviceRequestTitle) message += `: ${sanitizeText(data.serviceRequestTitle, '')}`;
        message += '. El supervisor coordinará la adquisición e instalación en fecha a definir.';
      } else if (data.serviceRequestType === 'support') {
        message += `Se ha generado una solicitud de soporte técnico con prioridad ${priority}`;
        if (data.serviceRequestTitle) message += `: ${sanitizeText(data.serviceRequestTitle, '')}`;
        message += '. Se requiere segunda opinión especializada. El supervisor coordinará la visita del técnico especialista.';
      } else if (data.serviceRequestType === 'repair') {
        message += `Se ha generado una solicitud de reparación con prioridad ${priority}`;
        if (data.serviceRequestTitle) message += `: ${sanitizeText(data.serviceRequestTitle, '')}`;
        message += '. El supervisor asignará técnico para realizar los trabajos necesarios.';
      }
    }
  } else if (data.finalStatus === 'observation') {
    const observationDate = data.observationUntil
      ? formatDate(data.observationUntil)
      : 'fecha a definir';

    message = `Ascensor${plural ? 'es' : ''} ${elevatorNumbers} ${plural ? 'quedarán' : 'quedará'} en observación hasta el ${observationDate}. Este estatus se cerrará automáticamente de no generarse ningún reporte durante el periodo señalado.`;

    if (data.serviceRequestType) {
      const priority = getPriorityLabel(data.serviceRequestPriority);
      message += '\n\n';

      if (data.serviceRequestType === 'parts') {
        message += `Adicionalmente, se ha generado una solicitud de repuestos con prioridad ${priority}`;
        if (data.serviceRequestTitle) message += `: ${sanitizeText(data.serviceRequestTitle, '')}`;
        message += ' para atención preventiva. El supervisor coordinará la instalación durante el periodo de observación.';
      } else if (data.serviceRequestType === 'support') {
        message += `Adicionalmente, se ha generado una solicitud de soporte técnico con prioridad ${priority}`;
        if (data.serviceRequestTitle) message += `: ${sanitizeText(data.serviceRequestTitle, '')}`;
        message += '. Se requiere una segunda visita con apoyo especializado durante el periodo de observación.';
      } else if (data.serviceRequestType === 'repair') {
        message += `Adicionalmente, se ha generado una solicitud de reparación con prioridad ${priority}`;
        if (data.serviceRequestTitle) message += `: ${sanitizeText(data.serviceRequestTitle, '')}`;
        message += '. Los trabajos se realizarán durante el periodo de observación.';
      }
    }
  } else if (data.finalStatus === 'stopped') {
    message = `Ascensor${plural ? 'es' : ''} ${elevatorNumbers} ${plural ? 'quedan' : 'queda'} DETENIDO${plural ? 'S' : ''} por seguridad.`;

    if (data.serviceRequestType) {
      const priority = getPriorityLabel(data.serviceRequestPriority);
      message += '\n\n';

      if (data.serviceRequestType === 'parts') {
        message += `Se ha generado una solicitud de repuestos con prioridad ${priority}`;
        if (data.serviceRequestTitle) message += `: ${sanitizeText(data.serviceRequestTitle, '')}`;
        message += '. El ascensor permanecerá fuera de servicio hasta la instalación y puesta en marcha del equipo.';
      } else if (data.serviceRequestType === 'support') {
        message += `Se ha generado una solicitud de soporte técnico con prioridad ${priority}`;
        if (data.serviceRequestTitle) message += `: ${sanitizeText(data.serviceRequestTitle, '')}`;
        message += '. Se requiere segunda opinión especializada para determinar el plan de acción. El ascensor permanecerá fuera de servicio hasta la resolución del diagnóstico.';
      } else if (data.serviceRequestType === 'repair') {
        message += `Se ha generado una solicitud de reparación con prioridad ${priority}`;
        if (data.serviceRequestTitle) message += `: ${sanitizeText(data.serviceRequestTitle, '')}`;
        message += '. El supervisor asignará técnico especializado. El ascensor permanecerá fuera de servicio hasta completar la reparación.';
      }
    }
  }

  return message;
}

function drawFinalStatus(
  doc: jsPDF,
  data: EmergencyVisitPDFData,
  startY: number,
  logoImg: HTMLImageElement | null,
  logoSrc: string
): number {
  return drawTextSection(
    doc,
    'ESTADO FINAL DEL SERVICIO',
    buildFinalStatusMessage(data),
    startY,
    logoImg,
    logoSrc
  );
}

function drawImageBox(
  doc: jsPDF,
  img: HTMLImageElement | null | undefined,
  format: 'PNG' | 'JPEG',
  x: number,
  y: number,
  w: number,
  h: number
): void {
  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.rect(x, y, w, h);

  if (!img) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sin foto', x + w / 2, y + h / 2, { align: 'center' });
    return;
  }

  const ratio = Math.min(w / img.width, h / img.height);
  const drawW = img.width * ratio;
  const drawH = img.height * ratio;
  const drawX = x + (w - drawW) / 2;
  const drawY = y + (h - drawH) / 2;

  try {
    doc.addImage(img, format, drawX, drawY, drawW, drawH);
  } catch (error) {
    console.error('Error al agregar imagen en PDF de emergencia:', error);
  }
}

function drawPhotosAndSignaturePage(
  doc: jsPDF,
  data: EmergencyVisitPDFData,
  logoImg: HTMLImageElement | null,
  logoSrc: string,
  failurePhoto1?: HTMLImageElement | null,
  failurePhoto2?: HTMLImageElement | null,
  resolutionPhoto1?: HTMLImageElement | null,
  resolutionPhoto2?: HTMLImageElement | null,
  signatureImg?: HTMLImageElement | null
): void {
  doc.addPage();

  let y = drawHeader(doc, logoImg, logoSrc);

  y = drawSectionBar(doc, 'REGISTRO FOTOGRÁFICO - ESTADO INICIAL', y);

  const photoWidth = 85;
  const photoHeight = 60;
  const spacing = 10;
  const startX = (PAGE_WIDTH - (2 * photoWidth + spacing)) / 2;

  drawImageBox(
    doc,
    failurePhoto1,
    getImageFormat(data.failurePhoto1Url || ''),
    startX,
    y,
    photoWidth,
    photoHeight
  );
  drawImageBox(
    doc,
    failurePhoto2,
    getImageFormat(data.failurePhoto2Url || ''),
    startX + photoWidth + spacing,
    y,
    photoWidth,
    photoHeight
  );

  y += photoHeight + 12;

  y = drawSectionBar(doc, 'REGISTRO FOTOGRÁFICO - ESTADO FINAL', y);

  drawImageBox(
    doc,
    resolutionPhoto1,
    getImageFormat(data.resolutionPhoto1Url || ''),
    startX,
    y,
    photoWidth,
    photoHeight
  );
  drawImageBox(
    doc,
    resolutionPhoto2,
    getImageFormat(data.resolutionPhoto2Url || ''),
    startX + photoWidth + spacing,
    y,
    photoWidth,
    photoHeight
  );

  y += photoHeight + 16;

  const blockWidth = 94;
  const blockX = (PAGE_WIDTH - blockWidth) / 2;

  doc.setFillColor(...hexToRgb(COLORS.blue));
  doc.roundedRect(blockX, y, blockWidth, 6, 1, 1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.3);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `RECEPCIONADO POR: ${sanitizeText(data.receiverName, 'NO ESPECIFICADO').toUpperCase()}`,
    PAGE_WIDTH / 2,
    y + 4.2,
    { align: 'center' }
  );

  y += 8;

  doc.setDrawColor(...hexToRgb(COLORS.lightBorder));
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(blockX, y, blockWidth, 24, 1, 1, 'FD');

  if (signatureImg) {
    try {
      const maxSigWidth = blockWidth - 20;
      const maxSigHeight = 16;
      const ratio = Math.min(maxSigWidth / signatureImg.width, maxSigHeight / signatureImg.height);
      const drawW = signatureImg.width * ratio;
      const drawH = signatureImg.height * ratio;
      const drawX = blockX + (blockWidth - drawW) / 2;
      const drawY = y + (24 - drawH) / 2;

      doc.addImage(signatureImg, 'PNG', drawX, drawY, drawW, drawH);
    } catch (error) {
      console.error('Error al agregar firma:', error);
    }
  }

  y += 28;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(`Fecha de servicio: ${formatDate(data.completedAt)}`, PAGE_WIDTH / 2, y, {
    align: 'center',
  });
}

function addPageNumbers(doc: jsPDF): void {
  const totalPages = doc.getNumberOfPages();

  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(100, 100, 100);
    doc.text(`Página ${i} de ${totalPages}`, PAGE_WIDTH / 2, FOOTER_Y, {
      align: 'center',
    });
    doc.text(
      'Este documento es válido como constancia del servicio de emergencia prestado.',
      PAGE_WIDTH / 2,
      FOOTER_Y + 3,
      { align: 'center' }
    );
  }
}

export async function generateEmergencyVisitPDF(data: EmergencyVisitPDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const logoSrc = '/logo_color.png';
  const logoImg = await loadImage(logoSrc);

  const failurePhoto1 = data.failurePhoto1Url ? await loadImage(data.failurePhoto1Url) : null;
  const failurePhoto2 = data.failurePhoto2Url ? await loadImage(data.failurePhoto2Url) : null;
  const resolutionPhoto1 = data.resolutionPhoto1Url ? await loadImage(data.resolutionPhoto1Url) : null;
  const resolutionPhoto2 = data.resolutionPhoto2Url ? await loadImage(data.resolutionPhoto2Url) : null;
  const signatureImg = data.signatureDataUrl ? await loadImage(data.signatureDataUrl) : null;

  let y = drawHeader(doc, logoImg, logoSrc);
  y = drawGeneralInfo(doc, data, y);
  y = drawElevators(doc, data, y);
  y = drawTextSection(
    doc,
    'DESCRIPCIÓN DE LA FALLA',
    data.failureDescription || 'Sin descripción',
    y,
    logoImg,
    logoSrc
  );
  y = drawTextSection(
    doc,
    'RESOLUCIÓN Y TRABAJOS REALIZADOS',
    data.resolutionSummary || 'Sin descripción',
    y,
    logoImg,
    logoSrc
  );
  drawFinalStatus(doc, data, y, logoImg, logoSrc);

  drawPhotosAndSignaturePage(
    doc,
    data,
    logoImg,
    logoSrc,
    failurePhoto1,
    failurePhoto2,
    resolutionPhoto1,
    resolutionPhoto2,
    signatureImg
  );

  addPageNumbers(doc);

  return doc.output('blob');
}