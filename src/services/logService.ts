import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

export enum LogDirection {
  INBOUND = 'Inbound',
  OUTBOUND = 'Outbound',
  SERVER = 'Server',
  DATABASE = 'Database',
}

export enum OcppMessageType {
  CALL = 'Call',
  CALL_RESULT = 'CallResult',
  CALL_ERROR = 'CallError',
  SYSTEM = 'System',
  VALIDATION = 'Validation',
  DATABASE = 'Database',
}

interface LogContext {
  chargePointId?: string;
  ocppMethod?: string;
  ocppMessageType: OcppMessageType;
  direction: LogDirection;
  payload?: any;
}

export const createLogEntry = async (
  level: LogLevel,
  message: string,
  context: LogContext
) => {
  try {
    await prisma.ocppLog.create({
      data: {
        level,
        message,
        chargePointId: context.chargePointId,
        ocppMethod: context.ocppMethod,
        ocppMessageType: context.ocppMessageType,
        direction: context.direction,
        payload: context.payload ? context.payload : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to create log entry:', error);
  }
};

export const logInfo = (message: string, context: LogContext) => {
  console.info(`[INFO] ${message}`, context);
  createLogEntry(LogLevel.INFO, message, context);
};

export const logWarn = (message: string, context: LogContext) => {
  console.warn(`[WARN] ${message}`, context);
  createLogEntry(LogLevel.WARN, message, context);
};

export const logError = (message: string, error: any, context: LogContext) => {
  console.error(`[ERROR] ${message}`, error, context);
  createLogEntry(LogLevel.ERROR, `${message}: ${error?.message || error}`, context);
};

export const logDebug = (message: string, context: LogContext) => {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[DEBUG] ${message}`, context);
    createLogEntry(LogLevel.DEBUG, message, context);
  }
}; 