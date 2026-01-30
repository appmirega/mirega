import jsPDF from 'jspdf';

interface ChecklistData {
  folio: number;
  client: {
    business_name: string;
    address: string;
    contact_name: string;
  };
  elevator: {
    brand: string;
    model: string;
    serial_number: string;
    is_hydraulic: boolean;
  };
  checklist: {
    month: number;
    year: number;
    last_certification_date: string | null;
    next_certification_date: string | null;
    certification_not_legible: boolean;
    completion_date: string;
  };
  technician: {
    full_name: string;
    email: string;
  };
  questions: Array<{
    question_number: number;
    section: string;
    question_text: string;
    answer_status: 'approved' | 'rejected';
    observations?: string;
  }>;
  signature: {
    signer_name: string;
    signature_data: string;
    signed_at: string;
  };
}

export async function generateMaintenancePDF(data: ChecklistData): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const darkBlue = [31, 49, 107];
  const lightBlue = [63, 104, 184];

  doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.rect(0, 0, 70, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MIREGA', 35, 15, { align: 'center' });
  doc.setFontSize(8);
  doc.text('ASCENSORES', 35, 20, { align: 'center' });

  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME MANTENIMIENTO', 105, 18);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const frequency = getMaintenanceFrequency(data.checklist.month);
  doc.text(`INSPECCIÓN ${frequency.toUpperCase()}`, 105, 25);

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('MIREGA ASCENSORES LTDA. Pedro de Valdivia N°255 – Of. 202, Providencia', 105, 31);
  doc.text('+56956087972  contacto@mirega.cl', 105, 35);

  let yPos = 45;

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(10, yPos, 135, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN GENERAL', 12, yPos + 5.5);

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(145, yPos, 55, 8, 'F');
  doc.text('N° FOLIO:', 147, yPos + 5.5);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(168, yPos + 1, 30, 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(String(data.folio).padStart(6, '0'), 183, yPos + 5, { align: 'center' });

  yPos += 13;

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(10, yPos, 25, 6, 'F');
  doc.text('Cliente:', 12, yPos + 4);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(200, 200, 200);
  doc.rect(35, yPos, 110, 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(data.client.business_name, 37, yPos + 4);

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(145, yPos, 20, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', 147, yPos + 4);

  doc.setFillColor(255, 255, 255);
  doc.rect(165, yPos, 35, 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(data.checklist.completion_date).toLocaleDateString('es-ES'), 167, yPos + 4);

  yPos += 8;

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(10, yPos, 25, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Dirección:', 12, yPos + 4);

  doc.setFillColor(255, 255, 255);
  doc.rect(35, yPos, 110, 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(data.client.address.substring(0, 60), 37, yPos + 4);

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(145, yPos, 20, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Periodo:', 147, yPos + 4);

  doc.setFillColor(255, 255, 255);
  doc.rect(165, yPos, 35, 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`${monthNames[data.checklist.month - 1]} ${data.checklist.year}`, 167, yPos + 4);

  yPos += 8;

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(10, yPos, 25, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Ascensor:', 12, yPos + 4);

  doc.setFillColor(255, 255, 255);
  doc.rect(35, yPos, 50, 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.elevator.brand} ${data.elevator.model}`.substring(0, 30), 37, yPos + 4);

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(85, yPos, 35, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Última certificación:', 87, yPos + 4);

  doc.setFillColor(255, 255, 255);
  doc.rect(120, yPos, 25, 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  const certDate = data.checklist.last_certification_date
    ? new Date(data.checklist.last_certification_date).toLocaleDateString('es-ES')
    : 'N/A';
  doc.text(certDate, 122, yPos + 4);

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(145, yPos, 35, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Última certificación:', 147, yPos + 4);

  doc.setFillColor(255, 255, 255);
  doc.rect(180, yPos, 20, 6);

  yPos += 8;

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(10, yPos, 25, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Técnico:', 12, yPos + 4);

  doc.setFillColor(255, 255, 255);
  doc.rect(35, yPos, 110, 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(data.technician.full_name, 37, yPos + 4);

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(145, yPos, 35, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Última certificación:', 147, yPos + 4);

  doc.setFillColor(255, 255, 255);
  doc.rect(180, yPos, 20, 6);

  yPos += 12;

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(10, yPos, 190, 8, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CHECKLIST MANTENIMIENTO', 12, yPos + 5.5);

  yPos += 12;

  const questions = data.questions;
  const leftColumnX = 10;
  const rightColumnX = 105;
  const checkboxSize = 5;
  const lineHeight = 5.5;

  doc.setFontSize(7);
  doc.setDrawColor(200, 200, 200);

  let leftY = yPos;
  let rightY = yPos;
  let questionIndex = 0;

  const sections = groupQuestionsBySection(questions);

  sections.forEach((section) => {
    if (questionIndex < 25) {
      doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
      doc.rect(leftColumnX, leftY, 90, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title, leftColumnX + 45, leftY + 3.5, { align: 'center' });
      leftY += 6;
    }

    section.questions.forEach((q) => {
      if (questionIndex < 25) {
        drawChecklistItem(doc, leftColumnX, leftY, q, checkboxSize);
        leftY += lineHeight;
      } else if (questionIndex < 50) {
        if (questionIndex === 25) {
          rightY = yPos;
        }
        drawChecklistItem(doc, rightColumnX, rightY, q, checkboxSize);
        rightY += lineHeight;
      }
      questionIndex++;
    });
  });

  const signatureY = 230;

  doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.rect(10, signatureY, 90, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RECEPCIONADO POR:', 12, signatureY + 4);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.setLineWidth(1);
  doc.rect(10, signatureY + 8, 90, 35);

  if (data.signature.signature_data) {
    try {
      doc.addImage(data.signature.signature_data, 'PNG', 15, signatureY + 10, 80, 25);
    } catch (error) {
      console.error('Error adding signature:', error);
    }
  }

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(data.signature.signer_name, 55, signatureY + 40, { align: 'center' });

  const numbersX = 180;
  let numbersY = yPos;
  doc.setFontSize(6);
  doc.setTextColor(0, 0, 0);

  for (let i = 1; i <= 50; i++) {
    doc.setFillColor(240, 240, 240);
    doc.rect(numbersX, numbersY, 20, 4, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(numbersX, numbersY, 20, 4);
    doc.text(String(i).padStart(2, '0'), numbersX + 10, numbersY + 2.8, { align: 'center' });
    numbersY += 4;
  }

  const rejectedQuestions = data.questions.filter((q) => q.answer_status === 'rejected' && q.observations);

  if (rejectedQuestions.length > 0) {
    doc.addPage();

    doc.setFillColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.rect(0, 0, 70, 35, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MIREGA', 35, 15, { align: 'center' });
    doc.setFontSize(8);
    doc.text('ASCENSORES', 35, 20, { align: 'center' });

    doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
    doc.setFontSize(18);
    doc.text('OBSERVACIONES', 105, 20);

    yPos = 45;

    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.rect(10, yPos, 190, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIONES Y HALLAZGOS', 12, yPos + 5.5);

    yPos += 15;

    rejectedQuestions.forEach((q, index) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFillColor(220, 38, 38);
      doc.circle(15, yPos, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(String(index + 1), 15, yPos + 1, { align: 'center' });

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Pregunta N° ${q.question_number}: ${q.question_text}`, 22, yPos + 1);

      yPos += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      const obsLines = doc.splitTextToSize(q.observations || '', 175);
      doc.text(obsLines, 15, yPos);
      yPos += obsLines.length * 5 + 10;

      doc.setDrawColor(220, 220, 220);
      doc.line(15, yPos - 5, 195, yPos - 5);
    });
  }

  return doc.output('blob');
}

function drawChecklistItem(doc: jsPDF, x: number, y: number, question: any, checkboxSize: number) {
  const isApproved = question.answer_status === 'approved';

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(String(question.question_number).padStart(2, '0'), x + 2, y + 3.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const questionText = question.question_text.substring(0, 55);
  doc.text(questionText, x + 8, y + 3.5);

  const checkboxX = x + 85;
  const centerX = checkboxX + checkboxSize / 2;
  const centerY = y + 2.5;

  if (isApproved) {
    doc.setFillColor(212, 237, 218);
    doc.circle(centerX, centerY, checkboxSize / 2, 'F');
    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.5);
    doc.circle(centerX, centerY, checkboxSize / 2, 'S');

    doc.setDrawColor(22, 163, 74);
    doc.setLineWidth(0.8);
    doc.line(centerX - 1.5, centerY, centerX - 0.5, centerY + 1.2);
    doc.line(centerX - 0.5, centerY + 1.2, centerX + 1.5, centerY - 1);
  } else {
    doc.setFillColor(248, 215, 218);
    doc.circle(centerX, centerY, checkboxSize / 2, 'F');
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.circle(centerX, centerY, checkboxSize / 2, 'S');

    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.8);
    doc.line(centerX - 1.2, centerY - 1.2, centerX + 1.2, centerY + 1.2);
    doc.line(centerX + 1.2, centerY - 1.2, centerX - 1.2, centerY + 1.2);
  }
}

function groupQuestionsBySection(questions: any[]) {
  const sectionTitles: { [key: string]: string } = {
    'cuarto_maquinas': 'CUARTO DE MÁQUINAS',
    'grupo_tractor': 'GRUPO TRACTOR',
    'limitador': 'LIMITADOR DE VELOCIDAD',
    'grupo_hidraulico': 'GRUPO HIDRÁULICO, CILINDRO Y VÁLVULAS',
    'cabina': 'CABINA',
    'cables': 'CABLES DE SUSPENSIÓN Y AMARRAS',
    'puertas': 'PUERTAS DE ACCESO Y PISO',
    'zapatas': 'ZAPATAS GUÍAS DE CABINA Y CONTRAPESO',
    'ducto': 'DUCTO',
  };

  const grouped: { title: string; questions: any[] }[] = [];
  let currentSection = '';
  let currentQuestions: any[] = [];

  questions.forEach((q) => {
    if (q.section !== currentSection) {
      if (currentQuestions.length > 0) {
        grouped.push({ title: sectionTitles[currentSection] || currentSection, questions: currentQuestions });
      }
      currentSection = q.section;
      currentQuestions = [q];
    } else {
      currentQuestions.push(q);
    }
  });

  if (currentQuestions.length > 0) {
    grouped.push({ title: sectionTitles[currentSection] || currentSection, questions: currentQuestions });
  }

  return grouped;
}

function getMaintenanceFrequency(month: number): string {
  const quarters = [3, 6, 9, 12];
  const semesters = [3, 9];

  if (semesters.includes(month)) {
    return 'Semestral';
  } else if (quarters.includes(month)) {
    return 'Trimestral';
  } else {
    return 'Mensual';
  }
}

export function generatePDFFilename(client: string, month: number, year: number, elevatorSerial: string): string {
  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const cleanClient = client
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toLowerCase();

  const cleanSerial = elevatorSerial.replace(/[^a-zA-Z0-9]/g, '');

  return `${cleanClient}_${cleanSerial}_${monthNames[month - 1]}_${year}.pdf`;
}
