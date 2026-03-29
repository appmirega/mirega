export function sanitizeStorageName(value: string | null | undefined): string {
  if (!value) return 'general';

  return value
    .normalize("NFD") // separa acentos
    .replace(/[\u0300-\u036f]/g, "") // elimina tildes
    .replace(/[^a-zA-Z0-9_-]/g, "_") // reemplaza caracteres inválidos
    .replace(/_+/g, "_") // evita múltiples _
    .replace(/^_+|_+$/g, "") // limpia extremos
    .toLowerCase();
}