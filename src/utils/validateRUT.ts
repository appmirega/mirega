export function cleanRut(value: string): string {
  return (value || '').replace(/\./g, '').replace(/[^0-9kK-]/g, '').toUpperCase();
}

export function normalizeRUT(value: string): string {
  const cleaned = cleanRut(value).replace(/-/g, '');

  if (!cleaned) return '';
  if (cleaned.length === 1) return cleaned;

  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1);

  return `${body}-${dv}`;
}

export function validateRUT(rut: string): boolean {
  const normalized = normalizeRUT(rut);

  if (!normalized) return false;

  const [body, dv] = normalized.split('-');

  if (!body || !dv) return false;
  if (!/^\d+$/.test(body)) return false;
  if (!/^[0-9K]$/.test(dv)) return false;

  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expectedDv =
    remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

  return expectedDv === dv;
}
