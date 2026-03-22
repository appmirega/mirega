import jsPDF from 'jspdf';

export interface WorkOrderClosurePDFData {
  workOrderNumber?: number | null;
  title: string;
  clientName?: string | null;
  buildingName?: string | null;
  elevatorName?: string | null;
  technicianName?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  actualHours?: number | null;
  technicalReport: string;
  clientReceptionName?: string | null;
  signatureDataUrl?: string | null;
  installedParts?: string[];
  beforePhotos?: string[];
  afterPhotos?: string[];
  evidencePhotos?: string[];
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CL');
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 5
) {
  const lines = doc.splitTextToSize(text || '—', maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(30, 41, 59);
  doc.rect(10, y, 190, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 13, y + 5.5);
  return y + 12;
}

function ensurePageSpace(doc: jsPDF, y: number, needed = 20) {
  if (y + needed > 285) {
    doc.addPage();
    return 15;
  }
  return y;
}

export async function generateWorkOrderClosurePDF(
  data: WorkOrderClosurePDFData
): Promise<Blob> {
  const doc = new jsPDF('p', 'mm', 'a4');
  let y = 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('CIERRE TÉCNICO DE ORDEN DE TRABAJO', 105, y, { align: 'center' });

  y += 8;
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(
    data.workOrderNumber ? `OT-${data.workOrderNumber}` : 'OT',
    105,
    y,
    { align: 'center' }
  );

  y += 12;

  y = addSectionTitle(doc, 'INFORMACIÓN GENERAL', y);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);

  const infoRows: Array<[string, string]> = [
    ['Título', data.title || '—'],
    ['Cliente', data.clientName || '—'],
    ['Edificio', data.buildingName || '—'],
    ['Ascensor', data.elevatorName || '—'],
    ['Técnico', data.technicianName || '—'],
    ['Inicio', formatDateTime(data.startedAt)],
    ['Término', formatDateTime(data.completedAt)],
    ['Horas reales', data.actualHours !== null && data.actualHours !== undefined ? String(data.actualHours) : '—'],
    ['Recibe', data.clientReceptionName || '—'],
  ];

  for (const [label, value] of infoRows) {
    y = ensurePageSpace(doc, y, 8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, 12, y);
    doc.setFont('helvetica', 'normal');
    y = addWrappedText(doc, value, 45, y, 150, 5);
    y += 1;
  }

  y += 4;
  y = ensurePageSpace(doc, y, 50);
  y = addSectionTitle(doc, 'INFORME TÉCNICO', y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  y = addWrappedText(doc, data.technicalReport || '—', 12, y, 185, 5);

  if (data.installedParts && data.installedParts.length > 0) {
    y += 6;
    y = ensurePageSpace(doc, y, 30);
    y = addSectionTitle(doc, 'REPUESTOS INSTALADOS', y);

    for (const part of data.installedParts) {
      y = ensurePageSpace(doc, y, 8);
      doc.setFont('helvetica', 'normal');
      doc.text(`• ${part}`, 14, y);
      y += 6;
    }
  }

  const photoGroups = [
    { title: 'FOTOS ANTES', items: data.beforePhotos || [] },
    { title: 'FOTOS DESPUÉS', items: data.afterPhotos || [] },
    { title: 'FOTOS EVIDENCIA', items: data.evidencePhotos || [] },
  ].filter((group) => group.items.length > 0);

  for (const group of photoGroups) {
    y += 4;
    y = ensurePageSpace(doc, y, 20);
    y = addSectionTitle(doc, group.title, y);

    for (const url of group.items) {
      y = ensurePageSpace(doc, y, 8);
      doc.setFont('helvetica', 'normal');
      y = addWrappedText(doc, `• ${url}`, 14, y, 180, 5);
      y += 1;
    }
  }

  y += 6;
  y = ensurePageSpace(doc, y, 40);
  y = addSectionTitle(doc, 'FIRMA DE RECEPCIÓN', y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Nombre:', 12, y);
  doc.setFont('helvetica', 'normal');
  doc.text(data.clientReceptionName || '—', 35, y);

  y += 8;

  if (data.signatureDataUrl) {
    try {
      doc.addImage(data.signatureDataUrl, 'PNG', 12, y, 70, 28);
      y += 32;
    } catch (error) {
      console.error('No se pudo incrustar la firma en el PDF:', error);
      doc.text('Firma no disponible en el PDF.', 12, y);
      y += 8;
    }
  } else {
    doc.text('Sin firma registrada.', 12, y);
    y += 8;
  }

  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Documento generado automáticamente el ${new Date().toLocaleString('es-CL')}`,
    105,
    290,
    { align: 'center' }
  );

  return doc.output('blob');
}