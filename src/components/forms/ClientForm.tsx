import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Building2,
  Mail,
  Phone,
  User,
  X,
  Building,
  Plus,
  Trash2,
} from 'lucide-react';

interface ClientFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ElevatorDraft {
  internal_code: string;
  elevator_number: string;
  tower_name: string;
  brand: string;
  model: string;
  serial_number: string;
  location_building: string;
  location_address: string;
}

const emptyElevator = (): ElevatorDraft => ({
  internal_code: '',
  elevator_number: '',
  tower_name: '',
  brand: '',
  model: '',
  serial_number: '',
  location_building: '',
  location_address: '',
});

export function ClientForm({ onSuccess, onCancel }: ClientFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [clientData, setClientData] = useState({
    company_name: '',
    building_name: '',
    address: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
  });

  const [elevators, setElevators] = useState<ElevatorDraft[]>([emptyElevator()]);

  const updateElevator = (
    index: number,
    field: keyof ElevatorDraft,
    value: string
  ) => {
    setElevators((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addElevator = () => {
    setElevators((prev) => [...prev, emptyElevator()]);
  };

  const removeElevator = (index: number) => {
    setElevators((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [emptyElevator()];
    });
  };

  const normalizedElevators = elevators
    .map((item) => ({
      internal_code: item.internal_code.trim(),
      elevator_number: item.elevator_number.trim(),
      tower_name: item.tower_name.trim(),
      brand: item.brand.trim(),
      model: item.model.trim(),
      serial_number: item.serial_number.trim(),
      location_building: item.location_building.trim(),
      location_address: item.location_address.trim(),
    }))
    .filter((item) => {
      return (
        item.internal_code ||
        item.elevator_number ||
        item.tower_name ||
        item.brand ||
        item.model ||
        item.serial_number ||
        item.location_building ||
        item.location_address
      );
    });

  const validateElevators = () => {
    for (let i = 0; i < normalizedElevators.length; i += 1) {
      const elevator = normalizedElevators[i];

      if (!elevator.brand) {
        throw new Error(`Falta la marca del ascensor #${i + 1}.`);
      }

      if (!elevator.model) {
        throw new Error(`Falta el modelo del ascensor #${i + 1}.`);
      }

      if (!elevator.location_address) {
        throw new Error(`Falta la dirección del ascensor #${i + 1}.`);
      }

      if (
        elevator.elevator_number &&
        Number.isNaN(Number(elevator.elevator_number))
      ) {
        throw new Error(
          `El número de ascensor del ascensor #${i + 1} debe ser numérico.`
        );
      }
    }
  };

  const resetForm = () => {
    setClientData({
      company_name: '',
      building_name: '',
      address: '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
    });
    setElevators([emptyElevator()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!clientData.company_name.trim()) {
        throw new Error('Debes ingresar el nombre del cliente.');
      }

      if (!clientData.address.trim()) {
        throw new Error('Debes ingresar la dirección del cliente.');
      }

      if (!clientData.contact_name.trim()) {
        throw new Error('Debes ingresar el nombre de contacto.');
      }

      validateElevators();

      const clientPayload: Record<string, any> = {
        company_name: clientData.company_name.trim(),
        building_name: clientData.building_name.trim() || null,
        address: clientData.address.trim(),
        contact_name: clientData.contact_name.trim(),
        contact_email: clientData.contact_email.trim() || null,
        contact_phone: clientData.contact_phone.trim() || null,
        is_active: true,
      };

      const { data: insertedClient, error: clientError } = await supabase
        .from('clients')
        .insert(clientPayload)
        .select('id')
        .single();

      if (clientError) throw clientError;
      if (!insertedClient?.id) {
        throw new Error('No se pudo recuperar el cliente recién creado.');
      }

      if (normalizedElevators.length > 0) {
        const elevatorsPayload = normalizedElevators.map((item) => ({
          client_id: insertedClient.id,
          internal_code: item.internal_code || null,
          elevator_number: item.elevator_number
            ? Number(item.elevator_number)
            : null,
          tower_name: item.tower_name || null,
          brand: item.brand,
          model: item.model,
          serial_number: item.serial_number || null,
          location_building:
            item.location_building ||
            clientData.building_name.trim() ||
            null,
          location_address: item.location_address || clientData.address.trim(),
          status: 'active',
        }));

        const { error: elevatorError } = await supabase
          .from('elevators')
          .insert(elevatorsPayload);

        if (elevatorError) {
          throw new Error(
            `Cliente creado, pero falló la creación de ascensores: ${elevatorError.message}`
          );
        }
      }

      setSuccess(
        normalizedElevators.length > 0
          ? 'Cliente y ascensores creados correctamente.'
          : 'Cliente creado correctamente.'
      );

      resetForm();
      onSuccess?.();
    } catch (err: any) {
      console.error('Error creating client:', err);
      setError(err?.message || 'Error al crear cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-6 h-6 text-green-600" />
          Nuevo Cliente
        </h2>

        {onCancel && (
          <button type="button" onClick={onCancel}>
            <X className="w-5 h-5 text-slate-500" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="font-semibold text-lg text-slate-900 mb-4">
            Datos del Cliente
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">Nombre del Cliente *</label>
              <input
                required
                value={clientData.company_name}
                onChange={(e) =>
                  setClientData({ ...clientData, company_name: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
                placeholder="Ej: Comunidad Edificio Torre Alcántara"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Nombre del Edificio</label>
              <input
                value={clientData.building_name}
                onChange={(e) =>
                  setClientData({ ...clientData, building_name: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
                placeholder="Ej: Torre Alcántara"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Dirección *</label>
              <input
                required
                value={clientData.address}
                onChange={(e) =>
                  setClientData({ ...clientData, address: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
                placeholder="Ej: Alcántara 44, Las Condes"
              />
            </div>
          </div>
        </div>

        <hr className="my-2" />

        <div>
          <h3 className="font-semibold text-lg text-slate-900 mb-4">
            Contacto del Cliente
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium">
                <User className="w-4 h-4 inline mr-1" />
                Nombre de contacto *
              </label>
              <input
                required
                value={clientData.contact_name}
                onChange={(e) =>
                  setClientData({ ...clientData, contact_name: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
                placeholder="Ej: Arturo Contreras"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <input
                type="email"
                value={clientData.contact_email}
                onChange={(e) =>
                  setClientData({ ...clientData, contact_email: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
                placeholder="Ej: contacto@empresa.cl"
              />
            </div>

            <div>
              <label className="block text-sm font-medium">
                <Phone className="w-4 h-4 inline mr-1" />
                Teléfono
              </label>
              <input
                value={clientData.contact_phone}
                onChange={(e) =>
                  setClientData({ ...clientData, contact_phone: e.target.value })
                }
                className="w-full border rounded px-3 py-2"
                placeholder="Ej: +56 9 1234 5678"
              />
            </div>
          </div>
        </div>

        <hr className="my-2" />

        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                Ascensores del Cliente
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                Puedes dejar esta sección vacía y crear los ascensores después.
              </p>
            </div>

            <button
              type="button"
              onClick={addElevator}
              className="inline-flex items-center gap-2 border rounded px-3 py-2 text-sm hover:bg-slate-50"
            >
              <Plus className="w-4 h-4" />
              Agregar ascensor
            </button>
          </div>

          <div className="space-y-4">
            {elevators.map((elevator, index) => (
              <div
                key={index}
                className="rounded-xl border border-slate-200 p-4 bg-slate-50"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-slate-900">
                    Ascensor #{index + 1}
                  </h4>

                  <button
                    type="button"
                    onClick={() => removeElevator(index)}
                    className="inline-flex items-center gap-2 text-red-600 border border-red-200 rounded px-3 py-1.5 text-sm hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Quitar
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Código interno</label>
                    <input
                      value={elevator.internal_code}
                      onChange={(e) =>
                        updateElevator(index, 'internal_code', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ej: ELE-001"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Número de ascensor
                    </label>
                    <input
                      value={elevator.elevator_number}
                      onChange={(e) =>
                        updateElevator(index, 'elevator_number', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ej: 1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Torre</label>
                    <input
                      value={elevator.tower_name}
                      onChange={(e) =>
                        updateElevator(index, 'tower_name', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ej: Torre A"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Marca *</label>
                    <input
                      value={elevator.brand}
                      onChange={(e) =>
                        updateElevator(index, 'brand', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ej: Otis"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Modelo *</label>
                    <input
                      value={elevator.model}
                      onChange={(e) =>
                        updateElevator(index, 'model', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ej: Gen2"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Serie</label>
                    <input
                      value={elevator.serial_number}
                      onChange={(e) =>
                        updateElevator(index, 'serial_number', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ej: SN-12345"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Ubicación edificio
                    </label>
                    <input
                      value={elevator.location_building}
                      onChange={(e) =>
                        updateElevator(index, 'location_building', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ej: Acceso principal"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">
                      Dirección ascensor *
                    </label>
                    <input
                      value={elevator.location_address}
                      onChange={(e) =>
                        updateElevator(index, 'location_address', e.target.value)
                      }
                      className="w-full border rounded px-3 py-2"
                      placeholder="Ej: Alcántara 44, Las Condes"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 border border-slate-300 rounded py-2"
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 text-white rounded py-2"
          >
            {loading ? 'Guardando...' : 'Crear Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}