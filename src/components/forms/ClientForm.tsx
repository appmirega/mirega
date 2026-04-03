import { useEffect, useId, useMemo, useState } from 'react';
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

interface ClientAlternateContactsPayload {
  self_managed?: boolean;
  admin_company?: string | null;
  enable_building_contacts?: boolean;
  additional_contacts?: Array<{
    name?: string | null;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
  }>;
}

interface EditableClient {
  id: string;
  company_name?: string | null;
  building_name?: string | null;
  internal_alias?: string | null;
  rut?: string | null;
  address?: string | null;
  commune?: string | null;
  city?: string | null;
  building_type?: BuildingType | null;
  contact_name?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  admin_name?: string | null;
  admin_email?: string | null;
  admin_phone?: string | null;
  alternate_contacts?: ClientAlternateContactsPayload | null;
}

interface ClientFormProps {
  client?: EditableClient | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

type BuildingType = 'residencial' | 'corporativo' | 'academico' | 'estatal';
type ElevatorDriveType = 'electromecanico' | 'hidraulico';
type ElevatorClassification = 'ascensor' | 'montacarga' | 'montaplatos' | 'otro';
type StopPattern = 'all' | 'odd' | 'even';

interface AdditionalContact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
}

interface ElevatorTemplate {
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
  commune: string;
  region: string;
  quantity: number;
  all_equal: boolean;
  templates: ElevatorTemplate[];
  stop_assignments: StopPattern[];
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

function applyStopPattern(template: ElevatorTemplate, pattern: StopPattern): ElevatorTemplate {
  return {
    ...template,
    stops_all_floors: pattern === 'all',
    stops_odd_floors: pattern === 'odd',
    stops_even_floors: pattern === 'even',
  };
}

function getStopPattern(template: ElevatorTemplate): StopPattern {
  if (template.stops_odd_floors) return 'odd';
  if (template.stops_even_floors) return 'even';
  return 'all';
}

function normalizeStopAssignments(
  quantity: number,
  assignments: StopPattern[] = [],
  fallbackPattern: StopPattern = 'all'
): StopPattern[] {
  const total = Math.max(1, Number(quantity || 1));

  if (total === 1) {
    return ['all'];
  }

  const base = assignments[0] && assignments[0] !== 'all' ? assignments[0] : fallbackPattern;

  if (base === 'all') {
    return Array.from({ length: total }, () => 'all');
  }

  if (total === 2) {
    return [base, base === 'odd' ? 'even' : 'odd'];
  }

  return Array.from({ length: total }, (_, index) => {
    const current = assignments[index];
    if (current === 'odd' || current === 'even') return current;
    return index % 2 === 0 ? base : base === 'odd' ? 'even' : 'odd';
  });
}

function createEmptyTemplate(): ElevatorTemplate {
  return {
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

function createAddressGroup(
  clientAddress = '',
  clientCommune = '',
  clientRegion = ''
): AddressGroup {
  return {
    id: crypto.randomUUID(),
    same_address_as_client: true,
    address: clientAddress,
    commune: clientCommune,
    region: clientRegion,
    quantity: 1,
    all_equal: true,
    templates: [createEmptyTemplate()],
    stop_assignments: ['all'],
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

function normalizeRut(value: string) {
  const cleaned = value.replace(/\./g, '').replace(/\s+/g, '').toUpperCase();
  const hyphenIndex = cleaned.indexOf('-');

  if (hyphenIndex === -1) {
    return cleaned.replace(/\D/g, '').slice(0, 8);
  }

  const body = cleaned.slice(0, hyphenIndex).replace(/\D/g, '').slice(0, 8);
  const verifierRaw = cleaned.slice(hyphenIndex + 1).replace(/[^0-9K]/g, '');
  const verifier = verifierRaw ? verifierRaw[0] : '';

  if (!body) return '';
  return verifier ? `${body}-${verifier}` : `${body}-`;
}

function isValidRutFormat(value: string) {
  return /^[0-9]{7,8}-[0-9K]$/i.test(normalizeRut(value));
}

function normalizeUppercaseText(value: string) {
  return value.toUpperCase();
}

function normalizePhoneCL(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  let working = digits;

  if (working.startsWith('56')) {
    working = working.slice(2);
  }

  if (working.startsWith('0')) {
    working = working.slice(1);
  }

  if (working.startsWith('9')) {
    working = working.slice(1);
  }

  const subscriber = working.slice(0, 8);
  return `+569${subscriber}`;
}

function isValidPhoneCL(value: string) {
  return /^\+569\d{8}$/.test(normalizePhoneCL(value));
}

function assertValidPhoneCL(value: string, label: string) {
  const phone = sanitize(value);
  if (!phone) return;

  if (!isValidPhoneCL(phone)) {
    throw new Error(`${label} debe tener formato +56912345678.`);
  }
}

const CHILE_REGIONS = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Región Metropolitana de Santiago',
  "Libertador General Bernardo O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén del General Carlos Ibáñez del Campo',
  'Magallanes y de la Antártica Chilena',
] as const;

const COMMUNES_BY_REGION: Record<string, string[]> = {
  'Arica y Parinacota': ['Arica', 'Camarones', 'General Lagos', 'Putre'],
  'Tarapacá': ['Alto Hospicio', 'Camiña', 'Colchane', 'Huara', 'Iquique', 'Pica', 'Pozo Almonte'],
  'Antofagasta': ['Antofagasta', 'Calama', 'María Elena', 'Mejillones', 'Ollagüe', 'San Pedro de Atacama', 'Sierra Gorda', 'Taltal', 'Tocopilla'],
  'Atacama': ['Alto del Carmen', 'Caldera', 'Chañaral', 'Copiapó', 'Diego de Almagro', 'Freirina', 'Huasco', 'Tierra Amarilla', 'Vallenar'],
  'Coquimbo': ['Andacollo', 'Canela', 'Combarbalá', 'Coquimbo', 'Illapel', 'La Higuera', 'La Serena', 'Los Vilos', 'Monte Patria', 'Ovalle', 'Paihuano', 'Punitaqui', 'Río Hurtado', 'Salamanca', 'Vicuña'],
  'Valparaíso': ['Algarrobo', 'Cabildo', 'Calera', 'Calle Larga', 'Cartagena', 'Casablanca', 'Catemu', 'Concón', 'El Quisco', 'El Tabo', 'Hijuelas', 'Isla de Pascua', 'Juan Fernández', 'La Cruz', 'La Ligua', 'Limache', 'Llaillay', 'Los Andes', 'Nogales', 'Olmué', 'Panquehue', 'Papudo', 'Petorca', 'Puchuncaví', 'Putaendo', 'Quillota', 'Quilpué', 'Quintero', 'Rinconada', 'San Antonio', 'San Esteban', 'San Felipe', 'Santa María', 'Santo Domingo', 'Valparaíso', 'Villa Alemana', 'Viña del Mar', 'Zapallar'],
  'Región Metropolitana de Santiago': ['Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina', 'Conchalí', 'Curacaví', 'El Bosque', 'El Monte', 'Estación Central', 'Huechuraba', 'Independencia', 'Isla de Maipo', 'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Lampa', 'Las Condes', 'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa', 'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén', 'Pirque', 'Providencia', 'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo', 'San Joaquín', 'San José de Maipo', 'San Miguel', 'San Pedro', 'San Ramón', 'Santiago', 'Talagante', 'Tiltil', 'Vitacura'],
  "Libertador General Bernardo O'Higgins": ['Chépica', 'Chimbarongo', 'Codegua', 'Coinco', 'Coltauco', 'Doñihue', 'Graneros', 'La Estrella', 'Las Cabras', 'Litueche', 'Lolol', 'Machalí', 'Malloa', 'Marchigüe', 'Mostazal', 'Nancagua', 'Navidad', 'Olivar', 'Palmilla', 'Paredones', 'Peralillo', 'Peumo', 'Pichidegua', 'Pichilemu', 'Placilla', 'Pumanque', 'Quinta de Tilcoco', 'Rancagua', 'Rengo', 'Requínoa', 'San Fernando', 'San Vicente'],
  'Maule': ['Cauquenes', 'Chanco', 'Colbún', 'Constitución', 'Curepto', 'Curicó', 'Empedrado', 'Hualañé', 'Licantén', 'Linares', 'Longaví', 'Maule', 'Molina', 'Parral', 'Pelarco', 'Pelluhue', 'Pencahue', 'Rauco', 'Retiro', 'Río Claro', 'Romeral', 'Sagrada Familia', 'San Clemente', 'San Javier', 'San Rafael', 'Talca', 'Teno', 'Vichuquén', 'Villa Alegre', 'Yerbas Buenas'],
  'Ñuble': ['Bulnes', 'Chillán', 'Chillán Viejo', 'Cobquecura', 'Coelemu', 'Coihueco', 'El Carmen', 'Ninhue', 'Ñiquén', 'Pemuco', 'Pinto', 'Portezuelo', 'Quillón', 'Quirihue', 'Ránquil', 'San Carlos', 'San Fabián', 'San Ignacio', 'San Nicolás', 'Treguaco', 'Yungay'],
  'Biobío': ['Alto Biobío', 'Antuco', 'Arauco', 'Cabrero', 'Cañete', 'Chiguayante', 'Concepción', 'Contulmo', 'Coronel', 'Curanilahue', 'Florida', 'Hualpén', 'Hualqui', 'Laja', 'Lebu', 'Los Álamos', 'Los Ángeles', 'Lota', 'Mulchén', 'Nacimiento', 'Negrete', 'Penco', 'Quilaco', 'Quilleco', 'San Pedro de la Paz', 'San Rosendo', 'Santa Bárbara', 'Santa Juana', 'Talcahuano', 'Tirúa', 'Tomé', 'Tucapel', 'Yumbel'],
  'La Araucanía': ['Angol', 'Carahue', 'Cholchol', 'Collipulli', 'Cunco', 'Curacautín', 'Curarrehue', 'Ercilla', 'Freire', 'Galvarino', 'Gorbea', 'Lautaro', 'Loncoche', 'Lonquimay', 'Los Sauces', 'Lumaco', 'Melipeuco', 'Nueva Imperial', 'Padre Las Casas', 'Perquenco', 'Pitrufquén', 'Pucón', 'Purén', 'Renaico', 'Saavedra', 'Temuco', 'Teodoro Schmidt', 'Toltén', 'Traiguén', 'Victoria', 'Vilcún', 'Villarrica'],
  'Los Ríos': ['Corral', 'Futrono', 'La Unión', 'Lago Ranco', 'Lanco', 'Los Lagos', 'Máfil', 'Mariquina', 'Paillaco', 'Panguipulli', 'Río Bueno', 'Valdivia'],
  'Los Lagos': ['Ancud', 'Calbuco', 'Castro', 'Chaitén', 'Chonchi', 'Cochamó', 'Curaco de Vélez', 'Dalcahue', 'Fresia', 'Frutillar', 'Futaleufú', 'Hualaihué', 'Llanquihue', 'Los Muermos', 'Maullín', 'Osorno', 'Palena', 'Puerto Montt', 'Puerto Octay', 'Puerto Varas', 'Puqueldón', 'Purranque', 'Puyehue', 'Queilén', 'Quellón', 'Quemchi', 'Quinchao', 'Río Negro', 'San Juan de la Costa', 'San Pablo'],
  'Aysén del General Carlos Ibáñez del Campo': ['Aysén', 'Chile Chico', 'Cisnes', 'Cochrane', 'Coihaique', 'Guaitecas', 'Lago Verde', "O'Higgins", 'Río Ibáñez', 'Tortel'],
  'Magallanes y de la Antártica Chilena': ['Antártica', 'Cabo de Hornos', 'Laguna Blanca', 'Natales', 'Porvenir', 'Primavera', 'Punta Arenas', 'Río Verde', 'San Gregorio', 'Timaukel', 'Torres del Paine'],
};

function getCommuneOptions(region: string) {
  return COMMUNES_BY_REGION[region] || [];
}

function normalizeRegionValue(value: string) {
  const clean = sanitize(value);
  if (!clean) return '';
  return CHILE_REGIONS.find((region) => region.toUpperCase() === clean.toUpperCase()) || clean;
}

function normalizeCommuneValue(region: string, commune: string) {
  const normalizedRegion = normalizeRegionValue(region);
  const clean = sanitize(commune);
  if (!clean) return '';

  return (
    getCommuneOptions(normalizedRegion).find(
      (option) => option.toUpperCase() === clean.toUpperCase()
    ) || clean
  );
}

const ADDRESS_GROUP_UPPERCASE_FIELDS = new Set(['address', 'commune', 'region']);

const ADDITIONAL_CONTACT_UPPERCASE_FIELDS = new Set(['name', 'role']);

const TEMPLATE_UPPERCASE_FIELDS = new Set([
  'brand_other',
  'model',
  'serial_number',
  'classification_other',
  'tower_name',
]);

function parseOptionalNumber(value: string) {
  const clean = sanitize(value);
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isNaN(parsed) ? null : parsed;
}

function hasAnyContactMethod(email: string, phone: string) {
  return Boolean(sanitize(email) || sanitize(phone));
}

function createInitialClientData() {
  return {
    company_name: '',
    building_name: '',
    internal_alias: '',
    rut: '',
    address: '',
    commune: '',
    region: '',
    building_type: 'residencial' as BuildingType,
    self_managed: false,
    enable_building_contacts: false,
    primary_contact_name: '',
    primary_contact_role: '',
    primary_contact_email: '',
    primary_contact_phone: '',
    admin_name: '',
    admin_email: '',
    admin_phone: '',
    admin_company: '',
  };
}

function mapAdditionalContacts(payload?: ClientAlternateContactsPayload | null): AdditionalContact[] {
  return (payload?.additional_contacts || []).map((contact) => ({
    id: crypto.randomUUID(),
    name: contact?.name || '',
    role: contact?.role || '',
    email: contact?.email || '',
    phone: normalizePhoneCL(contact?.phone || ''),
  }));
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEditMode = Boolean(client?.id);

  const [clientData, setClientData] = useState(createInitialClientData);
  const [additionalContacts, setAdditionalContacts] = useState<AdditionalContact[]>([]);
  const [groups, setGroups] = useState<AddressGroup[]>([createAddressGroup('', '', '')]);
  const [globalNumbering, setGlobalNumbering] = useState(true);

  useEffect(() => {
    setGroups((prev) =>
      prev.map((group) =>
        group.same_address_as_client
          ? {
              ...group,
              address: clientData.address,
              commune: clientData.commune,
              region: clientData.region,
            }
          : group
      )
    );
  }, [clientData.address, clientData.commune, clientData.region]);

  useEffect(() => {
    if (!client) {
      setClientData(createInitialClientData());
      setAdditionalContacts([]);
      setGroups([createAddressGroup('', '', '')]);
      setGlobalNumbering(true);
      return;
    }

    const payload = client.alternate_contacts || {};
    const selfManaged = Boolean(payload.self_managed);
    const additional = mapAdditionalContacts(payload);
    const hasPrimaryContact = Boolean(
      client.contact_name || client.contact_email || client.contact_phone || client.contact_person
    );

    setClientData({
      company_name: client.company_name || '',
      building_name: client.building_name || '',
      internal_alias: client.internal_alias || '',
      rut: client.rut || '',
      address: client.address || '',
      commune: normalizeCommuneValue(client.city || '', client.commune || ''),
      region: normalizeRegionValue(client.city || ''),
      building_type: (client.building_type as BuildingType) || 'residencial',
      self_managed: selfManaged,
      enable_building_contacts:
        selfManaged || Boolean(payload.enable_building_contacts) || hasPrimaryContact || additional.length > 0,
      primary_contact_name: client.contact_name || '',
      primary_contact_role: client.contact_person || '',
      primary_contact_email: client.contact_email || '',
      primary_contact_phone: normalizePhoneCL(client.contact_phone || ''),
      admin_name: client.admin_name || '',
      admin_email: client.admin_email || '',
      admin_phone: normalizePhoneCL(client.admin_phone || ''),
      admin_company: payload.admin_company || '',
    });

    setAdditionalContacts(additional);
    setGroups([createAddressGroup(client.address || '', normalizeCommuneValue(client.city || '', client.commune || ''), normalizeRegionValue(client.city || ''))]);
    setGlobalNumbering(true);
  }, [client]);

  const totalElevators = useMemo(
    () => groups.reduce((acc, group) => acc + Number(group.quantity || 0), 0),
    [groups]
  );

  const showBuildingContacts = clientData.self_managed || clientData.enable_building_contacts;

  const updateGroup = <K extends keyof AddressGroup>(
    groupIndex: number,
    field: K,
    value: AddressGroup[K]
  ) => {
    setGroups((prev) =>
      prev.map((group, index) => {
        if (index !== groupIndex) return group;

        const normalizedValue =
          typeof value === 'string' && ADDRESS_GROUP_UPPERCASE_FIELDS.has(String(field))
            ? normalizeUppercaseText(value)
            : value;

        let nextGroup: AddressGroup = { ...group, [field]: normalizedValue };

        if (field === 'same_address_as_client' && value === true) {
          nextGroup.address = clientData.address;
          nextGroup.commune = clientData.commune;
          nextGroup.region = clientData.region;
        }

        if (field === 'region' && value !== group.region) {
          nextGroup.commune = '';
        }

        if (field === 'quantity') {
          const nextQuantity = Math.max(1, Number(value || 1));
          nextGroup.quantity = nextQuantity;

          if (nextGroup.all_equal) {
            const baseTemplate = nextGroup.templates[0] || createEmptyTemplate();
            const basePattern: StopPattern =
              nextQuantity === 1
                ? 'all'
                : getStopPattern(baseTemplate) === 'all'
                ? 'odd'
                : getStopPattern(baseTemplate);

            nextGroup.templates = [
              applyStopPattern(baseTemplate, nextQuantity === 1 ? 'all' : getStopPattern(baseTemplate)),
            ];
            nextGroup.stop_assignments = normalizeStopAssignments(
              nextQuantity,
              nextGroup.stop_assignments,
              basePattern
            );
          } else {
            const currentTemplates = [...nextGroup.templates];
            if (currentTemplates.length < nextQuantity) {
              while (currentTemplates.length < nextQuantity) {
                currentTemplates.push(
                  applyStopPattern(
                    createEmptyTemplate(),
                    nextQuantity === 1 ? 'all' : currentTemplates.length % 2 === 0 ? 'odd' : 'even'
                  )
                );
              }
            } else {
              currentTemplates.splice(nextQuantity);
            }

            nextGroup.templates = currentTemplates.map((template, templateIndex) =>
              nextQuantity === 1
                ? applyStopPattern(template, 'all')
                : getStopPattern(template) === 'all'
                ? applyStopPattern(template, templateIndex % 2 === 0 ? 'odd' : 'even')
                : template
            );
            nextGroup.stop_assignments = normalizeStopAssignments(nextQuantity, nextGroup.stop_assignments);
          }
        }

        if (field === 'all_equal') {
          const target = Math.max(1, Number(nextGroup.quantity || 1));

          if (value === true) {
            const firstTemplate = nextGroup.templates[0] || createEmptyTemplate();
            const firstPattern = target === 1 ? 'all' : getStopPattern(firstTemplate);

            nextGroup.templates = [
              applyStopPattern(firstTemplate, target === 1 ? 'all' : firstPattern),
            ];
            nextGroup.stop_assignments = normalizeStopAssignments(
              target,
              nextGroup.stop_assignments,
              target === 1 ? 'all' : firstPattern === 'all' ? 'odd' : firstPattern
            );
          } else {
            const currentTemplates = [...nextGroup.templates];
            if (currentTemplates.length < target) {
              while (currentTemplates.length < target) {
                currentTemplates.push(createEmptyTemplate());
              }
            } else {
              currentTemplates.splice(target);
            }

            nextGroup.templates = currentTemplates.map((template, templateIndex) => {
              if (target === 1) {
                return applyStopPattern(template, 'all');
              }

              const assignment = nextGroup.stop_assignments[templateIndex];
              if (assignment === 'odd' || assignment === 'even') {
                return applyStopPattern(template, assignment);
              }

              return applyStopPattern(template, templateIndex % 2 === 0 ? 'odd' : 'even');
            });
            nextGroup.stop_assignments = normalizeStopAssignments(target, nextGroup.stop_assignments);
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

          const normalizedValue =
            typeof value === 'string' && TEMPLATE_UPPERCASE_FIELDS.has(String(field))
              ? normalizeUppercaseText(value)
              : value;

          const nextTemplate = { ...template, [field]: normalizedValue };

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

          if (field === 'stops_all_floors') {
            if (value === true) {
              nextTemplate.stops_odd_floors = false;
              nextTemplate.stops_even_floors = false;
            } else if (!nextTemplate.stops_odd_floors && !nextTemplate.stops_even_floors) {
              nextTemplate.stops_odd_floors = true;
            }
          }

          if (field === 'stops_odd_floors') {
            if (value === true) {
              nextTemplate.stops_all_floors = false;
              nextTemplate.stops_even_floors = false;
            } else if (!nextTemplate.stops_all_floors && !nextTemplate.stops_even_floors) {
              nextTemplate.stops_all_floors = true;
            }
          }

          if (field === 'stops_even_floors') {
            if (value === true) {
              nextTemplate.stops_all_floors = false;
              nextTemplate.stops_odd_floors = false;
            } else if (!nextTemplate.stops_all_floors && !nextTemplate.stops_odd_floors) {
              nextTemplate.stops_all_floors = true;
            }
          }

          return nextTemplate;
        });

        return { ...group, templates };
      })
    );
  };

  const updateGroupStopAssignment = (
    groupIndex: number,
    elevatorIndex: number,
    pattern: Exclude<StopPattern, 'all'>
  ) => {
    setGroups((prev) =>
      prev.map((group, index) => {
        if (index !== groupIndex) return group;

        const quantity = Math.max(1, Number(group.quantity || 1));
        const nextAssignments = normalizeStopAssignments(quantity, group.stop_assignments, pattern);

        if (quantity === 2) {
          nextAssignments[0] = pattern;
          nextAssignments[1] = pattern === 'odd' ? 'even' : 'odd';
        } else {
          nextAssignments[elevatorIndex] = pattern;
        }

        return {
          ...group,
          stop_assignments: nextAssignments,
          templates: [applyStopPattern(group.templates[0] || createEmptyTemplate(), 'all')],
        };
      })
    );
  };

  const addAddressGroup = () => {
    setGroups((prev) => [
      ...prev,
      createAddressGroup(clientData.address, clientData.commune, clientData.region),
    ]);
  };

  const removeAddressGroup = (groupIndex: number) => {
    setGroups((prev) => {
      const next = prev.filter((_, index) => index !== groupIndex);
      return next.length > 0
        ? next
        : [createAddressGroup(clientData.address, clientData.commune, clientData.region)];
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
      prev.map((item) => {
        if (item.id !== contactId) return item;

        const normalizedValue =
          typeof value === 'string' && ADDITIONAL_CONTACT_UPPERCASE_FIELDS.has(String(field))
            ? normalizeUppercaseText(value)
            : value;

        return { ...item, [field]: normalizedValue };
      })
    );
  };

  const resetForm = () => {
    setClientData(createInitialClientData());
    setAdditionalContacts([]);
    setGroups([createAddressGroup('', '', '')]);
    setGlobalNumbering(true);
  };

  const validateClient = () => {
    const rut = sanitize(clientData.rut);

    if (!rut) {
      throw new Error('Debes ingresar el RUT.');
    }

    if (!isValidRutFormat(rut)) {
      throw new Error('El RUT debe tener formato 15426257-1, sin puntos.');
    }

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

    if (!sanitize(clientData.commune)) {
      throw new Error('Debes ingresar la comuna.');
    }

    if (!sanitize(clientData.region)) {
      throw new Error('Debes ingresar la región.');
    }

    if (clientData.self_managed) {
      if (!sanitize(clientData.primary_contact_name)) {
        throw new Error('Si el edificio es autogestionado, el nombre del contacto principal es obligatorio.');
      }

      if (!sanitize(clientData.primary_contact_role)) {
        throw new Error('Si el edificio es autogestionado, el cargo o responsabilidad del contacto principal es obligatorio.');
      }

      if (!hasAnyContactMethod(clientData.primary_contact_email, clientData.primary_contact_phone)) {
        throw new Error('Si el edificio es autogestionado, debes ingresar al menos correo o teléfono del contacto principal.');
      }
    } else {
      if (!sanitize(clientData.admin_name)) {
        throw new Error('Si el edificio tiene administrador, el nombre del administrador es obligatorio.');
      }

      if (!hasAnyContactMethod(clientData.admin_email, clientData.admin_phone)) {
        throw new Error('Si el edificio tiene administrador, debes ingresar al menos correo o teléfono del administrador.');
      }

      if (clientData.enable_building_contacts) {
        if (!sanitize(clientData.primary_contact_name)) {
          throw new Error('Si activas encargados y contactos del edificio, el nombre del contacto principal es obligatorio.');
        }

        if (!sanitize(clientData.primary_contact_role)) {
          throw new Error('Si activas encargados y contactos del edificio, el cargo o responsabilidad es obligatorio.');
        }

        if (!hasAnyContactMethod(clientData.primary_contact_email, clientData.primary_contact_phone)) {
          throw new Error('Si activas encargados y contactos del edificio, debes ingresar al menos correo o teléfono del contacto principal.');
        }
      }
    }

    assertValidPhoneCL(clientData.admin_phone, 'El teléfono del administrador');
    assertValidPhoneCL(clientData.primary_contact_phone, 'El teléfono del contacto principal');

    if (showBuildingContacts) {
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
          throw new Error(`Falta el cargo o responsabilidad en contacto adicional #${index + 1}.`);
        }

        if (!hasAnyContactMethod(contact.email, contact.phone)) {
          throw new Error(`Debes ingresar correo o teléfono en contacto adicional #${index + 1}.`);
        }

        assertValidPhoneCL(contact.phone, `El teléfono del contacto adicional #${index + 1}`);
      });
    }
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
      throw new Error(`Falta el N° de paradas en ${label}.`);
    }

    if (parseOptionalNumber(template.floors) === null) {
      throw new Error(`El N° de paradas en ${label} debe ser numérico.`);
    }

    if (template.capacity_kg && parseOptionalNumber(template.capacity_kg) === null) {
      throw new Error(`La capacidad KG en ${label} debe ser numérica.`);
    }

    if (template.capacity_persons && parseOptionalNumber(template.capacity_persons) === null) {
      throw new Error(`La capacidad de personas en ${label} debe ser numérica.`);
    }

    if (template.use_tower && !sanitize(template.tower_name)) {
      throw new Error(`Marcaste uso de torre, pero falta la torre en ${label}.`);
    }

    if (template.classification === 'otro' && !sanitize(template.classification_other)) {
      throw new Error(`Debes especificar la clasificación "otro" en ${label}.`);
    }

    const stopFlags = [
      template.stops_all_floors,
      template.stops_odd_floors,
      template.stops_even_floors,
    ].filter(Boolean).length;

    if (stopFlags !== 1) {
      throw new Error(`Debes definir correctamente el tipo de detención en ${label}.`);
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

      if (!group.same_address_as_client) {
        if (!sanitize(group.address)) {
          throw new Error(`Debes ingresar la dirección del bloque ${groupIndex + 1}.`);
        }

        if (!sanitize(group.commune)) {
          throw new Error(`Debes ingresar la comuna del bloque ${groupIndex + 1}.`);
        }

        if (!sanitize(group.region)) {
          throw new Error(`Debes ingresar la región del bloque ${groupIndex + 1}.`);
        }
      }

      if (group.all_equal) {
        const baseTemplate = group.templates[0] || createEmptyTemplate();

        validateTemplate(
          applyStopPattern(
            baseTemplate,
            quantity === 1 ? 'all' : baseTemplate.stops_all_floors ? 'all' : 'odd'
          ),
          `bloque ${groupIndex + 1}`,
          true,
          group.address
        );

        if (quantity === 1 && !baseTemplate.stops_all_floors) {
          throw new Error(`Si el bloque ${groupIndex + 1} tiene un solo ascensor, debe detenerse en todos los pisos.`);
        }

        if (quantity > 1 && !baseTemplate.stops_all_floors) {
          const assignments = normalizeStopAssignments(quantity, group.stop_assignments, 'odd');
          const hasInvalid = assignments.some((assignment) => assignment === 'all');
          if (hasInvalid) {
            throw new Error(`Debes definir par o impar para todos los ascensores del bloque ${groupIndex + 1}.`);
          }
        }
      } else {
        if (group.templates.length !== quantity) {
          throw new Error(`Faltan fichas por completar en el bloque ${groupIndex + 1}.`);
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
    const filteredAdditionalContacts = showBuildingContacts
      ? additionalContacts
          .map((contact) => ({
            name: sanitize(contact.name),
            role: sanitize(contact.role),
            email: sanitize(contact.email),
            phone: normalizePhoneCL(contact.phone) || null,
          }))
          .filter((contact) => contact.name || contact.role || contact.email || contact.phone)
      : [];

    return {
      self_managed: clientData.self_managed,
      admin_company: sanitize(clientData.admin_company) || null,
      enable_building_contacts: showBuildingContacts,
      additional_contacts: filteredAdditionalContacts,
    };
  };

  const buildBaseClientPayload = () => ({
    company_name: sanitize(clientData.company_name),
    building_name: sanitize(clientData.building_name),
    internal_alias: sanitize(clientData.internal_alias),
    rut: normalizeRut(clientData.rut) || null,
    address: sanitize(clientData.address) || null,
    commune: sanitize(clientData.commune) || null,
    city: sanitize(clientData.region) || null,
    building_type: clientData.building_type,
    contact_name: showBuildingContacts ? sanitize(clientData.primary_contact_name) || null : null,
    contact_person: showBuildingContacts ? sanitize(clientData.primary_contact_role) || null : null,
    contact_email: showBuildingContacts ? sanitize(clientData.primary_contact_email) || null : null,
    contact_phone: showBuildingContacts ? normalizePhoneCL(clientData.primary_contact_phone) || null : null,
    admin_name: clientData.self_managed ? null : sanitize(clientData.admin_name) || null,
    admin_email: clientData.self_managed ? null : sanitize(clientData.admin_email) || null,
    admin_phone: clientData.self_managed ? null : normalizePhoneCL(clientData.admin_phone) || null,
    alternate_contacts: buildAlternateContactsPayload(),
  });

  const buildClientInsertPayload = () => ({
    ...buildBaseClientPayload(),
    billing_address: null,
    is_active: true,
    client_code: `CLI-${Date.now()}`,
  });

  const buildClientUpdatePayload = () => ({
    ...buildBaseClientPayload(),
  });

  const buildElevatorPayloads = (clientId: string) => {
    const payloads: Record<string, any>[] = [];
    let globalElevatorNumber = 1;

    groups.forEach((group) => {
      let localElevatorNumber = 1;
      const quantity = Math.max(1, Number(group.quantity || 1));
      const blockAddress = group.same_address_as_client
        ? sanitize(clientData.address)
        : sanitize(group.address);

      const blockBuildingLabel = group.same_address_as_client
        ? sanitize(clientData.building_name)
        : `${sanitize(clientData.building_name)} - ${blockAddress}`;

      const templatesToUse = group.all_equal
        ? (() => {
            const baseTemplate = group.templates[0] || createEmptyTemplate();
            const assignments =
              baseTemplate.stops_all_floors || quantity === 1
                ? Array.from({ length: quantity }, () => 'all' as StopPattern)
                : normalizeStopAssignments(quantity, group.stop_assignments, 'odd');

            return Array.from({ length: quantity }, (_, templateIndex) =>
              applyStopPattern(baseTemplate, assignments[templateIndex] || 'all')
            );
          })()
        : group.templates.slice(0, quantity).map((template) =>
            quantity === 1 ? applyStopPattern(template, 'all') : template
          );

      const getNextNumber = () => {
        if (globalNumbering) {
          return globalElevatorNumber++;
        }
        return localElevatorNumber++;
      };

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
          internal_code: null,
          elevator_number: getNextNumber(),
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
          location_building: blockBuildingLabel || null,
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
      });
    });

    return payloads;
  };

  const getDefaultClientPassword = () => `Mirega${new Date().getFullYear()}@@`;

  const buildClientAccessUsers = () => {
    const users = new Map<
      string,
      {
        email: string;
        full_name: string;
        phone: string | null;
      }
    >();

    const addUser = (email?: string | null, full_name?: string | null, phone?: string | null) => {
      const normalizedEmail = sanitize(email || '').toLowerCase();
      if (!normalizedEmail) return;

      users.set(normalizedEmail, {
        email: normalizedEmail,
        full_name: sanitize(full_name || '') || normalizedEmail,
        phone: normalizePhoneCL(phone || '') || null,
      });
    };

    if (!clientData.self_managed) {
      addUser(clientData.admin_email, clientData.admin_name, clientData.admin_phone);
    }

    if (showBuildingContacts) {
      addUser(
        clientData.primary_contact_email,
        clientData.primary_contact_name,
        clientData.primary_contact_phone
      );

      additionalContacts.forEach((contact) => {
        addUser(contact.email, contact.name || contact.role, contact.phone);
      });
    }

    return Array.from(users.values());
  };

  const createClientAccessUsers = async (clientId: string) => {
    const accessUsers = buildClientAccessUsers();
    if (accessUsers.length === 0) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No hay sesión activa para crear accesos cliente.');
    }

    const defaultPassword = getDefaultClientPassword();

    for (let i = 0; i < accessUsers.length; i += 1) {
      const accessUser = accessUsers[i];

      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: accessUser.email,
          password: defaultPassword,
          full_name: accessUser.full_name,
          phone: accessUser.phone,
          role: 'client',
          person_type: 'internal',
          company_name: null,
          grant_access: true,
          client_id: clientId,
          set_as_primary_client_user: i === 0,
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result?.ok) {
        throw new Error(
          `No se pudo crear acceso cliente para ${accessUser.email}: ${
            result?.error || 'Error desconocido'
          }`
        );
      }
    }
  };

  const syncClientAccessWithProfiles = async (clientId: string) => {
    const emails = new Set<string>();

    const addEmail = (value?: string | null) => {
      const normalized = sanitize(value || '').toLowerCase();
      if (normalized) emails.add(normalized);
    };

    if (!clientData.self_managed) {
      addEmail(clientData.admin_email);
    }

    if (showBuildingContacts) {
      addEmail(clientData.primary_contact_email);

      additionalContacts.forEach((contact) => {
        addEmail(contact.email);
      });
    }

    const emailList = Array.from(emails);
    if (emailList.length === 0) return;

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email')
      .in('email', emailList);

    if (error) {
      console.error('Error buscando profiles:', error);
      return;
    }

    if (!profiles || profiles.length === 0) return;

    const accessRows = profiles.map((p) => ({
      user_id: p.id,
      client_id: clientId,
      access_role: 'primary',
    }));

    const { error: insertError } = await supabase
      .from('client_user_access')
      .upsert(accessRows, {
        onConflict: 'user_id,client_id',
      });

    if (insertError) {
      console.error('Error sincronizando accesos:', insertError);
    }
  };



  const ensureRutIsUnique = async () => {
    const normalizedRut = normalizeRut(clientData.rut);

    if (!normalizedRut) return;

    const { data, error } = await supabase
      .from('clients')
      .select('id, rut')
      .eq('rut', normalizedRut)
      .limit(1);

    if (error) throw error;

    const existingClient = data?.[0];

    if (!existingClient) return;

    if (isEditMode && client?.id && existingClient.id === client.id) {
      return;
    }

    throw new Error('Cliente ya creado');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      validateClient();
      await ensureRutIsUnique();

      if (isEditMode && client?.id) {
        const { error: updateError } = await supabase
          .from('clients')
          .update(buildClientUpdatePayload())
          .eq('id', client.id);

        if (updateError) throw updateError;

        setSuccess('Cliente actualizado correctamente.');
        onSuccess?.();
      } else {
        validateGroups();

        const { data: insertedClient, error: clientError } = await supabase
          .from('clients')
          .insert(buildClientInsertPayload())
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

        await createClientAccessUsers(insertedClient.id);
        await syncClientAccessWithProfiles(insertedClient.id);

        setSuccess(
          `Cliente creado correctamente con ${elevatorPayloads.length} ascensor(es) y accesos cliente generados. Contraseña inicial: ${getDefaultClientPassword()}`
        );
        resetForm();
        onSuccess?.();
      }
    } catch (err: any) {
      console.error('Error saving client:', err);
      setError(err?.message || 'Error al guardar cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Building2 className="h-6 w-6 text-green-600" />
          {isEditMode ? 'Editar Cliente' : 'Nuevo Cliente'}
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
              onChange={(v) => setClientData({ ...clientData, company_name: normalizeUppercaseText(v) })}
              placeholder="Ej: Comunidad Edificio Alcántara"
            />

            <Field
              label="Nombre del edificio *"
              value={clientData.building_name}
              onChange={(v) => setClientData({ ...clientData, building_name: normalizeUppercaseText(v) })}
              placeholder="Ej: Edificio Alcántara"
            />

            <Field
              label="Nombre interno / corto *"
              value={clientData.internal_alias}
              onChange={(v) => setClientData({ ...clientData, internal_alias: normalizeUppercaseText(v) })}
              placeholder="Ej: Alcántara"
            />

            <Field
              label="RUT"
              value={clientData.rut}
              onChange={(v) => setClientData({ ...clientData, rut: normalizeRut(v) })}
              placeholder="Ej: 15426257-1"
            />

            <Field
              label="Dirección principal *"
              value={clientData.address}
              onChange={(v) => setClientData({ ...clientData, address: normalizeUppercaseText(v) })}
              placeholder="Ej: Alcántara 44"
              icon={<MapPin className="h-4 w-4" />}
            />

            <SelectField
              label="Región *"
              value={clientData.region}
              onChange={(v) =>
                setClientData({
                  ...clientData,
                  region: v,
                  commune: getCommuneOptions(v).includes(clientData.commune) ? clientData.commune : '',
                })
              }
              options={[
                { value: '', label: 'Selecciona una región' },
                ...CHILE_REGIONS.map((region) => ({ value: region, label: region })),
              ]}
            />

            <SelectField
              label="Comuna *"
              value={clientData.commune}
              onChange={(v) => setClientData({ ...clientData, commune: v })}
              options={[
                {
                  value: '',
                  label: clientData.region
                    ? 'Selecciona una comuna'
                    : 'Primero selecciona una región',
                },
                ...getCommuneOptions(clientData.region).map((commune) => ({
                  value: commune,
                  label: commune,
                })),
              ]}
              disabled={!clientData.region}
            />

            <SelectField
              label="Tipo de edificio"
              value={clientData.building_type}
              onChange={(v) =>
                setClientData({ ...clientData, building_type: v as BuildingType })
              }
              options={[
                { value: 'residencial', label: 'Residencial' },
                { value: 'corporativo', label: 'Corporativo / Privado' },
                { value: 'academico', label: 'Institución Académica' },
                { value: 'estatal', label: 'Institución Estatal' },
              ]}
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
              onChange={(v) =>
                setClientData({
                  ...clientData,
                  self_managed: v,
                  enable_building_contacts: v ? true : clientData.enable_building_contacts,
                })
              }
            />
          </div>

          {!clientData.self_managed && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Nombre del administrador *"
                  value={clientData.admin_name}
                  onChange={(v) => setClientData({ ...clientData, admin_name: normalizeUppercaseText(v) })}
                  placeholder="Nombre administrador"
                />

                <Field
                  label="Empresa de administración"
                  value={clientData.admin_company}
                  onChange={(v) => setClientData({ ...clientData, admin_company: normalizeUppercaseText(v) })}
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
                  onChange={(v) => setClientData({ ...clientData, admin_phone: normalizePhoneCL(v) })}
                  placeholder="Ej: +56912345678"
                  icon={<Phone className="h-4 w-4" />}
                />
              </div>

              <div className="mt-5">
                <Checkbox
                  label="Agregar encargados y contactos del edificio"
                  checked={clientData.enable_building_contacts}
                  onChange={(v) =>
                    setClientData({ ...clientData, enable_building_contacts: v })
                  }
                />
              </div>
            </>
          )}
        </section>

        {showBuildingContacts && (
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
                onChange={(v) => setClientData({ ...clientData, primary_contact_name: normalizeUppercaseText(v) })}
                placeholder="Ej: Arturo Contreras"
                icon={<User className="h-4 w-4" />}
              />

              <Field
                label="Cargo o responsabilidad"
                value={clientData.primary_contact_role}
                onChange={(v) => setClientData({ ...clientData, primary_contact_role: normalizeUppercaseText(v) })}
                placeholder="Ej: Comité, conserje, encargado técnico"
              />

              <Field
                label="Correo contacto principal"
                value={clientData.primary_contact_email}
                onChange={(v) => setClientData({ ...clientData, primary_contact_email: v })}
                placeholder="Ej: contacto@empresa.cl"
                icon={<Mail className="h-4 w-4" />}
              />

              <Field
                label="Teléfono contacto principal"
                value={clientData.primary_contact_phone}
                onChange={(v) => setClientData({ ...clientData, primary_contact_phone: normalizePhoneCL(v) })}
                placeholder="Ej: +56912345678"
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
                        onChange={(v) => updateAdditionalContact(contact.id, 'name', v)}
                        placeholder="Nombre"
                      />

                      <Field
                        label="Cargo o responsabilidad"
                        value={contact.role}
                        onChange={(v) => updateAdditionalContact(contact.id, 'role', v)}
                        placeholder="Ej: mayordomo, comité, encargado"
                      />

                      <Field
                        label="Correo"
                        value={contact.email}
                        onChange={(v) => updateAdditionalContact(contact.id, 'email', v)}
                        placeholder="Correo"
                      />

                      <Field
                        label="Teléfono"
                        value={contact.phone}
                        onChange={(v) => updateAdditionalContact(contact.id, 'phone', normalizePhoneCL(v))}
                        placeholder="Ej: +56912345678"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!isEditMode && (
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

            <div className="mb-4">
              <Checkbox
                label="Numeración continua entre torres y direcciones"
                checked={globalNumbering}
                onChange={setGlobalNumbering}
              />
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
              {globalNumbering
                ? 'La numeración será correlativa entre todos los ascensores del formulario: 1 → N.'
                : 'La numeración se reiniciará por cada bloque/dirección: 1 → N en cada grupo.'}
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
                        onChange={(v) => updateGroup(groupIndex, 'same_address_as_client', v)}
                      />

                      <div className="rounded border bg-white px-3 py-2 text-sm text-slate-600">
                        Numeración esperada:{' '}
                        <strong>
                          {globalNumbering
                            ? 'continua entre bloques'
                            : `1 a ${Math.max(1, Number(group.quantity || 1))}`}
                        </strong>
                      </div>
                    </div>

                    {!group.same_address_as_client && (
                      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <Field
                          label="Dirección de este bloque *"
                          value={group.address}
                          onChange={(v) => updateGroup(groupIndex, 'address', v)}
                          placeholder="Ej: Apoquindo 1234"
                        />

                        <Field
                          label="Comuna de este bloque *"
                          value={group.commune}
                          onChange={(v) => updateGroup(groupIndex, 'commune', v)}
                          placeholder="Ej: Las Condes"
                        />

                        <Field
                          label="Región de este bloque *"
                          value={group.region}
                          onChange={(v) => updateGroup(groupIndex, 'region', v)}
                          placeholder="Ej: Región Metropolitana"
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
                              <SelectField
                                label="Marca *"
                                value={template.brand}
                                onChange={(v) => updateTemplate(groupIndex, templateIndex, 'brand', v)}
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
                                  onChange={(v) => updateTemplate(groupIndex, templateIndex, 'brand_other', v)}
                                  placeholder="Especifica la marca"
                                />
                              )}

                              <div className="xl:col-span-2">
                                <Field
                                  label="Modelo"
                                  value={template.model}
                                  onChange={(v) => updateTemplate(groupIndex, templateIndex, 'model', v)}
                                  placeholder="Ej: Gen2"
                                />
                                <div className="mt-2">
                                  <Checkbox
                                    label="Modelo no conocido"
                                    checked={template.model_unknown}
                                    onChange={(v) => updateTemplate(groupIndex, templateIndex, 'model_unknown', v)}
                                  />
                                </div>
                              </div>

                              <div className="xl:col-span-2">
                                <Field
                                  label="N° serie"
                                  value={template.serial_number}
                                  onChange={(v) => updateTemplate(groupIndex, templateIndex, 'serial_number', v)}
                                  placeholder="Ej: SN-12345"
                                />
                                <div className="mt-2">
                                  <Checkbox
                                    label="Número de serie no legible"
                                    checked={template.serial_number_not_legible}
                                    onChange={(v) =>
                                      updateTemplate(groupIndex, templateIndex, 'serial_number_not_legible', v)
                                    }
                                  />
                                </div>
                              </div>

                              <div className="xl:col-span-2">
                                <Field
                                  label="Fecha instalación"
                                  type="date"
                                  value={template.installation_date}
                                  onChange={(v) => updateTemplate(groupIndex, templateIndex, 'installation_date', v)}
                                />
                                <div className="mt-2">
                                  <Checkbox
                                    label="Fecha no disponible"
                                    checked={template.installation_date_unknown}
                                    onChange={(v) =>
                                      updateTemplate(groupIndex, templateIndex, 'installation_date_unknown', v)
                                    }
                                  />
                                </div>
                              </div>

                              <Field
                                label="N° de paradas *"
                                value={template.floors}
                                onChange={(v) => updateTemplate(groupIndex, templateIndex, 'floors', v)}
                                placeholder="Ej: 12"
                              />

                              <Field
                                label="Capacidad KG"
                                value={template.capacity_kg}
                                onChange={(v) => updateTemplate(groupIndex, templateIndex, 'capacity_kg', v)}
                                placeholder="Ej: 630"
                              />

                              <Field
                                label="Capacidad personas"
                                value={template.capacity_persons}
                                onChange={(v) => updateTemplate(groupIndex, templateIndex, 'capacity_persons', v)}
                                placeholder="Ej: 8"
                              />

                              <SelectField
                                label="Tipo de ascensor"
                                value={template.elevator_type}
                                onChange={(v) =>
                                  updateTemplate(groupIndex, templateIndex, 'elevator_type', v as ElevatorDriveType)
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
                                    updateTemplate(groupIndex, templateIndex, 'classification_other', v)
                                  }
                                  placeholder="Especifica"
                                />
                              )}
                            </div>

                            <div className="mt-5 space-y-4">
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <Checkbox
                                  label="Usar torre"
                                  checked={template.use_tower}
                                  onChange={(v) => updateTemplate(groupIndex, templateIndex, 'use_tower', v)}
                                />

                                {template.use_tower && (
                                  <Field
                                    label="Torre *"
                                    value={template.tower_name}
                                    onChange={(v) => updateTemplate(groupIndex, templateIndex, 'tower_name', v)}
                                    placeholder="Ej: Torre A"
                                  />
                                )}

                                <Checkbox
                                  label="Tiene sala de máquinas"
                                  checked={template.has_machine_room}
                                  onChange={(v) => updateTemplate(groupIndex, templateIndex, 'has_machine_room', v)}
                                />

                                <Checkbox
                                  label="Sin sala de máquinas"
                                  checked={template.no_machine_room}
                                  onChange={(v) => updateTemplate(groupIndex, templateIndex, 'no_machine_room', v)}
                                />
                              </div>

                              {group.quantity === 1 ? (
                                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                                  Este bloque tiene un solo ascensor, por lo tanto queda marcado automáticamente que se detiene en todos los pisos.
                                </div>
                              ) : group.all_equal ? (
                                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                                  <Checkbox
                                    label="Se detiene en todos los pisos"
                                    checked={template.stops_all_floors}
                                    onChange={(v) =>
                                      updateTemplate(groupIndex, templateIndex, 'stops_all_floors', v)
                                    }
                                  />

                                  {!template.stops_all_floors && (
                                    <div className="space-y-3">
                                      <p className="text-sm font-medium text-slate-700">
                                        Asignación por ascensor
                                      </p>

                                      {group.quantity === 2 ? (
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                          <StopPatternSelector
                                            label="Ascensor 1"
                                            value={group.stop_assignments[0] === 'even' ? 'even' : 'odd'}
                                            onChange={(pattern) => updateGroupStopAssignment(groupIndex, 0, pattern)}
                                          />

                                          <div className="rounded border bg-white px-4 py-3 text-sm text-slate-700">
                                            <div className="font-medium text-slate-900">Ascensor 2</div>
                                            <div className="mt-1">
                                              Queda automáticamente en{' '}
                                              <strong>
                                                {group.stop_assignments[0] === 'even' ? 'impares' : 'pares'}
                                              </strong>
                                            </div>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                          {Array.from({ length: group.quantity }, (_, elevatorIndex) => (
                                            <StopPatternSelector
                                              key={`${group.id}-stop-${elevatorIndex}`}
                                              label={`Ascensor ${elevatorIndex + 1}`}
                                              value={
                                                group.stop_assignments[elevatorIndex] === 'even'
                                                  ? 'even'
                                                  : 'odd'
                                              }
                                              onChange={(pattern) =>
                                                updateGroupStopAssignment(groupIndex, elevatorIndex, pattern)
                                              }
                                            />
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                                  <Checkbox
                                    label="Se detiene en todos los pisos"
                                    checked={template.stops_all_floors}
                                    onChange={(v) =>
                                      updateTemplate(groupIndex, templateIndex, 'stops_all_floors', v)
                                    }
                                  />

                                  {!template.stops_all_floors && (
                                    <StopPatternSelector
                                      label={`Ascensor ${templateIndex + 1}`}
                                      value={template.stops_even_floors ? 'even' : 'odd'}
                                      onChange={(pattern) => {
                                        updateTemplate(groupIndex, templateIndex, 'stops_odd_floors', pattern === 'odd');
                                        updateTemplate(groupIndex, templateIndex, 'stops_even_floors', pattern === 'even');
                                      }}
                                    />
                                  )}
                                </div>
                              )}
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
        )}

        {isEditMode && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Estás editando los datos del cliente y sus contactos. Para evitar duplicidades, esta vista no vuelve a crear ascensores ni accesos automáticamente.
          </div>
        )}

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
            {loading ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Crear Cliente'}
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
        className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
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
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:bg-slate-100 disabled:text-slate-400"
      >
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DatalistField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const listId = useId();

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        className="w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}

function StopPatternSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 'odd' | 'even';
  onChange: (value: 'odd' | 'even') => void;
}) {
  return (
    <div className="rounded border bg-white p-3">
      <div className="mb-2 text-sm font-medium text-slate-700">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('odd')}
          className={`rounded border px-3 py-2 text-sm ${
            value === 'odd'
              ? 'border-green-600 bg-green-50 text-green-700'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          Impares
        </button>
        <button
          type="button"
          onClick={() => onChange('even')}
          className={`rounded border px-3 py-2 text-sm ${
            value === 'even'
              ? 'border-green-600 bg-green-50 text-green-700'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          Pares
        </button>
      </div>
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