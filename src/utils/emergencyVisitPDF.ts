export function mapRequestTypeLabel(type: string) {
  switch (type) {
    case 'repair':
      return 'Trabajos / Reparación';
    case 'parts':
      return 'Repuestos';
    case 'diagnostic':
      return 'Diagnóstico Técnico';
    default:
      return type || '-';
  }
}

export function generateEmergencyVisitPDF(data: any) {
  // ⚠️ Mantengo esto genérico para no romper tu implementación actual de PDF
  // Solo se ajusta el uso de etiquetas

  const requestTypeLabel = mapRequestTypeLabel(data.request_type);

  return {
    ...data,
    request_type_label: requestTypeLabel
  };
}