import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Page } from 'playwright';
import { ProductHuntCollector } from '../../src/collectors/producthunt.js';
import { browserManager } from '../../src/utils/browser.js';
import { database } from '../../src/database/index.js';
import logger from '../../src/utils/logger.js';
import type { CollectorConfig, AppOpportunity } from '../../src/types/index.js';

// Mock dependencies
vi.mock('../../src/utils/browser.js', () => ({
  browserManager: {
    initialize: vi.fn(),
    createPage: vi.fn(),
    navigateWithRetry: vi.fn(),
    randomScroll: vi.fn(),
    closeContext: vi.fn(),
  },
  withBrowser: vi.fn(),
  extractText: vi.fn(),
  extractAttribute: vi.fn(),
  waitForSelectorSafe: vi.fn(),
}));

vi.mock('../../src/database/index.js', () => ({
  database: {
    saveOpportunities: vi.fn(),
    getCollectorStats: vi.fn(),
    saveCollectorStats: vi.fn(),
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logCollectorStart: vi.fn(),
  logCollectorComplete: vi.fn(),
  logCollectorError: vi.fn(),
}));

describe('ProductHuntCollector', () => {
  let collector: ProductHuntCollector;
  let mockConfig: CollectorConfig;
  let mockPage: Page;

  beforeEach(() => {
    mockConfig = {
      source: 'producthunt',
      enabled: true,
      interval: 60,
      maxPages: 3,
      rateLimitMs: 1000,
      retryAttempts: 3,
      filters: {
        minUpvotes: 100,
      },
    };

    collector = new ProductHuntCollector(mockConfig);

    // Mock page object
    mockPage = {
      url: vi.fn().mockReturnValue('https://www.producthunt.com/topics/tech'),
      waitForTimeout: vi.fn(),
      setExtraHTTPHeaders: vi.fn(),
      mouse: {
        move: vi.fn(),
      },
      evaluate: vi.fn(),
      $$: vi.fn(),
      $: vi.fn(),
      goto: vi.fn(),
      waitForSelector: vi.fn(),
      context: vi.fn().mockReturnValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn(),
          getAttribute: vi.fn(),
          close: vi.fn(),
        }),
      }),
      close: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getStartUrl', () => {
    it('should return the Product Hunt tech topics URL', () => {
      const url = collector.getStartUrl();
      expect(url).toBe('https://www.producthunt.com/topics/tech');
    });
  });

  describe('isValidOpportunity', () => {
    it('should return true for valid opportunity with 100+ upvotes', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Test Product',
        description: 'A great test product',
        url: 'https://producthunt.com/posts/test-product',
        metrics: {
          upvotes: 150,
          comments: 25,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(true);
    });

    it('should return false for opportunity with less than 100 upvotes', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Test Product',
        description: 'A test product',
        url: 'https://producthunt.com/posts/test-product',
        metrics: {
          upvotes: 50,
          comments: 25,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(false);
    });

    it('should return false for opportunity without required fields', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: '',
        description: 'A test product',
        url: 'https://producthunt.com/posts/test-product',
        metrics: {
          upvotes: 150,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(false);
    });

    it('should return false for opportunity without upvotes', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Test Product',
        description: 'A test product',
        url: 'https://producthunt.com/posts/test-product',
        metrics: {},
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(false);
    });
  });

  describe('extractOpportunities', () => {
    beforeEach(() => {
      // Mock waitForContent to return true
      vi.spyOn(collector as any, 'waitForContent').mockResolvedValue(true);
      
      // Mock extractProducts to return sample products
      vi.spyOn(collector as any, 'extractProducts').mockResolvedValue([
        {
          title: 'High Value Product',
          tagline: 'An amazing product',
          description: 'An amazing product with great features',
          url: 'https://producthunt.com/posts/high-value-product',
          websiteUrl: 'https://highvalue.com',
          upvotes: 250,
          comments: 45,
          makers: ['John Doe', 'Jane Smith'],
          categories: ['Productivity'],
          tags: ['AI', 'SaaS'],
          createdAt: new Date('2023-01-15'),
        },
        {
          title: 'Low Value Product',
          tagline: 'A basic product',
          description: 'A basic product with limited features',
          url: 'https://producthunt.com/posts/low-value-product',
          websiteUrl: 'https://lowvalue.com',
          upvotes: 50,
          comments: 10,
          makers: ['Bob Wilson'],
          categories: ['Tools'],
          tags: ['Utility'],
          createdAt: new Date('2023-01-15'),
        },
      ]);
    });

    it('should extract high-value opportunities (100+ upvotes)', async () => {
      const opportunities = await collector.extractOpportunities(mockPage);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].title).toBe('High Value Product');
      expect(opportunities[0].metrics.upvotes).toBe(250);
      expect(opportunities[0].source).toBe('producthunt');
    });

    it('should handle pages with no products', async () => {
      vi.spyOn(collector as any, 'waitForContent').mockResolvedValue(false);

      const opportunities = await collector.extractOpportunities(mockPage);

      expect(opportunities).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith('No products found on page', {
        url: expect.any(String),
      });
    });

    it('should handle extraction errors gracefully', async () => {
      vi.spyOn(collector as any, 'waitForContent').mockRejectedValue(new Error('Network error'));

      const opportunities = await collector.extractOpportunities(mockPage);

      expect(opportunities).toHaveLength(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to extract opportunities from Product Hunt',
        expect.objectContaining({
          error: 'Network error',
        })
      );
    });
  });

  describe('getNextPageUrl', () => {
    beforeEach(() => {
      mockPage.url.mockReturnValue('https://www.producthunt.com/2023/01/15');
    });

    it('should return null when no next button is found', async () => {
      mockPage.$.mockResolvedValue(null);
      // Don't set URL to a date-based format to avoid date-based navigation
      mockPage.url.mockReturnValue('https://www.producthunt.com/topics/tech');

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBeNull();
    });

    it('should return URL from next button href', async () => {
      const mockButton = {
        getAttribute: vi.fn().mockResolvedValue('/2023/01/14'),
        evaluate: vi.fn().mockResolvedValue(false),
      };
      mockPage.$.mockResolvedValue(mockButton);

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBe('https://www.producthunt.com/2023/01/14');
    });

    it('should handle date-based navigation for previous day', async () => {
      mockPage.$.mockResolvedValue(null);
      mockPage.url.mockReturnValue('https://www.producthunt.com/2023/01/15');

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBe('https://www.producthunt.com/2023/01/14');
    });

    it('should handle button clicks for load more functionality', async () => {
      const mockButton = {
        getAttribute: vi.fn().mockResolvedValue(null),
        evaluate: vi.fn().mockResolvedValue(true),
        click: vi.fn(),
      };
      mockPage.$.mockResolvedValue(mockButton);
      // Don't use date-based URL for this test
      mockPage.url.mockReturnValue('https://www.producthunt.com/topics/tech');

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(mockButton.click).toHaveBeenCalled();
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(2000);
      expect(nextUrl).toBe('https://www.producthunt.com/topics/tech');
    });

    it('should handle errors gracefully', async () => {
      mockPage.$.mockRejectedValue(new Error('DOM error'));

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error finding next page URL',
        expect.objectContaining({
          error: 'DOM error',
        })
      );
    });
  });

  describe('extractProducts', () => {
    it('should extract products using multiple selectors', async () => {
      const mockElements = [
        {
          $: vi.fn(),
          $$: vi.fn().mockResolvedValue([]),
          textContent: vi.fn(),
          getAttribute: vi.fn(),
        },
        {
          $: vi.fn(),
          $$: vi.fn().mockResolvedValue([]),
          textContent: vi.fn(),
          getAttribute: vi.fn(),
        },
      ];

      mockPage.$$.mockResolvedValue(mockElements);

      // Mock extractProductData to return a product for each element
      vi.spyOn(collector as any, 'extractProductData').mockResolvedValue({
        title: 'Test Product',
        tagline: 'A test product',
        description: 'A test product description',
        url: 'https://producthunt.com/posts/test-product',
        websiteUrl: 'https://testproduct.com',
        upvotes: 150,
        comments: 25,
        makers: ['Test Maker'],
        categories: ['Test Category'],
        tags: ['test'],
        createdAt: new Date(),
      });

      const products = await (collector as any).extractProducts(mockPage);

      expect(products).toHaveLength(2);
      expect(mockPage.$$).toHaveBeenCalled();
    });

    it('should handle cases where no product elements are found', async () => {
      mockPage.$$.mockResolvedValue([]);

      const products = await (collector as any).extractProducts(mockPage);

      expect(products).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith('No product elements found with any selector');
    });
  });

  describe('extractProductData', () => {
    let mockElement: any;

    beforeEach(() => {
      mockElement = {
        $: vi.fn(),
        $$: vi.fn(),
      };

      // Mock the various extract methods
      vi.spyOn(collector as any, 'extractTextFromSelectors').mockImplementation((page, element, selectors) => {
        if (selectors.includes('h3 a')) return Promise.resolve('Test Product');
        if (selectors.includes('[class*="tagline"]')) return Promise.resolve('A great product');
        return Promise.resolve(null);
      });

      vi.spyOn(collector as any, 'extractHrefFromSelectors').mockResolvedValue('/posts/test-product');
      vi.spyOn(collector as any, 'extractNumberFromSelectors').mockImplementation((page, element, selectors) => {
        if (selectors.some(s => s.includes('vote'))) return Promise.resolve(150);
        if (selectors.some(s => s.includes('comment'))) return Promise.resolve(25);
        return Promise.resolve(0);
      });

      mockElement.$$.mockResolvedValue([
        { textContent: vi.fn().mockResolvedValue('Maker 1') },
        { textContent: vi.fn().mockResolvedValue('Tag 1') },
      ]);
    });

    it('should extract complete product data', async () => {
      const product = await (collector as any).extractProductData(mockPage, mockElement);

      expect(product).toEqual(expect.objectContaining({
        title: 'Test Product',
        tagline: 'A great product',
        description: 'A great product',
        url: 'https://www.producthunt.com/posts/test-product',
        upvotes: 150,
        comments: 25,
        makers: expect.any(Array),
        categories: expect.any(Array),
        tags: expect.any(Array),
        createdAt: expect.any(Date),
      }));
    });

    it('should return null when title cannot be extracted', async () => {
      vi.spyOn(collector as any, 'extractTextFromSelectors').mockImplementation((page, element, selectors) => {
        if (selectors.includes('h3 a')) return Promise.resolve(null);
        return Promise.resolve('Some text');
      });

      const product = await (collector as any).extractProductData(mockPage, mockElement);

      expect(product).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('No title found for product');
    });

    it('should handle extraction errors gracefully', async () => {
      vi.spyOn(collector as any, 'extractTextFromSelectors').mockRejectedValue(new Error('Extraction error'));

      const product = await (collector as any).extractProductData(mockPage, mockElement);

      expect(product).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to extract product data',
        expect.objectContaining({
          error: 'Extraction error',
        })
      );
    });
  });

  describe('simulateHumanBehavior', () => {
    beforeEach(() => {
      mockPage.$$.mockResolvedValue([
        { hover: vi.fn() },
        { hover: vi.fn() },
      ]);
    });

    it('should simulate mouse movements and scrolling', async () => {
      await (collector as any).simulateHumanBehavior(mockPage);

      expect(mockPage.mouse.move).toHaveBeenCalled();
      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockPage.waitForTimeout).toHaveBeenCalled();
    });

    it('should handle errors during simulation gracefully', async () => {
      mockPage.mouse.move.mockRejectedValue(new Error('Mouse error'));

      await expect((collector as any).simulateHumanBehavior(mockPage)).resolves.not.toThrow();

      expect(logger.debug).toHaveBeenCalledWith(
        'Error simulating human behavior',
        expect.objectContaining({
          error: 'Mouse error',
        })
      );
    });
  });

  describe('integration', () => {
    it('should complete a full collection cycle', async () => {
      // Mock all dependencies for a successful collection
      vi.mocked(database.getCollectorStats).mockResolvedValue([]);
      vi.mocked(database.saveOpportunities).mockResolvedValue(undefined);
      vi.mocked(database.saveCollectorStats).mockResolvedValue(undefined);

      // Mock the browser utilities
      const mockWithBrowser = vi.mocked(await import('../../src/utils/browser.js')).withBrowser;
      mockWithBrowser.mockImplementation(async (sessionId, callback) => {
        return callback(mockPage);
      });

      // Mock page content
      vi.spyOn(collector as any, 'waitForContent').mockResolvedValue(true);
      vi.spyOn(collector as any, 'extractProducts').mockResolvedValue([
        {
          title: 'High Value Product',
          tagline: 'An amazing product',
          description: 'An amazing product with great features',
          url: 'https://producthunt.com/posts/high-value-product',
          websiteUrl: 'https://highvalue.com',
          upvotes: 250,
          comments: 45,
          makers: ['John Doe'],
          categories: ['Productivity'],
          tags: ['AI'],
          createdAt: new Date(),
        },
      ]);

      const result = await collector.collect();

      expect(result.success).toBe(true);
      expect(result.opportunities).toHaveLength(1);
      expect(result.totalProcessed).toBe(1);
      expect(database.saveOpportunities).toHaveBeenCalledWith(result.opportunities);
    });
  });
});