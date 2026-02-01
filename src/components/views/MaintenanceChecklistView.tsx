import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  QrCode,
  ClipboardList,
  AlertCircle,
  Building2,
  Wrench,
  ArrowLeft,
} from 'lucide-react';
import { QRScanner } from '../checklist/QRScanner';
import { CertificationForm } from '../checklist/CertificationForm';
import { DynamicChecklistForm } from '../checklist/DynamicChecklistForm';
import { ChecklistSignatureModal } from '../checklist/ChecklistSignatureModal';

interface Client {
  id: string;
  business_name: string;
  address: string;
}

interface Elevator {
  id: string;
  brand: string;
  model: string;
  serial_number: string;
  is_hydraulic: boolean;
  classification: string | null; // ascensor_residencial, ascensor_corporativo, etc.
}

interface InProgressChecklist {
  id: string;
  elevator_id: string;
  month: number;
  year: number;
  auto_save_count: number;
  elevators: Elevator;
}

interface ActiveChecklist {
  id: string;
  elevator_id: string;
  elevator: Elevator;
  month: number;
  year: number;
}

type ViewMode = 'start' | 'select-elevator' | 'certification' | 'checklist';

export function MaintenanceChecklistView() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('start');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [elevators, setElevators] = useState<Elevator[]>([]);
  const [selectedElevator, setSelectedElevator] = useState<Elevator | null>(
    null,
  );
  const [activeChecklist, setActiveChecklist] =
    useState<ActiveChecklist | null>(null);
  const [inProgressChecklists, setInProgressChecklists] = useState<
    InProgressChecklist[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [clientNameForSignature, setClientNameForSignature] = useState('');

  useEffect(() => {
    if (profile?.role === 'technician') {
      loadInProgressChecklists();
    }
  }, [profile]);

  const loadInProgressChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from('mnt_checklists')
        .select(
          `
          id,
          elevator_id,
          month,
          year,
          auto_save_count,
          elevators (
            id,
            brand,
            model,
            serial_number,
            is_hydraulic,
            classification
          )
        `,
        )
        .eq('technician_id', profile?.id)
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setInProgressChecklists((data || []) as InProgressChecklist[]);
    } catch (err) {
      console.error('Error loading in-progress checklists:', err);
    }
  };

  const handleQRScan = async (qrCode: string) => {
    setLoading(true);
    setError(null);
    setShowQRScanner(false);

    try {
      const { data: qrData, error: qrError } = await supabase
        .from('mnt_client_qr_codes')
        .select('client_id, clients(id, business_name, address)')
        .eq('qr_code', qrCode)
        .single();

      if (qrError) throw new Error('Código QR no válido o no encontrado');

      const client = qrData.clients as unknown as Client;
      setSelectedClient(client);

      const { data: elevatorsData, error: elevatorsError } = await supabase
        .from('elevators')
        .select(
          'id, brand, model, serial_number, is_hydraulic, classification',
        )
        .eq('client_id', client.id)
        .eq('status', 'active')
        .order('serial_number');

      if (elevatorsError) throw elevatorsError;

      setElevators((elevatorsData || []) as Elevator[]);
      setViewMode('select-elevator');
    } catch (err: any) {
      console.error('Error processing QR:', err);
      setError(err.message || 'Error al procesar el código QR');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectElevator = async (elevator: Elevator) => {
    setSelectedElevator(elevator);

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const { data: existingChecklist } = await supabase
      .from('mnt_checklists')
      .select('*')
      .eq('elevator_id', elevator.id)
      .eq('technician_id', profile?.id)
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .eq('status', 'in_progress')
      .single();

    if (existingChecklist) {
      setActiveChecklist({
        id: existingChecklist.id,
        elevator_id: elevator.id,
        elevator,
        month: currentMonth,
        year: currentYear,
      });
      setViewMode('checklist');
    } else {
      setViewMode('certification');
    }
  };

  const handleCertificationSubmit = async (certData: {
    lastCertificationDate: string | null;
    nextCertificationDate: string | null;
    certificationNotLegible: boolean;
  }) => {
    if (!selectedElevator || !selectedClient) return;

    setLoading(true);
    setError(null);

    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      const { data: newChecklist, error: createError } = await supabase
        .from('mnt_checklists')
        .insert([
          {
            elevator_id: selectedElevator.id,
            technician_id: profile?.id,
            client_id: selectedClient.id,
            month: currentMonth,
            year: currentYear,
            last_certification_date: certData.lastCertificationDate,
            next_certification_date: certData.nextCertificationDate,
            certification_not_legible: certData.certificationNotLegible,
            status: 'in_progress',
          },
        ])
        .select()
        .single();

      if (createError) throw createError;

      setActiveChecklist({
        id: newChecklist.id,
        elevator_id: selectedElevator.id,
        elevator: selectedElevator,
        month: currentMonth,
        year: currentYear,
      });

      setViewMode('checklist');
    } catch (err: any) {
      console.error('Error creating checklist:', err);
      const message =
        err?.message || err?.details || 'Error desconocido al crear el checklist';
      setError('Error al crear el checklist: ' + message);
      alert('Error al crear el checklist: ' + message);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeChecklist = async (checklistId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('mnt_checklists')
        .select(
          `
          id,
          elevator_id,
          month,
          year,
          elevators (
            id,
            brand,
            model,
            serial_number,
            is_hydraulic,
            classification
          )
        `,
        )
        .eq('id', checklistId)
        .single();

      if (error) throw error;

      const elevator = data.elevators as unknown as Elevator;
      setActiveChecklist({
        id: data.id,
        elevator_id: data.elevator_id,
        elevator,
        month: data.month,
        year: data.year,
      });
      setSelectedElevator(elevator);
      setViewMode('checklist');
    } catch (err: any) {
      console.error('Error loading checklist:', err);
      setError('Error al cargar el checklist: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChecklistComplete = async () => {
    if (!activeChecklist || !selectedClient) return;

    // Primero verificar que todas las preguntas estén respondidas correctamente
    const { data: answers, error: answersError } = await supabase
      .from('mnt_checklist_answers')
      .select('*')
      .eq('checklist_id', activeChecklist.id);

    if (answersError) {
      alert('Error al verificar las respuestas');
      return;
    }

    // Verificar que todas las rechazadas tengan observaciones y al menos 1 foto
    const rejectedWithoutData = answers?.some(
      (a: any) => a.status === 'rejected' && (!a.observations || !a.photo_1_url)
    );

    if (rejectedWithoutData) {
      alert('Todas las preguntas rechazadas deben tener observaciones y al menos 1 foto');
      return;
    }

    // Guardar el nombre del cliente para el modal de firma
    setClientNameForSignature(selectedClient.business_name);
    
    // Mostrar modal de firma
    setShowSignatureModal(true);
  };

  const handleSignatureConfirm = async (signerName: string, signatureDataURL: string) => {
    if (!activeChecklist) return;

    setLoading(true);
    try {
      // Actualizar checklist con firma y completar
      const { error: updateError } = await supabase
        .from('mnt_checklists')
        .update({
          status: 'completed',
          completion_date: new Date().toISOString(),
          signature_data_url: signatureDataURL,
          signer_name: signerName,
        })
        .eq('id', activeChecklist.id);

      if (updateError) throw updateError;

      // Cerrar modal de firma
      setShowSignatureModal(false);

      // TODO: Aquí generaremos y enviaremos el PDF por correo
      alert('Checklist completado exitosamente. PDF será enviado por correo.');
      
      resetToStart();
      loadInProgressChecklists();
    } catch (err: any) {
      console.error('Error completing checklist:', err);
      alert('Error al completar el checklist: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    alert('Progreso guardado exitosamente');
  };

  const resetToStart = () => {
    setViewMode('start');
    setSelectedClient(null);
    setElevators([]);
    setSelectedElevator(null);
    setActiveChecklist(null);
    setError(null);
  };

  // --- Renders ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
      </div>
    );
  }

  if (viewMode === 'certification' && selectedElevator && selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewMode('select-elevator')}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Información de Certificación
            </h1>
            <p className="text-slate-600">
              {selectedClient.business_name} - {selectedElevator.brand}{' '}
              {selectedElevator.model}
            </p>
          </div>
        </div>

        {/* Mostrar error también en esta vista */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <CertificationForm
          elevatorClassification={selectedElevator.classification}
          onSubmit={handleCertificationSubmit}
          onCancel={() => setViewMode('select-elevator')}
        />
      </div>
    );
  }

  if (viewMode === 'checklist' && activeChecklist) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={resetToStart}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {activeChecklist.elevator.brand}{' '}
                  {activeChecklist.elevator.model}
                </h1>
                <p className="text-sm text-slate-600">
                  S/N: {activeChecklist.elevator.serial_number} •{' '}
                  {activeChecklist.month}/{activeChecklist.year}
                </p>
              </div>
            </div>
            {activeChecklist.elevator.is_hydraulic && (
              <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-semibold rounded-full">
                Hidráulico
              </span>
            )}
          </div>
        </div>

        <DynamicChecklistForm
          checklistId={activeChecklist.id}
          elevatorId={activeChecklist.elevator_id}
          isHydraulic={activeChecklist.elevator.is_hydraulic}
          month={activeChecklist.month}
          onComplete={handleChecklistComplete}
          onSave={handleSave}
        />
      </div>
    );
  }

  if (viewMode === 'select-elevator' && selectedClient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={resetToStart}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Seleccionar Ascensor
            </h1>
            <p className="text-slate-600 mt-1">
              Cliente: <strong>{selectedClient.business_name}</strong>
            </p>
            <p className="text-sm text-slate-500">{selectedClient.address}</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Error</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {elevators.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Building2 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">
                No hay ascensores activos para este cliente
              </p>
            </div>
          ) : (
            elevators.map((elevator) => (
              <button
                key={elevator.id}
                onClick={() => handleSelectElevator(elevator)}
                className="p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Wrench className="w-6 h-6 text-blue-600" />
                  </div>
                  {elevator.is_hydraulic && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-semibold rounded-full">
                      Hidráulico
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  {elevator.brand} {elevator.model}
                </h3>
                <p className="text-sm text-slate-600 mb-1">
                  S/N:{' '}
                  <span className="font-mono">
                    {elevator.serial_number || 'No registra'}
                  </span>
                </p>
                {elevator.classification && (
                  <p className="text-xs text-slate-500">
                    Tipo:{' '}
                    <span className="font-medium">
                      {elevator.classification}
                    </span>
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Checklist de Mantenimiento
        </h1>
        <p className="text-slate-600 mt-1">
          Escanea el código QR para iniciar o continuar un mantenimiento
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl shadow-lg p-8 text-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-white bg-opacity-20 rounded-xl">
              <QrCode className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Nuevo Mantenimiento</h2>
              <p className="text-blue-100">Escanea el código QR del cliente</p>
            </div>
          </div>
          <button
            onClick={() => setShowQRScanner(true)}
            className="w-full bg-white text-blue-700 px-6 py-4 rounded-lg font-bold text-lg hover:bg-blue-50 transition shadow-lg"
          >
            Escanear Código QR
          </button>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-xl shadow-sm p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-4 bg-orange-100 rounded-xl">
              <ClipboardList className="w-10 h-10 text-orange-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                Checklists en Progreso
              </h2>
              <p className="text-slate-600">Continúa donde lo dejaste</p>
            </div>
          </div>

          {inProgressChecklists.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                No tienes checklists en progreso
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {inProgressChecklists.map((checklist) => (
                <button
                  key={checklist.id}
                  onClick={() => handleResumeChecklist(checklist.id)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {checklist.elevators?.brand}{' '}
                        {checklist.elevators?.model}
                      </p>
                      <p className="text-sm text-slate-600">
                        S/N: {checklist.elevators?.serial_number}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {checklist.month}/{checklist.year} •{' '}
                        {checklist.auto_save_count} autoguardados
                      </p>
                    </div>
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <ClipboardList className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3">Instrucciones</h3>
        <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
          <li>Escanea el código QR del cliente para iniciar un nuevo mantenimiento</li>
          <li>Selecciona el ascensor que vas a revisar</li>
          <li>Ingresa las fechas de certificación (o marca como no legible)</li>
          <li>Completa el checklist respondiendo cada pregunta</li>
          <li>Si encuentras problemas, márcalos y agrega observaciones con 2 fotos</li>
          <li>El sistema guardará automáticamente tu progreso cada 5 cambios</li>
          <li>Al terminar, completa el checklist para continuar con la firma</li>
        </ol>
      </div>

      {showQRScanner && (
        <QRScanner
          onScanSuccess={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}

      {showSignatureModal && activeChecklist && (
        <ChecklistSignatureModal
          open={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onConfirm={handleSignatureConfirm}
          clientName={clientNameForSignature}
          elevatorSummary={`${activeChecklist.elevator.brand} ${activeChecklist.elevator.model}`}
          periodLabel={`${activeChecklist.month}/${activeChecklist.year}`}
        />
      )}
    </div>
  );
}
