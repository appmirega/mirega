// src/utils/validateRUT.ts
// Valida un RUT chileno (sin puntos, con guion y dígito verificador)

export function validateRUT(rut: string): boolean {
  if (!rut) return false;
  // Limpia formato
  rut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (rut.length < 2) return false;
  const body = rut.slice(0, -1);
  const dv = rut.slice(-1);
  let sum = 0, mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const expectedDV = 11 - (sum % 11);
  let dvCalc = expectedDV === 11 ? '0' : expectedDV === 10 ? 'K' : expectedDV.toString();
  return dvCalc === dv;
}
