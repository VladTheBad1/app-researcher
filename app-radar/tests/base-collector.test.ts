import { describe, it, expect, beforeEach } from 'vitest';
import { Page } from 'playwright';
import { BaseCollector } from '../src/collectors/base-collector.js';
import type { AppOpportunity, CollectorConfig } from '../src/types/index.js';

// Mock collector implementation for testing
class MockCollector extends BaseCollector {
  private mockOpportunities: AppOpportunity[];
  private mockNextPageUrl: string | null;

  constructor(config: CollectorConfig, mockData?: { opportunities?: AppOpportunity[]; nextPageUrl?: string | null }) {
    super(config);
    this.mockOpportunities = mockData?.opportunities || [];
    this.mockNextPageUrl = mockData?.nextPageUrl || null;
  }

  getStartUrl(): string {
    return 'https://example.com/page1';
  }

  async extractOpportunities(page: Page): Promise<AppOpportunity[]> {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    return [...this.mockOpportunities];
  }

  async getNextPageUrl(page: Page): Promise<string | null> {
    return this.mockNextPageUrl;
  }

  isValidOpportunity(opportunity: Partial<AppOpportunity>): boolean {
    return !!(opportunity.title && opportunity.description && opportunity.url);
  }
}

describe('BaseCollector', () => {
  const mockConfig: CollectorConfig = {
    source: 'test-source',
    enabled: true,
    interval: 60,
    maxPages: 2,
    rateLimitMs: 100,
    retryAttempts: 2,
  };

  it('should create collector with valid configuration', () => {
    const collector = new MockCollector(mockConfig);
    expect(collector).toBeDefined();
  });

  it('should collect opportunities from single page', async () => {
    const mockOpportunities: AppOpportunity[] = [
      {
        id: 'test-1',
        title: 'Test App 1',
        description: 'A test application',
        url: 'https://example.com/app1',
        source: 'test-source' as any,
        tags: ['test'],
        metrics: { upvotes: 10 },
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
    ];

    const collector = new MockCollector(mockConfig, { opportunities: mockOpportunities });
    const result = await collector.collect();

    expect(result.success).toBe(true);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].title).toBe('Test App 1');
  });

  it('should collect from multiple pages', async () => {
    const mockOpportunities: AppOpportunity[] = [
      {
        id: 'test-1',
        title: 'Test App 1',
        description: 'A test application',
        url: 'https://example.com/app1',
        source: 'test-source' as any,
        tags: ['test'],
        metrics: { upvotes: 10 },
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
    ];

    const collector = new MockCollector(
      mockConfig,
      { 
        opportunities: mockOpportunities,
        nextPageUrl: 'https://example.com/page2'
      }
    );

    const result = await collector.collect();

    expect(result.success).toBe(true);
    expect(result.totalProcessed).toBeGreaterThan(0);
  });

  it('should respect maxPages limit', async () => {
    const configWithLimit: CollectorConfig = {
      ...mockConfig,
      maxPages: 1,
    };

    const mockOpportunities: AppOpportunity[] = [
      {
        id: 'test-1',
        title: 'Test App 1',
        description: 'A test application',
        url: 'https://example.com/app1',
        source: 'test-source' as any,
        tags: ['test'],
        metrics: { upvotes: 10 },
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
    ];

    const collector = new MockCollector(
      configWithLimit,
      { 
        opportunities: mockOpportunities,
        nextPageUrl: 'https://example.com/page2'
      }
    );

    const result = await collector.collect();

    expect(result.success).toBe(true);
    // Should only process one page despite having nextPageUrl
    expect(result.nextPageUrl).toBe('https://example.com/page2');
  });

  it('should filter opportunities by configuration', async () => {
    const configWithFilters: CollectorConfig = {
      ...mockConfig,
      filters: {
        minUpvotes: 50,
        keywords: ['productivity'],
      },
    };

    const mockOpportunities: AppOpportunity[] = [
      {
        id: 'test-1',
        title: 'Productivity App',
        description: 'A productivity application',
        url: 'https://example.com/app1',
        source: 'test-source' as any,
        tags: ['productivity'],
        metrics: { upvotes: 100 },
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
      {
        id: 'test-2',
        title: 'Gaming App',
        description: 'A gaming application',
        url: 'https://example.com/app2',
        source: 'test-source' as any,
        tags: ['gaming'],
        metrics: { upvotes: 30 },
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
    ];

    const collector = new MockCollector(configWithFilters, { opportunities: mockOpportunities });
    const result = await collector.collect();

    expect(result.success).toBe(true);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].title).toBe('Productivity App');
  });

  it('should handle invalid opportunities', async () => {
    const mockOpportunities: any[] = [
      {
        // Missing required fields
        id: 'invalid-1',
        title: 'Valid Title',
        // No description or URL
        source: 'test-source',
        tags: [],
        metrics: {},
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
      {
        id: 'valid-1',
        title: 'Valid App',
        description: 'A valid application',
        url: 'https://example.com/valid',
        source: 'test-source',
        tags: [],
        metrics: {},
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
    ];

    const collector = new MockCollector(mockConfig, { opportunities: mockOpportunities });
    const result = await collector.collect();

    expect(result.success).toBe(true);
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0].title).toBe('Valid App');
  });
});