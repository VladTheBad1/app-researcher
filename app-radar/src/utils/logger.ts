import winston from 'winston';
import path from 'path';
import { appConfig } from '../config/index.js';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let output = `${timestamp} [${level}]: ${message}`;
  
  if (Object.keys(meta).length > 0) {
    output += ` ${JSON.stringify(meta)}`;
  }
  
  if (stack) {
    output += `\n${stack}`;
  }
  
  return output;
});

// Ensure logs directory exists
const logsDir = path.dirname(appConfig.logging.file!);
import fs from 'fs';
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'app-radar' },
  transports: [
    // File transport for all logs
    new winston.transports.File({
      filename: appConfig.logging.file,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: appConfig.logging.maxFiles || 5,
      tailable: true,
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: appConfig.logging.file!.replace('.log', '.error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 3,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      consoleFormat
    )
  }));
}

// Helper functions for structured logging
export function logCollectorStart(source: string, config: any) {
  logger.info('Collector started', { 
    source, 
    config: { 
      maxPages: config.maxPages, 
      rateLimitMs: config.rateLimitMs 
    } 
  });
}

export function logCollectorComplete(source: string, stats: any) {
  logger.info('Collector completed', { 
    source, 
    ...stats 
  });
}

export function logCollectorError(source: string, error: Error, context?: any) {
  logger.error('Collector error', { 
    source, 
    error: error.message, 
    stack: error.stack,
    context 
  });
}

export function logBrowserAction(action: string, url?: string, metadata?: any) {
  logger.debug('Browser action', { 
    action, 
    url, 
    ...metadata 
  });
}

export function logRateLimit(source: string, delayMs: number) {
  logger.debug('Rate limit applied', { 
    source, 
    delayMs 
  });
}

export function logDatabaseOperation(operation: string, table?: string, count?: number) {
  logger.debug('Database operation', { 
    operation, 
    table, 
    count 
  });
}

// Performance logging
export function logPerformance(operation: string, duration: number, metadata?: any) {
  logger.info('Performance metric', { 
    operation, 
    duration, 
    ...metadata 
  });
}

// Security logging
export function logSecurityEvent(event: string, details: any) {
  logger.warn('Security event', { 
    event, 
    ...details 
  });
}

export default logger;