// 🔥 VERSION ESTABLE HOJA 1 ORDENADA

function addHeader(doc: jsPDF, logoDataUrl: string | null) {
  const centerX = PAGE_WIDTH / 2
  const y = MARGIN

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', MARGIN, y + 2, 22, 16)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('INFORME DE MANTENIMIENTO', centerX, y + 8, { align: 'center' })

  doc.setFontSize(11)
  doc.text('INSPECCIÓN MENSUAL', centerX, y + 14, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80)

  doc.text(
    'MIREGA ASCENSORES LTDA. | Av. Pedro de Valdivia 273 - Of. 1406 Providencia | +56956087972 | contacto@mirega.cl | www.mirega.cl',
    centerX,
    y + 20,
    { align: 'center' }
  )

  doc.line(MARGIN, y + 23, PAGE_WIDTH - MARGIN, y + 23)

  return y + 28
}

function drawGeneralInfo(doc: jsPDF, data: MaintenanceChecklistPDFData, startY: number) {
  let y = startY

  const fieldHeight = 6
  const spacing = 2

  const leftX = MARGIN
  const rightX = PAGE_WIDTH / 2

  const drawField = (label: string, value: string, x: number, yPos: number) => {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(label, x, yPos)

    doc.setFont('helvetica', 'normal')
    doc.text(value || '-', x + 35, yPos)
  }

  // 🔥 CAMBIO IMPORTANTE: nombre edificio
  drawField('Edificio:', data.clientName, leftX, y)
  drawField('Periodo:', `${MONTHS[data.month - 1]} ${data.year}`, rightX, y)
  y += fieldHeight

  drawField('Dirección:', data.clientAddress || '-', leftX, y)
  drawField('Ascensor:', `#${data.elevatorNumber || '-'}`, rightX, y)
  y += fieldHeight

  drawField('Técnico:', data.technicianName, leftX, y)
  drawField('Fecha:', formatDate(data.completionDate), rightX, y)
  y += fieldHeight

  drawField('Certificación:', getCertificationStatusText(data.certificationStatus), leftX, y)
  drawField('Folio:', data.folioNumber ? String(data.folioNumber) : 'Pendiente', rightX, y)

  return y + 5
}

function drawLegend(doc: jsPDF, y: number) {
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('Simbología del checklist:', MARGIN, y)

  y += 4

  doc.setFont('helvetica', 'normal')

  const drawItem = (text: string, color: string, x: number) => {
    doc.setFillColor(...hexToRgb(color))
    doc.circle(x, y, 2, 'F')
    doc.text(text, x + 5, y + 1)
  }

  drawItem('Aprobado', COLORS.green, MARGIN)
  drawItem('Observación', COLORS.red, MARGIN + 50)
  drawItem('Fuera periodo', COLORS.cyan, MARGIN + 100)
  drawItem('No aplica', COLORS.gray, MARGIN + 150)

  return y + 6
}

function drawChecklist(doc: jsPDF, data: MaintenanceChecklistPDFData, startY: number) {
  let y = startY

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('CHECKLIST', MARGIN, y)

  y += 5

  const questions = [...data.questions].sort((a, b) => a.number - b.number)

  const colWidth = (PAGE_WIDTH - 2 * MARGIN - 10) / 2

  let leftY = y
  let rightY = y

  questions.forEach((q, index) => {
    const col = index % 2 === 0 ? 'left' : 'right'
    const x = col === 'left' ? MARGIN : MARGIN + colWidth + 10
    const yPos = col === 'left' ? leftY : rightY

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)

    const text = `${q.number}. ${q.text}`
    const lines = doc.splitTextToSize(text, colWidth - 8)

    doc.text(lines, x, yPos)

    // estado
    let color = COLORS.gray
    if (q.status === 'approved') color = COLORS.green
    if (q.status === 'rejected') color = COLORS.red

    doc.setFillColor(...hexToRgb(color))
    doc.circle(x + colWidth - 5, yPos - 1, 2, 'F')

    const height = lines.length * 3.5

    if (col === 'left') leftY += height + 2
    else rightY += height + 2
  })

  return Math.max(leftY, rightY) + 5
}

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