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

const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
  ),
  defaultMeta: { service: 'app-radar' },
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'HH:mm:ss' }),
        consoleFormat
      )
    })
  ],
});

// Helper functions
export function logCollectorStart(source: string, config: any) {
  logger.info('Collector started', { source, config });
}

export function logCollectorComplete(source: string, stats: any) {
  logger.info('Collector completed', { source, ...stats });
}

export function logCollectorError(source: string, error: Error, context?: any) {
  logger.error('Collector error', { source, error: error.message, context });
}

export default logger;