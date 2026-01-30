// Generador de PDF para Visitas de Emergencia
// Formato MIREGA - Adaptado del PDF de Mantenimiento
import jsPDF from 'jspdf';

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
  visitStartTime: string; // Hora de apertura del formulario
  visitEndTime: string;   // Hora de cierre
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

// Configuración de página A4
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 10;

// Colores corporativos MIREGA
const COLORS = {
  blue: '#273a8f',
  green: '#44ac4c',
  red: '#e1162b',
  orange: '#f59e0b',
  yellow: '#fbbf24',
  black: '#1d1d1b',
};

// Helper para convertir hex a RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ];
}

// Formatear fecha
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// Formatear hora
function formatTime(timeStr: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return timeStr;
}

// Etiquetas de causa de falla
function getFailureCauseLabel(cause: string): string {
  switch (cause) {
    case 'normal_use': return 'Falla por uso';
    case 'third_party': return 'Daño de terceros';
    case 'part_lifespan': return 'Vida útil del repuesto';
    default: return 'No especificado';
  }
}

// Etiquetas de estado
function getStatusLabel(status: string): string {
  switch (status) {
    case 'operational': return 'Operativo';
    case 'observation': return 'En Observación';
    case 'stopped': return 'Detenido';
    default: return 'No especificado';
  }
}

// Cargar imagen con fallback
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

// ENCABEZADO CON LOGO Y TEXTOS - LOGO A LA IZQUIERDA, TÍTULOS CENTRADOS
function drawHeader(doc: jsPDF, logoImg: HTMLImageElement | null): number {
  const darkBlue = [31, 49, 107];
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Logo a la izquierda - Ancho fijo 35, altura proporcional
  const logoW = 35;
  const logoX = MARGIN;
  const logoY = MARGIN;
  
  if (logoImg) {
    try {
      const aspectRatio = logoImg.height / logoImg.width;
      const logoH = logoW * aspectRatio;
      doc.addImage(logoImg, 'JPEG', logoX, logoY, logoW, logoH);
    } catch (e) {
      console.error('Error al cargar logo:', e);
    }
  }

  const mainTitle = 'REPORTE DE EMERGENCIA';
  const subTitle = 'SERVICIO DE ATENCIÓN';

  // Calcular centro de la página
  const centerX = pageWidth / 2;
  
  // Título principal - CENTRADO EN LA HOJA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(darkBlue[0], darkBlue[1], darkBlue[2]);
  
  // Alineado verticalmente con el logo (a la mitad del logo aprox)
  const titleY = MARGIN + 10;
  doc.text(mainTitle, centerX, titleY, { align: 'center' });

  // Subtítulo - CENTRADO DEBAJO DEL TÍTULO
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  const subTitleY = titleY + 7;
  doc.text(subTitle, centerX, subTitleY, { align: 'center' });

  // Información de contacto EN UNA SOLA LÍNEA - CENTRADA
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const infoY = subTitleY + 6;
  const contactInfo = 'MIREGA ASCENSORES LTDA. Pedro de Valdivia N°273 – Of. 1406, Providencia  |  +562 6469 1048 / +569 8793 3552  |  contacto@mirega.cl';
  doc.text(contactInfo, centerX, infoY, { align: 'center' });

  return infoY + 6;
}

// INFORMACIÓN GENERAL
function drawGeneralInfo(doc: jsPDF, data: EmergencyVisitPDFData, startY: number): number {
  let y = startY;
  
  // Barra de título AZUL
  const blueRgb = hexToRgb(COLORS.blue);
  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('INFORMACIÓN GENERAL', MARGIN + 3, y + 5.5);

  y += 10;

  // Configuración de campos
  const fieldHeight = 6;
  const labelWidth = 30;
  const leftCol = MARGIN;
  const rightCol = PAGE_WIDTH / 2;

  // Función para dibujar campo
  const drawField = (label: string, value: string, x: number, yPos: number, width?: number) => {
    const fieldWidth = width || ((PAGE_WIDTH / 2) - MARGIN - labelWidth);
    
    // Label (AZUL)
    doc.setFillColor(...blueRgb);
    doc.setTextColor(255, 255, 255);
    doc.rect(x, yPos, labelWidth, fieldHeight, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label, x + 1.5, yPos + 4.2);

    // Value
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...blueRgb);
    doc.setLineWidth(0.3);
    doc.rect(x + labelWidth, yPos, fieldWidth, fieldHeight);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(value, x + labelWidth + 2, yPos + 4.2);
  };

  // Fila 1: Edificio | Fecha
  drawField('Edificio:', data.clientName || '', leftCol, y);
  drawField('Fecha:', formatDate(data.visitDate), rightCol, y);
  y += fieldHeight + 1.5;

  // Fila 2: Dirección | Hora Inicio
  drawField('Dirección:', data.clientAddress || 'No especificada', leftCol, y);
  drawField('Hora Inicio:', formatTime(data.visitStartTime), rightCol, y);
  y += fieldHeight + 1.5;

  // Fila 3: Técnico | Hora Cierre
  drawField('Técnico:', data.technicianName || '', leftCol, y);
  drawField('Hora Cierre:', formatTime(data.visitEndTime), rightCol, y);
  y += fieldHeight + 1.5;

  return y + 3;
}

// ASCENSORES ATENDIDOS
function drawElevators(doc: jsPDF, data: EmergencyVisitPDFData, startY: number): number {
  let y = startY;

  // Determinar color de barra según estado final predominante
  let barColor = COLORS.green; // Verde por defecto (operativo)
  const hasObservation = data.elevators.some(e => e.final_status === 'observation');
  const hasStopped = data.elevators.some(e => e.final_status === 'stopped');
  
  if (hasStopped) {
    barColor = COLORS.red; // Rojo si hay detenidos
  } else if (hasObservation) {
    barColor = COLORS.yellow; // Amarillo si hay en observación
  }

  // Barra de título con color dinámico
  const barRgb = hexToRgb(barColor);
  doc.setFillColor(...barRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ASCENSORES ATENDIDOS', MARGIN + 3, y + 5.5);

  y += 12;

  // Tabla de ascensores
  const tableStart = MARGIN;
  const colWidths = [45, 40, 40, 65]; // Ascensor N°, Estado Inicial, Estado Final, Clasificación
  const rowHeight = 7;

  // Encabezados
  doc.setFillColor(220, 220, 220);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  
  let x = tableStart;
  const headers = ['Ascensor N°', 'Estado Inicial', 'Estado Final', 'Clasificación de la Falla'];
  headers.forEach((header, i) => {
    doc.rect(x, y, colWidths[i], rowHeight);
    doc.text(header, x + colWidths[i] / 2, y + 4.5, { align: 'center' });
    x += colWidths[i];
  });

  y += rowHeight;

  // Datos de ascensores
  doc.setFont('helvetica', 'normal');
  data.elevators.forEach((elevator) => {
    x = tableStart;
    
    // Ascensor N°
    doc.rect(x, y, colWidths[0], rowHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`Ascensor N° ${elevator.elevator_number}`, x + colWidths[0] / 2, y + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    x += colWidths[0];
    
    // Estado Inicial
    doc.rect(x, y, colWidths[1], rowHeight);
    const initialLabel = elevator.initial_status === 'operational' ? 'Operativo' : 'Detenido';
    doc.setTextColor(0, 0, 0); // Texto negro
    doc.setFont('helvetica', 'normal');
    doc.text(initialLabel, x + colWidths[1] / 2, y + 4.5, { align: 'center' });
    x += colWidths[1];
    
    // Estado Final
    doc.rect(x, y, colWidths[2], rowHeight);
    const finalLabel = getStatusLabel(elevator.final_status);
    doc.setTextColor(0, 0, 0); // Texto negro
    doc.setFont('helvetica', 'normal');
    doc.text(finalLabel, x + colWidths[2] / 2, y + 4.5, { align: 'center' });
    x += colWidths[2];
    
    // Clasificación de la Falla
    doc.rect(x, y, colWidths[3], rowHeight);
    doc.setFontSize(7);
    doc.text(getFailureCauseLabel(data.failureCause), x + 2, y + 4.5);
    doc.setFontSize(8);
    
    y += rowHeight;
  });

  return y + 5;
}

// DESCRIPCIÓN DE FALLA (sin fotos, limitada a espacio disponible)
function drawFailureDescription(doc: jsPDF, data: EmergencyVisitPDFData, startY: number): number {
  let y = startY;

  // Verificar si necesitamos nueva página
  if (y > PAGE_HEIGHT - 50) {
    doc.addPage();
    y = MARGIN;
  }

  // Barra de título AZUL
  const blueRgb = hexToRgb(COLORS.blue);
  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('DESCRIPCIÓN DE LA FALLA', MARGIN + 3, y + 5.5);

  y += 12;

  // Descripción con límite de líneas para no exceder página
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  
  const maxWidth = PAGE_WIDTH - 2 * MARGIN;
  // Eliminada variable no usada maxHeight
  const lines = doc.splitTextToSize(data.failureDescription || 'Sin descripción', maxWidth);
  
  let lineCount = 0;
  const maxLines = 7; // Límite de líneas
  
  lines.slice(0, maxLines).forEach((line: string) => {
    doc.text(line, MARGIN, y);
    y += 5;
    lineCount++;
  });
  
  if (lines.length > maxLines) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text('...', MARGIN, y);
    y += 5;
  }

  return y + 3;
}

// RESOLUCIÓN (sin fotos, limitada a espacio disponible)
function drawResolution(doc: jsPDF, data: EmergencyVisitPDFData, startY: number): number {
  let y = startY;

  // Verificar si necesitamos nueva página
  if (y > PAGE_HEIGHT - 50) {
    doc.addPage();
    y = MARGIN;
  }

  // Barra de título AZUL
  const blueRgb = hexToRgb(COLORS.blue);
  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('RESOLUCIÓN Y TRABAJOS REALIZADOS', MARGIN + 3, y + 5.5);

  y += 12;

  // Resumen de resolución con límite de líneas
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  
  const maxWidth = PAGE_WIDTH - 2 * MARGIN;
  const lines = doc.splitTextToSize(data.resolutionSummary || 'Sin descripción', maxWidth);
  
  const maxLines = 7; // Límite de líneas
  
  lines.slice(0, maxLines).forEach((line: string) => {
    doc.text(line, MARGIN, y);
    y += 5;
  });
  
  if (lines.length > maxLines) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text('...', MARGIN, y);
    y += 5;
  }

  return y + 3;
}

// ESTADO FINAL Y OBSERVACIONES
function drawFinalStatus(doc: jsPDF, data: EmergencyVisitPDFData, startY: number): number {
  let y = startY;

  // Verificar espacio
  if (y > PAGE_HEIGHT - 60) {
    doc.addPage();
    y = MARGIN;
  }

  // Barra de título AZUL
  const blueRgb = hexToRgb(COLORS.blue);
  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('ESTADO FINAL DEL SERVICIO', MARGIN + 3, y + 5.5);

  y += 12;

  // Generar mensaje contextual según estado y solicitudes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  
  const maxWidth = PAGE_WIDTH - 2 * MARGIN;
  
  // Obtener etiqueta de prioridad
  const getPriorityLabel = (priority?: string | null): string => {
    switch (priority) {
      case 'critical': return 'CRÍTICA';
      case 'high': return 'ALTA';
      case 'medium': return 'MEDIA';
      case 'low': return 'BAJA';
      default: return 'MEDIA';
    }
  };

  // Generar mensaje según estado final
  let message = '';
  
  if (data.finalStatus === 'operational') {
    // OPERATIVO
    const elevatorNumbers = data.elevators.map(e => `N° ${e.elevator_number}`).join(', ');
    message = `Ascensor${data.elevators.length > 1 ? 'es' : ''} ${elevatorNumbers} ${data.elevators.length > 1 ? 'quedan' : 'queda'} operativo${data.elevators.length > 1 ? 's' : ''} y sin anormalidades.`;
    
    // Agregar información de solicitud si existe
    if (data.serviceRequestType) {
      message += '\n\n';
      const priority = getPriorityLabel(data.serviceRequestPriority);
      
      if (data.serviceRequestType === 'parts') {
        message += `Se ha generado una solicitud de repuestos con prioridad ${priority}`;
        if (data.serviceRequestTitle) {
          message += `: ${data.serviceRequestTitle}`;
        }
        message += '. El supervisor coordinará la adquisición e instalación en fecha a definir.';
      } else if (data.serviceRequestType === 'support') {
        message += `Se ha generado una solicitud de soporte técnico con prioridad ${priority}`;
        if (data.serviceRequestTitle) {
          message += `: ${data.serviceRequestTitle}`;
        }
        message += '. Se requiere segunda opinión especializada. El supervisor coordinará la visita del técnico especialista.';
      } else if (data.serviceRequestType === 'repair') {
        message += `Se ha generado una solicitud de reparación con prioridad ${priority}`;
        if (data.serviceRequestTitle) {
          message += `: ${data.serviceRequestTitle}`;
        }
        message += '. El supervisor asignará técnico para realizar los trabajos necesarios.';
      }
    }
    
  } else if (data.finalStatus === 'observation') {
    // EN OBSERVACIÓN
    const elevatorNumbers = data.elevators.map(e => `N° ${e.elevator_number}`).join(', ');
    const observationDate = data.observationUntil ? formatDate(data.observationUntil) : 'fecha a definir';
    
    message = `Ascensor${data.elevators.length > 1 ? 'es' : ''} ${elevatorNumbers} ${data.elevators.length > 1 ? 'quedarán' : 'quedará'} en observación hasta el ${observationDate}. Este estatus se cerrará automáticamente de no generarse ningún reporte durante el periodo señalado.`;
    
    // Agregar información de solicitud si existe
    if (data.serviceRequestType) {
      message += '\n\n';
      const priority = getPriorityLabel(data.serviceRequestPriority);
      
      if (data.serviceRequestType === 'parts') {
        message += `Adicionalmente, se ha generado una solicitud de repuestos con prioridad ${priority}`;
        if (data.serviceRequestTitle) {
          message += `: ${data.serviceRequestTitle}`;
        }
        message += ' para atención preventiva. El supervisor coordinará la instalación durante el periodo de observación.';
      } else if (data.serviceRequestType === 'support') {
        message += `Adicionalmente, se ha generado una solicitud de soporte técnico con prioridad ${priority}`;
        if (data.serviceRequestTitle) {
          message += `: ${data.serviceRequestTitle}`;
        }
        message += '. Se requiere una segunda visita con apoyo especializado durante el periodo de observación.';
      } else if (data.serviceRequestType === 'repair') {
        message += `Adicionalmente, se ha generado una solicitud de reparación con prioridad ${priority}`;
        if (data.serviceRequestTitle) {
          message += `: ${data.serviceRequestTitle}`;
        }
        message += '. Los trabajos se realizarán durante el periodo de observación.';
      }
    }
    
  } else if (data.finalStatus === 'stopped') {
    // DETENIDO
    const elevatorNumbers = data.elevators.map(e => `N° ${e.elevator_number}`).join(', ');
    message = `Ascensor${data.elevators.length > 1 ? 'es' : ''} ${elevatorNumbers} ${data.elevators.length > 1 ? 'quedan' : 'queda'} DETENIDO${data.elevators.length > 1 ? 'S' : ''} por seguridad.`;
    
    // La solicitud es OBLIGATORIA para detenidos
    if (data.serviceRequestType) {
      message += '\n\n';
      const priority = getPriorityLabel(data.serviceRequestPriority);
      
      if (data.serviceRequestType === 'parts') {
        message += `Se ha generado una solicitud de repuestos con prioridad ${priority}`;
        if (data.serviceRequestTitle) {
          message += `: ${data.serviceRequestTitle}`;
        }
        message += '. El ascensor permanecerá fuera de servicio hasta la instalación y puesta en marcha del equipo.';
      } else if (data.serviceRequestType === 'support') {
        message += `Se ha generado una solicitud de soporte técnico con prioridad ${priority}`;
        if (data.serviceRequestTitle) {
          message += `: ${data.serviceRequestTitle}`;
        }
        message += '. Se requiere segunda opinión especializada para determinar el plan de acción. El ascensor permanecerá fuera de servicio hasta la resolución del diagnóstico.';
      } else if (data.serviceRequestType === 'repair') {
        message += `Se ha generado una solicitud de reparación con prioridad ${priority}`;
        if (data.serviceRequestTitle) {
          message += `: ${data.serviceRequestTitle}`;
        }
        message += '. El supervisor asignará técnico especializado. El ascensor permanecerá fuera de servicio hasta completar la reparación.';
      }
    }
  }

  // Dividir mensaje en líneas y renderizar
  const lines = doc.splitTextToSize(message, maxWidth);
  lines.forEach((line: string) => {
    if (y > PAGE_HEIGHT - 20) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, MARGIN, y);
    y += 5;
  });

  return y + 5;
}

// PÁGINA 2: EVIDENCIA FOTOGRÁFICA Y FIRMA
function drawPhotosAndSignaturePage(
  doc: jsPDF, 
  data: EmergencyVisitPDFData,
  logoImg: HTMLImageElement | null,
  failurePhoto1?: HTMLImageElement | null,
  failurePhoto2?: HTMLImageElement | null, 
  resolutionPhoto1?: HTMLImageElement | null,
  resolutionPhoto2?: HTMLImageElement | null,
  signatureImg?: HTMLImageElement | null
): void {
  doc.addPage();
  
  // Dibujar encabezado completo en página 2
  let y = drawHeader(doc, logoImg);
  y += 5;

  const blueRgb = hexToRgb(COLORS.blue);

  // Título de sección: ESTADO INICIAL con barra azul
  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('REGISTRO FOTOGRÁFICO - ESTADO INICIAL', MARGIN + 3, y + 5.5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  // Fotos iniciales (2 fotos, mismo tamaño forzado)
  const photoWidth = 85;
  const photoHeight = 65;
  const spacing = 10;
  const startX = (PAGE_WIDTH - (2 * photoWidth + spacing)) / 2;

  // Foto 1 - Estado Inicial
  if (failurePhoto1) {
    try {
      doc.addImage(failurePhoto1, 'JPEG', startX, y, photoWidth, photoHeight);
    } catch (e) {
      console.error('Error al agregar foto 1 inicial:', e);
    }
  } else {
    // Placeholder si no hay foto
    doc.setDrawColor(200, 200, 200);
    doc.rect(startX, y, photoWidth, photoHeight);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sin foto', startX + photoWidth / 2, y + photoHeight / 2, { align: 'center' });
  }

  // Foto 2 - Estado Inicial
  if (failurePhoto2) {
    try {
      doc.addImage(failurePhoto2, 'JPEG', startX + photoWidth + spacing, y, photoWidth, photoHeight);
    } catch (e) {
      console.error('Error al agregar foto 2 inicial:', e);
    }
  } else {
    doc.setDrawColor(200, 200, 200);
    doc.rect(startX + photoWidth + spacing, y, photoWidth, photoHeight);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sin foto', startX + photoWidth + spacing + photoWidth / 2, y + photoHeight / 2, { align: 'center' });
  }

  y += photoHeight + 15;

  // Título de sección: ESTADO FINAL con barra azul
  doc.setFillColor(...blueRgb);
  doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('REGISTRO FOTOGRÁFICO - ESTADO FINAL', MARGIN + 3, y + 5.5);
  doc.setTextColor(0, 0, 0);
  y += 12;

  // Fotos finales (2 fotos, mismo tamaño forzado)
  // Foto 1 - Estado Final
  if (resolutionPhoto1) {
    try {
      doc.addImage(resolutionPhoto1, 'JPEG', startX, y, photoWidth, photoHeight);
    } catch (e) {
      console.error('Error al agregar foto 1 final:', e);
    }
  } else {
    doc.setDrawColor(200, 200, 200);
    doc.rect(startX, y, photoWidth, photoHeight);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sin foto', startX + photoWidth / 2, y + photoHeight / 2, { align: 'center' });
  }

  // Foto 2 - Estado Final
  if (resolutionPhoto2) {
    try {
      doc.addImage(resolutionPhoto2, 'JPEG', startX + photoWidth + spacing, y, photoWidth, photoHeight);
    } catch (e) {
      console.error('Error al agregar foto 2 final:', e);
    }
  } else {
    doc.setDrawColor(200, 200, 200);
    doc.rect(startX + photoWidth + spacing, y, photoWidth, photoHeight);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Sin foto', startX + photoWidth + spacing + photoWidth / 2, y + photoHeight / 2, { align: 'center' });
  }

  y += photoHeight + 25; // Espacio adicional antes de la firma

  // FIRMA CENTRADA - MÁS ABAJO Y CONTROLADA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('FIRMA Y RECEPCIÓN DEL SERVICIO', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 6;

  // Nombre del receptor centrado
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(data.receiverName || 'No especificado', PAGE_WIDTH / 2, y, { align: 'center' });
  y += 6;

  // Firma centrada con tamaño controlado (más pequeña)
  if (signatureImg) {
    try {
      // Tamaño fijo controlado para la firma
      const maxSigWidth = 50;
      const maxSigHeight = 20;
      
      // Calcular tamaño manteniendo aspect ratio
      const aspectRatio = signatureImg.width / signatureImg.height;
      let sigWidth = maxSigWidth;
      let sigHeight = maxSigWidth / aspectRatio;
      
      if (sigHeight > maxSigHeight) {
        sigHeight = maxSigHeight;
        sigWidth = maxSigHeight * aspectRatio;
      }
      
      const sigX = (PAGE_WIDTH - sigWidth) / 2;
      doc.addImage(signatureImg, 'PNG', sigX, y, sigWidth, sigHeight);
      y += sigHeight + 2;
      
      // Línea de firma
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      const lineWidth = 60;
      const lineX = (PAGE_WIDTH - lineWidth) / 2;
      doc.line(lineX, y, lineX + lineWidth, y);
      y += 4;
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Firma del Receptor', PAGE_WIDTH / 2, y, { align: 'center' });
    } catch (e) {
      console.error('Error al agregar firma:', e);
    }
  }

  y += 6;

  // Fecha del servicio centrada
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(`Fecha de Servicio: ${formatDate(data.completedAt)}`, PAGE_WIDTH / 2, y, { align: 'center' });
}

// PIE DE PÁGINA
function drawFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  const y = PAGE_HEIGHT - 10;
  
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'italic');
  
  // Página
  doc.text(`Página ${pageNum} de ${totalPages}`, PAGE_WIDTH / 2, y, { align: 'center' });
  
  // Nota legal
  doc.text('Este documento es válido como constancia del servicio de emergencia prestado.', PAGE_WIDTH / 2, y + 3, { align: 'center' });
}

// FUNCIÓN PRINCIPAL DE GENERACIÓN
export async function generateEmergencyVisitPDF(data: EmergencyVisitPDFData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Cargar logo JPG
  const logoImg = await loadImage('/logo_fondo_1.jpg');

  // Cargar fotos si existen
  const failurePhoto1 = data.failurePhoto1Url ? await loadImage(data.failurePhoto1Url) : null;
  const failurePhoto2 = data.failurePhoto2Url ? await loadImage(data.failurePhoto2Url) : null;
  const resolutionPhoto1 = data.resolutionPhoto1Url ? await loadImage(data.resolutionPhoto1Url) : null;
  const resolutionPhoto2 = data.resolutionPhoto2Url ? await loadImage(data.resolutionPhoto2Url) : null;
  const signatureImg = data.signatureDataUrl ? await loadImage(data.signatureDataUrl) : null;

  // ============ PÁGINA 1: INFORMACIÓN COMPLETA ============
  let y = drawHeader(doc, logoImg);
  y = drawGeneralInfo(doc, data, y);
  y = drawElevators(doc, data, y);
  y = drawFailureDescription(doc, data, y);
  y = drawResolution(doc, data, y);
  y = drawFinalStatus(doc, data, y);

  // Pie de página 1
  drawFooter(doc, 1, 2);

  // ============ PÁGINA 2: FOTOS Y FIRMA ============
  drawPhotosAndSignaturePage(doc, data, logoImg, failurePhoto1, failurePhoto2, resolutionPhoto1, resolutionPhoto2, signatureImg);
  
  // Pie de página 2
  drawFooter(doc, 2, 2);

  // Retornar blob
  return doc.output('blob');
}
