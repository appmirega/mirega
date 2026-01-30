// Reemplaza el archivo actual por este. Mejora layout, respetando márgenes y mostrando elevator_number.
import jsPDF from 'jspdf';

export type CertificationStatus = 'sin_info' | 'vigente' | 'vencida' | 'por_vencer' | 'no_legible';
export type MaintenanceQuestionStatus = 'approved' | 'rejected' | 'not_applicable' | 'out_of_period';

export interface MaintenanceChecklistQuestion {
  number: number;
  section: string;
  text: string;
  status: MaintenanceQuestionStatus;
  observations?: string | null;
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
  clientCode?: string | number;
  clientAddress?: string | null;
  clientContactName?: string | null;
  elevatorCode?: string | null;
  elevatorAlias?: string | null;
  elevatorIndex?: number | null; // ahora contiene elevator_number
  month: number;
  year: number;
  completionDate?: string;
  lastCertificationDate?: string | null;
  nextCertificationDate?: string | null;
  certificationNotLegible?: boolean;
  technicianName: string;
  technicianEmail?: string | null;
  certificationStatus?: CertificationStatus;
  observationSummary?: string;
  questions: MaintenanceChecklistQuestion[];
  rejectedQuestions?: MaintenanceChecklistQuestion[];
  signatureDataUrl?: string | null;
  signature?: ChecklistSignatureInfo | null;
}

// A4 mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 5;
const MARGIN_RIGHT = 5;
const MARGIN_TOP = 10;
const MARGIN_BOTTOM = 10;

const BLUE = { r: 39, g: 58, b: 143 };
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// helpers
function formatDate(dateStr?: string | null, fallback = 'No registrado') {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return fallback;
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
}

function mapCertificationStatus(s?: CertificationStatus) {
  if (s === 'vigente') return 'Vigente';
  if (s === 'vencida') return 'Vencida';
  if (s === 'por_vencer') return 'Por vencer';
  if (s === 'no_legible') return 'Información Irregular';
  return 'Información Irregular';
}

// Rutas de assets (poner en public/)
const LOGO_PATH = '/logo_color.png';
const ICONS = ['/icons/icono_1.png','/icons/icono_2.png','/icons/icono_3.png','/icons/icono_4.png'];

// cargar imagen con fallback
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
  });
}

// Intenta cargar fuentes custom en /fonts (Bolt.ttf / Lith.ttf). Si no existen, usa helvetica.
async function tryRegisterFonts(doc: any) {
  const addFont = async (url: string, vfsName: string, post: string) => {
    try {
      const r = await fetch(url);
      if (!r.ok) return false;
      const buf = await r.arrayBuffer();
      const bin = String.fromCharCode(...new Uint8Array(buf));
      const b64 = btoa(bin);
      doc.addFileToVFS(vfsName, b64);
      doc.addFont(vfsName, post, 'normal');
      return true;
    } catch { return false; }
  };

  // no await blocking critical path if fonts not present
  await addFont('/fonts/Bolt.ttf','Bolt.ttf','Bolt');
  await addFont('/fonts/Lith.ttf','Lith.ttf','Lith');
}

// DRAW HEADER — aseguro que respeta márgenes, iconos reducidos y texto en una sola línea si cabe
function drawHeader(doc: jsPDF, logoImg: HTMLImageElement | null, icons: (HTMLImageElement | null)[]) {
  const logoW = 35;
  const logoH = 30;
  if (logoImg) {
    try { doc.addImage(logoImg, 'PNG', MARGIN_LEFT, MARGIN_TOP, logoW, logoH); } catch (e) { }
  }

  const mainTitle = 'INFORME MANTENIMIENTO';
  const subTitle = 'INSPECCIÓN MENSUAL';

  doc.setFont('helvetica');
  doc.setFontSize(16);
  doc.setTextColor(0,0,0);

  const titleXcenter = PAGE_WIDTH / 2;
  const titleY = MARGIN_TOP + 16;
  doc.text(mainTitle, titleXcenter, titleY, { align: 'center' });

  doc.setFont('helvetica');
  doc.setFontSize(13);
  const titleWidth = doc.getTextWidth(mainTitle);
  const titleStartX = titleXcenter - titleWidth / 2;
  const subTitleY = titleY + 7;
  doc.text(subTitle, titleStartX, subTitleY);

  const companyText1 = 'MIREGA ASCENSORES LTDA. Pedro de Valdivia N°273 – Of. 1406, Providencia';
  const companyText2 = '+562 6469 1048 / +569 8793 3552';
  const companyText3 = 'contacto@mirega.cl';
  const companyText4 = 'www.mirega.cl';

  let fontSize = 9;
  doc.setFont('helvetica');
  doc.setFontSize(fontSize);

  const iconWidth = 3.5;
  const iconGap = 2;
  const segmentGap = 8;

  let totalWidth = (iconWidth + iconGap + doc.getTextWidth(companyText1)) + segmentGap + (iconWidth + iconGap + doc.getTextWidth(companyText2)) + segmentGap + (iconWidth + iconGap + doc.getTextWidth(companyText3)) + segmentGap + (iconWidth + iconGap + doc.getTextWidth(companyText4));
  const maxContentWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  if (totalWidth > maxContentWidth) { doc.setFontSize(8); }

  const infoY = subTitleY + 8;
  let cursorX = MARGIN_LEFT;
  const yIcon = infoY - 3;
  const yBaseline = infoY;

  try { if (icons[0]) doc.addImage(icons[0], 'PNG', cursorX, yIcon, iconWidth, 3); } catch(e) {}
  cursorX += iconWidth + iconGap;
  doc.text(companyText1, cursorX, yBaseline);
  cursorX += doc.getTextWidth(companyText1) + segmentGap;

  try { if (icons[1]) doc.addImage(icons[1], 'PNG', cursorX, yIcon, iconWidth, 3); } catch(e) {}
  cursorX += iconWidth + iconGap;
  doc.text(companyText2, cursorX, yBaseline);
  cursorX += doc.getTextWidth(companyText2) + segmentGap;

  try { if (icons[2]) doc.addImage(icons[2], 'PNG', cursorX, yIcon, iconWidth, 3); } catch(e) {}
  cursorX += iconWidth + iconGap;
  doc.text(companyText3, cursorX, yBaseline);
  cursorX += doc.getTextWidth(companyText3) + segmentGap;

  try { if (icons[3]) doc.addImage(icons[3], 'PNG', cursorX, yIcon, iconWidth, 3); } catch(e) {}
  cursorX += iconWidth + iconGap;
  doc.text(companyText4, cursorX, yBaseline);

  return infoY + 8;
}

function drawFolioBox(doc: jsPDF, folio: number | string | null, y: number) {
  const boxW = 36;
  const totalWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(MARGIN_LEFT, y - 6, totalWidth, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255,255,255);
  doc.text('INFORMACIÓN GENERAL', MARGIN_LEFT + 3, y - 1);

  doc.setFillColor(255,255,255);
  doc.roundedRect(PAGE_WIDTH - MARGIN_RIGHT - boxW, y + 1.5, boxW, 6, 1.5, 1.5, 'F');
  doc.setTextColor(0,0,0);
  doc.setFont('helvetica', 'normal');
  const label = folio != null ? String(folio) : 'PENDIENTE';
  doc.setFontSize(9);
  doc.text(label, PAGE_WIDTH - MARGIN_RIGHT - boxW / 2, y + 5, { align: 'center' });
}

function drawInfoGeneral(doc: jsPDF, data: MaintenanceChecklistPDFData, startY: number, folioNumber: number | string | null) {
  let y = startY;
  y = drawFolioBox(doc, folioNumber, y - 12);

  y += 12;
  doc.setFontSize(9);

  const totalWidth = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const leftGroupWidth = totalWidth * 0.55;
  const rightGroupWidth = totalWidth - leftGroupWidth;

  const leftLabelWidth = 28;
  const leftFieldWidth = leftGroupWidth - leftLabelWidth - 6;
  const rightLabelWidth = 35;
  const rightFieldWidth = rightGroupWidth - rightLabelWidth - 6;

  const xLeftLabel = MARGIN_LEFT;
  const xLeftField = xLeftLabel + leftLabelWidth + 4;
  const xRightLabel = MARGIN_LEFT + leftGroupWidth + 6;
  const xRightField = xRightLabel + rightLabelWidth + 4;

  const rowH = 7;
  let curY = y + 2;

  // Cliente
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setTextColor(255,255,255);
  doc.rect(xLeftLabel, curY, leftLabelWidth, rowH, 'F');
  doc.text('Cliente:', xLeftLabel + 3, curY + 4);
  doc.setFillColor(255,255,255);
  doc.setTextColor(0,0,0);
  doc.rect(xLeftField, curY, leftFieldWidth, rowH, 'F');
  doc.text((data.clientName ?? '').substring(0,45), xLeftField + 3, curY + 4);

  // Fecha
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setTextColor(255,255,255);
  doc.rect(xRightLabel, curY, 18, rowH, 'F');
  doc.text('Fecha:', xRightLabel + 3, curY + 4);
  doc.setFillColor(255,255,255);
  doc.setTextColor(0,0,0);
  doc.rect(xRightField, curY, 44, rowH, 'F');
  doc.text(formatDate(data.completionDate, 'No registrado'), xRightField + 3, curY + 4);

  curY += rowH + 3;

  // Dirección / Vigencia
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setTextColor(255,255,255);
  doc.rect(xLeftLabel, curY, leftLabelWidth, rowH, 'F');
  doc.text('Dirección:', xLeftLabel + 3, curY + 4);
  doc.setFillColor(255,255,255);
  doc.setTextColor(0,0,0);
  doc.rect(xLeftField, curY, leftFieldWidth, rowH, 'F');
  doc.text((data.clientAddress ?? '').substring(0,60), xLeftField + 3, curY + 4);

  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setTextColor(255,255,255);
  doc.rect(xRightLabel, curY, rightLabelWidth + 10, rowH, 'F');
  doc.text('Vigencia certificación:', xRightLabel + 3, curY + 4);
  doc.setFillColor(255,255,255);
  doc.setTextColor(0,0,0);
  doc.rect(xRightField, curY, rightFieldWidth, rowH, 'F');
  doc.text(mapCertificationStatus(data.certificationStatus), xRightField + 3, curY + 4);

  curY += rowH + 3;

  // Ascensor / Ultima certificación
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setTextColor(255,255,255);
  doc.rect(xLeftLabel, curY, leftLabelWidth, rowH, 'F');
  doc.text('N° de ascensor:', xLeftLabel + 3, curY + 4);
  doc.setFillColor(255,255,255);
  doc.setTextColor(0,0,0);
  doc.rect(xLeftField, curY, leftFieldWidth, rowH, 'F');
  const ascText = data.elevatorIndex ? `Ascensor ${data.elevatorIndex}` : (data.elevatorAlias || '');
  doc.text(String(ascText).substring(0,45), xLeftField + 3, curY + 4);

  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setTextColor(255,255,255);
  doc.rect(xRightLabel, curY, rightLabelWidth, rowH, 'F');
  doc.text('Última certificación:', xRightLabel + 3, curY + 4);
  doc.setFillColor(255,255,255);
  doc.setTextColor(0,0,0);
  doc.rect(xRightField, curY, rightFieldWidth, rowH, 'F');
  doc.text(data.lastCertificationDate ? formatDate(data.lastCertificationDate, 'No legible') : 'No legible', xRightField + 3, curY + 4);

  curY += rowH + 3;

  // Técnico / Próxima
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setTextColor(255,255,255);
  doc.rect(xLeftLabel, curY, leftLabelWidth, rowH, 'F');
  doc.text('Técnico:', xLeftLabel + 3, curY + 4);
  doc.setFillColor(255,255,255);
  doc.setTextColor(0,0,0);
  doc.rect(xLeftField, curY, leftFieldWidth, rowH, 'F');
  doc.text((data.technicianName ?? '').substring(0,45), xLeftField + 3, curY + 4);

  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.setTextColor(255,255,255);
  doc.rect(xRightLabel, curY, rightLabelWidth, rowH, 'F');
  doc.text('Próxima certificación', xRightLabel + 3, curY + 4);
  doc.setFillColor(255,255,255);
  doc.setTextColor(0,0,0);
  doc.rect(xRightField, curY, rightFieldWidth, rowH, 'F');
  doc.text(data.nextCertificationDate ? formatDate(data.nextCertificationDate, 'No legible') : 'No legible', xRightField + 3, curY + 4);

  return curY + rowH + 6;
}

function drawChecklistTwoColumns(doc: jsPDF, data: MaintenanceChecklistPDFData, startY:number) {
  let yLeft = startY;
  let yRight = startY;
  const gap = 8;
  const usableW = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
  const colW = (usableW - gap) / 2;
  const leftX = MARGIN_LEFT;
  const rightX = MARGIN_LEFT + colW + gap;
  const lineHeight = 4;
  const maxY = PAGE_HEIGHT - MARGIN_BOTTOM - 50;

  const total = data.questions.length;
  const half = Math.ceil(total / 2);
  const leftQuestions = data.questions.slice(0, half);
  const rightQuestions = data.questions.slice(half);

  const drawColumn = (arr: MaintenanceChecklistQuestion[], x:number, yStart:number) => {
    let y = yStart;
    doc.setFontSize(8);
    doc.setFont('helvetica','normal');
    for (const q of arr) {
      if (y > maxY) break;
      const txt = `${q.number}. ${q.text}`;
      const lines = doc.splitTextToSize(txt, colW - 18);
      doc.text(lines, x + 2, y + 3);
      const statusX = x + colW - 8;
      const statusY = y + (lines.length * lineHeight)/2 + 1;
      if (q.status === 'approved') {
        doc.setFillColor(212,237,218); doc.circle(statusX, statusY-1.8, 2.2, 'F');
        doc.setDrawColor(22,163,74); doc.setLineWidth(0.7);
        doc.line(statusX - 1.2, statusY-2.4, statusX - 0.4, statusY - 0.2);
        doc.line(statusX - 0.4, statusY - 0.2, statusX + 1.4, statusY - 3.6);
      } else if (q.status === 'rejected') {
        doc.setFillColor(248,215,218); doc.circle(statusX, statusY-1.8, 2.2, 'F');
        doc.setDrawColor(220,38,38); doc.setLineWidth(0.7);
        doc.line(statusX - 1.2, statusY-3, statusX + 1.2, statusY + 1);
        doc.line(statusX + 1.2, statusY-3, statusX - 1.2, statusY + 1);
      } else if (q.status === 'not_applicable') {
        doc.setTextColor(120,120,120); doc.setFontSize(6); doc.text('N/A', statusX, statusY, {align:'center'}); doc.setFontSize(8); doc.setTextColor(0,0,0);
      } else {
        doc.setTextColor(120,120,120); doc.setFontSize(6); doc.text('--', statusX, statusY, {align:'center'}); doc.setFontSize(8); doc.setTextColor(0,0,0);
      }
      y += lineHeight * Math.max(1, lines.length) + 2;
    }
    return y;
  };

  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(MARGIN_LEFT, startY, PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT, 8, 'F');
  doc.setTextColor(255,255,255);
  doc.setFont('helvetica','bold'); doc.setFontSize(10);
  doc.text('CHECKLIST MANTENIMIENTO', MARGIN_LEFT + 3, startY + 5.5);

  const contentStart = startY + 10;
  yLeft = drawColumn(leftQuestions, leftX, contentStart);
  yRight = drawColumn(rightQuestions, rightX, contentStart);
  return Math.max(yLeft, yRight) + 6;
}

function drawSignature(doc: jsPDF, data: MaintenanceChecklistPDFData, y:number) {
  const boxW = 90, boxH = 30;
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(MARGIN_LEFT, y, boxW, 6, 'F');
  doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(9);
  doc.text('RECEPCIONADO POR:', MARGIN_LEFT + 2, y + 4);

  doc.setFillColor(255,255,255); doc.setDrawColor(BLUE.r, BLUE.g, BLUE.b);
  doc.rect(MARGIN_LEFT, y + 7, boxW, boxH, 'F');
  if (data.signature?.signatureDataUrl) {
    try { doc.addImage(data.signature.signatureDataUrl, 'PNG', MARGIN_LEFT + 5, y + 9, boxW - 10, boxH - 10); } catch {}
  }
  doc.setTextColor(0,0,0); doc.setFont('helvetica','normal'); doc.setFontSize(8);
  const name = data.signature?.signerName?.toUpperCase() || 'SIN FIRMA REGISTRADA';
  doc.text(name, MARGIN_LEFT + boxW/2, y + boxH + 9, {align:'center'});
  const signedAt = data.signature?.signedAt ? formatDate(data.signature.signedAt) : '';
  if (signedAt) doc.text(signedAt, MARGIN_LEFT + boxW/2, y + boxH + 14, {align:'center'});
}

function drawObservationsPage(doc: jsPDF, data: MaintenanceChecklistPDFData, logo:HTMLImageElement|null, icons:(HTMLImageElement|null)[]) {
  const rejected = data.rejectedQuestions ?? data.questions.filter(q => q.status === 'rejected' && (q.observations ?? '').trim() !== '');
  if (!rejected.length) return;
  doc.addPage();
  let y = drawHeader(doc, logo, icons);
  y = drawFolioBox(doc, data.folioNumber ?? null, y + 2);
  y += 8;
  doc.setFont('helvetica'); doc.setFontSize(9); doc.setTextColor(0,0,0);
  const maxY = PAGE_HEIGHT - MARGIN_BOTTOM - 45;
  rejected.forEach((rq, idx) => {
    if (y > maxY) return;
    doc.setFont('helvetica','bold'); doc.text(`${idx+1}. [P${rq.number}] ${rq.section}`, MARGIN_LEFT + 2, y);
    y += 4;
    doc.setFont('helvetica','normal');
    const lines = doc.splitTextToSize(rq.text, PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - 4);
    doc.text(lines, MARGIN_LEFT + 2, y);
    y += lines.length * 4;
    if (rq.observations) {
      const obsLines = doc.splitTextToSize(`Observación: ${rq.observations}`, PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT - 4);
      doc.setFont('helvetica','italic'); doc.text(obsLines, MARGIN_LEFT + 2, y); y += obsLines.length * 4;
    }
    y += 6;
  });
  drawSignature(doc, data, PAGE_HEIGHT - MARGIN_BOTTOM - 40);
}

export async function generateMaintenanceChecklistPDF(data: MaintenanceChecklistPDFData): Promise<Blob> {
  const doc:any = new jsPDF({ unit:'mm', format:'a4' });
  // try register fonts (non-blocking)
  tryRegisterFonts(doc).catch(()=>{});
  const [logoImg, ...icons] = await Promise.all([ loadImage(LOGO_PATH), ...ICONS.map(p => loadImage(p)) ]);
  const folio = data.folioNumber ?? null;
  // header
  let y = drawHeader(doc, logoImg, icons);
  y = drawInfoGeneral(doc, data, y + 2, folio);
  // checklist two columns (all questions)
  y = drawChecklistTwoColumns(doc, data, y + 4);
  // firma
  drawSignature(doc, data, PAGE_HEIGHT - MARGIN_BOTTOM - 40);
  // observaciones
  drawObservationsPage(doc, data, logoImg, icons as any);
  // footer pages & numbering
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.setTextColor(120,120,120);
    doc.text(`Página ${p} / ${total}`, PAGE_WIDTH - MARGIN_RIGHT - 10, PAGE_HEIGHT - 4, { align: 'right' });
    doc.text('Documento generado por MIREGA', MARGIN_LEFT + 2, PAGE_HEIGHT - 4);
  }
  return doc.output('blob') as Blob;
}
