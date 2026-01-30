/**
 * Sistema de Logging Estructurado
 * Reemplaza console.log con logging controlado por ambiente
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  context?: string;
}

class Logger {
  private isDevelopment: boolean;
  private isProduction: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.isProduction = import.meta.env.PROD;
  }

  private formatMessage(level: LogLevel, message: string, data?: any, context?: string): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      context,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    // En producción, solo errores y warnings
    if (this.isProduction) {
      return level === 'error' || level === 'warn';
    }

    // En desarrollo, todo
    return this.isDevelopment;
  }

  debug(message: string, data?: any, context?: string): void {
    if (!this.shouldLog('debug')) return;

    const entry = this.formatMessage('debug', message, data, context);
    console.log(`🔍 [DEBUG]${context ? ` [${context}]` : ''} ${message}`, data || '');
  }

  info(message: string, data?: any, context?: string): void {
    if (!this.shouldLog('info')) return;

    const entry = this.formatMessage('info', message, data, context);
    console.log(`ℹ️  [INFO]${context ? ` [${context}]` : ''} ${message}`, data || '');
  }

  warn(message: string, data?: any, context?: string): void {
    if (!this.shouldLog('warn')) return;

    const entry = this.formatMessage('warn', message, data, context);
    console.warn(`⚠️  [WARN]${context ? ` [${context}]` : ''} ${message}`, data || '');

    // En producción, enviar a servicio de monitoreo (Sentry, etc.)
    if (this.isProduction) {
      this.sendToMonitoring(entry);
    }
  }

  error(message: string, error?: Error | any, context?: string): void {
    const entry = this.formatMessage('error', message, error, context);
    console.error(`❌ [ERROR]${context ? ` [${context}]` : ''} ${message}`, error || '');

    // En producción, siempre enviar errores a monitoreo
    if (this.isProduction) {
      this.sendToMonitoring(entry);
    }
  }

  /**
   * Para logging de eventos de negocio importantes
   * (siempre se registra, incluso en producción)
   */
  audit(action: string, data?: any, userId?: string): void {
    const entry = {
      ...this.formatMessage('info', action, data, 'AUDIT'),
      userId,
    };

    console.log(`📋 [AUDIT] ${action}`, data || '');

    // Enviar a sistema de auditoría
    if (this.isProduction) {
      this.sendToAudit(entry);
    }
  }

  private sendToMonitoring(entry: LogEntry): void {
    // TODO: Integrar con Sentry, LogRocket, etc.
    // Por ahora, solo en desarrollo para testing
    if (this.isDevelopment) {
      console.log('[MONITORING]', entry);
    }
  }

  private sendToAudit(entry: any): void {
    // TODO: Enviar a tabla de auditoría en BD
    if (this.isDevelopment) {
      console.log('[AUDIT]', entry);
    }
  }
}

// Exportar instancia única
export const logger = new Logger();

// Exportar helpers específicos por contexto
export const createContextLogger = (context: string) => ({
  debug: (message: string, data?: any) => logger.debug(message, data, context),
  info: (message: string, data?: any) => logger.info(message, data, context),
  warn: (message: string, data?: any) => logger.warn(message, data, context),
  error: (message: string, error?: any) => logger.error(message, error, context),
  audit: (action: string, data?: any, userId?: string) => logger.audit(action, data, userId),
});

// Ejemplo de uso:
// const log = createContextLogger('EmergencyForm');
// log.debug('Componente montado', { clientId, elevatorIds });
// log.error('Error al cargar datos', error);
