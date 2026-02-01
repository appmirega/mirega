import React, { useState, useEffect } from 'react';
import { AlertTriangle, QrCode, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { EmergencyQRScanner } from '../emergency/EmergencyQRScanner';
import { MultiElevatorEmergencyForm } from '../emergency/MultiElevatorEmergencyForm';

interface PendingVisit {
  id: string;
  building_name: string;
  building_address: string;
  elevators_in_failure: string[];
  total_elevators: number;
  current_elevator_index: number;
  last_saved_at: string;
  created_at: string;
}

export function EmergencyV2View() {
  const { user, profile } = useAuth();
  const [view, setView] = useState<'main' | 'scanner' | 'form'>('main');
  const [pendingVisits, setPendingVisits] = useState<PendingVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentVisitData, setCurrentVisitData] = useState<{
    visitId?: string;
    clientId: string;
    buildingName: string;
    buildingAddress: string;
    elevatorsInFailure: string[];
    availableElevators: Array<{ id: string; internal_code: string; location: string }>;
  } | null>(null);

  useEffect(() => {
    if (profile?.role === 'technician' || profile?.role === 'admin' || profile?.role === 'developer') {
      loadPendingVisits();
    } else {
      setLoading(false);
    }
  }, [profile]);

  const loadPendingVisits = async () => {
    try {
      let query = supabase
        .from('emergency_v2_visits')
        .select('*')
        .eq('status', 'in_progress')
        .order('created_at', { ascending: false });

      if (profile?.role === 'technician') {
        query = query.eq('technician_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPendingVisits(data || []);
    } catch (error) {
      console.error('Error loading pending visits:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQRScanSuccess = async (data: {
    clientId: string;
    buildingName: string;
    buildingAddress: string;
    elevators: Array<{ id: string; internal_code: string; location: string }>;
  }) => {
    setView('main');

    setCurrentVisitData({
      clientId: data.clientId,
      buildingName: data.buildingName,
      buildingAddress: data.buildingAddress,
      elevatorsInFailure: [],
      availableElevators: data.elevators,
    });
  };

  const handleElevatorSelection = async (selectedElevatorIds: string[]) => {
    if (!currentVisitData || selectedElevatorIds.length === 0) {
      alert('Debe seleccionar al menos un ascensor');
      return;
    }

    try {
      const { data: visit, error } = await supabase
        .from('emergency_v2_visits')
        .insert({
          client_id: currentVisitData.clientId,
          technician_id: user?.id,
          building_name: currentVisitData.buildingName,
          building_address: currentVisitData.buildingAddress,
          elevators_in_failure: selectedElevatorIds,
          status: 'in_progress',
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentVisitData({
        ...currentVisitData,
        visitId: visit.id,
        elevatorsInFailure: selectedElevatorIds,
      });

      setView('form');
    } catch (error) {
      console.error('Error creating visit:', error);
      alert('Error al crear la visita');
    }
  };

  const handleResumeVisit = async (visit: PendingVisit) => {
    try {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, company_name, address')
        .eq('id', (await supabase
          .from('emergency_v2_visits')
          .select('client_id')
          .eq('id', visit.id)
          .single()
        ).data?.client_id)
        .single();

      if (clientError) throw clientError;

      const { data: elevators, error: elevatorsError } = await supabase
        .from('elevators')
        .select('id, internal_code, location')
        .eq('client_id', client.id)
        .order('internal_code');

      if (elevatorsError) throw elevatorsError;

      setCurrentVisitData({
        visitId: visit.id,
        clientId: client.id,
        buildingName: visit.building_name,
        buildingAddress: visit.building_address,
        elevatorsInFailure: visit.elevators_in_failure,
        availableElevators: elevators,
      });

      setView('form');
    } catch (error) {
      console.error('Error resuming visit:', error);
      alert('Error al reanudar visita');
    }
  };

  const handleCompleteVisit = () => {
    setView('main');
    setCurrentVisitData(null);
    loadPendingVisits();
  };

  if (profile?.role !== 'technician' && profile?.role !== 'admin' && profile?.role !== 'developer') {
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto text-center py-12">
          <AlertCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Restringido</h2>
          <p className="text-gray-600">
            Esta funcionalidad está disponible solo para técnicos, administradores y desarrolladores.
          </p>
        </div>
      </div>
    );
  }

  if (view === 'scanner') {
    return (
      <EmergencyQRScanner
        onScanSuccess={handleQRScanSuccess}
        onCancel={() => setView('main')}
      />
    );
  }

  if (view === 'form' && currentVisitData && currentVisitData.visitId) {
    return (
      <MultiElevatorEmergencyForm
        visitId={currentVisitData.visitId}
        clientId={currentVisitData.clientId}
        buildingName={currentVisitData.buildingName}
        buildingAddress={currentVisitData.buildingAddress}
        elevatorsInFailure={currentVisitData.elevatorsInFailure}
        availableElevators={currentVisitData.availableElevators}
        onComplete={handleCompleteVisit}
        onCancel={() => {
          setView('main');
          setCurrentVisitData(null);
        }}
      />
    );
  }

  if (currentVisitData && !currentVisitData.visitId) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Seleccionar Ascensores en Falla
            </h2>

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Edificio:</strong> {currentVisitData.buildingName}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Dirección:</strong> {currentVisitData.buildingAddress}
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              Seleccione todos los ascensores que presentan fallas:
            </p>

            <ElevatorSelector
              elevators={currentVisitData.availableElevators}
              onConfirm={handleElevatorSelection}
              onCancel={() => {
                setView('main');
                setCurrentVisitData(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Emergencias</h1>
          <p className="text-gray-600">
            Escanea el código QR del edificio para iniciar una visita de emergencia
          </p>
        </div>

        {/* Botón Iniciar Nueva Visita */}
        <div className="mb-6">
          <button
            onClick={() => setView('scanner')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg"
          >
            <QrCode className="h-6 w-6" />
            <span className="text-lg font-semibold">Iniciar Nueva Visita de Emergencia</span>
          </button>
        </div>

        {/* Visitas Pendientes */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : pendingVisits.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Visitas en Progreso</h2>
              <p className="text-sm text-gray-600">
                Puede continuar con visitas que no ha completado
              </p>
            </div>

            <div className="divide-y divide-gray-200">
              {pendingVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleResumeVisit(visit)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{visit.building_name}</h3>
                      <p className="text-sm text-gray-600">{visit.building_address}</p>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-gray-600">
                          <AlertTriangle className="h-4 w-4" />
                          {visit.total_elevators} ascensores en falla
                        </span>
                        <span className="flex items-center gap-1 text-blue-600">
                          <CheckCircle className="h-4 w-4" />
                          {visit.current_elevator_index} completados
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                        En Progreso
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        <Clock className="h-3 w-3 inline" />{' '}
                        {new Date(visit.last_saved_at).toLocaleDateString('es-CL')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No hay visitas pendientes</p>
            <p className="text-sm text-gray-500 mt-2">
              Escanea un código QR para iniciar una nueva visita
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ElevatorSelector({
  elevators,
  onConfirm,
  onCancel,
}: {
  elevators: Array<{ id: string; internal_code: string; location: string }>;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const toggleElevator = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    );
  };

  return (
    <div>
      <div className="space-y-2 mb-6 max-h-96 overflow-y-auto border border-gray-300 rounded-lg p-4">
        {elevators.map((elevator) => (
          <label
            key={elevator.id}
            className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.includes(elevator.id)}
              onChange={() => toggleElevator(elevator.id)}
              className="w-5 h-5 text-blue-600 rounded"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-900">{elevator.internal_code}</p>
              <p className="text-sm text-gray-600">{elevator.location}</p>
            </div>
            {selected.includes(elevator.id) && (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={() => onConfirm(selected)}
          disabled={selected.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirmar ({selected.length} seleccionados)
        </button>
      </div>
    </div>
  );
}
