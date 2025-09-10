export interface AppOpportunity {
  id: string;
  title: string;
  description: string;
  url: string;
  source: 'producthunt' | 'indiehackers' | 'twitter' | 'exploding-topics';
  category?: string;
  tags: string[];
  metrics: {
    upvotes?: number;
    comments?: number;
    views?: number;
    engagement?: number;
  };
  createdAt: Date;
  discoveredAt: Date;
  lastUpdated: Date;
  status: 'discovered' | 'analyzed' | 'ignored' | 'bookmarked';
}

export interface CollectorConfig {
  source: string;
  enabled: boolean;
  interval: number; // in minutes
  maxPages: number;
  rateLimitMs: number;
  retryAttempts: number;
  filters?: {
    minUpvotes?: number;
    categories?: string[];
    keywords?: string[];
    excludeKeywords?: string[];
  };
}

export interface BrowserConfig {
  headless: boolean;
  timeout: number;
  maxConcurrent: number;
  userAgent?: string;
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  stealth: boolean;
}

export interface DatabaseConfig {
  path: string;
  maxConnections: number;
  backupInterval: number;
}

export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  file?: string;
  maxFiles?: number;
  maxSize?: string;
}

export interface AppConfig {
  browser: BrowserConfig;
  database: DatabaseConfig;
  logging: LogConfig;
  collectors: CollectorConfig[];
  rateLimit: {
    requestDelayMin: number;
    requestDelayMax: number;
    maxRetries: number;
  };
}

export interface CollectorResult {
  success: boolean;
  opportunities: AppOpportunity[];
  errors?: string[];
  nextPageUrl?: string;
  totalProcessed: number;
}

export interface CollectorStats {
  source: string;
  totalCollected: number;
  totalErrors: number;
  lastRun: Date;
  avgRunTime: number;
  successRate: number;
}