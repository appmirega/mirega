/**
 * Utilidades de validación para formularios
 * Incluye validaciones para email, teléfono, RUT y otros campos
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Valida formato de email
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { isValid: false, error: 'El email es requerido' };
  }

  const emailRegex = /^[a-zA-Z0-9]([a-zA-Z0-9._-]*[a-zA-Z0-9])?@[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Formato de email inválido. Ejemplo: usuario@empresa.cl' };
  }

  // Validar longitud
  if (email.length > 254) {
    return { isValid: false, error: 'El email es demasiado largo (máximo 254 caracteres)' };
  }

  return { isValid: true };
}

/**
 * Valida formato de teléfono chileno (REQUERIDO)
 * Acepta: +56912345678, 912345678, +56 9 1234 5678, etc.
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone) {
    return { isValid: false, error: 'El teléfono es requerido' };
  }

  // Limpiar espacios, guiones y paréntesis
  const cleanPhone = phone.replace(/[\s\-()]/g, '');

  // Validar formato chileno
  const phoneRegex = /^(\+?56)?[2-9]\d{8}$/;
  
  if (!phoneRegex.test(cleanPhone)) {
    return { 
      isValid: false, 
      error: 'Formato de teléfono inválido. Debe tener 9 dígitos (ej: 912345678 o +56912345678)' 
    };
  }

  return { isValid: true };
}

/**
 * Valida formato de teléfono chileno (OPCIONAL)
 * Si está vacío, lo considera válido
 * Si tiene valor, valida el formato
 */
export function validatePhoneOptional(phone: string): ValidationResult {
  const trimmedPhone = phone.trim();
  
  // Si está vacío, es válido (es opcional)
  if (!trimmedPhone) {
    return { isValid: true };
  }

  // Limpiar espacios, guiones y paréntesis
  const cleanPhone = trimmedPhone.replace(/[\s\-()]/g, '');

  // Validar formato chileno
  const phoneRegex = /^(\+?56)?[2-9]\d{8}$/;
  
  if (!phoneRegex.test(cleanPhone)) {
    return { 
      isValid: false, 
      error: 'Formato de teléfono inválido. Debe tener 9 dígitos (ej: 912345678 o +56912345678)' 
    };
  }

  return { isValid: true };
}

/**
 * Valida RUT chileno
 * Acepta formatos: 12.345.678-9, 12345678-9, 123456789
 */
export function validateRUT(rut: string): ValidationResult {
  if (!rut) {
    return { isValid: false, error: 'El RUT es requerido' };
  }

  // Limpiar puntos y guiones
  const cleanRUT = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();

  if (cleanRUT.length < 2) {
    return { isValid: false, error: 'RUT demasiado corto' };
  }

  if (cleanRUT.length > 9) {
    return { isValid: false, error: 'RUT demasiado largo' };
  }

  const body = cleanRUT.slice(0, -1);
  const dv = cleanRUT.slice(-1);

  // Validar que el cuerpo sean solo números
  if (!/^\d+$/.test(body)) {
    return { isValid: false, error: 'El RUT debe contener solo números antes del dígito verificador' };
  }

  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body.charAt(i)) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const calculatedDV = 11 - (sum % 11);
  const expectedDV = calculatedDV === 11 ? '0' : calculatedDV === 10 ? 'K' : calculatedDV.toString();

  if (dv !== expectedDV) {
    return { isValid: false, error: 'RUT inválido. El dígito verificador no coincide' };
  }

  return { isValid: true };
}

/**
 * Formatea RUT con puntos y guión
 * Ejemplo: 12345678-9 → 12.345.678-9
 */
export function formatRUT(rut: string): string {
  const cleanRUT = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  
  if (cleanRUT.length < 2) return rut;

  const body = cleanRUT.slice(0, -1);
  const dv = cleanRUT.slice(-1);

  // Agregar puntos cada 3 dígitos desde la derecha
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${formattedBody}-${dv}`;
}

/**
 * Formatea teléfono chileno
 * Ejemplo: 912345678 → +56 9 1234 5678
 */
export function formatPhone(phone: string): string {
  const cleanPhone = phone.replace(/[\s\-()]/g, '');
  
  // Si ya tiene +56, mantenerlo
  if (cleanPhone.startsWith('+56')) {
    const number = cleanPhone.substring(3);
    if (number.length === 9) {
      return `+56 ${number.substring(0, 1)} ${number.substring(1, 5)} ${number.substring(5)}`;
    }
  }
  
  // Si empieza con 56, agregar +
  if (cleanPhone.startsWith('56') && cleanPhone.length === 11) {
    const number = cleanPhone.substring(2);
    return `+56 ${number.substring(0, 1)} ${number.substring(1, 5)} ${number.substring(5)}`;
  }

  // Si es solo el número de 9 dígitos
  if (cleanPhone.length === 9) {
    return `+56 ${cleanPhone.substring(0, 1)} ${cleanPhone.substring(1, 5)} ${cleanPhone.substring(5)}`;
  }

  return phone;
}

/**
 * Valida dirección chilena
 */
export function validateAddress(address: string): ValidationResult {
  if (!address) {
    return { isValid: false, error: 'La dirección es requerida' };
  }

  if (address.trim().length < 5) {
    return { isValid: false, error: 'La dirección es demasiado corta (mínimo 5 caracteres)' };
  }

  if (address.length > 200) {
    return { isValid: false, error: 'La dirección es demasiado larga (máximo 200 caracteres)' };
  }

  return { isValid: true };
}

/**
 * Valida nombre de empresa
 */
export function validateCompanyName(name: string): ValidationResult {
  if (!name) {
    return { isValid: false, error: 'El nombre de la empresa es requerido' };
  }

  if (name.trim().length < 2) {
    return { isValid: false, error: 'El nombre es demasiado corto (mínimo 2 caracteres)' };
  }

  if (name.length > 200) {
    return { isValid: false, error: 'El nombre es demasiado largo (máximo 200 caracteres)' };
  }

  return { isValid: true };
}

/**
 * Valida contraseña fuerte
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { isValid: false, error: 'La contraseña es requerida' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  }

  if (password.length > 72) {
    return { isValid: false, error: 'La contraseña es demasiado larga (máximo 72 caracteres)' };
  }

  // Al menos una mayúscula
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'La contraseña debe contener al menos una letra mayúscula' };
  }

  // Al menos una minúscula
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'La contraseña debe contener al menos una letra minúscula' };
  }

  // Al menos un número
  if (!/\d/.test(password)) {
    return { isValid: false, error: 'La contraseña debe contener al menos un número' };
  }

  return { isValid: true };
}

/**
 * Valida capacidad de ascensor
 */
export function validateElevatorCapacity(capacity: string | number): ValidationResult {
  const numCapacity = typeof capacity === 'string' ? parseInt(capacity) : capacity;

  if (isNaN(numCapacity)) {
    return { isValid: false, error: 'La capacidad debe ser un número' };
  }

  if (numCapacity < 100) {
    return { isValid: false, error: 'La capacidad mínima es 100 kg' };
  }

  if (numCapacity > 10000) {
    return { isValid: false, error: 'La capacidad máxima es 10,000 kg' };
  }

  return { isValid: true };
}

/**
 * Valida número de pisos
 */
export function validateFloors(floors: string | number): ValidationResult {
  const numFloors = typeof floors === 'string' ? parseInt(floors) : floors;

  if (isNaN(numFloors)) {
    return { isValid: false, error: 'El número de pisos debe ser un número' };
  }

  if (numFloors < 1) {
    return { isValid: false, error: 'Debe haber al menos 1 piso' };
  }

  if (numFloors > 200) {
    return { isValid: false, error: 'El número máximo de pisos es 200' };
  }

  return { isValid: true };
}

/**
 * Valida código interno de ascensor
 */
export function validateInternalCode(code: string): ValidationResult {
  if (!code) {
    return { isValid: false, error: 'El código interno es requerido' };
  }

  if (code.trim().length < 2) {
    return { isValid: false, error: 'El código es demasiado corto (mínimo 2 caracteres)' };
  }

  if (code.length > 50) {
    return { isValid: false, error: 'El código es demasiado largo (máximo 50 caracteres)' };
  }

  // Solo permite letras, números, guiones y guiones bajos
  if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
    return { isValid: false, error: 'El código solo puede contener letras, números, guiones y guiones bajos' };
  }

  return { isValid: true };
}
