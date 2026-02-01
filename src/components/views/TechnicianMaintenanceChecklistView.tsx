import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ClipboardList, 
  QrCode, 
  Search, 
  Building2, 
  ChevronRight,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  History,
  ArrowLeft,
  Download,
  Eye,
  Share2
} from 'lucide-react';
import { QRScanner } from '../checklist/QRScanner';
import { DynamicChecklistForm } from '../checklist/DynamicChecklistForm';
import { ChecklistSignatureModal } from '../checklist/ChecklistSignatureModal';
import { generateMaintenanceChecklistPDF, MaintenanceChecklistPDFData } from '../../utils/maintenanceChecklistPDF_v2';
import { createRequestsFromMaintenance } from '../../lib/serviceRequestsService';

interface Client {
  id: string;
  company_name: string;
  building_name: string;
  internal_alias: string;
  address: string;
}

interface Elevator {
  id: string;
  elevator_number: number;
  location_name: string;
  elevator_type: 'hydraulic' | 'electromechanical';
  status: 'active' | 'inactive' | 'under_maintenance';
  capacity_kg: number;
}

interface ChecklistProgress {
  elevator_id: string;
  checklist_id: string;
  status: 'pending' | 'in_progress' | 'completed';
}

type ViewMode = 'main' | 'client-selection' | 'elevator-selection' | 'checklist-form' | 'history' | 'in-progress';

interface TechnicianMaintenanceChecklistViewProps {
  initialMode?: ViewMode;
}

export const TechnicianMaintenanceChecklistView = ({ initialMode = 'main' }: TechnicianMaintenanceChecklistViewProps = {}) => {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cliente y ascensores seleccionados
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedElevator, setSelectedElevator] = useState<Elevator | null>(null);
  
  // Checklist actual
  const [currentChecklistId, setCurrentChecklistId] = useState<string | null>(null);
  const [checklistProgress, setChecklistProgress] = useState<Map<string, ChecklistProgress>>(new Map());
  
  // Periodo seleccionado
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Fechas de certificación
  const [lastCertificationDate, setLastCertificationDate] = useState('');
  const [nextCertificationDate, setNextCertificationDate] = useState('');
  const [certificationDatesNotReadable, setCertificationDatesNotReadable] = useState(false);
  const [certificationStatus, setCertificationStatus] = useState<'vigente' | 'vencida' | null>(null);
  const [showCertificationForm, setShowCertificationForm] = useState(false);
  
  // Firma
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  
  // Historial
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilterYear, setHistoryFilterYear] = useState<number | 'all'>('all');
  const [historyFilterMonth, setHistoryFilterMonth] = useState<number | 'all'>('all');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [historyFilterElevator, setHistoryFilterElevator] = useState<string>(''); // N° de ascensor

  // Checklists en progreso
  const [inProgressChecklists, setInProgressChecklists] = useState<any[]>([]);
  const [loadingInProgress, setLoadingInProgress] = useState(false);

  // Efecto para calcular estado de certificación
  useEffect(() => {
    if (nextCertificationDate && !certificationDatesNotReadable) {
      const status = calculateCertificationStatus(nextCertificationDate);
      setCertificationStatus(status);
    } else {
      setCertificationStatus(null);
    }
  }, [nextCertificationDate, certificationDatesNotReadable]);

  // Cargar clientes
  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name, building_name, internal_alias, address')
      .eq('is_active', true)
      .order('internal_alias');
    
    if (!error && data) {
      setClients(data);
    }
  };

  // Cargar ascensores del cliente
  const loadElevators = async (clientId: string) => {
    const { data, error } = await supabase
      .from('elevators')
      .select('id, elevator_number, location_name, elevator_type, status, capacity_kg')
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('elevator_number');
    
    if (!error && data) {
      setElevators(data);
    }
  };

  // Buscar cliente por código QR
  const handleQRScan = async (qrCode: string) => {
    setShowQRScanner(false);
    
    // Extraer código del cliente del QR
    const clientCode = qrCode.split('/').pop() || qrCode;
    
    const { data, error } = await supabase
      .from('clients')
      .select('id, company_name, building_name, internal_alias, address')
      .eq('client_code', clientCode)
      .single();
    
    if (!error && data) {
      setSelectedClient(data);
      await loadElevators(data.id);
      setViewMode('elevator-selection');
    } else {
      alert('No se encontró el cliente con ese código QR');
    }
  };

  // Seleccionar cliente manualmente
  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    await loadElevators(client.id);
    setViewMode('elevator-selection');
  };

  // Iniciar checklist para un ascensor
  const handleStartChecklist = async (elevator: Elevator) => {
    if (!selectedClient) return;
    
    // Verificar si ya existe un checklist para este ascensor en este periodo
    const { data: existing } = await supabase
      .from('mnt_checklists')
      .select('id, status')
      .eq('client_id', selectedClient.id)
      .eq('elevator_id', elevator.id)
      .eq('month', selectedMonth)
      .eq('year', selectedYear)
      .maybeSingle();
    
    if (existing) {
      if (existing.status === 'completed') {
        alert(
          `Ya existe un mantenimiento completado para el Ascensor ${elevator.elevator_number} en ${
            new Date(selectedYear, selectedMonth - 1).toLocaleString('es-CL', { month: 'long' })
          } ${selectedYear}.\n\nNo se pueden realizar mantenimientos duplicados en el mismo periodo.`
        );
        return;
      }
      // Si está en progreso, continuar con ese
      setCurrentChecklistId(existing.id);
    } else {
      // Crear nuevo checklist
      const { data: newChecklist, error } = await supabase
        .from('mnt_checklists')
        .insert({
          client_id: selectedClient.id,
          elevator_id: elevator.id,
          technician_id: profile?.id,
          month: selectedMonth,
          year: selectedYear,
          status: 'in_progress',
        })
        .select('id')
        .single();
      
      if (error) {
        alert('Error al crear el checklist');
        console.error(error);
        return;
      }
      
      setCurrentChecklistId(newChecklist.id);
    }
    
    setSelectedElevator(elevator);
    
    // Mostrar formulario de certificación antes del checklist
    setShowCertificationForm(true);
    setLastCertificationDate('');
    setNextCertificationDate('');
    setCertificationDatesNotReadable(false);
    setCertificationStatus(null);
    setViewMode('checklist-form');
  };

  // Formatear fecha última certificación (dd/mm/aaaa)
  const formatLastCertificationDate = (value: string): string => {
    // Eliminar todo lo que no sea número
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length === 0) return '';
    if (numbers.length <= 2) {
      // Solo día
      const day = parseInt(numbers);
      if (day > 31) return numbers.slice(0, 1);
      return numbers;
    }
    if (numbers.length <= 4) {
      // Día + mes
      const day = parseInt(numbers.slice(0, 2));
      const month = parseInt(numbers.slice(2));
      
      // Validar día
      if (day > 31 || day === 0) return numbers.slice(0, 2);
      
      // Validar mes parcial
      if (numbers.length === 4 && month > 12) return numbers.slice(0, 3);
      
      return numbers.slice(0, 2) + '/' + numbers.slice(2);
    }
    if (numbers.length <= 8) {
      // Día + mes + año
      const day = parseInt(numbers.slice(0, 2));
      const month = parseInt(numbers.slice(2, 4));
      const year = parseInt(numbers.slice(4));
      
      // Validar día según mes y año
      if (month > 0 && month <= 12) {
        const daysInMonth = new Date(year || 2000, month, 0).getDate();
        if (day > daysInMonth || day === 0) {
          return numbers.slice(0, 2) + '/' + numbers.slice(2, 4);
        }
      }
      
      return numbers.slice(0, 2) + '/' + numbers.slice(2, 4) + '/' + numbers.slice(4, 8);
    }
    
    return numbers.slice(0, 2) + '/' + numbers.slice(2, 4) + '/' + numbers.slice(4, 8);
  };

  // Formatear próxima certificación (mm/aaaa)
  const formatNextCertificationDate = (value: string): string => {
    // Eliminar todo lo que no sea número
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length === 0) return '';
    if (numbers.length <= 2) {
      // Solo mes
      const month = parseInt(numbers);
      if (month > 12) return numbers.slice(0, 1);
      return numbers;
    }
    if (numbers.length <= 6) {
      // Mes + año
      const month = parseInt(numbers.slice(0, 2));
      if (month > 12 || month === 0) return numbers.slice(0, 1);
      
      return numbers.slice(0, 2) + '/' + numbers.slice(2, 6);
    }
    
    return numbers.slice(0, 2) + '/' + numbers.slice(2, 6);
  };

  // Validar fecha última certificación
  const validateLastCertificationDate = (dateStr: string): boolean => {
    const regex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateStr.match(regex);
    
    if (!match) return false;
    
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;
    
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return false;
    
    return true;
  };

  // Validar próxima certificación
  const validateNextCertificationDate = (dateStr: string): boolean => {
    const regex = /^(\d{2})\/(\d{4})$/;
    const match = dateStr.match(regex);
    
    if (!match) return false;
    
    const month = parseInt(match[1]);
    const year = parseInt(match[2]);
    
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;
    
    return true;
  };

  // Handlers para inputs con formateo automático
  const handleLastCertificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLastCertificationDate(e.target.value);
    setLastCertificationDate(formatted);
  };

  const handleNextCertificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNextCertificationDate(e.target.value);
    setNextCertificationDate(formatted);
  };

  // Calcular estado de certificación
  const calculateCertificationStatus = (nextCertDate: string): 'vigente' | 'vencida' | null => {
    if (!nextCertDate || certificationDatesNotReadable) return null;
    
    try {
      // nextCertDate viene en formato mm/aaaa
      const [month, year] = nextCertDate.split('/').map(Number);
      
      // La certificación es válida hasta el día 14 del mes indicado
      // Del día 15 en adelante se considera vencida
      const certExpirationDate = new Date(year, month - 1, 14, 23, 59, 59);
      const today = new Date();
      
      return today <= certExpirationDate ? 'vigente' : 'vencida';
    } catch {
      return null;
    }
  };

  // Guardar fechas de certificación y continuar al checklist
  const handleSaveCertificationDates = async () => {
    if (!currentChecklistId) {
      alert('Error: No se ha creado el checklist');
      return;
    }

    if (!certificationDatesNotReadable) {
      // Validar fechas
      if (!validateLastCertificationDate(lastCertificationDate)) {
        alert('Fecha de "Última certificación" inválida. Verifique el formato dd/mm/aaaa y que la fecha sea válida.');
        return;
      }
      
      if (!validateNextCertificationDate(nextCertificationDate)) {
        alert('Fecha de "Próxima certificación" inválida. Verifique el formato mm/aaaa y que la fecha sea válida.');
        return;
      }
    }

    try {
      console.log('Guardando fechas de certificación:', {
        currentChecklistId,
        last_certification_date: certificationDatesNotReadable ? null : lastCertificationDate,
        next_certification_date: certificationDatesNotReadable ? null : nextCertificationDate,
        certification_dates_readable: !certificationDatesNotReadable,
        certification_status: certificationDatesNotReadable ? null : certificationStatus
      });

      // Guardar en mnt_checklists
      const { data, error } = await supabase
        .from('mnt_checklists')
        .update({
          last_certification_date: certificationDatesNotReadable ? null : lastCertificationDate,
          next_certification_date: certificationDatesNotReadable ? null : nextCertificationDate,
          certification_dates_readable: !certificationDatesNotReadable,
          certification_status: certificationDatesNotReadable ? null : certificationStatus
        })
        .eq('id', currentChecklistId)
        .select();

      if (error) {
        console.error('Error de Supabase:', error);
        throw error;
      }

      console.log('Fechas guardadas exitosamente:', data);

      // Ocultar formulario de certificación y mostrar checklist
      setShowCertificationForm(false);
    } catch (error: any) {
      console.error('Error guardando fechas de certificación:', error);
      
      // Traducir errores comunes al español
      let errorMessage = 'Error desconocido al guardar las fechas de certificación';
      
      if (error?.message) {
        const msg = error.message.toLowerCase();
        
        if (msg.includes('invalid input syntax for type date')) {
          errorMessage = 'Error: Las columnas de fecha están configuradas incorrectamente en la base de datos. Por favor, ejecute el SQL de corrección.';
        } else if (msg.includes('column') && msg.includes('does not exist')) {
          errorMessage = 'Error: Las columnas de certificación no existen en la base de datos. Por favor, ejecute la migración SQL.';
        } else if (msg.includes('permission denied')) {
          errorMessage = 'Error: No tiene permisos para actualizar estos datos.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      alert(errorMessage);
    }
  };

  // Completar checklist individual
  const handleChecklistComplete = async () => {
    console.log('🔵 handleChecklistComplete INICIADO');
    console.log('currentChecklistId:', currentChecklistId);
    console.log('viewMode antes:', viewMode);
    
    if (!currentChecklistId) {
      console.log('❌ No hay currentChecklistId, abortando');
      return;
    }
    
    try {
      console.log('Actualizando checklist en Supabase...');
      // Marcar como completado
      const { error } = await supabase
        .from('mnt_checklists')
        .update({ 
          status: 'completed',
          completion_date: new Date().toISOString()
        })
        .eq('id', currentChecklistId);
      
      if (error) {
        console.log('❌ Error en Supabase:', error);
        throw error;
      }
      
      console.log('✅ Checklist actualizado en Supabase');
      
      // Actualizar progreso
      if (selectedElevator) {
        console.log('Actualizando progreso del ascensor:', selectedElevator.id);
        const newProgress = new Map(checklistProgress);
        newProgress.set(selectedElevator.id, {
          elevator_id: selectedElevator.id,
          checklist_id: currentChecklistId,
          status: 'completed'
        });
        setChecklistProgress(newProgress);
      }
      
      console.log('🟢 Cambiando viewMode a elevator-selection...');
      // Volver a selección de ascensores
      setViewMode('elevator-selection');
      
      // NO limpiar currentChecklistId y selectedElevator aquí porque causa problemas de renderizado
      // React no actualiza el estado inmediatamente y el componente sigue mostrando el form
      
      // Limpiar después de un pequeño delay para que React procese el cambio de viewMode primero
      setTimeout(() => {
        setCurrentChecklistId(null);
        setSelectedElevator(null);
        console.log('Estado limpiado después del cambio de vista');
      }, 100);
      
      console.log('viewMode después:', 'elevator-selection');
      alert('✓ Checklist completado exitosamente. Puedes continuar con el siguiente ascensor o finalizar y firmar.');
    } catch (error) {
      console.error('❌ Error al completar checklist:', error);
      alert('Error al completar el checklist. Por favor intenta de nuevo.');
    }
  };

  // Auto-guardado del checklist
  const handleChecklistSave = () => {
    console.log('Checklist auto-guardado');
  };

  // Abrir modal de firma cuando todos los ascensores estén completos
  const handleFinishAllChecklists = () => {
    const completedCount = Array.from(checklistProgress.values())
      .filter(p => p.status === 'completed').length;
    
    if (completedCount === 0) {
      alert('Debes completar al menos un checklist antes de firmar');
      return;
    }
    
    setShowSignatureModal(true);
  };

  // Guardar firma y generar PDFs
  const handleSignatureConfirm = async (signerName: string, signatureDataURL: string) => {
    if (!selectedClient) return;
    
    const completedChecklists = Array.from(checklistProgress.values())
      .filter(p => p.status === 'completed');
    
    try {
      // Paso 1: Actualizar todos los checklists completados con la firma
      for (const progress of completedChecklists) {
        await supabase
          .from('mnt_checklists')
          .update({
            signer_name: signerName,
            signature_url: signatureDataURL,
            signed_at: new Date().toISOString()
          })
          .eq('id', progress.checklist_id);
      }
      
      setShowSignatureModal(false);
      
      // Paso 2: Generar PDFs para cada checklist
      alert(`Firma guardada. Generando ${completedChecklists.length} PDF(s)...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const progress of completedChecklists) {
        try {
          await generateAndUploadPDF(progress.checklist_id, signerName, signatureDataURL);
          successCount++;
        } catch (error) {
          console.error(`Error generando PDF para checklist ${progress.checklist_id}:`, error);
          errorCount++;
        }
      }
      
      if (errorCount > 0) {
        alert(`Se firmaron ${completedChecklists.length} checklist(s). Se generaron ${successCount} PDF(s) correctamente. ${errorCount} fallaron.`);
      } else {
        alert(`✅ Se firmaron y generaron ${successCount} PDF(s) exitosamente.`);
      }
      
      // Resetear y volver al inicio
      setChecklistProgress(new Map());
      setSelectedClient(null);
      setElevators([]);
      setViewMode('main');
      
    } catch (error) {
      console.error('Error en el proceso de firma:', error);
      alert('Error al procesar la firma. Por favor, intente nuevamente.');
    }
  };

  // Generar y subir PDF a Supabase Storage
  const generateAndUploadPDF = async (checklistId: string, signerName: string, signatureDataURL: string) => {
    // Obtener datos completos del checklist
    const { data: checklistData, error: checklistError } = await supabase
      .from('mnt_checklists')
      .select(`
        id,
        folio,
        month,
        year,
        completion_date,
        last_certification_date,
        next_certification_date,
        certification_dates_readable,
        certification_status,
        client_id,
        elevator_id,
        clients(company_name, building_name, internal_alias, address),
        elevators(elevator_number, location_name, elevator_type),
        profiles(full_name)
      `)
      .eq('id', checklistId)
      .single();
    
    if (checklistError || !checklistData) {
      throw new Error('No se pudo obtener los datos del checklist');
    }
    
    // Obtener respuestas del checklist
    const { data: responses, error: responsesError } = await supabase
      .from('mnt_checklist_answers')
      .select('question_id, status, observations')
      .eq('checklist_id', checklistId);
    
    if (responsesError) {
      console.error('Error obteniendo respuestas:', responsesError);
      throw new Error(`No se pudieron obtener las respuestas del checklist: ${responsesError.message}`);
    }
    
    // Obtener las preguntas del maestro con frecuencia y is_hydraulic_only
    const { data: questions, error: questionsError } = await supabase
      .from('mnt_checklist_questions')
      .select('id, question_number, section, question_text, frequency, is_hydraulic_only')
      .order('question_number');
    
    if (questionsError) {
      console.error('Error obteniendo preguntas:', questionsError);
      throw new Error(`No se pudieron obtener las preguntas: ${questionsError.message}`);
    }
    
    console.log('📊 Total de preguntas obtenidas:', questions?.length);
    console.log('📋 Preguntas hidráulicas encontradas:', questions?.filter(q => q.is_hydraulic_only).map(q => ({
      num: q.question_number,
      text: q.question_text.substring(0, 50) + '...'
    })));
    
    // Crear mapa de preguntas por ID
    const questionMap = new Map(questions?.map(q => [q.id, q]) || []);
    const responsesMap = new Map((responses || []).map((r: any) => [r.question_id, r]));
    
    
    // Determinar qué preguntas mostrar y con qué estado
    const elevatorType = checklistData.elevators?.elevator_type || 'electromechanical';
    const currentMonth = checklistData.month;
    
    console.log('🏢 TIPO DE ASCENSOR:', {
      raw: checklistData.elevators?.elevator_type,
      final: elevatorType,
      comparison: elevatorType === 'electromechanical',
      trimmed: elevatorType.trim(),
      length: elevatorType.length
    });
    
    // Lógica de frecuencias (igual que DynamicChecklistForm)
    const isQuarterlyMonth = (month: number) => [3, 6, 9, 12].includes(month);
    const isSemesterMonth = (month: number) => [6, 12].includes(month);
    
    const allQuestions = (questions || []).map((q: any) => {
      const response = responsesMap.get(q.id);
      let finalStatus: string;
      
      // IMPORTANTE: Primero obtener la respuesta del técnico
      const technicianStatus = response?.status || 'approved';
      
      // Debug para preguntas hidráulicas
      if (q.question_number >= 18 && q.question_number <= 20) {
        console.log(`🔍 Pregunta ${q.question_number}:`, {
          is_hydraulic_only: q.is_hydraulic_only,
          type: typeof q.is_hydraulic_only,
          elevatorType: elevatorType,
          technicianStatus: technicianStatus,
          condition1: q.is_hydraulic_only,
          condition2: elevatorType === 'electromechanical',
          bothTrue: q.is_hydraulic_only && elevatorType === 'electromechanical'
        });
      }
      
      // Determinar estado según reglas (PRIORIDAD: reglas automáticas > respuesta técnico)
      if (q.is_hydraulic_only && elevatorType === 'electromechanical') {
        console.log(`✅ Pregunta ${q.question_number} marcada como NO APLICA (hidráulica en electromecánico)`);
        finalStatus = 'not_applicable'; // Gris automático - IGNORA respuesta del técnico
      } else if (q.frequency === 'T' && !isQuarterlyMonth(currentMonth)) {
        finalStatus = 'out_of_period'; // Celeste automático - IGNORA respuesta del técnico
      } else if (q.frequency === 'S' && !isSemesterMonth(currentMonth)) {
        finalStatus = 'out_of_period'; // Celeste automático - IGNORA respuesta del técnico
      } else {
        // Usar respuesta del técnico (verde/rojo)
        finalStatus = technicianStatus;
      }
      
      // Debug para verificar preguntas hidráulicas
      if (q.question_number >= 18 && q.question_number <= 20) {
        console.log(`Pregunta ${q.question_number}:`, {
          text: q.question_text,
          is_hydraulic_only: q.is_hydraulic_only,
          elevatorType,
          finalStatus
        });
      }
      
      return {
        id: q.id,
        number: q.question_number,
        section: q.section,
        text: q.question_text,
        status: finalStatus,
        observations: response?.observations || null
      };
    }).sort((a, b) => a.number - b.number);
    
    // Preparar datos para el PDF con todas las preguntas
    const pdfData: MaintenanceChecklistPDFData = {
      checklistId: checklistData.id,
      folioNumber: checklistData.folio,
      clientName: checklistData.clients?.company_name || checklistData.clients?.building_name || 'Cliente no especificado',
      clientAddress: checklistData.clients?.address,
      elevatorNumber: checklistData.elevators?.elevator_number,
      month: checklistData.month,
      year: checklistData.year,
      completionDate: checklistData.completion_date,
      lastCertificationDate: checklistData.last_certification_date,
      nextCertificationDate: checklistData.next_certification_date,
      technicianName: checklistData.profiles?.full_name || 'Técnico no especificado',
      certificationStatus: checklistData.certification_dates_readable === false 
        ? 'no_legible' 
        : (checklistData.certification_status === 'vigente' ? 'vigente' : 'vencida'),
      questions: allQuestions,
      signature: {
        signerName: signerName,
        signedAt: new Date().toISOString(),
        signatureDataUrl: signatureDataURL
      }
    };
    
    // Generar PDF
    const pdfBlob = await generateMaintenanceChecklistPDF(pdfData);
    
    // Nombre del archivo
    const fileName = `mantenimiento_${checklistData.clients?.internal_alias || 'cliente'}_asc${checklistData.elevators?.elevator_number || 'X'}_${checklistData.month}-${checklistData.year}_${Date.now()}.pdf`;
    const filePath = `${checklistData.clients?.internal_alias || 'general'}/${fileName}`;
    
    // Subir a Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('maintenance-pdfs')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Error subiendo PDF: ${uploadError.message}`);
    }
    
    // Obtener URL pública del PDF
    const { data: urlData } = supabase.storage
      .from('maintenance-pdfs')
      .getPublicUrl(filePath);
    
    if (!urlData) {
      throw new Error('No se pudo obtener la URL del PDF');
    }
    
    // Guardar URL en la base de datos
    const { error: updateError } = await supabase
      .from('mnt_checklists')
      .update({ pdf_url: urlData.publicUrl })
      .eq('id', checklistId);
    
    if (updateError) {
      throw new Error(`Error guardando URL del PDF: ${updateError.message}`);
    }
    
    console.log(`✅ PDF generado y guardado: ${urlData.publicUrl}`);
    
    // NUEVO: Crear solicitudes automáticas desde observaciones
    await createServiceRequestsFromChecklist(
      checklistId,
      checklistData.elevator_id,
      checklistData.client_id,
      allQuestions
    );
  };
  
  // Crear solicitudes de servicio automáticas desde observaciones
  const createServiceRequestsFromChecklist = async (
    checklistId: string,
    elevatorId: string,
    clientId: string,
    questions: any[]
  ) => {
    try {
      // Validar que tengamos los IDs necesarios
      if (!elevatorId || !clientId) {
        console.error('❌ No se pueden crear solicitudes: falta elevator_id o client_id');
        console.log('elevatorId:', elevatorId, 'clientId:', clientId);
        return;
      }

      // Obtener respuestas con fotos desde la base de datos
      const { data: answers, error: answersError } = await supabase
        .from('mnt_checklist_answers')
        .select('question_id, photo_1_url, photo_2_url')
        .eq('checklist_id', checklistId);

      if (answersError) {
        console.error('Error obteniendo fotos de respuestas:', answersError);
      }

      console.log('🔍 DEBUG - Respuestas con fotos:', answers);
      console.log('🔍 DEBUG - Preguntas rechazadas:', questions.filter(q => q.status === 'rejected'));

      const photosMap = new Map(
        (answers || []).map(a => [a.question_id, { photo1: a.photo_1_url, photo2: a.photo_2_url }])
      );

      console.log('🔍 DEBUG - Mapa de fotos:', Array.from(photosMap.entries()));

      // Filtrar preguntas rechazadas con observaciones
      const rejectedQuestions = questions
        .filter(q => q.status === 'rejected' && q.observations && q.observations.trim() !== '')
        .map(q => {
          const photos = photosMap.get(q.id) || { photo1: null, photo2: null };
          console.log(`🔍 DEBUG - Pregunta ${q.number} (ID: ${q.id}):`, photos);
          return {
            question_number: q.number,
            text: q.text,
            observations: q.observations,
            is_critical: q.section === 'SALA DE MÁQUINAS' || q.section === 'GRUPO HIDRÁULICO, CILINDRO Y VÁLVULAS',
            observation_photo_1: photos.photo1,
            observation_photo_2: photos.photo2
          };
        });
      
      if (rejectedQuestions.length === 0) {
        console.log('No hay observaciones para crear solicitudes');
        return;
      }
      
      console.log(`📋 Creando ${rejectedQuestions.length} solicitud(es) de servicio automáticas...`);
      
      const results = await createRequestsFromMaintenance(
        checklistId,
        elevatorId,
        clientId,
        profile?.id || '',
        rejectedQuestions
      );
      
      console.log(`✅ ${results.length} solicitud(es) creada(s) exitosamente`);
    } catch (error) {
      console.error('Error creando solicitudes automáticas:', error);
      // No bloqueamos el flujo si falla la creación de solicitudes
    }
  };

  // Cargar historial
  const loadHistory = async () => {
    setLoadingHistory(true);
    console.log('📚 Cargando historial de mantenimientos para:', profile?.id);
    const { data, error } = await supabase
      .from('mnt_checklists')
      .select(`
        id,
        month,
        year,
        completion_date,
        folio,
        status,
        clients(company_name, building_name, internal_alias),
        elevators(location_name, elevator_number)
      `)
      .eq('technician_id', profile?.id)
      .eq('status', 'completed')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('completion_date', { ascending: false });
    
    console.log('✅ Historial cargado:', { count: data?.length, error });

    if (!error && data) {
      console.log('📊 Datos del historial:', data.slice(0, 3)); // Mostrar primeros 3
      setHistory(data);
    }
    setLoadingHistory(false);
  };

  const handleViewHistory = () => {
    loadHistory();
    setViewMode('history');
  };

  // Cargar checklists en progreso
  const loadInProgressChecklists = async () => {
    setLoadingInProgress(true);
    const { data, error } = await supabase
      .from('mnt_checklists')
      .select(`
        id,
        month,
        year,
        created_at,
        folio,
        status,
        clients(id, company_name, building_name, internal_alias),
        elevators(id, location_name, elevator_number, elevator_type)
      `)
      .eq('technician_id', profile?.id)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInProgressChecklists(data);
    }
    setLoadingInProgress(false);
  };

  const handleViewInProgress = () => {
    loadInProgressChecklists();
    setViewMode('in-progress');
  };

  const handleResumeChecklist = (checklist: any) => {
    setSelectedClient(checklist.clients);
    setSelectedElevator(checklist.elevators);
    setCurrentChecklistId(checklist.id);
    setSelectedMonth(checklist.month);
    setSelectedYear(checklist.year);
    setViewMode('checklist-form');
  };

  // Ver PDF en nueva pestaña
  const handleViewPDF = async (checklistId: string) => {
    const { data, error } = await supabase
      .from('mnt_checklists')
      .select('pdf_url')
      .eq('id', checklistId)
      .single();
    
    if (error || !data?.pdf_url) {
      alert('PDF no disponible. Puede que aún no se haya generado.');
      return;
    }
    
    window.open(data.pdf_url, '_blank');
  };

  // Descargar PDF
  const handleDownloadPDF = async (checklistId: string) => {
    const { data, error } = await supabase
      .from('mnt_checklists')
      .select('pdf_url, clients(internal_alias), elevators(elevator_number), month, year')
      .eq('id', checklistId)
      .single();
    
    if (error || !data?.pdf_url) {
      alert('PDF no disponible. Puede que aún no se haya generado.');
      return;
    }
    
    // Descargar el PDF
    const response = await fetch(data.pdf_url);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mantenimiento_${data.clients?.internal_alias}_asc${data.elevators?.elevator_number}_${data.month}-${data.year}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Compartir PDF (copiar enlace)
  const handleSharePDF = async (checklistId: string) => {
    const { data, error } = await supabase
      .from('mnt_checklists')
      .select('pdf_url')
      .eq('id', checklistId)
      .single();
    
    if (error || !data?.pdf_url) {
      alert('PDF no disponible. Puede que aún no se haya generado.');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(data.pdf_url);
      alert('✅ Enlace del PDF copiado al portapapeles');
    } catch (err) {
      alert('No se pudo copiar el enlace. URL: ' + data.pdf_url);
    }
  };

  const handleBackToMain = () => {
    setViewMode('main');
    setSelectedClient(null);
    setElevators([]);
    setChecklistProgress(new Map());
  };

  // Clientes filtrados por búsqueda
  const filteredClients = clients.filter(c => 
    c.internal_alias?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.building_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (viewMode === 'client-selection') {
      loadClients();
    }
  }, [viewMode]);

  // ============= VISTAS =============

  // Vista principal
  if (viewMode === 'main') {
    const completedCount = Array.from(checklistProgress.values())
      .filter(p => p.status === 'completed').length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 bg-blue-100 rounded-xl">
                <ClipboardList className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Checklist de Mantenimiento</h1>
                <p className="text-slate-600">Registra mantenimientos preventivos</p>
              </div>
            </div>

            {selectedClient && completedCount > 0 && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-900">
                  Mantenimiento en progreso: {selectedClient.internal_alias || selectedClient.building_name}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  {completedCount} ascensor(es) completado(s)
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={() => setShowQRScanner(true)}
                className="w-full flex items-center justify-between p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg transition group"
              >
                <div className="flex items-center gap-3">
                  <QrCode className="w-6 h-6" />
                  <div className="text-left">
                    <p className="font-semibold">Escanear Código QR</p>
                    <p className="text-xs text-blue-100">Buscar cliente por QR</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition" />
              </button>

              <button
                onClick={() => setViewMode('client-selection')}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-xl transition group"
              >
                <div className="flex items-center gap-3">
                  <Search className="w-6 h-6 text-slate-600" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Buscar Cliente Manualmente</p>
                    <p className="text-xs text-slate-600">Seleccionar de la lista</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition" />
              </button>

              <button
                onClick={handleViewInProgress}
                className="w-full flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 border-2 border-amber-200 rounded-xl transition group"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-amber-600" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Checklists en Progreso</p>
                    <p className="text-xs text-amber-700">Retomar checklists incompletos</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition" />
              </button>

              <button
                onClick={handleViewHistory}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border-2 border-slate-200 rounded-xl transition group"
              >
                <div className="flex items-center gap-3">
                  <History className="w-6 h-6 text-slate-600" />
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">Ver Historial</p>
                    <p className="text-xs text-slate-600">Checklists completados</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:translate-x-1 transition" />
              </button>
            </div>
          </div>

          {selectedClient && completedCount > 0 && (
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <button
                onClick={() => setViewMode('elevator-selection')}
                className="w-full mb-3 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
              >
                Continuar con {selectedClient.internal_alias || selectedClient.building_name}
              </button>
              <button
                onClick={handleFinishAllChecklists}
                className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold"
              >
                Firmar y Finalizar ({completedCount} completado{completedCount !== 1 ? 's' : ''})
              </button>
            </div>
          )}
        </div>

        {showQRScanner && (
          <QRScanner 
            onScanSuccess={handleQRScan} 
            onClose={() => setShowQRScanner(false)} 
          />
        )}
      </div>
    );
  }

  // Vista de selección de cliente
  if (viewMode === 'client-selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleBackToMain}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-slate-900">Seleccionar Cliente</h2>
            </div>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Buscar por nombre interno, razón social o edificio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleSelectClient(client)}
                  className="w-full p-4 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {client.internal_alias || client.building_name}
                      </p>
                      <p className="text-sm text-slate-600">{client.company_name}</p>
                      <p className="text-xs text-slate-500 mt-1">{client.address}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
                  </div>
                </button>
              ))}

              {filteredClients.length === 0 && (
                <p className="text-center text-slate-500 py-8">No se encontraron clientes</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vista de selección de ascensores
  if (viewMode === 'elevator-selection' && selectedClient) {
    const completedCount = Array.from(checklistProgress.values())
      .filter(p => p.status === 'completed').length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleBackToMain}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedClient.internal_alias || selectedClient.building_name}
                </h2>
                <p className="text-sm text-slate-600">{selectedClient.company_name}</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-900">Periodo del Mantenimiento</p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {new Date(2025, m - 1).toLocaleString('es-CL', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-blue-200 rounded-lg text-sm"
                >
                  {[2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">
                Selecciona los ascensores para realizar el mantenimiento:
              </p>
              <p className="text-xs text-slate-500">
                {completedCount > 0 
                  ? `${completedCount} de ${elevators.length} completado(s)`
                  : 'Ningún ascensor completado aún'}
              </p>
            </div>

            <div className="space-y-3">
              {elevators.map((elevator) => {
                const progress = checklistProgress.get(elevator.id);
                const isCompleted = progress?.status === 'completed';

                return (
                  <button
                    key={elevator.id}
                    onClick={() => handleStartChecklist(elevator)}
                    className={`w-full p-4 rounded-xl border-2 transition ${
                      isCompleted
                        ? 'bg-green-50 border-green-300'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isCompleted ? 'bg-green-100' : 'bg-slate-100'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <Clock className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-slate-900">
                            Ascensor {elevator.elevator_number}
                          </p>
                          <p className="text-xs text-slate-600">
                            {elevator.location_name} • {elevator.capacity_kg} kg
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>

            {completedCount > 0 && (
              <button
                onClick={handleFinishAllChecklists}
                className="w-full mt-6 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Firmar y Finalizar Mantenimiento
              </button>
            )}
          </div>
        </div>

        {showSignatureModal && (
          <ChecklistSignatureModal
            open={showSignatureModal}
            onClose={() => setShowSignatureModal(false)}
            onConfirm={handleSignatureConfirm}
            clientName={selectedClient.internal_alias || selectedClient.building_name}
            elevatorSummary={`${completedCount} ascensor(es) completado(s)`}
            periodLabel={`${new Date(selectedYear, selectedMonth - 1).toLocaleString('es-CL', { month: 'long' })} ${selectedYear}`}
          />
        )}
      </div>
    );
  }

  // Vista del formulario de checklist
  if (viewMode === 'checklist-form' && currentChecklistId && selectedElevator && selectedClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setViewMode('elevator-selection')}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedClient.internal_alias || selectedClient.building_name} - Ascensor {selectedElevator.elevator_number}
                </h2>
                <p className="text-sm text-slate-600">
                  {new Date(selectedYear, selectedMonth - 1).toLocaleString('es-CL', { month: 'long' })} {selectedYear}
                </p>
              </div>
            </div>
          </div>

          {showCertificationForm ? (
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">📋 Datos de Certificación del Ascensor</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <input
                    type="checkbox"
                    id="notReadable"
                    checked={certificationDatesNotReadable}
                    onChange={(e) => setCertificationDatesNotReadable(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="notReadable" className="text-sm font-medium text-slate-700 cursor-pointer">
                    Las fechas de certificación NO son legibles
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Última Certificación (dd/mm/aaaa)
                  </label>
                  <input
                    type="text"
                    value={lastCertificationDate}
                    onChange={handleLastCertificationChange}
                    disabled={certificationDatesNotReadable}
                    placeholder="01/12/2024"
                    maxLength={10}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Próxima Certificación (mm/aaaa)
                  </label>
                  <input
                    type="text"
                    value={nextCertificationDate}
                    onChange={handleNextCertificationChange}
                    disabled={certificationDatesNotReadable}
                    placeholder="12/2025"
                    maxLength={7}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                {certificationDatesNotReadable ? (
                  <div className="p-3 rounded-lg text-center font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                    Estado: Certificación no visible
                  </div>
                ) : certificationStatus && (
                  <div className={`p-3 rounded-lg text-center font-semibold ${
                    certificationStatus === 'vigente' 
                      ? 'bg-green-100 text-green-800 border border-green-300' 
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}>
                    Estado: {certificationStatus === 'vigente' ? '✓ VIGENTE' : '⚠ VENCIDA'}
                  </div>
                )}

                <button
                  onClick={handleSaveCertificationDates}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Continuar al Checklist
                </button>
              </div>
            </div>
          ) : (
            <DynamicChecklistForm
              checklistId={currentChecklistId}
              elevatorId={selectedElevator.id}
              isHydraulic={selectedElevator.elevator_type === 'hydraulic'}
              month={selectedMonth}
              onComplete={handleChecklistComplete}
              onSave={handleChecklistSave}
            />
          )}
        </div>
      </div>
    );
  }

  // Vista de checklists en progreso
  if (viewMode === 'in-progress') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleBackToMain}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">Checklists en Progreso</h2>
                <p className="text-sm text-slate-600">Retoma checklists incompletos</p>
              </div>
            </div>

            {loadingInProgress ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : inProgressChecklists.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">No hay checklists en progreso</p>
                <p className="text-sm text-slate-500 mt-2">Todos tus checklists están completados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {inProgressChecklists.map((checklist) => {
                  const clientName = checklist.clients?.internal_alias || checklist.clients?.building_name || 'Sin nombre';
                  const elevatorInfo = `Ascensor ${checklist.elevators?.elevator_number || '-'}`;
                  const monthName = new Date(checklist.year, checklist.month - 1).toLocaleString('es-CL', { month: 'long' });
                  const periodLabel = `${monthName} ${checklist.year}`;
                  const createdDate = new Date(checklist.created_at).toLocaleDateString('es-CL');

                  return (
                    <button
                      key={checklist.id}
                      onClick={() => handleResumeChecklist(checklist)}
                      className="w-full p-4 bg-white hover:bg-amber-50 border-2 border-amber-200 rounded-xl transition text-left group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-amber-600" />
                            <p className="font-semibold text-slate-900">{clientName}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{elevatorInfo}</span>
                            <span>•</span>
                            <span>{periodLabel}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            Iniciado: {createdDate}
                          </p>
                          {checklist.folio && (
                            <p className="text-xs text-amber-600 font-mono mt-1">
                              Folio: {checklist.folio}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                            En progreso
                          </span>
                          <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Vista de historial
  if (viewMode === 'history') {
    // Verificar si hay al menos un filtro seleccionado (NO mostrar listado infinito)
    const hasActiveFilter = 
      historySearchQuery !== '' || 
      historyFilterYear !== 'all' || 
      historyFilterMonth !== 'all' || 
      historyFilterStatus !== 'all' ||
      historyFilterElevator !== '';

    // Filtrar historial
    const filteredHistory = history.filter(h => {
      const clientName = h.clients?.internal_alias || h.clients?.building_name || h.clients?.company_name || '';
      const matchesSearch = historySearchQuery === '' || 
        clientName.toLowerCase().includes(historySearchQuery.toLowerCase());
      const matchesYear = historyFilterYear === 'all' || h.year === historyFilterYear;
      const matchesMonth = historyFilterMonth === 'all' || h.month === historyFilterMonth;
      const matchesStatus = historyFilterStatus === 'all' || 
        (historyFilterStatus === 'completed' && h.status === 'completed') ||
        (historyFilterStatus === 'pending' && h.status !== 'completed');
      const matchesElevator = historyFilterElevator === '' || 
        String(h.elevators?.elevator_number) === historyFilterElevator;
      
      return matchesSearch && matchesYear && matchesMonth && matchesStatus && matchesElevator;
    });

    const groupedHistory = filteredHistory.reduce((acc: any, h: any) => {
      const building = h.clients?.internal_alias || h.clients?.building_name || 'Sin nombre';
      const monthName = new Date(h.completion_date || `${h.year}-${String(h.month).padStart(2,'0')}-01`)
        .toLocaleString('es-CL', { month: 'long' });
      const key = `${monthName} ${h.year}`;
      
      if (!acc[building]) acc[building] = {};
      if (!acc[building][key]) acc[building][key] = [];
      acc[building][key].push(h);
      return acc;
    }, {});

    const totalCompleted = history.filter(h => h.status === 'completed').length;
    const totalPending = history.filter(h => h.status !== 'completed').length;

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={handleBackToMain}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">Historial de Mantenimientos</h2>
                <p className="text-sm text-slate-600">Todos los mantenimientos registrados</p>
              </div>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 mb-1">Completados</p>
                <p className="text-3xl font-bold text-green-900">{totalCompleted}</p>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700 mb-1">Pendientes</p>
                <p className="text-3xl font-bold text-amber-900">{totalPending}</p>
              </div>
            </div>

            {/* Filtros */}
            <div className="space-y-3 mb-6 p-4 bg-slate-50 rounded-lg border-2 border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-semibold text-slate-700">Filtros de búsqueda</p>
                <span className="text-xs text-slate-500">(Selecciona al menos un filtro)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Buscar Edificio</label>
                  <input
                    type="text"
                    placeholder="Nombre edificio..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">N° Ascensor</label>
                  <input
                    type="text"
                    placeholder="Ej: 1, 2, 3..."
                    value={historyFilterElevator}
                    onChange={(e) => setHistoryFilterElevator(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                  <select
                    value={historyFilterStatus}
                    onChange={(e) => setHistoryFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Todos</option>
                    <option value="completed">Completados</option>
                    <option value="pending">Pendientes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
                  <select
                    value={historyFilterYear}
                    onChange={(e) => setHistoryFilterYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Todos</option>
                    {[2024, 2025, 2026].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mes</label>
                  <select
                    value={historyFilterMonth}
                    onChange={(e) => setHistoryFilterMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">Todos</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>
                        {new Date(2025, m - 1).toLocaleString('es-CL', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setHistorySearchQuery('');
                      setHistoryFilterYear('all');
                      setHistoryFilterMonth('all');
                      setHistoryFilterStatus('all');
                      setHistoryFilterElevator('');
                    }}
                    className="w-full px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>

            {loadingHistory ? (
              <p className="text-center py-8 text-slate-500">Cargando...</p>
            ) : !hasActiveFilter ? (
              <div className="text-center py-12 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <Search className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                <p className="text-blue-900 font-semibold mb-2">Selecciona al menos un filtro</p>
                <p className="text-sm text-blue-700">
                  Para evitar listados infinitos, debes seleccionar edificio, N° ascensor, año, mes o estado
                </p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 border-2 border-slate-200 rounded-lg">
                <History className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">No se encontraron mantenimientos</p>
                <p className="text-sm text-slate-500 mt-2">Intenta ajustar los filtros</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedHistory).map((building) => (
                  <div key={building} className="border-b border-slate-200 pb-4 last:border-0">
                    <h3 className="font-semibold text-lg text-slate-900 mb-3">{building}</h3>
                    {Object.keys(groupedHistory[building]).map((period) => (
                      <div key={period} className="ml-4 mb-3">
                        <h4 className="font-medium text-slate-700 mb-2">{period}</h4>
                        <ul className="space-y-2">
                          {groupedHistory[building][period].map((h: any) => (
                            <li key={h.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
                              <div className="flex items-center gap-2">
                                {h.status === 'completed' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                  <Clock className="w-4 h-4 text-amber-600" />
                                )}
                                <span className="text-sm font-medium text-slate-900">
                                  Ascensor {h.elevators?.elevator_number ?? '?'}
                                </span>
                                {h.status !== 'completed' && (
                                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                    Pendiente
                                  </span>
                                )}
                              </div>
                              {h.status === 'completed' && (
                                <div className="flex gap-2">
                                  <button 
                                    className="p-1.5 hover:bg-slate-200 rounded text-slate-600"
                                    title="Ver PDF"
                                    onClick={() => handleViewPDF(h.id)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button 
                                    className="p-1.5 hover:bg-slate-200 rounded text-slate-600"
                                    title="Descargar PDF"
                                    onClick={() => handleDownloadPDF(h.id)}
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button 
                                    className="p-1.5 hover:bg-slate-200 rounded text-slate-600"
                                    title="Compartir"
                                    onClick={() => handleSharePDF(h.id)}
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
