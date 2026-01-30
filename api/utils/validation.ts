/**
 * Utilidades de validación para API endpoints
 * Compartido entre diferentes endpoints
 */

/**
 * Valida RUT chileno con dígito verificador
 */
export function validateRUT(rut: string): boolean {
  // Eliminar puntos y guión
  const cleanRUT = rut.replace(/\./g, '').replace(/-/g, '');
  
  if (cleanRUT.length < 2) return false;
  
  const body = cleanRUT.slice(0, -1);
  const dv = cleanRUT.slice(-1).toUpperCase();
  
  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body.charAt(i)) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const calculatedDV = 11 - (sum % 11);
  const expectedDV = calculatedDV === 11 ? '0' : calculatedDV === 10 ? 'K' : calculatedDV.toString();
  
  return dv === expectedDV;
}

/**
 * Valida formato de email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Valida teléfono chileno (+56 9 XXXX XXXX)
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+56\s?9\s?\d{4}\s?\d{4}$/;
  return phoneRegex.test(phone);
}
