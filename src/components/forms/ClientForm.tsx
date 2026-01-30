import QRCode from 'qrcode';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus,
  Trash2,
  Building2,
  MapPin,
  Phone,
  Mail,
  X,
  Key,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
// ...existing code...
import {
  validateEmail,
  // ...existing code...
  validatePhoneOptional,
  validateRUT,
  validateCompanyName,
  validateAddress,
  validatePassword,
  // ...existing code...
  // ...existing code...
} from '../../utils/validation';

type ElevatorType = 'hydraulic' | 'electromechanical';

type Classification =
  | 'ascensor_corporativo'
  | 'ascensor_residencial'
  | 'montacargas'
  | 'montaplatos';

interface ElevatorData {
  location_name: string;           // nombre/torre visible
  useClientAddress: boolean;
  address_asc: string;             // Dirección del ascensor (columna en Supabase)
  elevator_type: ElevatorType;
  manufacturer: string;            // puede ser uno de la lista o "OTROS"
  manufacturer_custom?: string;    // si manufacturer === "OTROS", aquí va el texto del usuario
  model: string;
  serial_number: string;
  serial_number_not_legible: boolean;
  capacity_kg: number;
  floors: number;
  installation_date: string;
  has_machine_room: boolean;
  no_machine_room: boolean;
  stops_all_floors: boolean;
  stops_odd_floors: boolean;
  stops_even_floors: boolean;
  classification: Classification;
}

interface ClientFormProps {
  client?:
    | {
        id: string;
        company_name: string;
        building_name: string | null;
        contact_name: string;
        contact_email: string;
        contact_phone: string;
        address: string;
      }
    | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const MANUFACTURERS = [
  'Orona',
  'Otis',
  'Schindler',
  'Mitsubishi',
  'TK Elevator (ThyssenKrupp)',
  'KONE',
  'FUJI Elevators',
  'HEAVENWARD',
  'MAC PUARSA',
  'FBLT',
  'SAITEK',
  'CARLOS SILVA',
  'CEA',
  'OTROS',
];

const createEmptyElevator = (clientAddress: string): ElevatorData => ({
  location_name: '',
  useClientAddress: true,
  address_asc: clientAddress, // por defecto usa dirección del cliente
  elevator_type: 'hydraulic',
  manufacturer: '',
  manufacturer_custom: '',
  model: '',
  serial_number: '',
  serial_number_not_legible: false,
  capacity_kg: 450,
  floors: 1,
  installation_date: new Date().toISOString().split('T')[0],
  has_machine_room: true,
  no_machine_room: false,
  stops_all_floors: true,
  stops_odd_floors: false,
  stops_even_floors: false,
  classification: 'ascensor_corporativo',
});

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const isEditMode = !!client;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generar contraseña automática basada en año actual
  const generateAutoPassword = () => {
    const currentYear = new Date().getFullYear();
    return `Mirega_${currentYear}@`;
  };

  const [clientData, setClientData] = useState({
    company_name: client?.company_name || '',
    building_name: client?.building_name || '',
    // Alias interno (Mirega)
    internal_alias: '',
    // Contacto Principal (se mantiene)
    contact_name: client?.contact_name || '',
    contact_email: client?.contact_email || '',
    contact_phone: client?.contact_phone || '',
    // Contactos Alternos (hasta 3) - NUEVO, ahora con cargo/rol
    alternate_contacts: [
      { name: '', email: '', phone: '', role: '', enabled: false },
      { name: '', email: '', phone: '', role: '', enabled: false },
      { name: '', email: '', phone: '', role: '', enabled: false },
    ],
    // Campos legacy (se mantienen para compatibilidad)
    admin_name: '',
    admin_email: '',
    admin_phone: '',
    rut: '',
    address: client?.address || '',
    password: isEditMode ? '' : generateAutoPassword(),
    confirmPassword: isEditMode ? '' : generateAutoPassword(),
  });

  const [generatedClientCode, setGeneratedClientCode] =
    useState<string | null>(null);
  const [generatedQRCode, setGeneratedQRCode] =
    useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  // Ascensores
  const [totalEquipments, setTotalEquipments] = useState(1);
  const [identicalElevators, setIdenticalElevators] =
    useState(false);
  const [elevatorCount, setElevatorCount] = useState(1);

  const [templateElevator, setTemplateElevator] =
    useState<ElevatorData>(() =>
      createEmptyElevator(clientData.address)
    );

  const [elevators, setElevators] = useState<ElevatorData[]>([
    createEmptyElevator(clientData.address),
  ]);

  const fail = (msg: string) => {
    setError(msg);
    setLoading(false);
    return false;
  };

  // Sincroniza dirección de cliente con ascensores que la usan
  const handleClientAddressChange = (address: string) => {
    const prev = clientData.address;

    setClientData((p) => ({ ...p, address }));

    // Template (ascensores idénticos)
    setTemplateElevator((old) =>
      old.useClientAddress
        ? { ...old, address_asc: address }
        : old
    );

    // Ascensores individuales que usaban la dirección anterior del cliente
    setElevators((old) =>
      old.map((e) =>
        e.useClientAddress && e.address_asc === prev
          ? { ...e, address_asc: address }
          : e
      )
    );
  };

  const updateElevator = (
    index: number,
    patch: Partial<ElevatorData>
  ) => {
    setElevators((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const addElevator = () => {
    if (!identicalElevators && elevators.length >= totalEquipments) {
      alert(`No puedes agregar más de ${totalEquipments} ascensores.`);
      return;
    }
    setElevators((prev) => [
      ...prev,
      createEmptyElevator(clientData.address),
    ]);
  };

  const removeElevator = (index: number) => {
    setElevators((prev) =>
      prev.length <= 1
        ? prev
        : prev.filter((_, i) => i !== index)
    );
  };

  const validateElevators = (): boolean => {
    const list = identicalElevators ? [templateElevator] : elevators;

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const n = i + 1;
      const addr = e.useClientAddress
        ? clientData.address
        : e.address_asc;

      if (!e.location_name)
        return fail(`El ascensor ${n} debe tener un nombre / torre`);
      if (!addr)
        return fail(`El ascensor ${n} debe tener una dirección`);

      // Fabricante: si es OTROS, debe venir manufacturer_custom
      if (!e.manufacturer)
        return fail(`El ascensor ${n} debe tener un fabricante seleccionado`);
      if (e.manufacturer === 'OTROS' && !e.manufacturer_custom?.trim())
        return fail(`Escribe el fabricante en "OTROS" para el ascensor ${n}`);

      if (!e.model)
        return fail(`El ascensor ${n} debe tener un modelo`);
      if (!e.serial_number && !e.serial_number_not_legible)
        return fail(
          `El ascensor ${n} debe tener número de serie o marcar "N° de serie no legible"`
        );
      if (e.capacity_kg <= 0)
        return fail(
          `El ascensor ${n} debe tener una capacidad (kg) válida`
        );
      if (e.floors <= 0)
        return fail(
          `El ascensor ${n} debe tener un N° de paradas válido`
        );

      if (
        (e.has_machine_room && e.no_machine_room) ||
        (!e.has_machine_room && !e.no_machine_room)
      ) {
        return fail(
          `El ascensor ${n} debe indicar si tiene o no sala de máquinas`
        );
      }

      const stopCount = [
        e.stops_all_floors,
        e.stops_odd_floors,
        e.stops_even_floors,
      ].filter(Boolean).length;
      if (stopCount !== 1) {
        return fail(
          `El ascensor ${n} debe tener una sola opción de paradas seleccionada`
        );
      }
    }

    return true;
  };

  const generateQRCodeForClient = async (clientCode: string) => {
    const url = `${window.location.origin}/client/${clientCode}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    setGeneratedClientCode(clientCode);
    setGeneratedQRCode(dataUrl);
  };

  const handleCopyClientCode = async () => {
    if (!generatedClientCode) return;
    await navigator.clipboard.writeText(generatedClientCode);
    alert('Código de cliente copiado');
  };

  // SUBMIT
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // EDITAR CLIENTE
    if (isEditMode) {
      try {
        if (
          !clientData.company_name ||
          !clientData.contact_name ||
          !clientData.contact_email ||
          !clientData.address
        ) {
          return fail(
            'Completa los campos obligatorios (Empresa, Contacto, Email, Dirección)'
          );
        }

        const { error: upErr } = await supabase
          .from('clients')
          .update({
            company_name: clientData.company_name,
            building_name: clientData.building_name || null,
            internal_alias: clientData.internal_alias || '',
            contact_name: clientData.contact_name,
            contact_email: clientData.contact_email,
            contact_phone: clientData.contact_phone,
            admin_name: clientData.admin_name || '',
            admin_email: clientData.admin_email || '',
            admin_phone: clientData.admin_phone || '',
            address: clientData.address,
          })
          .eq('id', client!.id);

        if (upErr) throw upErr;

        alert('Cliente actualizado exitosamente');
        onSuccess?.();
      } catch (err: any) {
        console.error(err);
        fail(err.message || 'Error al actualizar el cliente');
      }
      return;
    }

    // NUEVO CLIENTE
    if (
      !clientData.company_name ||
      !clientData.building_name ||
      !clientData.internal_alias ||
      !clientData.contact_name ||
      !clientData.contact_email ||
      !clientData.address
    ) {
      return fail('Completa los campos obligatorios (Nombre de empresa, Edificio, Alias, Contacto, Email, Dirección)');
    }

    if (!identicalElevators && elevators.length !== totalEquipments) {
      return fail(
        `Debes agregar exactamente ${totalEquipments} ascensores. Actualmente tienes ${elevators.length}.`
      );
    }

    if (identicalElevators && elevatorCount !== totalEquipments) {
      return fail(
        `El número de ascensores idénticos (${elevatorCount}) debe coincidir con el N° de Equipos (${totalEquipments}).`
      );
    }

    // Validaciones mejoradas
    const emailValidation = validateEmail(clientData.contact_email);
    if (!emailValidation.isValid) {
      return fail(emailValidation.error!);
    }

    const phoneValidation = validatePhoneOptional(clientData.contact_phone);
    if (!phoneValidation.isValid) {
      return fail(phoneValidation.error!);
    }

    const companyValidation = validateCompanyName(clientData.company_name);
    if (!companyValidation.isValid) {
      return fail(companyValidation.error!);
    }

    const addressValidation = validateAddress(clientData.address);
    if (!addressValidation.isValid) {
      return fail(addressValidation.error!);
    }

    if (clientData.rut) {
      const rutValidation = validateRUT(clientData.rut);
      if (!rutValidation.isValid) {
        return fail(rutValidation.error!);
      }
    }

    if (!validateElevators()) return;

    if (clientData.password !== clientData.confirmPassword) {
      return fail('Las contraseñas no coinciden');
    }

    const passwordValidation = validatePassword(clientData.password);
    if (!passwordValidation.isValid) {
      return fail(passwordValidation.error!);
    }

    try {
      // Verificar si el email ya existe ANTES de intentar crear el usuario
      const { data: existingProfiles, error: checkError } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', clientData.contact_email.toLowerCase().trim())
        .limit(1);

      if (checkError) {
        console.error('Error al verificar email existente:', checkError);
      }

      if (existingProfiles && existingProfiles.length > 0) {
        return fail('Ya existe un usuario registrado con este correo electrónico. Por favor, usa otro email.');
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          'No hay sesión activa para crear el usuario del cliente.'
        );
      }

      const apiBase =
        import.meta.env.VITE_DATABASE_URL ||
        import.meta.env.VITE_SUPABASE_URL ||
        import.meta.env.VITE_SUPABASE_URL;

      if (!apiBase) {
        throw new Error(
          'Falta VITE_DATABASE_URL / VITE_SUPABASE_URL en el frontend.'
        );
      }

      const apiUrl = `${apiBase}/functions/v1/create-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_DATABASE_ANON_KEY as string,
        },
        body: JSON.stringify({
          email: clientData.contact_email,
          password: clientData.password,
          full_name: clientData.contact_name,
          phone: clientData.contact_phone || null,
          role: 'client',
        }),
      });

      const raw = await response.text();
      let result: any = null;

      if (raw) {
        try {
          result = JSON.parse(raw);
        } catch {
          console.error('Respuesta no JSON de create-user:', raw);
          throw new Error(
            'La función create-user no retornó JSON válido.'
          );
        }
      }

      if (!response.ok || !result?.success) {
        console.error(
          'create-user error:',
          response.status,
          raw
        );
        
        // Traducir mensajes de error comunes del backend
        let errorMessage = result?.error || `Error al crear el usuario del cliente (status ${response.status}).`;
        
        // Traducciones de errores comunes
        if (errorMessage.includes('already been registered') || errorMessage.includes('already exists')) {
          errorMessage = 'Ya existe un usuario registrado con este correo electrónico. Por favor, usa otro email.';
        } else if (errorMessage.includes('invalid email')) {
          errorMessage = 'El correo electrónico no es válido.';
        } else if (errorMessage.includes('weak password')) {
          errorMessage = 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
        }
        
        throw new Error(errorMessage);
      }

      const profile = result.user;

      const clientCode = `CLI-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)
        .toUpperCase()}`;

      const { data: createdClient, error: clientErr } = await supabase
        .from('clients')
        .insert({
          profile_id: profile.id,
          company_name: clientData.company_name,
          building_name: clientData.building_name,
          internal_alias: clientData.internal_alias,
          contact_name: clientData.contact_name,
          contact_email: clientData.contact_email,
          contact_phone: clientData.contact_phone,
          admin_name: clientData.admin_name,
          admin_email: clientData.admin_email,
          admin_phone: clientData.admin_phone,
          // Contactos alternos como JSON (incluye cargo/rol)
          alternate_contacts: (clientData.alternate_contacts?.filter(c => c.enabled && (c.name || c.email || c.phone || c.role)) ?? null),
          rut: clientData.rut || null,
          address: clientData.address,
          is_active: true,
          client_code: clientCode,
        })
        .select()
        .single();

      if (clientErr || !createdClient) {
        throw clientErr || new Error('No se pudo crear el cliente');
      }

      // Helpers para tower/index y fabricante personalizado
      const normalizeManufacturer = (e: ElevatorData) =>
        e.manufacturer === 'OTROS'
          ? (e.manufacturer_custom?.trim() || 'OTROS')
          : e.manufacturer;

      const makeElevatorRow = (e: ElevatorData, idx: number) => {
        const tower = e.location_name?.trim() || `Ascensor ${idx + 1}`;
        const indexNum = idx + 1; // consecutivo según orden visual (si lo omites, DB trigger lo completa)
        return {
          client_id: createdClient.id,
          location_name: e.location_name,
          tower_name: tower,
          index_number: indexNum,
          address_asc: e.useClientAddress ? clientData.address : e.address_asc,
          elevator_type: e.elevator_type,
          manufacturer: normalizeManufacturer(e),
          model: e.model,
          serial_number: e.serial_number,
          serial_number_not_legible: e.serial_number_not_legible,
          capacity_kg: e.capacity_kg,
          floors: e.floors,
          installation_date: e.installation_date,
          has_machine_room: e.has_machine_room,
          no_machine_room: e.no_machine_room,
          stops_all_floors: e.stops_all_floors,
          stops_odd_floors: e.stops_odd_floors,
          stops_even_floors: e.stops_even_floors,
          classification: e.classification,
          status: 'active' as const,
        };
      };

      const elevatorsToInsert: any[] = identicalElevators
        ? Array(elevatorCount).fill(null).map((_, idx) => {
            const e = templateElevator;
            const serial = e.serial_number ? `${e.serial_number}-${idx + 1}` : '';
            return { ...makeElevatorRow({ ...e, serial_number: serial }, idx) };
          })
        : elevators.map((e, idx) => makeElevatorRow(e, idx));

      if (elevatorsToInsert.length > 0) {
        const { error: elevErr } = await supabase
          .from('elevators')
          .insert(elevatorsToInsert);
        if (elevErr) throw elevErr;
      }

      await generateQRCodeForClient(clientCode);

      alert('Cliente y ascensores creados exitosamente.');
      onSuccess?.();
    } catch (err: any) {
      console.error('Error creando cliente:', err);
      fail(
        err.message ||
          'Error al crear el cliente. Revisa la configuración del servidor.'
      );
    } finally {
      setLoading(false);
    }
  };

  // RENDER
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">
            {isEditMode ? 'Editar Cliente' : 'Nuevo Cliente'}
          </h2>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Información del Cliente */}
        <section className="border-b border-slate-200 pb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Información del Cliente
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Razón Social *
              </label>
              <input
                type="text"
                required
                value={clientData.company_name}
                onChange={(e) =>
                  setClientData((p) => ({
                    ...p,
                    company_name: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre Edificio *
              </label>
              <input
                type="text"
                required
                value={clientData.building_name}
                onChange={(e) =>
                  setClientData((p) => ({
                    ...p,
                    building_name: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Este nombre aparecerá en documentos PDF y búsquedas.
              </p>
            </div>

            {/* Alias interno */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre interno (Mirega) *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Alcántara, Carmen, etc."
                value={clientData.internal_alias}
                onChange={(e) =>
                  setClientData((p) => ({
                    ...p,
                    internal_alias: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">
                Alias corto para identificar rápido al cliente en Mirega.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                RUT
              </label>
              <input
                type="text"
                value={clientData.rut}
                onChange={(e) =>
                  setClientData((p) => ({
                    ...p,
                    rut: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Contacto "legacy" */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Contacto *
              </label>
              <input
                type="text"
                required
                value={clientData.contact_name}
                onChange={(e) =>
                  setClientData((p) => ({
                    ...p,
                    contact_name: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                <Mail className="w-4 h-4" />
                Email *
              </label>
              <input
                type="email"
                required
                value={clientData.contact_email}
                onChange={(e) =>
                  setClientData((p) => ({
                    ...p,
                    contact_email: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                <Phone className="w-4 h-4" />
                Teléfono
              </label>
              <input
                type="tel"
                value={clientData.contact_phone}
                onChange={(e) =>
                  setClientData((p) => ({
                    ...p,
                    contact_phone: e.target.value,
                  }))
                }
                placeholder="Opcional - se puede agregar después"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Dirección cliente */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                <MapPin className="w-4 h-4" />
                Dirección *
              </label>
              <input
                type="text"
                required
                value={clientData.address}
                onChange={(e) =>
                  handleClientAddressChange(e.target.value)
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Bloque Contacto Alterno (Opcional) - Múltiples */}
            <div className="md:col-span-2 border rounded-lg p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-slate-800">
                  Contactos Alternos (Opcionales)
                </p>
                <p className="text-xs text-blue-600">
                  Agrega hasta 3 contactos alternos. Activa/desactiva cada uno según sea necesario.
                </p>
              </div>
              
              <div className="space-y-4">
                {clientData.alternate_contacts.map((contact, index) => (
                  <div 
                    key={index}
                    className={`border rounded-lg p-3 transition ${
                      contact.enabled 
                        ? 'bg-white border-blue-300' 
                        : 'bg-gray-100 border-gray-300 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        id={`contact-${index}`}
                        checked={contact.enabled}
                        onChange={(e) => {
                          setClientData((p) => {
                            const updated = [...p.alternate_contacts];
                            updated[index].enabled = e.target.checked;
                            return { ...p, alternate_contacts: updated };
                          });
                        }}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                      />
                      <label 
                        htmlFor={`contact-${index}`}
                        className="text-sm font-medium text-slate-700 cursor-pointer flex-1"
                      >
                        Contacto Alterno {index + 1}
                      </label>
                      {contact.enabled && (
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          Activo
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-slate-600 mb-1 block font-medium">
                          Nombre
                        </label>
                        <input
                          type="text"
                          disabled={!contact.enabled}
                          value={contact.name}
                          onChange={(e) => {
                            setClientData((p) => {
                              const updated = [...p.alternate_contacts];
                              updated[index].name = e.target.value;
                              return { ...p, alternate_contacts: updated };
                            });
                          }}
                          placeholder="Ej: Presidente de condominio"
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 mb-1 block font-medium">
                          Email
                        </label>
                        <input
                          type="email"
                          disabled={!contact.enabled}
                          value={contact.email}
                          onChange={(e) => {
                            setClientData((p) => {
                              const updated = [...p.alternate_contacts];
                              updated[index].email = e.target.value;
                              return { ...p, alternate_contacts: updated };
                            });
                          }}
                          placeholder="contacto@empresa.cl"
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 mb-1 block font-medium">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          disabled={!contact.enabled}
                          value={contact.phone}
                          onChange={(e) => {
                            setClientData((p) => {
                              const updated = [...p.alternate_contacts];
                              updated[index].phone = e.target.value;
                              return { ...p, alternate_contacts: updated };
                            });
                          }}
                          placeholder="+56 9 XXXX XXXX"
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 mb-1 block font-medium">
                          Cargo / Rol
                        </label>
                        <input
                          type="text"
                          disabled={!contact.enabled}
                          value={contact.role}
                          onChange={(e) => {
                            setClientData((p) => {
                              const updated = [...p.alternate_contacts];
                              updated[index].role = e.target.value;
                              return { ...p, alternate_contacts: updated };
                            });
                          }}
                          placeholder="Ej: Presidente, Tesorero, etc."
                          className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Credenciales */}
        {!isEditMode && (
          <section className="border-b border-slate-200 pb-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Credenciales de Acceso
            </h3>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800 mb-2">
                <strong>✅ Contraseña autogenerada:</strong> La contraseña se genera automáticamente para facilitar el ingreso rápido.
              </p>
              <p className="text-sm text-green-700">
                El cliente puede cambiarla una vez que inicie sesión.
              </p>
              <div className="mt-3 p-3 bg-white border border-green-300 rounded flex items-center justify-between">
                <code className="text-lg font-bold text-green-700">{clientData.password}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(clientData.password);
                    alert('Contraseña copiada al portapapeles');
                  }}
                  className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  <Copy className="w-4 h-4" />
                  Copiar
                </button>
              </div>
              <p className="text-xs text-green-600 mt-2">
                Patrón: Mirega_YYYY@ (donde YYYY es el año actual)
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                  <Key className="w-4 h-4" />
                  Contraseña (autogenerada)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    disabled
                    value={clientData.password}
                    className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((s) => !s)
                    }
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    type={
                      showConfirmPassword
                        ? 'text'
                        : 'password'
                    }
                    disabled
                    value={clientData.confirmPassword}
                    className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        (s) => !s
                      )
                    }
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Ascensores */}
        <section className="border-b border-slate-200 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">
              Información de Ascensores
            </h3>
          </div>

          {/* Configuración general */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                N° de Equipos *
              </label>
              <input
                type="number"
                min={1}
                value={totalEquipments}
                onChange={(e) => {
                  const v = Math.max(
                    1,
                    Number(e.target.value) || 1
                  );
                  setTotalEquipments(v);
                  if (!identicalElevators) {
                    setElevators((prev) => {
                      const next = [...prev];
                      while (next.length < v) {
                        next.push(
                          createEmptyElevator(
                            clientData.address
                          )
                        );
                      }
                      return next.slice(0, v);
                    });
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2 mt-6">
              <input
                id="identical-elevators"
                type="checkbox"
                checked={identicalElevators}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIdenticalElevators(checked);
                  if (checked) {
                    setElevatorCount(totalEquipments);
                  }
                }}
              />
              <label
                htmlFor="identical-elevators"
                className="text-sm text-slate-700"
              >
                Todos los ascensores son idénticos
              </label>
            </div>

            {identicalElevators && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  N° Ascensores idénticos
                </label>
                <input
                  type="number"
                  min={1}
                  max={totalEquipments}
                  value={elevatorCount}
                  onChange={(e) =>
                    setElevatorCount(
                      Math.min(
                        totalEquipments,
                        Math.max(
                          1,
                          Number(e.target.value) ||
                            1
                        )
                      )
                    )
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Bloque para ascensores idénticos */}
          {identicalElevators ? (
            <div className="border rounded-xl p-4 bg-slate-50 space-y-3">
              <h4 className="font-semibold text-slate-800">
                Datos del ascensor (se aplica a los {elevatorCount})
              </h4>

              {/* Nombre + dirección */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">
                    Torre / Nombre *
                  </label>
                  <input
                    type="text"
                    value={
                      templateElevator.location_name
                    }
                    onChange={(e) =>
                      setTemplateElevator((p) => ({
                        ...p,
                        location_name:
                          e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">
                    Dirección
                  </label>
                  <div className="flex flex-col gap-1">
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="radio"
                        checked={
                          templateElevator.useClientAddress
                        }
                        onChange={() =>
                          setTemplateElevator((p) => ({
                            ...p,
                            useClientAddress:
                              true,
                            address_asc:
                              clientData.address,
                          }))
                        }
                      />
                      Usar dirección del cliente
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="radio"
                        checked={
                          !templateElevator.useClientAddress
                        }
                        onChange={() =>
                          setTemplateElevator((p) => ({
                            ...p,
                            useClientAddress:
                              false,
                            address_asc: '',
                          }))
                        }
                      />
                      Dirección diferente
                    </label>
                    {!templateElevator.useClientAddress && (
                      <input
                        type="text"
                        placeholder="Dirección del ascensor"
                        value={
                          templateElevator.address_asc
                        }
                        onChange={(e) =>
                          setTemplateElevator((p) => ({
                            ...p,
                            address_asc:
                              e.target.value,
                          }))
                        }
                        className="w-full mt-1 px-3 py-2 border rounded-lg"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Tipo / fabricante / modelo */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">
                    Tipo *
                  </label>
                  <select
                    value={
                      templateElevator.elevator_type
                    }
                    onChange={(e) =>
                      setTemplateElevator((p) => ({
                        ...p,
                        elevator_type:
                          e.target
                            .value as ElevatorType,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="hydraulic">
                      Hidráulico
                    </option>
                    <option value="electromechanical">
                      Electromecánico
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">
                    Fabricante *
                  </label>
                  <select
                    value={
                      templateElevator.manufacturer
                    }
                    onChange={(e) =>
                      setTemplateElevator((p) => ({
                        ...p,
                        manufacturer:
                          e.target.value,
                        // reset el custom si elige algo distinto de OTROS
                        manufacturer_custom:
                          e.target.value === 'OTROS'
                            ? p.manufacturer_custom
                            : '',
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">
                      Seleccionar fabricante
                    </option>
                    {MANUFACTURERS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {templateElevator.manufacturer === 'OTROS' && (
                    <input
                      type="text"
                      placeholder="Especifique fabricante"
                      value={templateElevator.manufacturer_custom || ''}
                      onChange={(e) =>
                        setTemplateElevator((p) => ({
                          ...p,
                          manufacturer_custom: e.target.value,
                        }))
                      }
                      className="w-full mt-2 px-3 py-2 border rounded-lg"
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">
                    Modelo *
                  </label>
                  <input
                    type="text"
                    value={templateElevator.model}
                    onChange={(e) =>
                      setTemplateElevator((p) => ({
                        ...p,
                        model: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Serie / capacidad / paradas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">
                    N° de Serie
                  </label>
                  <input
                    type="text"
                    disabled={
                      templateElevator.serial_number_not_legible
                    }
                    value={
                      templateElevator.serial_number
                    }
                    onChange={(e) =>
                      setTemplateElevator((p) => ({
                        ...p,
                        serial_number:
                          e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <label className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={
                        templateElevator.serial_number_not_legible
                      }
                      onChange={(e) =>
                        setTemplateElevator((p) => ({
                          ...p,
                          serial_number_not_legible:
                            e.target.checked,
                          serial_number:
                            e.target.checked
                              ? ''
                              : p.serial_number,
                        }))
                      }
                    />
                    N° de serie no legible / no disponible
                  </label>
                </div>
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">
                    Capacidad (kg) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={
                      templateElevator.capacity_kg
                    }
                    onChange={(e) =>
                      setTemplateElevator((p) => ({
                        ...p,
                        capacity_kg:
                          Number(
                            e.target.value
                          ) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">
                    N° de Paradas *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={templateElevator.floors}
                    onChange={(e) =>
                      setTemplateElevator((p) => ({
                        ...p,
                        floors:
                          Number(
                            e.target.value
                          ) || 0,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              {/* Sala de máquinas / paradas / clasificación */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <p className="text-sm text-slate-700 mb-1">
                    Sala de máquinas *
                  </p>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      checked={
                        templateElevator.has_machine_room
                      }
                      onChange={() =>
                        setTemplateElevator((p) => ({
                          ...p,
                          has_machine_room:
                            true,
                          no_machine_room:
                            false,
                        }))
                      }
                    />
                    Con sala de máquinas
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      checked={
                        templateElevator.no_machine_room
                      }
                      onChange={() =>
                        setTemplateElevator((p) => ({
                          ...p,
                          has_machine_room:
                            false,
                          no_machine_room:
                            true,
                        }))
                      }
                    />
                    Sin sala de máquinas
                  </label>
                </div>
                <div>
                  <p className="text-sm text-slate-700 mb-1">
                    Paradas *
                  </p>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      checked={
                        templateElevator.stops_all_floors
                      }
                      onChange={() =>
                        setTemplateElevator((p) => ({
                          ...p,
                          stops_all_floors:
                            true,
                          stops_odd_floors:
                            false,
                          stops_even_floors:
                            false,
                        }))
                      }
                    />
                    Todas las plantas
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      checked={
                        templateElevator.stops_odd_floors
                      }
                      onChange={() =>
                        setTemplateElevator((p) => ({
                          ...p,
                          stops_all_floors:
                            false,
                          stops_odd_floors:
                            true,
                          stops_even_floors:
                            false,
                        }))
                      }
                    />
                    Solo pisos impares
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="radio"
                      checked={
                        templateElevator.stops_even_floors
                      }
                      onChange={() =>
                        setTemplateElevator((p) => ({
                          ...p,
                          stops_all_floors:
                            false,
                          stops_odd_floors:
                            false,
                          stops_even_floors:
                            true,
                        }))
                      }
                    />
                    Solo pisos pares
                  </label>
                </div>
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">
                    Clasificación *
                  </label>
                  <select
                    value={
                      templateElevator.classification
                    }
                    onChange={(e) =>
                      setTemplateElevator((p) => ({
                        ...p,
                        classification:
                          e.target
                            .value as Classification,
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="ascensor_corporativo">
                      Ascensor Corporativo
                    </option>
                    <option value="ascensor_residencial">
                      Ascensor Residencial
                    </option>
                    <option value="montacargas">
                      Montacargas
                    </option>
                    <option value="montaplatos">
                      Montaplatos
                    </option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            // Ascensores individuales
            <div className="space-y-4">
              {elevators.map((e, idx) => (
                <div
                  key={idx}
                  className="border rounded-xl p-4 bg-slate-50 space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-slate-800">
                      Ascensor #{idx + 1}
                    </h4>
                    {elevators.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          removeElevator(idx)
                        }
                        className="p-1.5 rounded-md hover:bg-red-50 text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-slate-700 mb-1 block">
                        Torre / Nombre *
                      </label>
                      <input
                        type="text"
                        value={e.location_name}
                        onChange={(ev) =>
                          updateElevator(idx, {
                            location_name:
                              ev.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-700 mb-1 block">
                        Dirección
                      </label>
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="radio"
                            checked={
                              e.useClientAddress
                            }
                            onChange={() =>
                              updateElevator(idx, {
                                useClientAddress:
                                  true,
                                address_asc:
                                  clientData.address,
                              })
                            }
                          />
                          Usar dirección del cliente
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="radio"
                            checked={
                              !e.useClientAddress
                            }
                            onChange={() =>
                              updateElevator(idx, {
                                useClientAddress:
                                  false,
                                address_asc: '',
                              })
                            }
                          />
                          Dirección diferente
                        </label>
                        {!e.useClientAddress && (
                          <input
                            type="text"
                            placeholder="Dirección del ascensor"
                            value={e.address_asc}
                            onChange={(ev) =>
                              updateElevator(idx, {
                                address_asc:
                                  ev.target.value,
                              })
                            }
                            className="w-full mt-1 px-3 py-2 border rounded-lg"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm text-slate-700 mb-1 block">
                        Tipo *
                      </label>
                      <select
                        value={e.elevator_type}
                        onChange={(ev) =>
                          updateElevator(idx, {
                            elevator_type:
                              ev.target
                                .value as ElevatorType,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="hydraulic">
                          Hidráulico
                        </option>
                        <option value="electromechanical">
                          Electromecánico
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-700 mb-1 block">
                        Fabricante *
                      </label>
                      <select
                        value={e.manufacturer}
                        onChange={(ev) =>
                          updateElevator(idx, {
                            manufacturer:
                              ev.target.value,
                            manufacturer_custom:
                              ev.target.value === 'OTROS'
                                ? e.manufacturer_custom
                                : '',
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="">
                          Seleccionar fabricante
                        </option>
                        {MANUFACTURERS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                      {e.manufacturer === 'OTROS' && (
                        <input
                          type="text"
                          placeholder="Especifique fabricante"
                          value={e.manufacturer_custom || ''}
                          onChange={(ev) =>
                            updateElevator(idx, {
                              manufacturer_custom: ev.target.value,
                            })
                          }
                          className="w-full mt-2 px-3 py-2 border rounded-lg"
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-sm text-slate-700 mb-1 block">
                        Modelo *
                      </label>
                      <input
                        type="text"
                        value={e.model}
                        onChange={(ev) =>
                          updateElevator(idx, {
                            model:
                              ev.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-sm text-slate-700 mb-1 block">
                        N° de Serie
                      </label>
                      <input
                        type="text"
                        disabled={
                          e.serial_number_not_legible
                        }
                        value={e.serial_number}
                        onChange={(ev) =>
                          updateElevator(idx, {
                            serial_number:
                              ev.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                      <label className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={
                            e.serial_number_not_legible
                          }
                          onChange={(ev) =>
                            updateElevator(idx, {
                              serial_number_not_legible:
                                ev.target.checked,
                              serial_number:
                                ev.target.checked
                                  ? ''
                                  : e.serial_number,
                            })
                          }
                        />
                        N° de serie no legible / no
                        disponible
                      </label>
                    </div>
                    <div>
                      <label className="text-sm text-slate-700 mb-1 block">
                        Capacidad (kg) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={e.capacity_kg}
                        onChange={(ev) =>
                          updateElevator(idx, {
                            capacity_kg:
                              Number(
                                ev.target.value
                              ) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-700 mb-1 block">
                        N° de Paradas *
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={e.floors}
                        onChange={(ev) =>
                          updateElevator(idx, {
                            floors:
                              Number(
                                ev.target.value
                              ) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <p className="text-sm text-slate-700 mb-1">
                        Sala de máquinas *
                      </p>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          checked={e.has_machine_room}
                          onChange={() =>
                            updateElevator(idx, {
                              has_machine_room:
                                true,
                              no_machine_room:
                                false,
                            })
                          }
                        />
                        Con sala de máquinas
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          checked={e.no_machine_room}
                          onChange={() =>
                            updateElevator(idx, {
                              has_machine_room:
                                false,
                              no_machine_room:
                                true,
                            })
                          }
                        />
                        Sin sala de máquinas
                      </label>
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 mb-1">
                        Paradas *
                      </p>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          checked={e.stops_all_floors}
                          onChange={() =>
                            updateElevator(idx, {
                              stops_all_floors:
                                true,
                              stops_odd_floors:
                                false,
                              stops_even_floors:
                                false,
                            })
                          }
                        />
                        Todas las plantas
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          checked={
                            e.stops_odd_floors
                          }
                          onChange={() =>
                            updateElevator(idx, {
                              stops_all_floors:
                                false,
                              stops_odd_floors:
                                true,
                              stops_even_floors:
                                false,
                            })
                          }
                        />
                        Solo pisos impares
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="radio"
                          checked={
                            e.stops_even_floors
                          }
                          onChange={() =>
                            updateElevator(idx, {
                              stops_all_floors:
                                false,
                              stops_odd_floors:
                                false,
                              stops_even_floors:
                                true,
                            })
                          }
                        />
                        Solo pisos pares
                      </label>
                    </div>
                    <div>
                      <label className="text-sm text-slate-700 mb-1 block">
                        Clasificación *
                      </label>
                      <select
                        value={e.classification}
                        onChange={(ev) =>
                          updateElevator(idx, {
                            classification:
                              ev.target
                                .value as Classification,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="ascensor_corporativo">
                          Ascensor Corporativo
                        </option>
                        <option value="ascensor_residencial">
                          Ascensor Residencial
                        </option>
                        <option value="montacargas">
                          Montacargas
                        </option>
                        <option value="montaplatos">
                          Montaplatos
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {elevators.length < totalEquipments && (
                <button
                  type="button"
                  onClick={addElevator}
                  className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-slate-400 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-4 h-4" />
                  Agregar ascensor
                </button>
              )}
            </div>
          )}
        </section>

        {/* Botones */}
        <div className="flex items-center justify-between pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="ml-auto px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? 'Guardando...'
              : isEditMode
              ? 'Guardar cambios'
              : 'Crear cliente'}
          </button>
        </div>

        {/* QR generado */}
        {generatedClientCode && generatedQRCode && (
          <div className="mt-6 p-4 border rounded-lg bg-slate-50 flex items-center gap-4">
            <img
              src={generatedQRCode}
              alt="QR Cliente"
              className="w-24 h-24"
            />
            <div>
              <p className="text-sm text-slate-700">
                Código del cliente:
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg">
                  {generatedClientCode}
                </span>
                <button
                  type="button"
                  onClick={handleCopyClientCode}
                  className="p-1.5 rounded-md border border-slate-300 hover:bg-white"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

