import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Page } from 'playwright';
import { IndieHackersCollector } from '../../src/collectors/indiehackers.js';
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

describe('IndieHackersCollector', () => {
  let collector: IndieHackersCollector;
  let mockConfig: CollectorConfig;
  let mockPage: Page;

  beforeEach(() => {
    mockConfig = {
      source: 'indiehackers',
      enabled: true,
      interval: 60,
      maxPages: 3,
      rateLimitMs: 1000,
      retryAttempts: 3,
      filters: {
        minUpvotes: 10,
      },
    };

    collector = new IndieHackersCollector(mockConfig);

    // Mock page object
    mockPage = {
      url: vi.fn().mockReturnValue('https://www.indiehackers.com/products'),
      waitForTimeout: vi.fn(),
      setExtraHTTPHeaders: vi.fn(),
      route: vi.fn(),
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
    it('should return the IndieHackers products URL by default', () => {
      const url = collector.getStartUrl();
      expect(url).toBe('https://www.indiehackers.com/products');
    });
  });

  describe('isValidOpportunity', () => {
    it('should return true for opportunity with revenue data', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'SaaS Product',
        description: 'Making $10k MRR from this product',
        url: 'https://indiehackers.com/product/saas-product',
        metrics: {
          upvotes: 5,
          comments: 2,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(true);
    });

    it('should return true for opportunity with sufficient upvotes', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Popular Product',
        description: 'A product with good engagement',
        url: 'https://indiehackers.com/product/popular-product',
        metrics: {
          upvotes: 15,
          comments: 3,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(true);
    });

    it('should return true for opportunity with sufficient comments', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Discussion Product',
        description: 'A product generating discussion',
        url: 'https://indiehackers.com/product/discussion-product',
        metrics: {
          upvotes: 3,
          comments: 8,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(true);
    });

    it('should return true for opportunity with revenue keywords', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Revenue Product',
        description: 'This startup hit $50K ARR last year',
        url: 'https://indiehackers.com/product/revenue-product',
        metrics: {
          upvotes: 2,
          comments: 1,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(true);
    });

    it('should return false for opportunity without sufficient engagement or revenue data', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Low Engagement Product',
        description: 'A product with minimal engagement',
        url: 'https://indiehackers.com/product/low-product',
        metrics: {
          upvotes: 2,
          comments: 1,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(false);
    });

    it('should return false for opportunity without required fields', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: '',
        description: 'A product description',
        url: 'https://indiehackers.com/product/test',
        metrics: {
          upvotes: 15,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(false);
    });
  });

  describe('getNextPageUrl', () => {
    beforeEach(() => {
      mockPage.url.mockReturnValue('https://www.indiehackers.com/products');
    });

    it('should return null when no next button is found and page limit reached', async () => {
      mockPage.$.mockResolvedValue(null);
      // Set current page high to simulate limit reached
      (collector as any).currentPage = 11;
      // Make sure we're not on interviews page to avoid switching
      (collector as any).currentUrl = 'https://www.indiehackers.com/interviews';

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBeNull();
    });

    it('should return URL from next button href', async () => {
      const mockButton = {
        getAttribute: vi.fn().mockResolvedValue('/products?page=2'),
        evaluate: vi.fn().mockResolvedValue(false),
      };
      mockPage.$.mockResolvedValue(mockButton);

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBe('https://www.indiehackers.com/products?page=2');
    });

    it('should handle pagination with page numbers', async () => {
      mockPage.$.mockResolvedValueOnce(null); // No next button
      mockPage.$.mockResolvedValueOnce({}); // Has page number link

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBe('https://www.indiehackers.com/products?page=2');
    });

    it('should handle button clicks for load more functionality', async () => {
      const mockButton = {
        getAttribute: vi.fn().mockResolvedValue(null),
        evaluate: vi.fn().mockResolvedValue(true),
        click: vi.fn(),
      };
      mockPage.$.mockResolvedValue(mockButton);

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(mockButton.click).toHaveBeenCalled();
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(3000);
      expect(nextUrl).toBe('https://www.indiehackers.com/products');
    });

    it('should switch from products to interviews when products section is done', async () => {
      mockPage.$.mockResolvedValue(null);
      mockPage.url.mockReturnValue('https://www.indiehackers.com/products');
      // Set current page high to simulate products section done
      (collector as any).currentPage = 11;

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBe('https://www.indiehackers.com/interviews');
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

  describe('extractOpportunities', () => {
    beforeEach(() => {
      // Mock route for resource blocking
      mockPage.route.mockImplementation((pattern, handler) => {
        // Simulate route setup
      });
    });

    it('should extract product opportunities from products page', async () => {
      mockPage.url.mockReturnValue('https://www.indiehackers.com/products');
      
      // Mock waitForContent to return true
      vi.spyOn(collector as any, 'waitForContent').mockResolvedValue(true);
      
      // Mock extractProducts to return sample products
      vi.spyOn(collector as any, 'extractProducts').mockResolvedValue([
        {
          title: 'High Revenue SaaS',
          description: 'A SaaS product making good money',
          url: 'https://indiehackers.com/product/high-revenue-saas',
          revenue: '$10k',
          mrr: 10000,
          upvotes: 25,
          comments: 15,
          founder: 'John Doe',
          categories: ['SaaS'],
          tags: ['B2B'],
          milestones: ['Hit $10k MRR'],
          createdAt: new Date('2023-01-15'),
        },
      ]);

      const opportunities = await collector.extractOpportunities(mockPage);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].title).toBe('High Revenue SaaS');
      expect(opportunities[0].source).toBe('indiehackers');
      expect(opportunities[0].description).toContain('MRR: $10,000');
      expect(opportunities[0].tags).toContain('revenue-data');
    });

    it('should extract interview opportunities from interviews page', async () => {
      mockPage.url.mockReturnValue('https://www.indiehackers.com/interviews');
      
      // Mock waitForContent to return true
      vi.spyOn(collector as any, 'waitForContent').mockResolvedValue(true);
      
      // Mock extractInterviews to return sample interviews
      vi.spyOn(collector as any, 'extractInterviews').mockResolvedValue([
        {
          title: 'How I Built a $50k MRR Business',
          description: 'Founder story about building a successful business',
          url: 'https://indiehackers.com/interview/success-story',
          mrr: 50000,
          founder: 'Jane Smith',
          categories: ['Interview'],
          tags: ['founder-story'],
          milestones: ['Reached $50k MRR'],
          createdAt: new Date('2023-01-15'),
        },
      ]);

      const opportunities = await collector.extractOpportunities(mockPage);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].title).toBe('How I Built a $50k MRR Business');
      expect(opportunities[0].category).toBe('Interview');
      expect(opportunities[0].tags).toContain('interview');
      expect(opportunities[0].description).toContain('MRR: $50,000');
    });

    it('should handle pages with no content', async () => {
      mockPage.url.mockReturnValue('https://www.indiehackers.com/products');
      vi.spyOn(collector as any, 'waitForContent').mockResolvedValue(false);

      const opportunities = await collector.extractOpportunities(mockPage);

      expect(opportunities).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith('No products found on page', {
        url: expect.any(String),
      });
    });

    it('should handle extraction errors gracefully', async () => {
      mockPage.url.mockReturnValue('https://www.indiehackers.com/products');
      vi.spyOn(collector as any, 'waitForContent').mockRejectedValue(new Error('Network error'));

      const opportunities = await collector.extractOpportunities(mockPage);

      expect(opportunities).toHaveLength(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to extract product opportunities from IndieHackers',
        expect.objectContaining({
          error: 'Network error',
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
        title: 'Test SaaS',
        description: 'A test SaaS product',
        url: 'https://indiehackers.com/product/test-saas',
        revenue: '$5k',
        mrr: 5000,
        upvotes: 20,
        comments: 10,
        founder: 'Test Founder',
        categories: ['SaaS'],
        tags: ['test'],
        milestones: ['Launched'],
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
      vi.spyOn(collector as any, 'extractTextFromSelectors').mockImplementation((_page, _element, selectors) => {
        const selectorString = JSON.stringify(selectors);
        if (selectorString.includes('title') || selectorString.includes('h3 a')) return Promise.resolve('Test SaaS Product');
        if (selectorString.includes('description') || selectorString.includes('tagline') || selectorString.includes('.summary')) return Promise.resolve('A great SaaS making $10k MRR');
        if (selectorString.includes('founder') || selectorString.includes('maker')) return Promise.resolve('John Doe');
        return Promise.resolve(null);
      });

      vi.spyOn(collector as any, 'extractHrefFromSelectors').mockResolvedValue('/product/test-saas');
      vi.spyOn(collector as any, 'extractNumberFromSelectors').mockImplementation((_page, _element, selectors) => {
        if (selectors.some(s => s.includes('vote') || s.includes('like'))) return Promise.resolve(25);
        if (selectors.some(s => s.includes('comment'))) return Promise.resolve(10);
        return Promise.resolve(0);
      });

      // Mock revenue extraction
      vi.spyOn(collector as any, 'extractRevenueData').mockResolvedValue({
        revenue: '$10k',
        mrr: 10000,
      });

      // Mock milestones extraction
      vi.spyOn(collector as any, 'extractMilestones').mockReturnValue(['Hit $10k MRR']);

      mockElement.$$.mockResolvedValue([
        { textContent: vi.fn().mockResolvedValue('SaaS') },
        { textContent: vi.fn().mockResolvedValue('B2B') },
      ]);
    });

    it('should extract complete product data', async () => {
      const product = await (collector as any).extractProductData(mockPage, mockElement);

      expect(product).toEqual(expect.objectContaining({
        title: 'Test SaaS Product',
        description: 'A great SaaS making $10k MRR',
        url: 'https://www.indiehackers.com/product/test-saas',
        revenue: '$10k',
        mrr: 10000,
        upvotes: 25,
        comments: 10,
        founder: 'John Doe',
        categories: expect.any(Array),
        tags: expect.any(Array),
        milestones: ['Hit $10k MRR'],
        createdAt: expect.any(Date),
      }));
    });

    it('should return null when title cannot be extracted', async () => {
      vi.spyOn(collector as any, 'extractTextFromSelectors').mockImplementation((_page, _element, selectors) => {
        if (selectors.some(s => s.includes('title') || s.includes('h3 a'))) return Promise.resolve(null);
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

  describe('parseRevenueText', () => {
    it('should parse MRR from text', () => {
      const text = 'Our SaaS is making $5,000/month in MRR';
      const result = (collector as any).parseRevenueText(text);
      
      expect(result.mrr).toBe(5000);
    });

    it('should parse ARR from text', () => {
      const text = 'We hit $100,000 ARR last year';
      const result = (collector as any).parseRevenueText(text);
      
      expect(result.arr).toBe(100000);
    });

    it('should parse general revenue from text', () => {
      const text = 'Making $25,000 in revenue monthly';
      const result = (collector as any).parseRevenueText(text);
      
      expect(result.revenue).toBe('$25,000');
    });

    it('should parse K notation', () => {
      const text = 'Earning $50K/mo from this project';
      const result = (collector as any).parseRevenueText(text);
      
      expect(result.mrr).toBe(50);
    });

    it('should return empty object for text without revenue', () => {
      const text = 'Just a regular product description';
      const result = (collector as any).parseRevenueText(text);
      
      expect(result).toEqual({});
    });
  });

  describe('extractMilestones', () => {
    it('should extract revenue milestones', () => {
      const text = 'We reached $10,000 and then hit $100,000 in revenue';
      const milestones = (collector as any).extractMilestones(text);
      
      expect(milestones).toContain('reached $10,000');
      expect(milestones).toContain('$100,000 in revenue');
    });

    it('should extract launch milestones', () => {
      const text = 'launched the product and acquired our first customers';
      const milestones = (collector as any).extractMilestones(text);
      
      expect(milestones.length).toBeGreaterThan(0);
      expect(milestones.some(m => m.includes('launched'))).toBe(true);
      expect(milestones.some(m => m.includes('acquired'))).toBe(true);
    });

    it('should limit milestones to 3', () => {
      const text = 'launched product, hit $1k MRR, reached $5k MRR, acquired customers, raised funding';
      const milestones = (collector as any).extractMilestones(text);
      
      expect(milestones).toHaveLength(3);
    });

    it('should return empty array for text without milestones', () => {
      const text = 'Just a regular description without achievements';
      const milestones = (collector as any).extractMilestones(text);
      
      expect(milestones).toHaveLength(0);
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
      let callCount = 0;
      mockWithBrowser.mockImplementation(async (_sessionId, callback) => {
        callCount++;
        return callback(mockPage);
      });

      // Mock page content  
      mockPage.url.mockReturnValue('https://www.indiehackers.com/products');
      vi.spyOn(collector as any, 'extractOpportunities').mockResolvedValue([
        {
          id: expect.any(String),
          title: 'Successful SaaS',
          description: 'A successful SaaS product making money | Revenue: $25k | MRR: $25,000 | Founder: Jane Doe',
          url: 'https://indiehackers.com/product/successful-saas',
          source: 'indiehackers',
          category: 'SaaS',
          tags: ['B2B', 'SaaS', 'Hit $25k MRR', 'revenue-data', 'mrr-25k'],
          metrics: {
            upvotes: 50,
            comments: 30,
          },
          createdAt: expect.any(Date),
          discoveredAt: expect.any(Date),
          lastUpdated: expect.any(Date),
          status: 'discovered',
        },
      ]);

      const result = await collector.collect();

      expect(result.success).toBe(true);
      expect(result.opportunities).toHaveLength(1);
      expect(result.totalProcessed).toBe(1);
      expect(database.saveOpportunities).toHaveBeenCalledWith(result.opportunities);
      expect(result.opportunities[0].tags).toContain('revenue-data');
      expect(result.opportunities[0].description).toContain('Revenue: $25k');
    });
  });
});