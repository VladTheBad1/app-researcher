import { Page } from 'playwright';
import { randomUUID } from 'crypto';
import pRetry from 'p-retry';
import { 
  browserManager, 
  withBrowser, 
  extractText, 
  extractAttribute,
  waitForSelectorSafe 
} from '../utils/browser.js';
import { database } from '../database/index.js';
import logger, { logCollectorStart, logCollectorComplete, logCollectorError } from '../utils/logger.js';
import type { 
  AppOpportunity, 
  CollectorConfig, 
  CollectorResult, 
  CollectorStats 
} from '../types/index.js';

export abstract class BaseCollector {
  protected config: CollectorConfig;
  protected sessionId: string;
  protected stats: {
    startTime: number;
    totalProcessed: number;
    totalErrors: number;
    opportunities: AppOpportunity[];
  };
  
  constructor(config: CollectorConfig) {
    this.config = config;
    this.sessionId = `${config.source}-${Date.now()}`;
    this.stats = {
      startTime: 0,
      totalProcessed: 0,
      totalErrors: 0,
      opportunities: [],
    };
  }
  
  // Abstract methods that must be implemented by each collector
  abstract getStartUrl(): string;
  abstract extractOpportunities(page: Page): Promise<AppOpportunity[]>;
  abstract getNextPageUrl(page: Page): Promise<string | null>;
  abstract isValidOpportunity(opportunity: Partial<AppOpportunity>): boolean;
  
  async collect(): Promise<CollectorResult> {
    this.stats.startTime = Date.now();
    logCollectorStart(this.config.source, this.config);
    
    try {
      const result = await this.performCollection();
      
      // Save opportunities to database
      if (result.opportunities.length > 0) {
        await database.saveOpportunities(result.opportunities);
      }
      
      // Update collector statistics
      await this.updateCollectorStats(result);
      
      const duration = Date.now() - this.stats.startTime;
      logCollectorComplete(this.config.source, {
        totalProcessed: result.totalProcessed,
        opportunitiesFound: result.opportunities.length,
        errors: result.errors?.length || 0,
        duration,
      });
      
      return result;
      
    } catch (error) {
      logCollectorError(this.config.source, error as Error);
      
      return {
        success: false,
        opportunities: [],
        errors: [error instanceof Error ? error.message : String(error)],
        totalProcessed: this.stats.totalProcessed,
      };
    } finally {
      // Cleanup browser context
      try {
        await browserManager.closeContext(this.sessionId);
      } catch (error) {
        logger.warn('Failed to close browser context', { 
          sessionId: this.sessionId,
          error: error instanceof Error ? error.message : error 
        });
      }
    }
  }
  
  private async performCollection(): Promise<CollectorResult> {
    const errors: string[] = [];
    let currentUrl: string | null = this.getStartUrl();
    let pageCount = 0;
    
    while (currentUrl && pageCount < this.config.maxPages) {
      try {
        await this.collectFromPage(currentUrl);
        
        // Get next page URL
        currentUrl = await withBrowser(this.sessionId, async (page) => {
          await browserManager.navigateWithRetry(page, currentUrl!);
          return await this.getNextPageUrl(page);
        });
        
        pageCount++;
        
        // Apply rate limiting between pages
        if (currentUrl && this.config.rateLimitMs > 0) {
          await this.applyRateLimit();
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Page ${pageCount + 1}: ${errorMessage}`);
        this.stats.totalErrors++;
        
        // Decide whether to continue or abort
        if (this.shouldAbortOnError(error as Error)) {
          break;
        }
      }
    }
    
    return {
      success: errors.length === 0,
      opportunities: this.stats.opportunities,
      errors: errors.length > 0 ? errors : undefined,
      totalProcessed: this.stats.totalProcessed,
      nextPageUrl: currentUrl,
    };
  }
  
  private async collectFromPage(url: string): Promise<void> {
    const pageOpportunities = await withBrowser(this.sessionId, async (page) => {
      await browserManager.navigateWithRetry(page, url);
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      // Optional: Perform human-like scrolling
      await browserManager.randomScroll(page);
      
      return await this.extractOpportunities(page);
    });
    
    // Filter and process opportunities
    const validOpportunities = pageOpportunities.filter(opp => 
      this.isValidOpportunity(opp) && this.passesFilters(opp)
    );
    
    this.stats.opportunities.push(...validOpportunities);
    this.stats.totalProcessed += pageOpportunities.length;
    
    logger.debug('Page collection complete', {
      source: this.config.source,
      url,
      found: pageOpportunities.length,
      valid: validOpportunities.length,
    });
  }
  
  protected createOpportunity(data: {
    title: string;
    description: string;
    url: string;
    category?: string;
    tags?: string[];
    metrics?: Partial<AppOpportunity['metrics']>;
    createdAt?: Date;
  }): AppOpportunity {
    const now = new Date();
    
    return {
      id: randomUUID(),
      title: data.title.trim(),
      description: data.description.trim(),
      url: data.url,
      source: this.config.source as AppOpportunity['source'],
      category: data.category,
      tags: data.tags || [],
      metrics: {
        upvotes: data.metrics?.upvotes,
        comments: data.metrics?.comments,
        views: data.metrics?.views,
        engagement: data.metrics?.engagement,
      },
      createdAt: data.createdAt || now,
      discoveredAt: now,
      lastUpdated: now,
      status: 'discovered',
    };
  }
  
  protected async safeExtractText(page: Page, selector: string, defaultValue: string = ''): Promise<string> {
    try {
      const text = await extractText(page, selector);
      return text?.trim() || defaultValue;
    } catch (error) {
      logger.debug('Failed to extract text', { 
        selector, 
        source: this.config.source,
        error: error instanceof Error ? error.message : error 
      });
      return defaultValue;
    }
  }
  
  protected async safeExtractAttribute(page: Page, selector: string, attribute: string, defaultValue: string = ''): Promise<string> {
    try {
      const value = await extractAttribute(page, selector, attribute);
      return value?.trim() || defaultValue;
    } catch (error) {
      logger.debug('Failed to extract attribute', { 
        selector, 
        attribute,
        source: this.config.source,
        error: error instanceof Error ? error.message : error 
      });
      return defaultValue;
    }
  }
  
  protected async safeExtractNumber(page: Page, selector: string): Promise<number | undefined> {
    try {
      const text = await this.safeExtractText(page, selector);
      const number = parseInt(text.replace(/[^\d]/g, ''), 10);
      return isNaN(number) ? undefined : number;
    } catch {
      return undefined;
    }
  }
  
  protected async waitForContent(page: Page, selectors: string[], timeout: number = 10000): Promise<boolean> {
    const promises = selectors.map(selector => 
      waitForSelectorSafe(page, selector, timeout)
    );
    
    const results = await Promise.all(promises);
    return results.some(result => result);
  }
  
  private passesFilters(opportunity: AppOpportunity): boolean {
    const filters = this.config.filters;
    if (!filters) return true;
    
    // Check minimum upvotes
    if (filters.minUpvotes && (!opportunity.metrics.upvotes || opportunity.metrics.upvotes < filters.minUpvotes)) {
      return false;
    }
    
    // Check categories
    if (filters.categories && filters.categories.length > 0) {
      if (!opportunity.category || !filters.categories.includes(opportunity.category)) {
        return false;
      }
    }
    
    // Check keywords
    if (filters.keywords && filters.keywords.length > 0) {
      const content = `${opportunity.title} ${opportunity.description}`.toLowerCase();
      const hasKeyword = filters.keywords.some(keyword => 
        content.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }
    
    // Check exclude keywords
    if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
      const content = `${opportunity.title} ${opportunity.description}`.toLowerCase();
      const hasExcludeKeyword = filters.excludeKeywords.some(keyword => 
        content.includes(keyword.toLowerCase())
      );
      if (hasExcludeKeyword) return false;
    }
    
    return true;
  }
  
  private async applyRateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.config.rateLimitMs));
  }
  
  private shouldAbortOnError(error: Error): boolean {
    // Abort on critical errors
    const criticalErrorPatterns = [
      /net::ERR_INTERNET_DISCONNECTED/,
      /net::ERR_NAME_NOT_RESOLVED/,
      /Timeout/,
      /blocked/i,
    ];
    
    return criticalErrorPatterns.some(pattern => pattern.test(error.message));
  }
  
  private async updateCollectorStats(result: CollectorResult): Promise<void> {
    try {
      const duration = Date.now() - this.stats.startTime;
      
      // Get existing stats or create new ones
      const existingStats = await database.getCollectorStats(this.config.source);
      const existing = existingStats[0];
      
      const newStats: CollectorStats = {
        source: this.config.source,
        totalCollected: (existing?.totalCollected || 0) + result.opportunities.length,
        totalErrors: (existing?.totalErrors || 0) + this.stats.totalErrors,
        lastRun: new Date(),
        avgRunTime: existing 
          ? Math.round((existing.avgRunTime + duration) / 2)
          : duration,
        successRate: existing
          ? (existing.successRate + (result.success ? 1 : 0)) / 2
          : result.success ? 1 : 0,
      };
      
      await database.saveCollectorStats(newStats);
    } catch (error) {
      logger.error('Failed to update collector stats', { 
        source: this.config.source,
        error: error instanceof Error ? error.message : error 
      });
    }
  }
  
  // Retry wrapper for external API calls
  protected async withRetry<T>(
    operation: () => Promise<T>,
    options?: { retries?: number; onFailedAttempt?: (error: any) => void }
  ): Promise<T> {
    return pRetry(operation, {
      retries: options?.retries || this.config.retryAttempts,
      onFailedAttempt: options?.onFailedAttempt || ((error) => {
        logger.warn('Retry attempt failed', {
          source: this.config.source,
          attempt: error.attemptNumber,
          retriesLeft: error.retriesLeft,
          error: error.message,
        });
      }),
    });
  }
}