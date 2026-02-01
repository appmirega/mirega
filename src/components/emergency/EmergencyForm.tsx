import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  ArrowLeft, 
  AlertTriangle, 
  Camera, 
  Save, 
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { ManualServiceRequestForm } from '../forms/ManualServiceRequestForm';
import { generateEmergencyVisitPDF, EmergencyVisitPDFData } from '../../utils/emergencyVisitPDF';

interface EmergencyFormProps {
  clientId: string;
  elevatorIds: string[];
  onComplete: () => void;
  onCancel: () => void;
  existingVisitId?: string; // Para continuar emergencias en progreso
}

interface ElevatorInfo {
  id: string;
  elevator_number: number;
  brand: string;
  model: string;
  location_name: string;
}

interface LastEmergency {
  visit_date: string;
  days_since_last_emergency: number;
}

export function EmergencyForm({ clientId, elevatorIds, onComplete, onCancel, existingVisitId }: EmergencyFormProps) {
  console.log('🚨 ========== EMERGENCYFORM MONTADO ==========');
  console.log('📥 Props recibidas:', { clientId, elevatorIds: elevatorIds.length, existingVisitId });
  console.log('🔑 existingVisitId tipo:', typeof existingVisitId, 'valor:', existingVisitId);
  
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visitId, setVisitId] = useState<string | null>(existingVisitId || null);
  
  console.log('📍 visitId inicial (state):', visitId);
  
  // Datos del cliente y ascensores
  const [clientName, setClientName] = useState('');
  const [elevators, setElevators] = useState<ElevatorInfo[]>([]);
  const [lastEmergencies, setLastEmergencies] = useState<Map<string, LastEmergency>>(new Map());
  
  // Estado inicial de ascensores (Paso 2)
  const [elevatorInitialStatus, setElevatorInitialStatus] = useState<Map<string, 'operational' | 'stopped'>>(new Map());
  
  // Descripción de falla (Paso 3)
  const [failureDescription, setFailureDescription] = useState('');
  const [failurePhoto1, setFailurePhoto1] = useState<File | null>(null);
  const [failurePhoto2, setFailurePhoto2] = useState<File | null>(null);
  const [failurePhoto1Url, setFailurePhoto1Url] = useState('');
  const [failurePhoto2Url, setFailurePhoto2Url] = useState('');
  
  // Estado final (Paso 5)
  const [finalStatus, setFinalStatus] = useState<'operational' | 'observation' | 'stopped' | ''>('');
  
  // Resolución (Paso 7)
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [resolutionPhoto1, setResolutionPhoto1] = useState<File | null>(null);
  const [resolutionPhoto2, setResolutionPhoto2] = useState<File | null>(null);
  const [resolutionPhoto1Url, setResolutionPhoto1Url] = useState('');
  const [resolutionPhoto2Url, setResolutionPhoto2Url] = useState('');
  const [failureCause, setFailureCause] = useState<'normal_use' | 'third_party' | 'part_lifespan' | ''>('');
  
  // Firma (Paso 8)
  const [receiverName, setReceiverName] = useState('');
  const [signatureRef, setSignatureRef] = useState<SignatureCanvas | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  
  // Solicitud
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
  const [showServiceRequestModal, setShowServiceRequestModal] = useState(false);
  const [visitStartTime, setVisitStartTime] = useState<string>(''); // Hora de inicio del formulario
  
  // Control de UI
  const [currentStep, setCurrentStep] = useState(1);
  const [showWarning, setShowWarning] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Cargar datos iniciales SOLO UNA VEZ
  useEffect(() => {
    if (initialized) return;
    console.log('🔄 useEffect loadInitialData ejecutándose...');
    loadInitialData();
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Función de auto-guardado (DEFINIDA ANTES DEL useEffect)
  const autoSave = useCallback(async () => {
    console.log('🔍 autoSave LLAMADO - visitId:', visitId);
    
    if (!visitId) {
      console.warn('⚠️ autoSave: NO HAY visitId, abortando');
      return;
    }
    
    console.log('✅ autoSave: visitId válido, procediendo a guardar');
    
    try {
      const dataToSave = {
        failure_description: failureDescription || '',
        resolution_summary: resolutionSummary || '',
        final_status: finalStatus || null,
        failure_cause: failureCause || null,
        receiver_name: receiverName || '',
        service_request_id: serviceRequestId || null,
        failure_photo_1_url: failurePhoto1Url || null,
        failure_photo_2_url: failurePhoto2Url || null,
        resolution_photo_1_url: resolutionPhoto1Url || null,
        resolution_photo_2_url: resolutionPhoto2Url || null,
        last_autosave: new Date().toISOString()
      };
      
      console.log('💾 Auto-guardando:', {
        texto_descripcion: failureDescription?.length || 0,
        texto_resolucion: resolutionSummary?.length || 0,
        estado_final: finalStatus,
        causa: failureCause,
        receptor: receiverName
      });
      
      console.log('📤 Enviando a BD:', dataToSave);
      
      const { data, error } = await supabase
        .from('emergency_visits')
        .update(dataToSave)
        .eq('id', visitId)
        .select();
      
      if (error) {
        console.error('❌ Error auto-guardado:', error);
      } else {
        console.log('✅ Guardado OK - Respuesta BD:', data);
      }
      
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }, [
    visitId, 
    failureDescription, 
    resolutionSummary, 
    finalStatus,
    failureCause,
    receiverName,
    serviceRequestId,
    failurePhoto1Url,
    failurePhoto2Url,
    resolutionPhoto1Url,
    resolutionPhoto2Url
  ]);

  // Guardado automático cada 30 segundos como respaldo
  useEffect(() => {
    if (!visitId) return;
    
    console.log('⏰ Iniciando auto-guardado cada 30 segundos para visitId:', visitId);
    
    const interval = setInterval(() => {
      console.log('⏰ Ejecutando auto-guardado programado...');
      autoSave();
    }, 30000);
    
    return () => {
      console.log('⏹️ Deteniendo auto-guardado');
      clearInterval(interval);
    };
  }, [visitId, autoSave]);

  // Guardar cuando se desmonta el componente (navegación interna)
  useEffect(() => {
    return () => {
      if (visitId) {
        console.log('🔄 Componente desmontándose - guardando...');
        // Guardado síncrono usando fetch (más confiable en cleanup)
        const saveData = {
          failure_description: failureDescription || '',
          resolution_summary: resolutionSummary || '',
          final_status: finalStatus || null,
          failure_cause: failureCause || null,
          receiver_name: receiverName || '',
          service_request_id: serviceRequestId || null,
          failure_photo_1_url: failurePhoto1Url || null,
          failure_photo_2_url: failurePhoto2Url || null,
          resolution_photo_1_url: resolutionPhoto1Url || null,
          resolution_photo_2_url: resolutionPhoto2Url || null,
        };
        
        // Usar fetch directamente (más confiable en cleanup)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        fetch(`${supabaseUrl}/rest/v1/emergency_visits?id=eq.${visitId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(saveData),
          keepalive: true // Permite que la petición continúe aunque se cierre la pestaña
        });
      }
    };
  }, [visitId, failureDescription, resolutionSummary, finalStatus, failureCause, receiverName, serviceRequestId, failurePhoto1Url, failurePhoto2Url, resolutionPhoto1Url, resolutionPhoto2Url]);

  // Guardar antes de cerrar ventana/pestaña
  useEffect(() => {
    if (!visitId) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.log('🚪 Cerrando ventana - guardando...');
      autoSave();
      // No mostrar diálogo de confirmación
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [visitId, autoSave]);

  const loadInitialData = async () => {
    console.log('📊 Cargando datos iniciales para emergencia...');
    try {
      setLoading(true);
      
      // Cargar información del cliente
      console.log('🔍 Buscando cliente:', clientId);
      const { data: client } = await supabase
        .from('clients')
        .select('company_name')
        .eq('id', clientId)
        .single();
      
      if (client) setClientName(client.company_name);
      
      // Cargar información de ascensores
      const { data: elevatorsData } = await supabase
        .from('elevators')
        .select('id, elevator_number, brand, model, location_name')
        .in('id', elevatorIds);
      
      if (elevatorsData) {
        setElevators(elevatorsData);
        
        // Inicializar estados iniciales como operativos por defecto
        const initialStatuses = new Map();
        elevatorsData.forEach(e => initialStatuses.set(e.id, 'operational'));
        setElevatorInitialStatus(initialStatuses);
      }
      
      // Cargar últimas emergencias para cada ascensor
      const { data: lastEmergenciesData } = await supabase
        .from('last_emergency_by_elevator')
        .select('elevator_id, visit_date, days_since_last_emergency')
        .in('elevator_id', elevatorIds);
      
      if (lastEmergenciesData) {
        const emergenciesMap = new Map();
        lastEmergenciesData.forEach(e => emergenciesMap.set(e.elevator_id, e));
        setLastEmergencies(emergenciesMap);
      }
      
      // Cargar borrador existente o crear uno nuevo
      if (existingVisitId) {
        await loadDraftData(existingVisitId);
      } else {
        await createDraft();
      }
      
      console.log('✅ Datos iniciales cargados correctamente');
      
    } catch (error) {
      console.error('❌ Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createDraft = async () => {
    console.log('📝 Creando borrador de visita...');
    try {
      const startTime = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: true });
      setVisitStartTime(startTime);
      
      const { data, error } = await supabase
        .from('emergency_visits')
        .insert({
          client_id: clientId,
          technician_id: profile?.id,
          status: 'draft'
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creando borrador:', error);
        throw error;
      }
      
      console.log('✅ Borrador creado con ID:', data.id);
      setVisitId(data.id);
      
      // Insertar ascensores afectados
      const elevatorInserts = elevatorIds.map(elevId => ({
        emergency_visit_id: data.id,
        elevator_id: elevId,
        initial_status: 'operational'
      }));
      
      const { error: elevatorsError } = await supabase
        .from('emergency_visit_elevators')
        .insert(elevatorInserts);
      
      if (elevatorsError) {
        console.error('❌ Error insertando ascensores:', elevatorsError);
        throw elevatorsError;
      }
      
      console.log('✅ Ascensores vinculados al borrador');
      
    } catch (error) {
      console.error('❌ Error in createDraft:', error);
      throw error;
    }
  };

  const loadDraftData = async (draftVisitId: string) => {
    console.log('📂 ============ CARGANDO BORRADOR ============');
    console.log('🔑 Visit ID:', draftVisitId);
    try {
      setVisitId(draftVisitId);
      
      // Cargar datos de la visita
      const { data: visitData, error: visitError } = await supabase
        .from('emergency_visits')
        .select('*, created_at')
        .eq('id', draftVisitId)
        .single();
      
      if (visitError) {
        console.error('❌ Error al cargar de BD:', visitError);
        throw visitError;
      }
      
      console.log('💾 DATOS CRUDOS DE BD:', JSON.stringify(visitData, null, 2));
      
      console.log('💾 Valores específicos:', {
        failure_description: visitData.failure_description,
        failure_description_length: visitData.failure_description?.length || 0,
        resolution_summary: visitData.resolution_summary,
        resolution_summary_length: visitData.resolution_summary?.length || 0,
        final_status: visitData.final_status,
        failure_cause: visitData.failure_cause,
        receiver_name: visitData.receiver_name,
        fotos: {
          f1: visitData.failure_photo_1_url,
          f2: visitData.failure_photo_2_url,
          r1: visitData.resolution_photo_1_url,
          r2: visitData.resolution_photo_2_url
        }
      });
      
      // Capturar hora de creación
      if (visitData.created_at) {
        const createdDate = new Date(visitData.created_at);
        const startTime = createdDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: true });
        setVisitStartTime(startTime);
      }
      
      // Restaurar TODOS los estados del formulario (incluso si son strings vacíos)
      console.log('\n📝 RESTAURANDO CAMPOS:');
      
      if (visitData.failure_description !== undefined && visitData.failure_description !== null) {
        console.log('  ✅ Seteando failure_description:', visitData.failure_description.substring(0, 50));
        setFailureDescription(visitData.failure_description);
      } else {
        console.log('  ❌ failure_description es null/undefined');
      }
      
      if (visitData.resolution_summary !== undefined && visitData.resolution_summary !== null) {
        console.log('  ✅ Seteando resolution_summary:', visitData.resolution_summary.substring(0, 50));
        setResolutionSummary(visitData.resolution_summary);
      } else {
        console.log('  ❌ resolution_summary es null/undefined');
      }
      
      if (visitData.final_status) {
        console.log('  ✅ Seteando final_status:', visitData.final_status);
        setFinalStatus(visitData.final_status);
      } else {
        console.log('  ❌ final_status vacío');
      }
      
      if (visitData.failure_cause) {
        console.log('  ✅ Seteando failure_cause:', visitData.failure_cause);
        setFailureCause(visitData.failure_cause);
      } else {
        console.log('  ❌ failure_cause vacío');
      }
      
      if (visitData.receiver_name !== undefined && visitData.receiver_name !== null) {
        console.log('  ✅ Seteando receiver_name:', visitData.receiver_name);
        setReceiverName(visitData.receiver_name);
      } else {
        console.log('  ❌ receiver_name es null/undefined');
      }
      
      // Restaurar URLs de fotos
      if (visitData.failure_photo_1_url) setFailurePhoto1Url(visitData.failure_photo_1_url);
      if (visitData.failure_photo_2_url) setFailurePhoto2Url(visitData.failure_photo_2_url);
      if (visitData.resolution_photo_1_url) setResolutionPhoto1Url(visitData.resolution_photo_1_url);
      if (visitData.resolution_photo_2_url) setResolutionPhoto2Url(visitData.resolution_photo_2_url);
      
      // Restaurar service_request_id si existe
      if (visitData.service_request_id) setServiceRequestId(visitData.service_request_id);
      
      // Cargar estados iniciales de ascensores
      const { data: elevatorsData } = await supabase
        .from('emergency_visit_elevators')
        .select('*')
        .eq('emergency_visit_id', draftVisitId);
      
      if (elevatorsData) {
        const statusMap = new Map();
        elevatorsData.forEach(e => {
          statusMap.set(e.elevator_id, e.initial_status);
        });
        setElevatorInitialStatus(statusMap);
      }
      
      console.log('✅ Borrador cargado correctamente con todos los campos');
      
    } catch (error) {
      console.error('❌ Error cargando borrador:', error);
      throw error;
    }
  };

  const uploadPhoto = async (file: File, path: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${path}_${Date.now()}.${fileExt}`;
      const filePath = `emergency-visits/${visitId}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('emergency-photos')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('emergency-photos')
        .getPublicUrl(filePath);
      
      return urlData.publicUrl;
      
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  const handleFailurePhotoUpload = async (fileNum: 1 | 2, file: File) => {
    const url = await uploadPhoto(file, `failure_${fileNum}`);
    if (url) {
      if (fileNum === 1) {
        setFailurePhoto1Url(url);
        await supabase
          .from('emergency_visits')
          .update({ failure_photo_1_url: url })
          .eq('id', visitId);
      } else {
        setFailurePhoto2Url(url);
        await supabase
          .from('emergency_visits')
          .update({ failure_photo_2_url: url })
          .eq('id', visitId);
      }
    }
  };

  const handleResolutionPhotoUpload = async (fileNum: 1 | 2, file: File) => {
    const url = await uploadPhoto(file, `resolution_${fileNum}`);
    if (url) {
      if (fileNum === 1) {
        setResolutionPhoto1Url(url);
        await supabase
          .from('emergency_visits')
          .update({ resolution_photo_1_url: url })
          .eq('id', visitId);
      } else {
        setResolutionPhoto2Url(url);
        await supabase
          .from('emergency_visits')
          .update({ resolution_photo_2_url: url })
          .eq('id', visitId);
      }
    }
  };

  const updateElevatorInitialStatus = async (elevatorId: string, status: 'operational' | 'stopped') => {
    setElevatorInitialStatus(prev => new Map(prev).set(elevatorId, status));
    
    await supabase
      .from('emergency_visit_elevators')
      .update({ initial_status: status })
      .eq('emergency_visit_id', visitId)
      .eq('elevator_id', elevatorId);
    
    // Guardar después de actualizar estado de ascensor
    console.log('💾 Estado de ascensor actualizado - guardando...');
    await autoSave();
  };

  const handleFinalStatusChange = (status: 'operational' | 'observation' | 'stopped') => {
    setFinalStatus(status);
    
    // Si es detenido, mostrar advertencia de solicitud obligatoria
    if (status === 'stopped' && !serviceRequestId) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
    
    // Guardar después de cambiar estado final (con delay para que se actualice el estado)
    console.log('💾 Estado final actualizado - guardando en 200ms...');
    setTimeout(() => autoSave(), 200);
  };

  const formatTimeSinceEmergency = (days: number): string => {
    if (days < 30) return `hace ${days} día${days !== 1 ? 's' : ''}`;
    if (days < 365) {
      const months = Math.floor(days / 30);
      return `hace ${months} mes${months !== 1 ? 'es' : ''}`;
    }
    const years = Math.floor(days / 365);
    return `hace ${years} año${years !== 1 ? 's' : ''}`;
  };

  const canComplete = useMemo(() => {
    // Validación 1: Descripción de falla
    if (!failureDescription || failureDescription.trim() === '') return false;
    
    // Validación 2: Resumen de resolución
    if (!resolutionSummary || resolutionSummary.trim() === '') return false;
    
    // Validación 3: Estado final
    if (!finalStatus || finalStatus === '') return false;
    
    // Validación 4: Causa de falla
    if (!failureCause || failureCause === '') return false;
    
    // Validación 5: Nombre del receptor
    if (!receiverName || receiverName.trim() === '') return false;
    
    // Validación 6: Firma (usando estado hasSignature)
    if (!hasSignature) return false;
    
    // Validación 7: Si está detenido, requiere solicitud obligatoria
    if (finalStatus === 'stopped' && !serviceRequestId) return false;
    
    return true;
  }, [failureDescription, resolutionSummary, finalStatus, failureCause, receiverName, hasSignature, serviceRequestId]);
  const generateAndUploadPDF = async (signatureUrl: string | null) => {
    try {
      // Obtener tipo y descripción de solicitud si existe
      let requestType: 'repair' | 'parts' | 'support' | null = null;
      let requestDescription: string | null = null;
      let requestPriority: 'low' | 'medium' | 'high' | 'critical' | null = null;
      let requestTitle: string | null = null;
      
      if (serviceRequestId) {
        const { data: requestData } = await supabase
          .from('service_requests')
          .select('request_type, title, description, priority')
          .eq('id', serviceRequestId)
          .single();
        
        if (requestData) {
          requestType = requestData.request_type as 'repair' | 'parts' | 'support';
          requestTitle = requestData.title;
          requestDescription = requestData.description;
          requestPriority = requestData.priority as 'low' | 'medium' | 'high' | 'critical';
        }
      }

      // Obtener dirección del cliente desde la tabla clients
      const { data: clientData } = await supabase
        .from('clients')
        .select('address')
        .eq('id', clientId)
        .single();
      
      const clientAddress = clientData?.address || null;

      const endTime = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: true });

      // Preparar datos del PDF
      const pdfData: EmergencyVisitPDFData = {
        visitId: visitId!,
        clientName,
        clientAddress: clientAddress,
        visitDate: new Date().toISOString(),
        visitStartTime: visitStartTime,
        visitEndTime: endTime,
        technicianName: profile?.full_name || 'Técnico',
        elevators: elevators.map(e => ({
          elevator_number: e.elevator_number,
          brand: e.brand,
          model: e.model,
          location_name: e.location_name,
          initial_status: elevatorInitialStatus.get(e.id) || 'operational',
          final_status: finalStatus as 'operational' | 'observation' | 'stopped'
        })),
        failureDescription,
        failurePhoto1Url,
        failurePhoto2Url,
        resolutionSummary,
        resolutionPhoto1Url,
        resolutionPhoto2Url,
        failureCause: failureCause as 'normal_use' | 'third_party' | 'part_lifespan',
        finalStatus: finalStatus as 'operational' | 'observation' | 'stopped',
        observationUntil: finalStatus === 'observation' 
          ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
          : null,
        receiverName,
        signatureDataUrl: signatureUrl || '',
        completedAt: new Date().toISOString(),
        serviceRequestType: requestType,
        serviceRequestDescription: requestDescription,
        serviceRequestPriority: requestPriority,
        serviceRequestTitle: requestTitle
      };

      // Generar PDF
      console.log('📄 Generando PDF de emergencia...');
      const pdfBlob = await generateEmergencyVisitPDF(pdfData);
      console.log('✅ PDF generado, tamaño:', pdfBlob.size, 'bytes');

      // Subir PDF a Storage con nombre limpio
      const cleanClientName = clientName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
        .replace(/[^a-zA-Z0-9]/g, '_') // Solo alfanuméricos
        .substring(0, 30); // Limitar longitud
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `emergencia_${cleanClientName}_${timestamp}.pdf`;
      const filePath = `emergencias/${fileName}`;
      
      console.log('📤 Subiendo PDF:', filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('emergency-pdfs')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Error subiendo PDF:', uploadError);
        throw new Error(`Error al subir PDF: ${uploadError.message}`);
      }

      // Obtener URL pública del PDF
      const { data: urlData } = supabase.storage
        .from('emergency-pdfs')
        .getPublicUrl(filePath);

      if (!urlData) {
        throw new Error('No se pudo obtener la URL del PDF');
      }

      const pdfUrl = urlData.publicUrl;

      // Actualizar URL del PDF en la base de datos
      const { error: updateError } = await supabase
        .from('emergency_visits')
        .update({ pdf_url: pdfUrl })
        .eq('id', visitId);

      if (updateError) {
        throw new Error(`Error guardando URL del PDF: ${updateError.message}`);
      }

      console.log('✅ PDF generado y guardado:', pdfUrl);

    } catch (error) {
      console.error('Error generando o subiendo PDF:', error);
      // No bloqueamos el flujo si falla el PDF
      alert('Advertencia: El PDF no pudo generarse, pero la emergencia se guardó correctamente.');
    }
  };
  const handleComplete = async () => {
    if (!canComplete) {
      console.log('❌ Validación falló. Estado:', {
        failureDescription: !!failureDescription,
        resolutionSummary: !!resolutionSummary,
        finalStatus,
        failureCause,
        receiverName,
        signatureEmpty: signatureRef?.isEmpty()
      });
      return;
    }
    
    console.log('✅ Iniciando completado de emergencia...');
    
    try {
      setSaving(true);
      
      // Subir firma
      const signatureBlob = await new Promise<Blob>((resolve) => {
        signatureRef?.getTrimmedCanvas().toBlob((blob) => resolve(blob!));
      });
      
      const signatureFile = new File([signatureBlob], 'signature.png', { type: 'image/png' });
      const signatureUrl = await uploadPhoto(signatureFile, 'signature');
      
      // Calcular fecha de observación si aplica
      let observationUntil = null;
      if (finalStatus === 'observation') {
        const date = new Date();
        date.setDate(date.getDate() + 15);
        observationUntil = date.toISOString().split('T')[0];
      }
      
      // Actualizar visita
      const completedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('emergency_visits')
        .update({
          failure_description: failureDescription,
          failure_photo_1_url: failurePhoto1Url,
          failure_photo_2_url: failurePhoto2Url,
          final_status: finalStatus,
          resolution_summary: resolutionSummary,
          resolution_photo_1_url: resolutionPhoto1Url,
          resolution_photo_2_url: resolutionPhoto2Url,
          failure_cause: failureCause,
          receiver_name: receiverName,
          receiver_signature_url: signatureUrl,
          observation_until: observationUntil,
          service_request_id: serviceRequestId,
          status: 'completed',
          completed_at: completedAt
        })
        .eq('id', visitId);
      
      if (updateError) {
        throw new Error(`Error actualizando visita: ${updateError.message}`);
      }
      
      console.log('✅ Emergencia actualizada:', visitId, 'Status: completed, Time:', completedAt);
      
      // Actualizar estado final de ascensores
      for (const elevatorId of elevatorIds) {
        await supabase
          .from('emergency_visit_elevators')
          .update({ final_status: finalStatus })
          .eq('emergency_visit_id', visitId)
          .eq('elevator_id', elevatorId);
      }
      
      // Generar PDF
      await generateAndUploadPDF(signatureUrl);
      
      console.log('✅ Emergencia completada exitosamente');
      alert('Emergencia guardada correctamente con PDF generado');
      
      onComplete();
      
    } catch (error) {
      console.error('❌ Error completing visit:', error);
      alert(`Error al completar emergencia: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Función para salir del formulario (guarda antes de salir)
  const handleExit = async () => {
    console.log('🚪 Saliendo del formulario - guardando cambios...');
    if (visitId) {
      // Esperar 300ms para que se completen guardados pendientes de botones
      await new Promise(resolve => setTimeout(resolve, 300));
      await autoSave();
      console.log('✅ Guardado completado antes de salir');
    }
    onCancel();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handleExit} className="p-2 hover:bg-gray-200 rounded-lg">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Visita de Emergencia</h1>
          <p className="text-gray-600">{clientName}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Save className="w-4 h-4" />
          Guardado automático
        </div>
      </div>

      {/* Ascensores afectados */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Ascensores Afectados</h2>
        <div className="space-y-4">
          {elevators.map(elevator => {
            const lastEmergency = lastEmergencies.get(elevator.id);
            return (
              <div key={elevator.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">
                      Ascensor #{elevator.elevator_number}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {elevator.brand} {elevator.model} - {elevator.location_name}
                    </p>
                  </div>
                </div>
                
                {/* Alerta de última emergencia */}
                {lastEmergency && (
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm text-yellow-800">
                      Última emergencia {formatTimeSinceEmergency(lastEmergency.days_since_last_emergency)}
                    </span>
                  </div>
                )}
                
                {/* Estado inicial */}
                <div className="flex gap-2">
                  <button
                    onClick={() => updateElevatorInitialStatus(elevator.id, 'operational')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                      elevatorInitialStatus.get(elevator.id) === 'operational'
                        ? 'bg-green-50 border-green-500 text-green-700'
                        : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    Operativo
                  </button>
                  <button
                    onClick={() => updateElevatorInitialStatus(elevator.id, 'stopped')}
                    className={`flex-1 py-2 px-4 rounded-lg border-2 transition-all ${
                      elevatorInitialStatus.get(elevator.id) === 'stopped'
                        ? 'bg-red-50 border-red-500 text-red-700'
                        : 'bg-white border-gray-300 text-gray-700'
                    }`}
                  >
                    Detenido
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Descripción de la falla */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Descripción de la Falla</h2>
        <div className="relative">
          <textarea
            value={failureDescription}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 500) {
                setFailureDescription(value);
              }
            }}
            onBlur={() => {
              console.log('💾 Campo failureDescription perdió foco - guardando...');
              autoSave();
            }}
            placeholder="Describe detalladamente la falla encontrada..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
            maxLength={500}
          />
          <div className="absolute bottom-2 right-2 text-xs text-gray-500">
            {failureDescription.length}/500
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto 1
            </label>
            {!failurePhoto1Url ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <Camera className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Subir foto</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFailurePhoto1(file);
                      handleFailurePhotoUpload(1, file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative">
                <img src={failurePhoto1Url} alt="Falla 1" className="w-full h-40 object-cover rounded-lg" />
                <button
                  onClick={() => { setFailurePhoto1(null); setFailurePhoto1Url(''); }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto 2
            </label>
            {!failurePhoto2Url ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <Camera className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Subir foto</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFailurePhoto2(file);
                      handleFailurePhotoUpload(2, file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative">
                <img src={failurePhoto2Url} alt="Falla 2" className="w-full h-40 object-cover rounded-lg" />
                <button
                  onClick={() => { setFailurePhoto2(null); setFailurePhoto2Url(''); }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Estado Final */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Estado Final del Ascensor</h2>
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => handleFinalStatusChange('operational')}
            className={`p-4 rounded-lg border-2 transition-all ${
              finalStatus === 'operational'
                ? 'bg-green-50 border-green-500'
                : 'bg-white border-gray-300'
            }`}
          >
            <CheckCircle className={`w-8 h-8 mx-auto mb-2 ${
              finalStatus === 'operational' ? 'text-green-600' : 'text-gray-400'
            }`} />
            <p className="font-semibold text-center">Operativo</p>
            <p className="text-xs text-center text-gray-600 mt-1">Emergencia resuelta</p>
          </button>
          
          <button
            onClick={() => handleFinalStatusChange('observation')}
            className={`p-4 rounded-lg border-2 transition-all ${
              finalStatus === 'observation'
                ? 'bg-yellow-50 border-yellow-500'
                : 'bg-white border-gray-300'
            }`}
          >
            <AlertCircle className={`w-8 h-8 mx-auto mb-2 ${
              finalStatus === 'observation' ? 'text-yellow-600' : 'text-gray-400'
            }`} />
            <p className="font-semibold text-center">Observación</p>
            <p className="text-xs text-center text-gray-600 mt-1">Sin causa identificada (15 días)</p>
          </button>
          
          <button
            onClick={() => handleFinalStatusChange('stopped')}
            className={`p-4 rounded-lg border-2 transition-all ${
              finalStatus === 'stopped'
                ? 'bg-red-50 border-red-500'
                : 'bg-white border-gray-300'
            }`}
          >
            <AlertTriangle className={`w-8 h-8 mx-auto mb-2 ${
              finalStatus === 'stopped' ? 'text-red-600' : 'text-gray-400'
            }`} />
            <p className="font-semibold text-center">Detenido</p>
            <p className="text-xs text-center text-gray-600 mt-1">Requiere reparación</p>
          </button>
        </div>
        
        {showWarning && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 font-medium">
              ⚠️ Debe crear una solicitud de servicio antes de cerrar
            </p>
            <p className="text-xs text-red-600 mt-1">
              La prioridad será automáticamente <span className="font-bold">CRÍTICA</span> porque el ascensor quedó detenido
            </p>
          </div>
        )}
      </div>

      {/* Solicitudes */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Solicitudes de Servicio</h2>
        <button
          onClick={() => setShowServiceRequestModal(true)}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
        >
          {serviceRequestId ? 'Ver Solicitud Creada' : 'Solicitud Técnica Adicional'}
        </button>
      </div>

      {/* Resolución */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Resumen de Resolución</h2>
        <div className="relative">
          <textarea
            value={resolutionSummary}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length <= 500) {
                setResolutionSummary(value);
              }
            }}
            onBlur={() => {
              console.log('💾 Campo resolutionSummary perdió foco - guardando...');
              autoSave();
            }}
            placeholder="Describe lo que se realizó para resolver la falla..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 mb-4"
            maxLength={500}
          />
          <div className="absolute top-2 right-2 text-xs text-gray-500">
            {resolutionSummary.length}/500
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto Resolución 1
            </label>
            {!resolutionPhoto1Url ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                <Camera className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Subir foto</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setResolutionPhoto1(file);
                      handleResolutionPhotoUpload(1, file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative">
                <img src={resolutionPhoto1Url} alt="Resolución 1" className="w-full h-40 object-cover rounded-lg" />
                <button
                  onClick={() => { setResolutionPhoto1(null); setResolutionPhoto1Url(''); }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Foto Resolución 2
            </label>
            {!resolutionPhoto2Url ? (
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                <Camera className="w-12 h-12 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Subir foto</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setResolutionPhoto2(file);
                      handleResolutionPhotoUpload(2, file);
                    }
                  }}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative">
                <img src={resolutionPhoto2Url} alt="Resolución 2" className="w-full h-40 object-cover rounded-lg" />
                <button
                  onClick={() => { setResolutionPhoto2(null); setResolutionPhoto2Url(''); }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Clasificación de la Falla
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => {
                setFailureCause('normal_use');
                console.log('💾 Causa de falla seleccionada - guardando...');
                setTimeout(() => autoSave(), 100);
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                failureCause === 'normal_use'
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-white border-gray-300 hover:border-blue-300'
              }`}
            >
              <p className="font-semibold text-gray-900">Falla por uso</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setFailureCause('third_party');
                console.log('💾 Causa de falla seleccionada - guardando...');
                setTimeout(() => autoSave(), 100);
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                failureCause === 'third_party'
                  ? 'bg-orange-50 border-orange-500'
                  : 'bg-white border-gray-300 hover:border-orange-300'
              }`}
            >
              <p className="font-semibold text-gray-900">Responsabilidad de terceros</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setFailureCause('part_lifespan');
                console.log('💾 Causa de falla seleccionada - guardando...');
                setTimeout(() => autoSave(), 100);
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                failureCause === 'part_lifespan'
                  ? 'bg-purple-50 border-purple-500'
                  : 'bg-white border-gray-300 hover:border-purple-300'
              }`}
            >
              <p className="font-semibold text-gray-900">Vida útil de repuesto</p>
            </button>
          </div>
        </div>
      </div>

      {/* Firma */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Firma y Cierre</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nombre de quien recepciona
          </label>
          <input
            type="text"
            value={receiverName}
            onChange={(e) => setReceiverName(e.target.value)}
            onBlur={() => {
              console.log('💾 Campo receiverName perdió foco - guardando...');
              autoSave();
            }}
            placeholder="Nombre completo"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Firma
          </label>
          <div className="border-2 border-gray-300 rounded-lg">
            <SignatureCanvas
              ref={(ref) => setSignatureRef(ref)}
              canvasProps={{
                className: 'w-full h-48 cursor-crosshair'
              }}
              onEnd={() => {
                // Actualizar estado cuando se termina de dibujar
                if (signatureRef && !signatureRef.isEmpty()) {
                  setHasSignature(true);
                }
              }}
            />
          </div>
          <button
            onClick={() => {
              signatureRef?.clear();
              setHasSignature(false);
            }}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Limpiar firma
          </button>
        </div>
      </div>

      {/* Botón de completar */}
      <button
        onClick={handleComplete}
        disabled={!canComplete || saving}
        className="w-full py-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <CheckCircle className="w-5 h-5" />
            Completar y Generar PDF
          </>
        )}
      </button>

      {/* Modal de Solicitud Técnica */}
      {showServiceRequestModal && (
        <ManualServiceRequestForm
          onClose={() => setShowServiceRequestModal(false)}
          onSuccess={(requestId) => {
            if (requestId) {
              console.log('✅ Solicitud creada con ID:', requestId);
              setServiceRequestId(requestId);
            }
            setShowServiceRequestModal(false);
          }}
          forcedPriority={finalStatus === 'stopped' ? 'critical' : undefined}
          prefilledClientId={clientId}
          prefilledElevatorId={elevatorIds[0]}
        />
      )}
    </div>
  );
}
