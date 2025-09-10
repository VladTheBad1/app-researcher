import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { appConfig } from '../config/index.js';
import logger, { logDatabaseOperation } from '../utils/logger.js';
import type { AppOpportunity, CollectorStats } from '../types/index.js';

sqlite3.verbose();

export class Database {
  private db: sqlite3.Database | null = null;
  private initialized = false;
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Ensure database directory exists
      const dbDir = path.dirname(appConfig.database.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      this.db = new sqlite3.Database(appConfig.database.path);
      
      // Promisify database methods
      const run = promisify(this.db.run.bind(this.db));
      const get = promisify(this.db.get.bind(this.db));
      const all = promisify(this.db.all.bind(this.db));
      
      // Enable foreign keys
      await run('PRAGMA foreign_keys = ON');
      await run('PRAGMA journal_mode = WAL');
      await run('PRAGMA synchronous = NORMAL');
      await run('PRAGMA cache_size = 10000');
      await run('PRAGMA temp_store = MEMORY');
      
      // Create tables
      await this.createTables();
      
      this.initialized = true;
      logDatabaseOperation('initialize', undefined, 1);
      logger.info('Database initialized successfully', { path: appConfig.database.path });
      
    } catch (error) {
      logger.error('Failed to initialize database', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }
  
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const run = promisify(this.db.run.bind(this.db));
    
    // Opportunities table
    await run(`
      CREATE TABLE IF NOT EXISTS opportunities (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL,
        category TEXT,
        tags TEXT, -- JSON array
        upvotes INTEGER,
        comments INTEGER,
        views INTEGER,
        engagement INTEGER,
        created_at TEXT NOT NULL,
        discovered_at TEXT NOT NULL,
        last_updated TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'discovered',
        CONSTRAINT chk_source CHECK (source IN ('producthunt', 'indiehackers', 'twitter', 'exploding-topics')),
        CONSTRAINT chk_status CHECK (status IN ('discovered', 'analyzed', 'ignored', 'bookmarked'))
      )
    `);
    
    // Collector stats table
    await run(`
      CREATE TABLE IF NOT EXISTS collector_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        total_collected INTEGER NOT NULL DEFAULT 0,
        total_errors INTEGER NOT NULL DEFAULT 0,
        last_run TEXT NOT NULL,
        avg_run_time INTEGER NOT NULL DEFAULT 0,
        success_rate REAL NOT NULL DEFAULT 0.0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Collection runs table for detailed tracking
    await run(`
      CREATE TABLE IF NOT EXISTS collection_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        opportunities_found INTEGER NOT NULL DEFAULT 0,
        errors_count INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER,
        success BOOLEAN NOT NULL DEFAULT 0,
        error_message TEXT,
        metadata TEXT -- JSON
      )
    `);
    
    // Create indexes for better performance
    await run('CREATE INDEX IF NOT EXISTS idx_opportunities_source ON opportunities(source)');
    await run('CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status)');
    await run('CREATE INDEX IF NOT EXISTS idx_opportunities_discovered_at ON opportunities(discovered_at)');
    await run('CREATE INDEX IF NOT EXISTS idx_opportunities_url ON opportunities(url)');
    await run('CREATE INDEX IF NOT EXISTS idx_collection_runs_source ON collection_runs(source)');
    await run('CREATE INDEX IF NOT EXISTS idx_collection_runs_started_at ON collection_runs(started_at)');
    
    logDatabaseOperation('create_tables');
  }
  
  async saveOpportunity(opportunity: AppOpportunity): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const run = promisify(this.db.run.bind(this.db));
    
    try {
      await run(`
        INSERT OR REPLACE INTO opportunities (
          id, title, description, url, source, category, tags,
          upvotes, comments, views, engagement,
          created_at, discovered_at, last_updated, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        opportunity.id,
        opportunity.title,
        opportunity.description,
        opportunity.url,
        opportunity.source,
        opportunity.category || null,
        JSON.stringify(opportunity.tags),
        opportunity.metrics.upvotes || null,
        opportunity.metrics.comments || null,
        opportunity.metrics.views || null,
        opportunity.metrics.engagement || null,
        opportunity.createdAt.toISOString(),
        opportunity.discoveredAt.toISOString(),
        opportunity.lastUpdated.toISOString(),
        opportunity.status
      ]);
      
      logDatabaseOperation('save_opportunity', 'opportunities', 1);
    } catch (error) {
      logger.error('Failed to save opportunity', { 
        id: opportunity.id,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
  
  async saveOpportunities(opportunities: AppOpportunity[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const run = promisify(this.db.run.bind(this.db));
    
    try {
      await run('BEGIN TRANSACTION');
      
      for (const opportunity of opportunities) {
        await this.saveOpportunity(opportunity);
      }
      
      await run('COMMIT');
      logDatabaseOperation('save_opportunities_batch', 'opportunities', opportunities.length);
      
    } catch (error) {
      await run('ROLLBACK');
      logger.error('Failed to save opportunities batch', { 
        count: opportunities.length,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
  
  async getOpportunities(filters?: {
    source?: string;
    status?: string;
    limit?: number;
    offset?: number;
    minUpvotes?: number;
    since?: Date;
  }): Promise<AppOpportunity[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const all = promisify(this.db.all.bind(this.db));
    
    let query = 'SELECT * FROM opportunities WHERE 1=1';
    const params: any[] = [];
    
    if (filters?.source) {
      query += ' AND source = ?';
      params.push(filters.source);
    }
    
    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    
    if (filters?.minUpvotes) {
      query += ' AND upvotes >= ?';
      params.push(filters.minUpvotes);
    }
    
    if (filters?.since) {
      query += ' AND discovered_at >= ?';
      params.push(filters.since.toISOString());
    }
    
    query += ' ORDER BY discovered_at DESC';
    
    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }
    
    try {
      const rows: any[] = await all(query, params);
      
      const opportunities: AppOpportunity[] = rows.map(row => ({
        id: row.id,
        title: row.title,
        description: row.description,
        url: row.url,
        source: row.source as AppOpportunity['source'],
        category: row.category,
        tags: JSON.parse(row.tags || '[]'),
        metrics: {
          upvotes: row.upvotes,
          comments: row.comments,
          views: row.views,
          engagement: row.engagement,
        },
        createdAt: new Date(row.created_at),
        discoveredAt: new Date(row.discovered_at),
        lastUpdated: new Date(row.last_updated),
        status: row.status as AppOpportunity['status'],
      }));
      
      logDatabaseOperation('get_opportunities', 'opportunities', opportunities.length);
      return opportunities;
      
    } catch (error) {
      logger.error('Failed to get opportunities', { 
        filters,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
  
  async updateOpportunityStatus(id: string, status: AppOpportunity['status']): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const run = promisify(this.db.run.bind(this.db));
    
    try {
      await run(`
        UPDATE opportunities 
        SET status = ?, last_updated = ? 
        WHERE id = ?
      `, [status, new Date().toISOString(), id]);
      
      logDatabaseOperation('update_opportunity_status', 'opportunities', 1);
    } catch (error) {
      logger.error('Failed to update opportunity status', { 
        id, status,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
  
  async saveCollectorStats(stats: CollectorStats): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const run = promisify(this.db.run.bind(this.db));
    
    try {
      await run(`
        INSERT OR REPLACE INTO collector_stats (
          source, total_collected, total_errors, last_run, avg_run_time, success_rate, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        stats.source,
        stats.totalCollected,
        stats.totalErrors,
        stats.lastRun.toISOString(),
        stats.avgRunTime,
        stats.successRate,
        new Date().toISOString()
      ]);
      
      logDatabaseOperation('save_collector_stats', 'collector_stats', 1);
    } catch (error) {
      logger.error('Failed to save collector stats', { 
        source: stats.source,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
  
  async getCollectorStats(source?: string): Promise<CollectorStats[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const all = promisify(this.db.all.bind(this.db));
    
    let query = 'SELECT * FROM collector_stats';
    const params: any[] = [];
    
    if (source) {
      query += ' WHERE source = ?';
      params.push(source);
    }
    
    query += ' ORDER BY updated_at DESC';
    
    try {
      const rows: any[] = await all(query, params);
      
      const stats: CollectorStats[] = rows.map(row => ({
        source: row.source,
        totalCollected: row.total_collected,
        totalErrors: row.total_errors,
        lastRun: new Date(row.last_run),
        avgRunTime: row.avg_run_time,
        successRate: row.success_rate,
      }));
      
      logDatabaseOperation('get_collector_stats', 'collector_stats', stats.length);
      return stats;
      
    } catch (error) {
      logger.error('Failed to get collector stats', { 
        source,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
  
  async cleanup(daysOld: number = 30): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const run = promisify(this.db.run.bind(this.db));
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    try {
      const result = await run(`
        DELETE FROM opportunities 
        WHERE status = 'ignored' AND last_updated < ?
      `, [cutoffDate.toISOString()]);
      
      const deletedCount = (result as any).changes || 0;
      logDatabaseOperation('cleanup', 'opportunities', deletedCount);
      
      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup database', { 
        daysOld,
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }
  
  async close(): Promise<void> {
    if (this.db) {
      const close = promisify(this.db.close.bind(this.db));
      await close();
      this.db = null;
      this.initialized = false;
      logDatabaseOperation('close');
    }
  }
}

// Global database instance
export const database = new Database();