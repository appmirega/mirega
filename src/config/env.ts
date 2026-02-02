/**
 * Configuración centralizada de variables de entorno
 * Estandariza el acceso a variables de entorno y elimina referencias legacy
 */

/**
 * Validar que las variables de entorno críticas existan
 */
function validateEnvVars(): void {
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  
  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `❌ Variables de entorno faltantes: ${missing.join(', ')}\n` +
      `Por favor, configura estas variables en tu archivo .env`
    );
  }
}

// Validar al cargar el módulo
validateEnvVars();

/**
 * Configuración de Supabase
 */
export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const;

/**
 * Configuración de la aplicación
 */
export const appConfig = {
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  mode: import.meta.env.MODE,
} as const;

// Compatibilidad legacy: exportar SUPABASE_URL y SUPABASE_ANON_KEY
export const SUPABASE_URL = supabaseConfig.url;
export const SUPABASE_ANON_KEY = supabaseConfig.anonKey;

/**
 * URLs y endpoints
 */
export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000, // 30 segundos
} as const;

/**
 * Features flags (para habilitar/deshabilitar funcionalidades)
 */
export const featureFlags = {
  enableDarkMode: false, // TODO: Implementar modo oscuro
  enableExport: true,
  enableNotifications: false, // TODO: Implementar notificaciones
  enableGlobalSearch: false, // TODO: Implementar búsqueda global
} as const;

/**
 * Configuración de logging
 */
export const loggingConfig = {
  enableConsoleInProduction: false,
  enableSentry: false, // TODO: Integrar Sentry
  logLevel: appConfig.isDevelopment ? 'debug' : 'error',
} as const;

/**
 * Validación y formateo de RUT chileno
 */
export const rutConfig = {
  minLength: 8,
  maxLength: 12,
  format: /^(\d{1,2})\.?(\d{3})\.?(\d{3})-?([\dkK])$/,
} as const;

/**
 * Configuración de validaciones
 */
export const validationConfig = {
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },
  phone: {
    chileanFormat: /^\+56\s?9\s?\d{4}\s?\d{4}$/,
  },
  email: {
    maxLength: 254,
  },
  elevator: {
    minCapacity: 100,
    maxCapacity: 10000,
    minFloors: 1,
    maxFloors: 200,
  },
} as const;

/**
 * Helper para obtener una variable de entorno con valor por defecto
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = import.meta.env[key];
  
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Variable de entorno no encontrada: ${key}`);
  }
  
  return value;
}

/**
 * Helper para verificar si estamos en desarrollo
 */
export const isDev = (): boolean => appConfig.isDevelopment;

/**
 * Helper para verificar si estamos en producción
 */
export const isProd = (): boolean => appConfig.isProduction;
