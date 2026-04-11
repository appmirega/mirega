import jsPDF from 'jspdf'

export type MaintenanceQuestionStatus =
  | 'approved'
  | 'rejected'
  | 'not_applicable'
  | 'out_of_period'

export interface MaintenanceChecklistQuestion {
  id?: string
  number: number
  section: string
  text: string
  status: MaintenanceQuestionStatus
  observations?: string | null
  photos?: string[]
}

export interface MaintenanceChecklistPDFData {
  clientName: string
  clientAddress?: string | null
  elevatorNumber?: number
  month: number
  year: number
  completionDate?: string
  technicianName: string
  folioNumber?: number | string
  certificationStatus?: string
  questions: MaintenanceChecklistQuestion[]
  signature?: {
    signerName: string
    signatureDataUrl: string
  }
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 10

const COLORS = {
  blue: [39, 58, 143],
  green: [68, 172, 76],
  red: [225, 22, 43],
  gray: [180, 180, 180],
  cyan: [0, 150, 255],
}

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function formatDate(date?: string) {
  if (!date) return '-'
  const d = new Date(date)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

function getCertificationStatusText(status?: string) {
  if (!status) return '-'
  if (status === 'vigente') return 'Vigente'
  if (status === 'vencida') return 'Vencida'
  return 'No legible'
}

// ================= HEADER =================
function addHeader(doc: jsPDF, logo?: string | null) {
  const centerX = PAGE_WIDTH / 2
  const y = MARGIN

  if (logo) {
    doc.addImage(logo, 'PNG', MARGIN, y + 2, 24, 18)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COLORS.blue)
  doc.text('INFORME MANTENIMIENTO', centerX, y + 8, { align: 'center' })

  doc.setFontSize(13)
  doc.text('INSPECCIÓN MENSUAL', centerX, y + 15, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(90)

  doc.text(
    'MIREGA ASCENSORES LTDA. | Av. Pedro de Valdivia 273 - Of. 1406 Providencia | +56956087972 | contacto@mirega.cl | www.mirega.cl',
    centerX,
    y + 22,
    { align: 'center' }
  )

  doc.line(MARGIN, y + 25, PAGE_WIDTH - MARGIN, y + 25)

  return y + 30
}

// ================= INFO =================
function drawGeneralInfo(doc: jsPDF, data: MaintenanceChecklistPDFData, y: number) {
  doc.setFillColor(...COLORS.blue)
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F')

  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('INFORMACIÓN GENERAL', MARGIN + 3, y + 5.5)

  y += 12

  const draw = (label: string, value: string, x: number) => {
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(label, x, y)

    doc.setFont('helvetica', 'normal')
    doc.text(value || '-', x + 35, y)
  }

  draw('Edificio:', data.clientName, MARGIN)
  draw('Periodo:', `${MONTHS[data.month - 1]} ${data.year}`, PAGE_WIDTH / 2)
  y += 6

  draw('Dirección:', data.clientAddress || '-', MARGIN)
  draw('Ascensor:', `#${data.elevatorNumber || '-'}`, PAGE_WIDTH / 2)
  y += 6

  draw('Técnico:', data.technicianName, MARGIN)
  draw('Fecha:', formatDate(data.completionDate), PAGE_WIDTH / 2)
  y += 6

  draw('Certificación:', getCertificationStatusText(data.certificationStatus), MARGIN)
  draw('Folio:', String(data.folioNumber || 'Pendiente'), PAGE_WIDTH / 2)

  return y + 6
}

// ================= LEYENDA =================
function drawLegend(doc: jsPDF, y: number) {
  y += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('Simbología del checklist:', MARGIN, y)

  y += 5

  const drawItem = (text: string, color: number[], x: number) => {
    doc.setFillColor(...color)
    doc.circle(x, y, 2, 'F')
    doc.setTextColor(0)
    doc.text(text, x + 5, y + 1)
  }

  drawItem('Aprobado', COLORS.green, MARGIN)
  drawItem('Observación', COLORS.red, MARGIN + 50)
  drawItem('Fuera periodo', COLORS.cyan, MARGIN + 100)
  drawItem('No aplica', COLORS.gray, MARGIN + 150)

  return y + 6
}

// ================= CHECKLIST =================
function drawChecklist(doc: jsPDF, data: MaintenanceChecklistPDFData, y: number) {
  doc.setFillColor(...COLORS.blue)
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F')

  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('CHECKLIST MANTENIMIENTO', MARGIN + 3, y + 5.5)

  y += 10

  const grouped: Record<string, MaintenanceChecklistQuestion[]> = {}

  data.questions.forEach(q => {
    if (!grouped[q.section]) grouped[q.section] = []
    grouped[q.section].push(q)
  })

  Object.keys(grouped).forEach(section => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.blue)

    doc.text(section.toUpperCase(), MARGIN, y)
    y += 5

    grouped[section].forEach(q => {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)

      const text = `${q.number}. ${q.text}`
      const lines = doc.splitTextToSize(text, PAGE_WIDTH - 25)

      doc.text(lines, MARGIN + 3, y)

      let color = COLORS.gray
      if (q.status === 'approved') color = COLORS.green
      if (q.status === 'rejected') color = COLORS.red

      doc.setFillColor(...color)
      doc.circle(PAGE_WIDTH - 15, y + 1, 2, 'F')

      y += lines.length * 3.5 + 2

      if (y > PAGE_HEIGHT - 40) {
        doc.addPage()
        y = addHeader(doc)
      }
    })

    y += 3
  })

  return y
}

// ================= FIRMA =================
function drawSignature(doc: jsPDF, data: MaintenanceChecklistPDFData) {
  const y = PAGE_HEIGHT - 35

  doc.setFillColor(...COLORS.blue)
  doc.rect(PAGE_WIDTH / 2 - 40, y, 80, 6, 'F')

  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('FIRMA DE RECEPCIÓN', PAGE_WIDTH / 2, y + 4, { align: 'center' })

  doc.setDrawColor(...COLORS.blue)
  doc.rect(PAGE_WIDTH / 2 - 40, y + 6, 80, 20)

  if (data.signature?.signatureDataUrl) {
    doc.addImage(
      data.signature.signatureDataUrl,
      'PNG',
      PAGE_WIDTH / 2 - 30,
      y + 8,
      60,
      12
    )
  }

  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')
  doc.text(data.signature?.signerName || '', PAGE_WIDTH / 2, y + 28, { align: 'center' })
}

// ================= EXPORT =================
export async function generateMaintenanceChecklistPDF(
  data: MaintenanceChecklistPDFData
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  let y = addHeader(doc)
  y = drawGeneralInfo(doc, data, y)
  y = drawLegend(doc, y)
  y = drawChecklist(doc, data, y)

  drawSignature(doc, data)

  return doc.output('blob')
}