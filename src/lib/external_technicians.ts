// Módulo de gestión de técnicos externos
// Permite agregar, listar y buscar técnicos externos/empresas

export interface ExternalTechnician {
  id: string;
  name: string;
  company?: string;
  contact?: string;
}

const STORAGE_KEY = 'external_technicians';

export function getExternalTechnicians(): ExternalTechnician[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

export function addExternalTechnician(tech: Omit<ExternalTechnician, 'id'>): ExternalTechnician {
  const list = getExternalTechnicians();
  const newTech = { ...tech, id: Date.now().toString() };
  list.push(newTech);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return newTech;
}

export function findExternalTechnicianByName(name: string): ExternalTechnician | undefined {
  return getExternalTechnicians().find(t => t.name.toLowerCase() === name.toLowerCase());
}
