import jsPDF from 'jspdf'

export interface MaintenanceChecklistPDFData {
  clientName: string
  clientAddress?: string
  elevatorNumber?: number
  month: number
  year: number
  technicianName: string
  completionDate?: string
  folioNumber?: string | number
  certificationStatus?: string
  questions: any[]
  signature?: {
    signerName: string
    signatureDataUrl: string
  }
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 10

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

// ================= HEADER =================
function addHeader(doc: jsPDF) {
  const centerX = PAGE_WIDTH / 2
  const y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('INFORME DE MANTENIMIENTO', centerX, y + 8, { align: 'center' })

  doc.setFontSize(11)
  doc.text('INSPECCIÓN MENSUAL', centerX, y + 14, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)

  doc.text(
    'MIREGA ASCENSORES LTDA. | Av. Pedro de Valdivia 273 - Of. 1406 Providencia | +56956087972 | contacto@mirega.cl | www.mirega.cl',
    centerX,
    y + 20,
    { align: 'center' }
  )

  doc.line(MARGIN, y + 23, PAGE_WIDTH - MARGIN, y + 23)

  return y + 28
}

// ================= INFO =================
function drawGeneralInfo(doc: jsPDF, data: MaintenanceChecklistPDFData, y: number) {
  const leftX = MARGIN
  const rightX = PAGE_WIDTH / 2

  const draw = (label: string, value: string, x: number, yPos: number) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(label, x, yPos)

    doc.setFont('helvetica', 'normal')
    doc.text(value || '-', x + 35, yPos)
  }

  draw('Edificio:', data.clientName, leftX, y)
  draw('Periodo:', `${MONTHS[data.month - 1]} ${data.year}`, rightX, y)
  y += 6

  draw('Dirección:', data.clientAddress || '-', leftX, y)
  draw('Ascensor:', `#${data.elevatorNumber || '-'}`, rightX, y)
  y += 6

  draw('Técnico:', data.technicianName, leftX, y)
  draw('Fecha:', data.completionDate || '-', rightX, y)
  y += 6

  draw('Certificación:', data.certificationStatus || '-', leftX, y)
  draw('Folio:', String(data.folioNumber || 'Pendiente'), rightX, y)

  return y + 6
}

// ================= CHECKLIST =================
function drawChecklist(doc: jsPDF, data: MaintenanceChecklistPDFData, y: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('CHECKLIST', MARGIN, y)

  y += 5

  const colWidth = (PAGE_WIDTH - 2 * MARGIN - 10) / 2

  let leftY = y
  let rightY = y

  data.questions
    .sort((a, b) => a.number - b.number)
    .forEach((q, index) => {
      const col = index % 2 === 0 ? 'left' : 'right'
      const x = col === 'left' ? MARGIN : MARGIN + colWidth + 10
      const yPos = col === 'left' ? leftY : rightY

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)

      const text = `${q.number}. ${q.text}`
      const lines = doc.splitTextToSize(text, colWidth - 8)

      doc.text(lines, x, yPos)

      let color = [200, 200, 200]
      if (q.status === 'approved') color = [0, 180, 0]
      if (q.status === 'rejected') color = [200, 0, 0]

      doc.setFillColor(...color)
      doc.circle(x + colWidth - 5, yPos - 1, 2, 'F')

      const height = lines.length * 3.5

      if (col === 'left') leftY += height + 2
      else rightY += height + 2
    })

  return Math.max(leftY, rightY)
}

// ================= FIRMA =================
function drawSignature(doc: jsPDF, data: MaintenanceChecklistPDFData) {
  const y = PAGE_HEIGHT - 35

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('FIRMA DE RECEPCIÓN', PAGE_WIDTH / 2, y, { align: 'center' })

  doc.rect(PAGE_WIDTH / 2 - 30, y + 2, 60, 20)

  if (data.signature?.signatureDataUrl) {
    doc.addImage(
      data.signature.signatureDataUrl,
      'PNG',
      PAGE_WIDTH / 2 - 25,
      y + 5,
      50,
      12
    )
  }

  doc.setFont('helvetica', 'normal')
  doc.text(data.signature?.signerName || '', PAGE_WIDTH / 2, y + 25, { align: 'center' })
}

// ================= EXPORT (CLAVE) =================
export async function generateMaintenanceChecklistPDF(
  data: MaintenanceChecklistPDFData
): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  let y = addHeader(doc)
  y = drawGeneralInfo(doc, data, y)
  y = drawChecklist(doc, data, y)

  drawSignature(doc, data)

  return doc.output('blob')
}