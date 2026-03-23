import { useMemo, useState } from 'react';
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
  Layers3,
} from 'lucide-react';

interface ClientFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface ElevatorDraft {
  internal_code: string;
  brand: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  serial_number_not_legible: boolean;
  installation_date: string;
  capacity_kg: string;
  capacity_persons: string;
  floors: string;
  location_building: string;
  location_address: string;
  location_coordinates: string;
  location_name: string;
  tower_name: string;
  elevator_number: string;
  index_number: string;
  address_asc: string;
  elevator_type: 'electromecanico' | 'hidraulico';
  classification: 'ascensor' | 'montacarga' | 'montaplatos' | 'otro';
  has_machine_room: boolean;
  no_machine_room: boolean;
  stops_all_floors: boolean;
  stops_odd_floors: boolean;
  stops_even_floors: boolean;
  quantity: string;
  all_identical: boolean;
}

const createEmptyElevator = (): ElevatorDraft => ({
  internal_code: '',
  brand: '',
  manufacturer: '',
  model: '',
  serial_number: '',
  serial_number_not_legible: false,
  installation_date: '',
  capacity_kg: '',
  capacity_persons: '',
  floors: '',
  location_building: '',
  location_address: '',
  location_coordinates: '',
  location_name: '',
  tower_name: '',
  elevator_number: '',
  index_number: '',
  address_asc: '',
  elevator_type: 'electromecanico',
  classification: 'ascensor',
  has_machine_room: false,
  no_machine_room: false,
  stops_all_floors: true,
  stops_odd_floors: false,
  stops_even_floors: false,
  quantity: '1',
  all_identical: true,
});

function generateClientCode() {
  return `CLI-${Date.now()}`;
}

function sanitizeText(value: string) {
  return value.trim();
}

function parseOptionalInteger(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function buildIndexedCode(baseCode: string, index: number) {
  const clean = baseCode.trim();
  if (!clean) return null;
  return `${clean}-${index + 1}`;
}

export function ClientForm({ onSuccess, onCancel }: ClientFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [clientData, setClientData] = useState({
    company_name: '',
    building_name: '',
    rut: '',
    address: '',
    city: '',
    internal_alias: '',
    billing_address: '',
    contact_name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    admin_name: '',
    admin_email: '',
    admin_phone: '',
  });

  const [elevators, setElevators] = useState<ElevatorDraft[]>([
    createEmptyElevator(),
  ]);

  const normalizedElevators = useMemo(() => {
    return elevators.filter((item) => {
      return (
        sanitizeText(item.brand) ||
        sanitizeText(item.manufacturer) ||
        sanitizeText(item.model) ||
        sanitizeText(item.serial_number) ||
        sanitizeText(item.location_building) ||
        sanitizeText(item.location_address) ||
        sanitizeText(item.location_name) ||
        sanitizeText(item.tower_name) ||
        sanitizeText(item.internal_code) ||
        sanitizeText(item.elevator_number) ||
        sanitizeText(item.index_number)
      );
    });
  }, [elevators]);

  const updateElevator = <K extends keyof ElevatorDraft>(
    index: number,
    field: K,
    value: ElevatorDraft[K]
  ) => {
    setElevators((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addElevator = () => {
    setElevators((prev) => [...prev, createEmptyElevator()]);
  };

  const removeElevator = (index: number) => {
    setElevators((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [createEmptyElevator()];
    });
  };

  const resetForm = () => {
    setClientData({
      company_name: '',
      building_name: '',
      rut: '',
      address: '',
      city: '',
      internal_alias: '',
      billing_address: '',
      contact_name: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      admin_name: '',
      admin_email: '',
      admin_phone: '',
    });
    setElevators([createEmptyElevator()]);
  };

  const validateClient = () => {
    if (!sanitizeText(clientData.company_name)) {
      throw new Error('Debes ingresar el nombre del cliente.');
    }

    if (!sanitizeText(clientData.building_name)) {
      throw new Error('Debes ingresar el nombre del edificio.');
    }

    if (!sanitizeText(clientData.rut)) {
      throw new Error('Debes ingresar el RUT.');
    }

    if (!sanitizeText(clientData.address)) {
      throw new Error('Debes ingresar la dirección del cliente.');
    }
  };

  const validateElevators = () => {
    for (let i = 0; i < normalizedElevators.length; i += 1) {
      const elevator = normalizedElevators[i];
      const itemLabel = `Ascensor #${i + 1}`;

      if (!sanitizeText(elevator.brand)) {
        throw new Error(`Falta la marca en ${itemLabel}.`);
      }

      if (!sanitizeText(elevator.manufacturer)) {
        throw new Error(`Falta el fabricante en ${itemLabel}.`);
      }

      if (!sanitizeText(elevator.model)) {
        throw new Error(`Falta el modelo en ${itemLabel}.`);
      }

      if (!sanitizeText(elevator.location_address) && !sanitizeText(clientData.address)) {
        throw new Error(`Falta la dirección de ubicación en ${itemLabel}.`);
      }

      if (elevator.quantity.trim()) {
        const quantity = Number(elevator.quantity);
        if (Number.isNaN(quantity) || quantity < 1) {
          throw new Error(`La cantidad en ${itemLabel} debe ser mayor o igual a 1.`);
        }
      }

      if (elevator.elevator_number.trim() && Number.isNaN(Number(elevator.elevator_number))) {
        throw new Error(`El número de ascensor en ${itemLabel} debe ser numérico.`);
      }

      if (elevator.index_number.trim() && Number.isNaN(Number(elevator.index_number))) {
        throw new Error(`El índice en ${itemLabel} debe ser numérico.`);
      }

      if (elevator.floors.trim() && Number.isNaN(Number(elevator.floors))) {
        throw new Error(`Los pisos en ${itemLabel} deben ser numéricos.`);
      }

      if (elevator.capacity_kg.trim() && Number.isNaN(Number(elevator.capacity_kg))) {
        throw new Error(`La capacidad KG en ${itemLabel} debe ser numérica.`);
      }

      if (elevator.capacity_persons.trim() && Number.isNaN(Number(elevator.capacity_persons))) {
        throw new Error(`La capacidad de personas en ${itemLabel} debe ser numérica.`);
      }

      if (elevator.has_machine_room && elevator.no_machine_room) {
        throw new Error(`No puedes marcar sala de máquinas y sin sala en ${itemLabel}.`);
      }
    }
  };

  const buildElevatorPayloads = (clientId: string) => {
    const payloads: Record<string, any>[] = [];

    normalizedElevators.forEach((item) => {
      const quantity = Math.max(1, Number(item.quantity || '1') || 1);
      const allIdentical = item.all_identical;

      for (let i = 0; i < quantity; i += 1) {
        const shouldReplicate = allIdentical && quantity > 1;

        const baseElevatorNumber = parseOptionalInteger(item.elevator_number);
        const baseIndexNumber = parseOptionalInteger(item.index_number);

        const elevator_number =
          shouldReplicate && baseElevatorNumber !== null
            ? baseElevatorNumber + i
            : baseElevatorNumber;

        const index_number =
          shouldReplicate && baseIndexNumber !== null
            ? baseIndexNumber + i
            : baseIndexNumber;

        payloads.push({
          client_id: clientId,
          internal_code:
            shouldReplicate && sanitizeText(item.internal_code)
              ? buildIndexedCode(item.internal_code, i)
              : sanitizeText(item.internal_code) || null,
          brand: sanitizeText(item.brand) || null,
          manufacturer: sanitizeText(item.manufacturer) || null,
          model: sanitizeText(item.model) || null,
          serial_number: sanitizeText(item.serial_number) || null,
          serial_number_not_legible: item.serial_number_not_legible,
          installation_date: item.installation_date || null,
          capacity_kg: parseOptionalInteger(item.capacity_kg),
          capacity_persons: parseOptionalInteger(item.capacity_persons),
          floors: parseOptionalInteger(item.floors),
          location_building:
            sanitizeText(item.location_building) ||
            sanitizeText(clientData.building_name) ||
            null,
          location_address:
            sanitizeText(item.location_address) ||
            sanitizeText(clientData.address) ||
            null,
          location_coordinates: sanitizeText(item.location_coordinates) || null,
          location_name: sanitizeText(item.location_name) || null,
          tower_name: sanitizeText(item.tower_name) || null,
          index_number,
          elevator_number,
          address_asc:
            sanitizeText(item.address_asc) ||
            sanitizeText(item.location_address) ||
            sanitizeText(clientData.address) ||
            null,
          elevator_type: item.elevator_type,
          classification: item.classification,
          is_hydraulic: item.elevator_type === 'hidraulico',
          has_machine_room: item.has_machine_room,
          no_machine_room: item.no_machine_room,
          stops_all_floors: item.stops_all_floors,
          stops_odd_floors: item.stops_odd_floors,
          stops_even_floors: item.stops_even_floors,
          status: 'active',
        });
      }
    });

    return payloads;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      validateClient();
      validateElevators();

      const clientPayload = {
        company_name: sanitizeText(clientData.company_name),
        building_name: sanitizeText(clientData.building_name),
        rut: sanitizeText(clientData.rut),
        address: sanitizeText(clientData.address) || null,
        city: sanitizeText(clientData.city) || null,
        internal_alias: sanitizeText(clientData.internal_alias) || null,
        billing_address: sanitizeText(clientData.billing_address) || null,
        contact_name: sanitizeText(clientData.contact_name) || null,
        contact_person:
          sanitizeText(clientData.contact_person) ||
          sanitizeText(clientData.contact_name) ||
          null,
        contact_email: sanitizeText(clientData.contact_email) || null,
        contact_phone: sanitizeText(clientData.contact_phone) || null,
        admin_name: sanitizeText(clientData.admin_name) || null,
        admin_email: sanitizeText(clientData.admin_email) || null,
        admin_phone: sanitizeText(clientData.admin_phone) || null,
        client_code: generateClientCode(),
        is_active: true,
        alternate_contacts: null,
      };

      const { data: insertedClient, error: clientError } = await supabase
        .from('clients')
        .insert(clientPayload)
        .select('id')
        .single();

      if (clientError) throw clientError;
      if (!insertedClient?.id) {
        throw new Error('No se pudo recuperar el cliente creado.');
      }

      const elevatorPayloads = buildElevatorPayloads(insertedClient.id);

      if (elevatorPayloads.length > 0) {
        const { error: elevatorError } = await supabase
          .from('elevators')
          .insert(elevatorPayloads);

        if (elevatorError) {
          throw new Error(
            `Cliente creado, pero falló la creación de ascensores: ${elevatorError.message}`
          );
        }
      }

      setSuccess(
        elevatorPayloads.length > 0
          ? `Cliente creado correctamente con ${elevatorPayloads.length} ascensor(es).`
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
    <div className="rounded-xl bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Building2 className="h-6 w-6 text-green-600" />
          Nuevo Cliente
        </h2>

        {onCancel && (
          <button type="button" onClick={onCancel}>
            <X className="h-5 w-5 text-slate-500" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <section>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Datos del Cliente
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Nombre del cliente *"
              value={clientData.company_name}
              onChange={(v) => setClientData({ ...clientData, company_name: v })}
              placeholder="Ej: Comunidad Edificio Torre Alcántara"
            />

            <Field
              label="Nombre del edificio *"
              value={clientData.building_name}
              onChange={(v) => setClientData({ ...clientData, building_name: v })}
              placeholder="Ej: Torre Alcántara"
            />

            <Field
              label="RUT *"
              value={clientData.rut}
              onChange={(v) => setClientData({ ...clientData, rut: v })}
              placeholder="Ej: 56049780-6"
            />

            <Field
              label="Alias interno"
              value={clientData.internal_alias}
              onChange={(v) => setClientData({ ...clientData, internal_alias: v })}
              placeholder="Ej: Alcántara"
            />

            <Field
              label="Dirección *"
              value={clientData.address}
              onChange={(v) => setClientData({ ...clientData, address: v })}
              placeholder="Ej: Alcántara 44, Las Condes"
            />

            <Field
              label="Ciudad"
              value={clientData.city}
              onChange={(v) => setClientData({ ...clientData, city: v })}
              placeholder="Ej: Santiago"
            />

            <Field
              label="Dirección de facturación"
              value={clientData.billing_address}
              onChange={(v) => setClientData({ ...clientData, billing_address: v })}
              placeholder="Opcional"
            />
          </div>
        </section>

        <section>
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Contactos del Cliente
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Nombre contacto"
              icon={<User className="h-4 w-4" />}
              value={clientData.contact_name}
              onChange={(v) => setClientData({ ...clientData, contact_name: v })}
              placeholder="Ej: Arturo Contreras"
            />

            <Field
              label="Persona de contacto"
              icon={<User className="h-4 w-4" />}
              value={clientData.contact_person}
              onChange={(v) => setClientData({ ...clientData, contact_person: v })}
              placeholder="Opcional"
            />

            <Field
              label="Email contacto"
              icon={<Mail className="h-4 w-4" />}
              value={clientData.contact_email}
              onChange={(v) => setClientData({ ...clientData, contact_email: v })}
              placeholder="Ej: contacto@empresa.cl"
            />

            <Field
              label="Teléfono contacto"
              icon={<Phone className="h-4 w-4" />}
              value={clientData.contact_phone}
              onChange={(v) => setClientData({ ...clientData, contact_phone: v })}
              placeholder="Ej: +56 9 1234 5678"
            />

            <Field
              label="Administrador"
              value={clientData.admin_name}
              onChange={(v) => setClientData({ ...clientData, admin_name: v })}
              placeholder="Nombre administrador"
            />

            <Field
              label="Email administrador"
              value={clientData.admin_email}
              onChange={(v) => setClientData({ ...clientData, admin_email: v })}
              placeholder="Email administrador"
            />

            <Field
              label="Teléfono administrador"
              value={clientData.admin_phone}
              onChange={(v) => setClientData({ ...clientData, admin_phone: v })}
              placeholder="Teléfono administrador"
            />
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Layers3 className="h-5 w-5 text-blue-600" />
                Ascensores del Cliente
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Puedes crear uno o varios ascensores. También puedes replicar fichas idénticas.
              </p>
            </div>

            <button
              type="button"
              onClick={addElevator}
              className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Agregar ascensor
            </button>
          </div>

          <div className="space-y-6">
            {elevators.map((elevator, index) => (
              <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="font-medium text-slate-900">
                    Ficha de ascensor #{index + 1}
                  </h4>

                  <button
                    type="button"
                    onClick={() => removeElevator(index)}
                    className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field
                    label="Código interno"
                    value={elevator.internal_code}
                    onChange={(v) => updateElevator(index, 'internal_code', v)}
                    placeholder="Ej: ELE-001"
                  />

                  <Field
                    label="Número ascensor"
                    value={elevator.elevator_number}
                    onChange={(v) => updateElevator(index, 'elevator_number', v)}
                    placeholder="Ej: 1"
                  />

                  <Field
                    label="Índice"
                    value={elevator.index_number}
                    onChange={(v) => updateElevator(index, 'index_number', v)}
                    placeholder="Ej: 1"
                  />

                  <Field
                    label="Torre"
                    value={elevator.tower_name}
                    onChange={(v) => updateElevator(index, 'tower_name', v)}
                    placeholder="Ej: Torre A"
                  />

                  <Field
                    label="Ubicación / nombre"
                    value={elevator.location_name}
                    onChange={(v) => updateElevator(index, 'location_name', v)}
                    placeholder="Ej: Hall principal"
                  />

                  <Field
                    label="Ubicación edificio"
                    value={elevator.location_building}
                    onChange={(v) => updateElevator(index, 'location_building', v)}
                    placeholder="Ej: Acceso principal"
                  />

                  <Field
                    label="Dirección ubicación"
                    value={elevator.location_address}
                    onChange={(v) => updateElevator(index, 'location_address', v)}
                    placeholder="Ej: Alcántara 44, Las Condes"
                  />

                  <Field
                    label="Dirección ascensor"
                    value={elevator.address_asc}
                    onChange={(v) => updateElevator(index, 'address_asc', v)}
                    placeholder="Ej: Alcántara 44, Las Condes"
                  />

                  <Field
                    label="Coordenadas"
                    value={elevator.location_coordinates}
                    onChange={(v) => updateElevator(index, 'location_coordinates', v)}
                    placeholder="Opcional"
                  />

                  <Field
                    label="Marca *"
                    value={elevator.brand}
                    onChange={(v) => updateElevator(index, 'brand', v)}
                    placeholder="Ej: Otis"
                  />

                  <Field
                    label="Fabricante *"
                    value={elevator.manufacturer}
                    onChange={(v) => updateElevator(index, 'manufacturer', v)}
                    placeholder="Ej: Otis"
                  />

                  <Field
                    label="Modelo *"
                    value={elevator.model}
                    onChange={(v) => updateElevator(index, 'model', v)}
                    placeholder="Ej: Gen2"
                  />

                  <Field
                    label="N° serie"
                    value={elevator.serial_number}
                    onChange={(v) => updateElevator(index, 'serial_number', v)}
                    placeholder="Ej: SN-12345"
                  />

                  <Field
                    label="Fecha instalación"
                    type="date"
                    value={elevator.installation_date}
                    onChange={(v) => updateElevator(index, 'installation_date', v)}
                  />

                  <Field
                    label="Pisos"
                    value={elevator.floors}
                    onChange={(v) => updateElevator(index, 'floors', v)}
                    placeholder="Ej: 12"
                  />

                  <Field
                    label="Capacidad KG"
                    value={elevator.capacity_kg}
                    onChange={(v) => updateElevator(index, 'capacity_kg', v)}
                    placeholder="Ej: 630"
                  />

                  <Field
                    label="Capacidad personas"
                    value={elevator.capacity_persons}
                    onChange={(v) => updateElevator(index, 'capacity_persons', v)}
                    placeholder="Ej: 8"
                  />

                  <SelectField
                    label="Tipo de ascensor"
                    value={elevator.elevator_type}
                    onChange={(v) =>
                      updateElevator(
                        index,
                        'elevator_type',
                        v as ElevatorDraft['elevator_type']
                      )
                    }
                    options={[
                      { value: 'electromecanico', label: 'Electromecánico' },
                      { value: 'hidraulico', label: 'Hidráulico' },
                    ]}
                  />

                  <SelectField
                    label="Clasificación"
                    value={elevator.classification}
                    onChange={(v) =>
                      updateElevator(
                        index,
                        'classification',
                        v as ElevatorDraft['classification']
                      )
                    }
                    options={[
                      { value: 'ascensor', label: 'Ascensor' },
                      { value: 'montacarga', label: 'Montacarga' },
                      { value: 'montaplatos', label: 'Montaplatos' },
                      { value: 'otro', label: 'Otro' },
                    ]}
                  />

                  <Field
                    label="Cantidad"
                    value={elevator.quantity}
                    onChange={(v) => updateElevator(index, 'quantity', v)}
                    placeholder="Ej: 3"
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Checkbox
                    label="Serie no legible"
                    checked={elevator.serial_number_not_legible}
                    onChange={(v) =>
                      updateElevator(index, 'serial_number_not_legible', v)
                    }
                  />

                  <Checkbox
                    label="Tiene sala de máquinas"
                    checked={elevator.has_machine_room}
                    onChange={(v) => updateElevator(index, 'has_machine_room', v)}
                  />

                  <Checkbox
                    label="Sin sala de máquinas"
                    checked={elevator.no_machine_room}
                    onChange={(v) => updateElevator(index, 'no_machine_room', v)}
                  />

                  <Checkbox
                    label="Se detiene en todos los pisos"
                    checked={elevator.stops_all_floors}
                    onChange={(v) => updateElevator(index, 'stops_all_floors', v)}
                  />

                  <Checkbox
                    label="Se detiene en pisos impares"
                    checked={elevator.stops_odd_floors}
                    onChange={(v) => updateElevator(index, 'stops_odd_floors', v)}
                  />

                  <Checkbox
                    label="Se detiene en pisos pares"
                    checked={elevator.stops_even_floors}
                    onChange={(v) => updateElevator(index, 'stops_even_floors', v)}
                  />

                  <Checkbox
                    label="Todos iguales"
                    checked={elevator.all_identical}
                    onChange={(v) => updateElevator(index, 'all_identical', v)}
                  />
                </div>

                {Number(elevator.quantity || '1') > 1 && elevator.all_identical && (
                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                    Se crearán <strong>{Number(elevator.quantity || '1')}</strong>{' '}
                    fichas iguales a partir de esta base, incrementando{' '}
                    <strong>número de ascensor</strong>, <strong>índice</strong> y
                    el <strong>código interno</strong> si fueron informados.
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded border border-slate-300 py-2"
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded bg-green-600 py-2 text-white"
          >
            {loading ? 'Guardando...' : 'Crear Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {icon && <span className="mr-1 inline-flex align-middle">{icon}</span>}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border px-3 py-2"
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border px-3 py-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded border bg-white px-3 py-2 text-sm text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}