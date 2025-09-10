import { config } from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppConfig } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  // Browser Configuration
  HEADLESS: z.string().default('true').transform(val => val === 'true'),
  BROWSER_TIMEOUT: z.string().default('30000').transform(Number),
  MAX_CONCURRENT_BROWSERS: z.string().default('3').transform(Number),
  
  // Rate Limiting
  REQUEST_DELAY_MIN: z.string().default('1000').transform(Number),
  REQUEST_DELAY_MAX: z.string().default('3000').transform(Number),
  MAX_RETRIES: z.string().default('3').transform(Number),
  
  // Database
  DATABASE_PATH: z.string().default('./data/opportunities.db'),
  
  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FILE: z.string().default('./logs/app-radar.log'),
  
  // Stealth Mode
  ENABLE_STEALTH: z.string().default('true').transform(val => val === 'true'),
  ROTATE_USER_AGENTS: z.string().default('true').transform(val => val === 'true'),
  
  // Optional proxy
  PROXY_ENABLED: z.string().default('false').transform(val => val === 'true'),
  PROXY_URL: z.string().optional(),
  
  // API Keys
  TWITTER_BEARER_TOKEN: z.string().optional(),
  PRODUCTHUNT_API_KEY: z.string().optional(),
});

function loadConfig(): AppConfig {
  const env = envSchema.parse(process.env);
  
  return {
    browser: {
      headless: env.HEADLESS,
      timeout: env.BROWSER_TIMEOUT,
      maxConcurrent: env.MAX_CONCURRENT_BROWSERS,
      stealth: env.ENABLE_STEALTH,
      ...(env.PROXY_ENABLED && env.PROXY_URL && {
        proxy: { server: env.PROXY_URL }
      })
    },
    database: {
      path: path.resolve(env.DATABASE_PATH),
      maxConnections: 10,
      backupInterval: 24 * 60 * 60 * 1000, // 24 hours
    },
    logging: {
      level: env.LOG_LEVEL,
      file: path.resolve(env.LOG_FILE),
      maxFiles: 5,
      maxSize: '10m',
    },
    rateLimit: {
      requestDelayMin: env.REQUEST_DELAY_MIN,
      requestDelayMax: env.REQUEST_DELAY_MAX,
      maxRetries: env.MAX_RETRIES,
    },
    collectors: [
      {
        source: 'producthunt',
        enabled: true,
        interval: 60, // 1 hour
        maxPages: 5,
        rateLimitMs: 2000,
        retryAttempts: 3,
        filters: {
          minUpvotes: 10,
          categories: ['productivity', 'developer-tools', 'saas'],
        }
      },
      {
        source: 'indiehackers',
        enabled: true,
        interval: 120, // 2 hours
        maxPages: 3,
        rateLimitMs: 3000,
        retryAttempts: 3,
        filters: {
          keywords: ['startup', 'saas', 'tool', 'app'],
        }
      },
      {
        source: 'exploding-topics',
        enabled: true,
        interval: 240, // 4 hours
        maxPages: 2,
        rateLimitMs: 5000,
        retryAttempts: 2,
      },
      {
        source: 'twitter',
        enabled: !!env.TWITTER_BEARER_TOKEN,
        interval: 30, // 30 minutes
        maxPages: 10,
        rateLimitMs: 1000,
        retryAttempts: 3,
        filters: {
          keywords: ['#buildinpublic', '#indiehackers', '#startup'],
        }
      }
    ]
  };
}

export const appConfig = loadConfig();

export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required directories exist
  const requiredDirs = ['./data', './logs'];
  for (const dir of requiredDirs) {
    try {
      const fs = await import('fs');
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
    } catch (error) {
      errors.push(`Failed to create directory ${dir}: ${error}`);
    }
  }
  
  // Validate browser config
  if (appConfig.browser.timeout < 5000) {
    errors.push('Browser timeout should be at least 5 seconds');
  }
  
  if (appConfig.browser.maxConcurrent > 10) {
    errors.push('Max concurrent browsers should not exceed 10');
  }
  
  // Validate rate limiting
  if (appConfig.rateLimit.requestDelayMin >= appConfig.rateLimit.requestDelayMax) {
    errors.push('REQUEST_DELAY_MIN must be less than REQUEST_DELAY_MAX');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}