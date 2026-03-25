import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Building2,
  Mail,
  Phone,
  User,
  X,
  Plus,
  Trash2,
  MapPin,
  Layers3,
  Briefcase,
  Users,
} from 'lucide-react';

interface ClientFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

type BuildingType = 'residencial' | 'corporativo';
type ElevatorDriveType = 'electromecanico' | 'hidraulico';
type ElevatorClassification = 'ascensor' | 'montacarga' | 'montaplatos' | 'otro';

interface AdditionalContact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
}

interface ElevatorTemplate {
  internal_code: string;
  brand: string;
  brand_other: string;
  model: string;
  model_unknown: boolean;
  serial_number: string;
  serial_number_not_legible: boolean;
  installation_date: string;
  installation_date_unknown: boolean;
  floors: string;
  capacity_kg: string;
  capacity_persons: string;
  elevator_type: ElevatorDriveType;
  classification: ElevatorClassification;
  classification_other: string;
  has_machine_room: boolean;
  no_machine_room: boolean;
  stops_all_floors: boolean;
  stops_odd_floors: boolean;
  stops_even_floors: boolean;
  use_tower: boolean;
  tower_name: string;
}

interface AddressGroup {
  id: string;
  same_address_as_client: boolean;
  address: string;
  quantity: number;
  all_equal: boolean;
  templates: ElevatorTemplate[];
}

const BRAND_OPTIONS = [
  'Otis',
  'Schindler',
  'Kone',
  'TK Elevator',
  'Mitsubishi',
  'Hyundai',
  'Fujitec',
  'Orona',
  'Sigma',
  'Atlas',
  'LG',
  'Otros',
] as const;

function createEmptyTemplate(): ElevatorTemplate {
  return {
    internal_code: '',
    brand: '',
    brand_other: '',
    model: '',
    model_unknown: false,
    serial_number: '',
    serial_number_not_legible: false,
    installation_date: '',
    installation_date_unknown: false,
    floors: '',
    capacity_kg: '',
    capacity_persons: '',
    elevator_type: 'electromecanico',
    classification: 'ascensor',
    classification_other: '',
    has_machine_room: false,
    no_machine_room: false,
    stops_all_floors: true,
    stops_odd_floors: false,
    stops_even_floors: false,
    use_tower: false,
    tower_name: '',
  };
}

function createAddressGroup(clientAddress = ''): AddressGroup {
  return {
    id: crypto.randomUUID(),
    same_address_as_client: true,
    address: clientAddress,
    quantity: 1,
    all_equal: true,
    templates: [createEmptyTemplate()],
  };
}

function createAdditionalContact(): AdditionalContact {
  return {
    id: crypto.randomUUID(),
    name: '',
    role: '',
    email: '',
    phone: '',
  };
}

function sanitize(value: string) {
  return value.trim();
}

function parseOptionalNumber(value: string) {
  const clean = sanitize(value);
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildInternalCode(base: string, elevatorNumber: number) {
  const clean = sanitize(base);
  if (!clean) return null;
  return `${clean}-${elevatorNumber}`;
}

function hasAnyContactMethod(email: string, phone: string) {
  return Boolean(sanitize(email) || sanitize(phone));
}

export function ClientForm({ onSuccess, onCancel }: ClientFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [clientData, setClientData] = useState({
    company_name: '',
    building_name: '',
    internal_alias: '',
    rut: '',
    address: '',
    city: '',
    building_type: 'residencial' as BuildingType,
    billing_address: '',
    self_managed: false,

    primary_contact_name: '',
    primary_contact_role: '',
    primary_contact_email: '',
    primary_contact_phone: '',

    admin_name: '',
    admin_email: '',
    admin_phone: '',
    admin_company: '',
  });

  const [additionalContacts, setAdditionalContacts] = useState<AdditionalContact[]>([]);
  const [groups, setGroups] = useState<AddressGroup[]>([createAddressGroup('')]);

  useEffect(() => {
    setGroups((prev) =>
      prev.map((group) =>
        group.same_address_as_client
          ? { ...group, address: clientData.address }
          : group
      )
    );
  }, [clientData.address]);

  const totalElevators = useMemo(
    () => groups.reduce((acc, group) => acc + Number(group.quantity || 0), 0),
    [groups]
  );

  const updateGroup = <K extends keyof AddressGroup>(
    groupIndex: number,
    field: K,
    value: AddressGroup[K]
  ) => {
    setGroups((prev) =>
      prev.map((group, index) => {
        if (index !== groupIndex) return group;

        let nextGroup: AddressGroup = { ...group, [field]: value };

        if (field === 'same_address_as_client' && value === true) {
          nextGroup.address = clientData.address;
        }

        if (field === 'quantity') {
          const nextQuantity = Math.max(1, Number(value || 1));

          if (nextGroup.all_equal) {
            nextGroup.templates = [nextGroup.templates[0] || createEmptyTemplate()];
          } else {
            const currentTemplates = [...nextGroup.templates];
            if (currentTemplates.length < nextQuantity) {
              while (currentTemplates.length < nextQuantity) {
                currentTemplates.push(createEmptyTemplate());
              }
            } else {
              currentTemplates.splice(nextQuantity);
            }
            nextGroup.templates = currentTemplates;
          }
        }

        if (field === 'all_equal') {
          if (value === true) {
            nextGroup.templates = [nextGroup.templates[0] || createEmptyTemplate()];
          } else {
            const currentTemplates = [...nextGroup.templates];
            const target = Math.max(1, Number(nextGroup.quantity || 1));

            if (currentTemplates.length < target) {
              while (currentTemplates.length < target) {
                currentTemplates.push(createEmptyTemplate());
              }
            } else {
              currentTemplates.splice(target);
            }

            nextGroup.templates = currentTemplates;
          }
        }

        return nextGroup;
      })
    );
  };

  const updateTemplate = <K extends keyof ElevatorTemplate>(
    groupIndex: number,
    templateIndex: number,
    field: K,
    value: ElevatorTemplate[K]
  ) => {
    setGroups((prev) =>
      prev.map((group, index) => {
        if (index !== groupIndex) return group;

        const templates = group.templates.map((template, tIndex) => {
          if (tIndex !== templateIndex) return template;

          const nextTemplate = { ...template, [field]: value };

          if (field === 'model_unknown' && value === true) {
            nextTemplate.model = '';
          }

          if (field === 'serial_number_not_legible' && value === true) {
            nextTemplate.serial_number = '';
          }

          if (field === 'installation_date_unknown' && value === true) {
            nextTemplate.installation_date = '';
          }

          if (field === 'use_tower' && value === false) {
            nextTemplate.tower_name = '';
          }

          if (field === 'classification' && value !== 'otro') {
            nextTemplate.classification_other = '';
          }

          if (field === 'has_machine_room' && value === true) {
            nextTemplate.no_machine_room = false;
          }

          if (field === 'no_machine_room' && value === true) {
            nextTemplate.has_machine_room = false;
          }

          if (field === 'stops_all_floors' && value === true) {
            nextTemplate.stops_odd_floors = false;
            nextTemplate.stops_even_floors = false;
          }

          return nextTemplate;
        });

        return { ...group, templates };
      })
    );
  };

  const addAddressGroup = () => {
    setGroups((prev) => [...prev, createAddressGroup(clientData.address)]);
  };

  const removeAddressGroup = (groupIndex: number) => {
    setGroups((prev) => {
      const next = prev.filter((_, index) => index !== groupIndex);
      return next.length > 0 ? next : [createAddressGroup(clientData.address)];
    });
  };

  const addAdditionalContact = () => {
    setAdditionalContacts((prev) => [...prev, createAdditionalContact()]);
  };

  const removeAdditionalContact = (contactId: string) => {
    setAdditionalContacts((prev) => prev.filter((item) => item.id !== contactId));
  };

  const updateAdditionalContact = <K extends keyof AdditionalContact>(
    contactId: string,
    field: K,
    value: AdditionalContact[K]
  ) => {
    setAdditionalContacts((prev) =>
      prev.map((item) =>
        item.id === contactId ? { ...item, [field]: value } : item
      )
    );
  };

  const resetForm = () => {
    setClientData({
      company_name: '',
      building_name: '',
      internal_alias: '',
      rut: '',
      address: '',
      city: '',
      building_type: 'residencial',
      billing_address: '',
      self_managed: false,
      primary_contact_name: '',
      primary_contact_role: '',
      primary_contact_email: '',
      primary_contact_phone: '',
      admin_name: '',
      admin_email: '',
      admin_phone: '',
      admin_company: '',
    });
    setAdditionalContacts([]);
    setGroups([createAddressGroup('')]);
  };

  const validateClient = () => {
    if (!sanitize(clientData.company_name)) {
      throw new Error('Debes ingresar el nombre completo o razón social.');
    }

    if (!sanitize(clientData.building_name)) {
      throw new Error('Debes ingresar el nombre del edificio.');
    }

    if (!sanitize(clientData.internal_alias)) {
      throw new Error('Debes ingresar el nombre interno o corto del edificio.');
    }

    if (!sanitize(clientData.address)) {
      throw new Error('Debes ingresar la dirección principal del cliente.');
    }

    if (clientData.self_managed) {
      if (!sanitize(clientData.primary_contact_name)) {
        throw new Error(
          'Si el edificio es autogestionado, el nombre del contacto principal es obligatorio.'
        );
      }

      if (!sanitize(clientData.primary_contact_role)) {
        throw new Error(
          'Si el edificio es autogestionado, el cargo o responsabilidad del contacto principal es obligatorio.'
        );
      }

      if (
        !hasAnyContactMethod(
          clientData.primary_contact_email,
          clientData.primary_contact_phone
        )
      ) {
        throw new Error(
          'Si el edificio es autogestionado, debes ingresar al menos correo o teléfono del contacto principal.'
        );
      }
    } else {
      if (!sanitize(clientData.admin_name)) {
        throw new Error(
          'Si el edificio tiene administrador, el nombre del administrador es obligatorio.'
        );
      }

      if (!hasAnyContactMethod(clientData.admin_email, clientData.admin_phone)) {
        throw new Error(
          'Si el edificio tiene administrador, debes ingresar al menos correo o teléfono del administrador.'
        );
      }
    }

    additionalContacts.forEach((contact, index) => {
      const hasAnyData =
        sanitize(contact.name) ||
        sanitize(contact.role) ||
        sanitize(contact.email) ||
        sanitize(contact.phone);

      if (!hasAnyData) return;

      if (!sanitize(contact.name)) {
        throw new Error(`Falta el nombre en contacto adicional #${index + 1}.`);
      }

      if (!sanitize(contact.role)) {
        throw new Error(
          `Falta el cargo o responsabilidad en contacto adicional #${index + 1}.`
        );
      }

      if (!hasAnyContactMethod(contact.email, contact.phone)) {
        throw new Error(
          `Debes ingresar correo o teléfono en contacto adicional #${index + 1}.`
        );
      }
    });
  };

  const validateTemplate = (
    template: ElevatorTemplate,
    label: string,
    requireAddress: boolean,
    groupAddress: string
  ) => {
    const brand =
      template.brand === 'Otros'
        ? sanitize(template.brand_other)
        : sanitize(template.brand);

    if (!brand) {
      throw new Error(`Falta la marca en ${label}.`);
    }

    if (!template.model_unknown && !sanitize(template.model)) {
      throw new Error(`Falta el modelo en ${label}.`);
    }

    if (!template.serial_number_not_legible && !sanitize(template.serial_number)) {
      throw new Error(`Falta el número de serie en ${label} o marca "no legible".`);
    }

    if (!template.installation_date_unknown && !sanitize(template.installation_date)) {
      throw new Error(`Falta la fecha de instalación en ${label} o marca "no disponible".`);
    }

    if (!sanitize(template.floors)) {
      throw new Error(`Falta la cantidad de pisos en ${label}.`);
    }

    if (parseOptionalNumber(template.floors) === null) {
      throw new Error(`La cantidad de pisos en ${label} debe ser numérica.`);
    }

    if (template.capacity_kg && parseOptionalNumber(template.capacity_kg) === null) {
      throw new Error(`La capacidad KG en ${label} debe ser numérica.`);
    }

    if (
      template.capacity_persons &&
      parseOptionalNumber(template.capacity_persons) === null
    ) {
      throw new Error(`La capacidad de personas en ${label} debe ser numérica.`);
    }

    if (template.use_tower && !sanitize(template.tower_name)) {
      throw new Error(`Marcaste uso de torre, pero falta la torre en ${label}.`);
    }

    if (template.classification === 'otro' && !sanitize(template.classification_other)) {
      throw new Error(`Debes especificar la clasificación "otro" en ${label}.`);
    }

    if (requireAddress && !sanitize(groupAddress)) {
      throw new Error(`Falta la dirección del bloque para ${label}.`);
    }
  };

  const validateGroups = () => {
    if (groups.length === 0) {
      throw new Error('Debes configurar al menos un bloque de ascensores.');
    }

    groups.forEach((group, groupIndex) => {
      const quantity = Math.max(1, Number(group.quantity || 1));

      if (!group.same_address_as_client && !sanitize(group.address)) {
        throw new Error(`Debes ingresar la dirección del bloque ${groupIndex + 1}.`);
      }

      if (group.all_equal) {
        validateTemplate(
          group.templates[0] || createEmptyTemplate(),
          `bloque ${groupIndex + 1}`,
          true,
          group.address
        );
      } else {
        if (group.templates.length !== quantity) {
          throw new Error(
            `Faltan fichas por completar en el bloque ${groupIndex + 1}.`
          );
        }

        group.templates.forEach((template, templateIndex) => {
          validateTemplate(
            template,
            `bloque ${groupIndex + 1} / ascensor ${templateIndex + 1}`,
            true,
            group.address
          );
        });
      }
    });
  };

  const buildAlternateContactsPayload = () => {
    const filteredAdditionalContacts = additionalContacts
      .map((contact) => ({
        name: sanitize(contact.name),
        role: sanitize(contact.role),
        email: sanitize(contact.email),
        phone: sanitize(contact.phone),
      }))
      .filter(
        (contact) =>
          contact.name || contact.role || contact.email || contact.phone
      );

    return {
      self_managed: clientData.self_managed,
      admin_company: sanitize(clientData.admin_company) || null,
      additional_contacts: filteredAdditionalContacts,
    };
  };

  const buildClientPayload = () => ({
    company_name: sanitize(clientData.company_name),
    building_name: sanitize(clientData.building_name),
    internal_alias: sanitize(clientData.internal_alias),
    rut: sanitize(clientData.rut) || null,
    address: sanitize(clientData.address) || null,
    city: sanitize(clientData.city) || null,
    building_type: clientData.building_type,
    billing_address: sanitize(clientData.billing_address) || null,

    contact_name: sanitize(clientData.primary_contact_name) || null,
    contact_person: sanitize(clientData.primary_contact_role) || null,
    contact_email: sanitize(clientData.primary_contact_email) || null,
    contact_phone: sanitize(clientData.primary_contact_phone) || null,

    admin_name: clientData.self_managed
      ? null
      : sanitize(clientData.admin_name) || null,
    admin_email: clientData.self_managed
      ? null
      : sanitize(clientData.admin_email) || null,
    admin_phone: clientData.self_managed
      ? null
      : sanitize(clientData.admin_phone) || null,

    is_active: true,
    client_code: `CLI-${Date.now()}`,
    alternate_contacts: buildAlternateContactsPayload(),
  });

  const buildElevatorPayloads = (clientId: string) => {
    const payloads: Record<string, any>[] = [];
    let globalElevatorNumber = 1;

    groups.forEach((group) => {
      const quantity = Math.max(1, Number(group.quantity || 1));
      const blockAddress = group.same_address_as_client
        ? sanitize(clientData.address)
        : sanitize(group.address);

      const templatesToUse = group.all_equal
        ? Array.from({ length: quantity }, () => group.templates[0])
        : group.templates.slice(0, quantity);

      templatesToUse.forEach((template) => {
        const brand =
          template.brand === 'Otros'
            ? sanitize(template.brand_other)
            : sanitize(template.brand);

        const classification =
          template.classification === 'otro'
            ? sanitize(template.classification_other)
            : template.classification;

        payloads.push({
          client_id: clientId,
          internal_code: sanitize(template.internal_code)
            ? buildInternalCode(template.internal_code, globalElevatorNumber)
            : null,
          elevator_number: globalElevatorNumber,
          tower_name: template.use_tower ? sanitize(template.tower_name) || null : null,
          brand: brand || null,
          model: template.model_unknown ? null : sanitize(template.model) || null,
          serial_number: template.serial_number_not_legible
            ? null
            : sanitize(template.serial_number) || null,
          serial_number_not_legible: template.serial_number_not_legible,
          installation_date: template.installation_date_unknown
            ? null
            : sanitize(template.installation_date) || null,
          floors: parseOptionalNumber(template.floors),
          capacity_kg: parseOptionalNumber(template.capacity_kg),
          capacity_persons: parseOptionalNumber(template.capacity_persons),
          location_address: blockAddress || null,
          address_asc: blockAddress || null,
          location_building: sanitize(clientData.building_name) || null,
          manufacturer: null,
          elevator_type: template.elevator_type,
          classification: classification || null,
          is_hydraulic: template.elevator_type === 'hidraulico',
          has_machine_room: template.has_machine_room,
          no_machine_room: template.no_machine_room,
          stops_all_floors: template.stops_all_floors,
          stops_odd_floors: template.stops_odd_floors,
          stops_even_floors: template.stops_even_floors,
          status: 'active',
        });

        globalElevatorNumber += 1;
      });
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
      validateGroups();

      const { data: insertedClient, error: clientError } = await supabase
        .from('clients')
        .insert(buildClientPayload())
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
        `Cliente creado correctamente con ${elevatorPayloads.length} ascensor(es).`
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
            Datos generales del cliente
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Nombre completo / razón social *"
              value={clientData.company_name}
              onChange={(v) => setClientData({ ...clientData, company_name: v })}
              placeholder="Ej: Comunidad Edificio Alcántara"
            />

            <Field
              label="Nombre del edificio *"
              value={clientData.building_name}
              onChange={(v) => setClientData({ ...clientData, building_name: v })}
              placeholder="Ej: Edificio Alcántara"
            />

            <Field
              label="Nombre interno / corto *"
              value={clientData.internal_alias}
              onChange={(v) => setClientData({ ...clientData, internal_alias: v })}
              placeholder="Ej: Alcántara"
            />

            <Field
              label="RUT"
              value={clientData.rut}
              onChange={(v) => setClientData({ ...clientData, rut: v })}
              placeholder="Ej: 56.049.780-6"
            />

            <Field
              label="Dirección principal *"
              value={clientData.address}
              onChange={(v) => setClientData({ ...clientData, address: v })}
              placeholder="Ej: Alcántara 44, Las Condes"
              icon={<MapPin className="h-4 w-4" />}
            />

            <Field
              label="Ciudad"
              value={clientData.city}
              onChange={(v) => setClientData({ ...clientData, city: v })}
              placeholder="Ej: Santiago"
            />

            <SelectField
              label="Tipo de edificio"
              value={clientData.building_type}
              onChange={(v) =>
                setClientData({ ...clientData, building_type: v as BuildingType })
              }
              options={[
                { value: 'residencial', label: 'Residencial' },
                { value: 'corporativo', label: 'Corporativo' },
              ]}
            />

            <Field
              label="Dirección de facturación"
              value={clientData.billing_address}
              onChange={(v) => setClientData({ ...clientData, billing_address: v })}
              placeholder="Opcional"
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-slate-700" />
            <h3 className="text-lg font-semibold text-slate-900">
              Administración del edificio
            </h3>
          </div>

          <div className="mb-4">
            <Checkbox
              label="Edificio autogestionado / sin administrador"
              checked={clientData.self_managed}
              onChange={(v) => setClientData({ ...clientData, self_managed: v })}
            />
          </div>

          {!clientData.self_managed && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field
                label="Nombre del administrador *"
                value={clientData.admin_name}
                onChange={(v) => setClientData({ ...clientData, admin_name: v })}
                placeholder="Nombre administrador"
              />

              <Field
                label="Empresa de administración"
                value={clientData.admin_company}
                onChange={(v) => setClientData({ ...clientData, admin_company: v })}
                placeholder="Ej: Administración XYZ"
              />

              <Field
                label="Correo administrador"
                value={clientData.admin_email}
                onChange={(v) => setClientData({ ...clientData, admin_email: v })}
                placeholder="Correo administrador"
                icon={<Mail className="h-4 w-4" />}
              />

              <Field
                label="Teléfono administrador"
                value={clientData.admin_phone}
                onChange={(v) => setClientData({ ...clientData, admin_phone: v })}
                placeholder="Teléfono administrador"
                icon={<Phone className="h-4 w-4" />}
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-700" />
            <h3 className="text-lg font-semibold text-slate-900">
              Encargados y contactos del edificio
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="Nombre contacto principal"
              value={clientData.primary_contact_name}
              onChange={(v) =>
                setClientData({ ...clientData, primary_contact_name: v })
              }
              placeholder="Ej: Arturo Contreras"
              icon={<User className="h-4 w-4" />}
            />

            <Field
              label="Cargo o responsabilidad"
              value={clientData.primary_contact_role}
              onChange={(v) =>
                setClientData({ ...clientData, primary_contact_role: v })
              }
              placeholder="Ej: Comité, conserje, encargado técnico"
            />

            <Field
              label="Correo contacto principal"
              value={clientData.primary_contact_email}
              onChange={(v) =>
                setClientData({ ...clientData, primary_contact_email: v })
              }
              placeholder="Ej: contacto@empresa.cl"
              icon={<Mail className="h-4 w-4" />}
            />

            <Field
              label="Teléfono contacto principal"
              value={clientData.primary_contact_phone}
              onChange={(v) =>
                setClientData({ ...clientData, primary_contact_phone: v })
              }
              placeholder="Ej: +56 9 1234 5678"
              icon={<Phone className="h-4 w-4" />}
            />
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              <h4 className="font-medium text-slate-900">
                Otros contactos responsables
              </h4>
              <p className="text-sm text-slate-500">
                Puedes agregar más personas encargadas del edificio.
              </p>
            </div>

            <button
              type="button"
              onClick={addAdditionalContact}
              className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Agregar contacto
            </button>
          </div>

          {additionalContacts.length > 0 && (
            <div className="mt-4 space-y-4">
              {additionalContacts.map((contact, index) => (
                <div
                  key={contact.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h5 className="font-medium text-slate-900">
                      Contacto adicional #{index + 1}
                    </h5>

                    <button
                      type="button"
                      onClick={() => removeAdditionalContact(contact.id)}
                      className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Quitar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      label="Nombre"
                      value={contact.name}
                      onChange={(v) =>
                        updateAdditionalContact(contact.id, 'name', v)
                      }
                      placeholder="Nombre"
                    />

                    <Field
                      label="Cargo o responsabilidad"
                      value={contact.role}
                      onChange={(v) =>
                        updateAdditionalContact(contact.id, 'role', v)
                      }
                      placeholder="Ej: mayordomo, comité, encargado"
                    />

                    <Field
                      label="Correo"
                      value={contact.email}
                      onChange={(v) =>
                        updateAdditionalContact(contact.id, 'email', v)
                      }
                      placeholder="Correo"
                    />

                    <Field
                      label="Teléfono"
                      value={contact.phone}
                      onChange={(v) =>
                        updateAdditionalContact(contact.id, 'phone', v)
                      }
                      placeholder="Teléfono"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Layers3 className="h-5 w-5 text-blue-600" />
                Configuración de ascensores por dirección
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Total configurado: <strong>{totalElevators}</strong> ascensor(es)
              </p>
            </div>

            <button
              type="button"
              onClick={addAddressGroup}
              className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Agregar dirección
            </button>
          </div>

          <div className="space-y-6">
            {groups.map((group, groupIndex) => {
              const templateCount = group.all_equal ? 1 : group.quantity;

              return (
                <div
                  key={group.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 font-semibold text-slate-900">
                        <MapPin className="h-4 w-4 text-slate-600" />
                        Bloque dirección #{groupIndex + 1}
                      </h4>
                      <p className="text-sm text-slate-500">
                        Define cantidad y si los ascensores de este bloque son iguales o distintos.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAddressGroup(groupIndex)}
                      className="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Quitar bloque
                    </button>
                  </div>

                  <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field
                      label="Cantidad de ascensores *"
                      type="number"
                      value={String(group.quantity)}
                      onChange={(v) =>
                        updateGroup(groupIndex, 'quantity', Math.max(1, Number(v || 1)))
                      }
                      placeholder="Ej: 3"
                    />

                    <Checkbox
                      label="Todos iguales"
                      checked={group.all_equal}
                      onChange={(v) => updateGroup(groupIndex, 'all_equal', v)}
                    />

                    <Checkbox
                      label="Usar misma dirección del cliente"
                      checked={group.same_address_as_client}
                      onChange={(v) =>
                        updateGroup(groupIndex, 'same_address_as_client', v)
                      }
                    />

                    <div className="rounded border bg-white px-3 py-2 text-sm text-slate-600">
                      Numeración automática:{' '}
                      <strong>
                        {Array.from({ length: group.quantity }, (_, i) => i + 1).join(', ')}
                      </strong>
                    </div>
                  </div>

                  {!group.same_address_as_client && (
                    <div className="mb-5">
                      <Field
                        label="Dirección de este bloque *"
                        value={group.address}
                        onChange={(v) => updateGroup(groupIndex, 'address', v)}
                        placeholder="Ej: Apoquindo 1234, Las Condes"
                      />
                    </div>
                  )}

                  <div className="space-y-5">
                    {Array.from({ length: templateCount }, (_, templateIndex) => {
                      const template = group.templates[templateIndex] || createEmptyTemplate();
                      const title = group.all_equal
                        ? 'Ficha base para todos los ascensores del bloque'
                        : `Ficha ascensor ${templateIndex + 1}`;

                      return (
                        <div
                          key={`${group.id}-${templateIndex}`}
                          className="rounded-xl border bg-white p-4"
                        >
                          <h5 className="mb-4 font-medium text-slate-900">{title}</h5>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                            <Field
                              label="Código interno (opcional)"
                              value={template.internal_code}
                              onChange={(v) =>
                                updateTemplate(groupIndex, templateIndex, 'internal_code', v)
                              }
                              placeholder="Ej: ALC"
                            />

                            <SelectField
                              label="Marca *"
                              value={template.brand}
                              onChange={(v) =>
                                updateTemplate(groupIndex, templateIndex, 'brand', v)
                              }
                              options={[
                                { value: '', label: 'Selecciona marca' },
                                ...BRAND_OPTIONS.map((item) => ({
                                  value: item,
                                  label: item,
                                })),
                              ]}
                            />

                            {template.brand === 'Otros' && (
                              <Field
                                label="Otra marca *"
                                value={template.brand_other}
                                onChange={(v) =>
                                  updateTemplate(groupIndex, templateIndex, 'brand_other', v)
                                }
                                placeholder="Especifica la marca"
                              />
                            )}

                            <div className="xl:col-span-2">
                              <Field
                                label="Modelo"
                                value={template.model}
                                onChange={(v) =>
                                  updateTemplate(groupIndex, templateIndex, 'model', v)
                                }
                                placeholder="Ej: Gen2"
                              />
                              <div className="mt-2">
                                <Checkbox
                                  label="Modelo no conocido"
                                  checked={template.model_unknown}
                                  onChange={(v) =>
                                    updateTemplate(
                                      groupIndex,
                                      templateIndex,
                                      'model_unknown',
                                      v
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div className="xl:col-span-2">
                              <Field
                                label="N° serie"
                                value={template.serial_number}
                                onChange={(v) =>
                                  updateTemplate(
                                    groupIndex,
                                    templateIndex,
                                    'serial_number',
                                    v
                                  )
                                }
                                placeholder="Ej: SN-12345"
                              />
                              <div className="mt-2">
                                <Checkbox
                                  label="Número de serie no legible"
                                  checked={template.serial_number_not_legible}
                                  onChange={(v) =>
                                    updateTemplate(
                                      groupIndex,
                                      templateIndex,
                                      'serial_number_not_legible',
                                      v
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <div className="xl:col-span-2">
                              <Field
                                label="Fecha instalación"
                                type="date"
                                value={template.installation_date}
                                onChange={(v) =>
                                  updateTemplate(
                                    groupIndex,
                                    templateIndex,
                                    'installation_date',
                                    v
                                  )
                                }
                              />
                              <div className="mt-2">
                                <Checkbox
                                  label="Fecha no disponible"
                                  checked={template.installation_date_unknown}
                                  onChange={(v) =>
                                    updateTemplate(
                                      groupIndex,
                                      templateIndex,
                                      'installation_date_unknown',
                                      v
                                    )
                                  }
                                />
                              </div>
                            </div>

                            <Field
                              label="Pisos *"
                              value={template.floors}
                              onChange={(v) =>
                                updateTemplate(groupIndex, templateIndex, 'floors', v)
                              }
                              placeholder="Ej: 12"
                            />

                            <Field
                              label="Capacidad KG"
                              value={template.capacity_kg}
                              onChange={(v) =>
                                updateTemplate(groupIndex, templateIndex, 'capacity_kg', v)
                              }
                              placeholder="Ej: 630"
                            />

                            <Field
                              label="Capacidad personas"
                              value={template.capacity_persons}
                              onChange={(v) =>
                                updateTemplate(
                                  groupIndex,
                                  templateIndex,
                                  'capacity_persons',
                                  v
                                )
                              }
                              placeholder="Ej: 8"
                            />

                            <SelectField
                              label="Tipo de ascensor"
                              value={template.elevator_type}
                              onChange={(v) =>
                                updateTemplate(
                                  groupIndex,
                                  templateIndex,
                                  'elevator_type',
                                  v as ElevatorDriveType
                                )
                              }
                              options={[
                                { value: 'electromecanico', label: 'Electromecánico' },
                                { value: 'hidraulico', label: 'Hidráulico' },
                              ]}
                            />

                            <SelectField
                              label="Tipo de equipo"
                              value={template.classification}
                              onChange={(v) =>
                                updateTemplate(
                                  groupIndex,
                                  templateIndex,
                                  'classification',
                                  v as ElevatorClassification
                                )
                              }
                              options={[
                                { value: 'ascensor', label: 'Ascensor' },
                                { value: 'montacarga', label: 'Montacarga' },
                                { value: 'montaplatos', label: 'Montaplatos' },
                                { value: 'otro', label: 'Otro' },
                              ]}
                            />

                            {template.classification === 'otro' && (
                              <Field
                                label="Otro tipo de equipo *"
                                value={template.classification_other}
                                onChange={(v) =>
                                  updateTemplate(
                                    groupIndex,
                                    templateIndex,
                                    'classification_other',
                                    v
                                  )
                                }
                                placeholder="Especifica"
                              />
                            )}
                          </div>

                          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <Checkbox
                              label="Usar torre"
                              checked={template.use_tower}
                              onChange={(v) =>
                                updateTemplate(groupIndex, templateIndex, 'use_tower', v)
                              }
                            />

                            {template.use_tower && (
                              <Field
                                label="Torre *"
                                value={template.tower_name}
                                onChange={(v) =>
                                  updateTemplate(
                                    groupIndex,
                                    templateIndex,
                                    'tower_name',
                                    v
                                  )
                                }
                                placeholder="Ej: Torre A"
                              />
                            )}

                            <Checkbox
                              label="Tiene sala de máquinas"
                              checked={template.has_machine_room}
                              onChange={(v) =>
                                updateTemplate(
                                  groupIndex,
                                  templateIndex,
                                  'has_machine_room',
                                  v
                                )
                              }
                            />

                            <Checkbox
                              label="Sin sala de máquinas"
                              checked={template.no_machine_room}
                              onChange={(v) =>
                                updateTemplate(
                                  groupIndex,
                                  templateIndex,
                                  'no_machine_room',
                                  v
                                )
                              }
                            />

                            <Checkbox
                              label="Se detiene en todos los pisos"
                              checked={template.stops_all_floors}
                              onChange={(v) =>
                                updateTemplate(
                                  groupIndex,
                                  templateIndex,
                                  'stops_all_floors',
                                  v
                                )
                              }
                            />

                            <Checkbox
                              label="Se detiene en pisos impares"
                              checked={template.stops_odd_floors}
                              onChange={(v) =>
                                updateTemplate(
                                  groupIndex,
                                  templateIndex,
                                  'stops_odd_floors',
                                  v
                                )
                              }
                            />

                            <Checkbox
                              label="Se detiene en pisos pares"
                              checked={template.stops_even_floors}
                              onChange={(v) =>
                                updateTemplate(
                                  groupIndex,
                                  templateIndex,
                                  'stops_even_floors',
                                  v
                                )
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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