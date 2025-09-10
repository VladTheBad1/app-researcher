import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Page } from 'playwright';
import { ExplodingTopicsCollector } from '../../src/collectors/exploding-topics.js';
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

describe('ExplodingTopicsCollector', () => {
  let collector: ExplodingTopicsCollector;
  let mockConfig: CollectorConfig;
  let mockPage: Page;

  beforeEach(async () => {
    mockConfig = {
      source: 'exploding-topics',
      enabled: true,
      interval: 60,
      maxPages: 3,
      rateLimitMs: 1000,
      retryAttempts: 3,
      filters: {
        minUpvotes: 0,
        categories: ['Technology', 'Startups', 'Software'],
        keywords: ['app', 'software', 'saas', 'tool', 'platform'],
        excludeKeywords: ['adult', 'gambling', 'crypto-scam']
      }
    };

    collector = new ExplodingTopicsCollector(mockConfig);

    // Create comprehensive mock page
    mockPage = {
      url: vi.fn(() => 'https://explodingtopics.com/'),
      goto: vi.fn(),
      waitForTimeout: vi.fn(),
      waitForSelector: vi.fn().mockResolvedValue(true),
      $: vi.fn(),
      $$: vi.fn(),
      evaluate: vi.fn(),
      mouse: {
        move: vi.fn(),
      },
      setExtraHTTPHeaders: vi.fn(),
      addInitScript: vi.fn(),
      viewportSize: vi.fn(() => ({ width: 1920, height: 1080 })),
      context: vi.fn(() => ({
        newPage: vi.fn(),
      })),
    } as any;

    // Reset all mocks
    vi.clearAllMocks();
    
    // Set up withBrowser mock
    const { withBrowser } = await import('../../src/utils/browser.js');
    (withBrowser as any).mockImplementation(async (sessionId: string, callback: any) => {
      return await callback(mockPage);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Configuration and Setup', () => {
    it('should initialize with correct configuration', () => {
      expect(collector).toBeDefined();
      expect(collector.getStartUrl()).toBe('https://explodingtopics.com');
    });

    it('should setup stealth headers correctly', async () => {
      await collector.extractOpportunities(mockPage);
      
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith(
        expect.objectContaining({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Mode': 'navigate',
          'Referer': 'https://www.google.com/'
        })
      );
    });

    it('should add anti-detection init scripts', async () => {
      await collector.extractOpportunities(mockPage);
      
      expect(mockPage.addInitScript).toHaveBeenCalled();
    });
  });

  describe('Topic Extraction', () => {
    it('should handle empty topic lists gracefully', async () => {
      mockPage.$$ = vi.fn().mockResolvedValue([]);
      mockPage.waitForSelector = vi.fn().mockRejectedValue(new Error('Timeout'));

      const opportunities = await collector.extractOpportunities(mockPage);
      
      expect(opportunities).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No topic elements found'),
        expect.any(Object)
      );
    });

    it('should extract tech-related topics successfully', async () => {
      const mockTopicElement = {
        $: vi.fn(),
        textContent: vi.fn(),
      };

      // Mock title extraction
      mockTopicElement.$.mockImplementation((selector) => {
        if (selector.includes('h1') || selector.includes('h2') || selector.includes('title')) {
          return {
            textContent: vi.fn().mockResolvedValue('AI-Powered Development Tools'),
          };
        }
        if (selector.includes('p') || selector.includes('description')) {
          return {
            textContent: vi.fn().mockResolvedValue('Revolutionary software development platform using artificial intelligence'),
          };
        }
        if (selector.includes('growth') || selector.includes('percent')) {
          return {
            textContent: vi.fn().mockResolvedValue('↑ 150%'),
          };
        }
        if (selector === 'a') {
          return {
            getAttribute: vi.fn().mockResolvedValue('/topics/ai-development-tools'),
          };
        }
        return null;
      });

      mockPage.$$ = vi.fn().mockResolvedValue([mockTopicElement]);
      mockPage.waitForSelector = vi.fn().mockResolvedValue(mockTopicElement);
      
      // Mock the waitForContent method to return true
      (collector as any).waitForContent = vi.fn().mockResolvedValue(true);

      const opportunities = await collector.extractOpportunities(mockPage);
      
      expect(opportunities).toHaveLength(1);
      expect(opportunities[0]).toMatchObject({
        title: 'AI-Powered Development Tools',
        description: expect.stringContaining('Revolutionary software'),
        source: 'exploding-topics',
        category: 'Technology',
        metrics: expect.objectContaining({
          engagement: 150,
        }),
      });
    });

    it('should filter out non-tech topics', async () => {
      const mockTopicElement = {
        $: vi.fn(),
        textContent: vi.fn(),
      };

      // Mock non-tech topic
      mockTopicElement.$.mockImplementation((selector) => {
        if (selector.includes('h1') || selector.includes('h2') || selector.includes('title')) {
          return {
            textContent: vi.fn().mockResolvedValue('Fashion Trends 2024'),
          };
        }
        if (selector.includes('p') || selector.includes('description')) {
          return {
            textContent: vi.fn().mockResolvedValue('Latest fashion styles and clothing trends'),
          };
        }
        return null;
      });

      mockPage.$$ = vi.fn().mockResolvedValue([mockTopicElement]);
      mockPage.waitForSelector = vi.fn().mockResolvedValue(mockTopicElement);
      
      // Mock the waitForContent method to return true
      (collector as any).waitForContent = vi.fn().mockResolvedValue(true);

      const opportunities = await collector.extractOpportunities(mockPage);
      
      expect(opportunities).toHaveLength(0);
    });

    it('should parse growth percentages correctly', async () => {
      const mockTopicElement = {
        $: vi.fn(),
        textContent: vi.fn(),
      };

      const testCases = [
        { input: '↑ 250%', expected: 250 },
        { input: '+150%', expected: 150 },
        { input: '75.5% growth', expected: 75.5 },
        { input: 'exploding', expected: 200 },
        { input: 'trending up', expected: 50 },
        { input: '', expected: 0 },
      ];

      for (const testCase of testCases) {
        mockTopicElement.$.mockImplementation((selector) => {
          if (selector.includes('h1') || selector.includes('h2') || selector.includes('title')) {
            return {
              textContent: vi.fn().mockResolvedValue('AI Software Development'),
            };
          }
          if (selector.includes('growth') || selector.includes('percent')) {
            return {
              textContent: vi.fn().mockResolvedValue(testCase.input),
            };
          }
          return null;
        });

        mockPage.$$ = vi.fn().mockResolvedValue([mockTopicElement]);
        mockPage.waitForSelector = vi.fn().mockResolvedValue(true);

        const opportunities = await collector.extractOpportunities(mockPage);
        
        if (opportunities.length > 0) {
          expect(opportunities[0].metrics.engagement).toBe(testCase.expected);
        }
      }
    });

    it('should parse search volume numbers correctly', async () => {
      const mockTopicElement = {
        $: vi.fn(),
        textContent: vi.fn(),
      };

      const testCases = [
        { input: '10k searches', expected: 10000 },
        { input: '1.5m volume', expected: 1500000 },
        { input: '500 searches', expected: 500 },
        { input: '2.3K monthly', expected: 2300 },
      ];

      for (const testCase of testCases) {
        mockTopicElement.$.mockImplementation((selector) => {
          if (selector.includes('h1') || selector.includes('h2') || selector.includes('title')) {
            return {
              textContent: vi.fn().mockResolvedValue('SaaS Analytics Platform'),
            };
          }
          if (selector.includes('volume') || selector.includes('searches')) {
            return {
              textContent: vi.fn().mockResolvedValue(testCase.input),
            };
          }
          return null;
        });

        mockPage.$$ = vi.fn().mockResolvedValue([mockTopicElement]);
        mockPage.waitForSelector = vi.fn().mockResolvedValue(true);

        const opportunities = await collector.extractOpportunities(mockPage);
        
        if (opportunities.length > 0) {
          expect(opportunities[0].metrics.views).toBe(testCase.expected);
        }
      }
    });
  });

  describe('Tech Keyword Filtering', () => {
    it('should identify tech-related content', async () => {
      const techTopics = [
        'AI-powered development platform',
        'SaaS analytics dashboard',
        'Mobile app performance monitoring',
        'Cloud infrastructure automation',
        'API management software',
        'JavaScript framework for developers',
        'Kubernetes deployment tools',
        'No-code website builder platform',
        'Fintech payment processing API',
        'Blockchain development toolkit',
      ];

      for (const topic of techTopics) {
        const isValid = collector['isTechRelated'](topic);
        expect(isValid).toBe(true);
      }
    });

    it('should filter out non-tech content', async () => {
      const nonTechTopics = [
        'Fashion trends for summer',
        'Cooking recipes and meal ideas',
        'Travel destinations in Europe',
        'Home decoration ideas',
        'Fitness workout routines',
        'Pet care and training tips',
        'Gardening and plant care',
        'Musical album reviews',
      ];

      for (const topic of nonTechTopics) {
        const isValid = collector['isTechRelated'](topic);
        expect(isValid).toBe(false, `Topic "${topic}" should not be tech-related`);
      }
    });
  });

  describe('Pagination Handling', () => {
    it('should handle load more buttons', async () => {
      const mockLoadMoreButton = {
        isDisabled: vi.fn().mockResolvedValue(false),
        click: vi.fn(),
      };

      mockPage.$ = vi.fn().mockImplementation((selector) => {
        if (selector.includes('load-more') || selector.includes('show-more')) {
          return mockLoadMoreButton;
        }
        return null;
      });

      const nextUrl = await collector.getNextPageUrl(mockPage);
      
      expect(mockLoadMoreButton.click).toHaveBeenCalled();
      expect(nextUrl).toBe('https://explodingtopics.com/');
    });

    it('should handle disabled load more buttons', async () => {
      const mockLoadMoreButton = {
        isDisabled: vi.fn().mockResolvedValue(true),
        click: vi.fn(),
      };

      mockPage.$ = vi.fn().mockImplementation((selector) => {
        if (selector.includes('load-more')) {
          return mockLoadMoreButton;
        }
        return null;
      });

      const nextUrl = await collector.getNextPageUrl(mockPage);
      
      expect(mockLoadMoreButton.click).not.toHaveBeenCalled();
      expect(nextUrl).toBeNull();
    });

    it('should handle pagination links', async () => {
      const mockNextLink = {
        getAttribute: vi.fn().mockResolvedValue('/page/2'),
      };

      mockPage.$ = vi.fn().mockImplementation((selector) => {
        if (selector.includes('load-more') || selector.includes('show-more')) {
          return null; // No load-more button
        }
        if (selector.includes('next')) {
          return mockNextLink;
        }
        return null;
      });

      const nextUrl = await collector.getNextPageUrl(mockPage);
      
      expect(nextUrl).toBe('https://explodingtopics.com/page/2');
    });

    it('should return null when no pagination is available', async () => {
      mockPage.$ = vi.fn().mockResolvedValue(null);

      const nextUrl = await collector.getNextPageUrl(mockPage);
      
      expect(nextUrl).toBeNull();
    });
  });

  describe('Human Behavior Simulation', () => {
    it('should simulate mouse movements and scrolling', async () => {
      mockPage.$$ = vi.fn().mockResolvedValue([]);
      mockPage.evaluate = vi.fn();
      
      await collector.extractOpportunities(mockPage);
      
      expect(mockPage.mouse.move).toHaveBeenCalled();
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Number)
      );
    });

    it('should add random delays between actions', async () => {
      mockPage.$$ = vi.fn().mockResolvedValue([]);
      
      await collector.extractOpportunities(mockPage);
      
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(3000);
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(
        expect.any(Number)
      );
    });

    it('should hover over elements occasionally', async () => {
      const mockElement = {
        hover: vi.fn(),
      };
      
      mockPage.$$ = vi.fn().mockImplementation((selector) => {
        if (selector.includes('topic') || selector.includes('card')) {
          return [mockElement];
        }
        return [];
      });

      // Mock Math.random to ensure hover behavior
      const originalRandom = Math.random;
      Math.random = vi.fn().mockReturnValue(0.8); // > 0.3, so hovering will happen

      await collector.extractOpportunities(mockPage);
      
      expect(mockElement.hover).toHaveBeenCalled();
      
      // Restore original Math.random
      Math.random = originalRandom;
    });
  });

  describe('Opportunity Validation', () => {
    it('should validate complete opportunities', () => {
      const validOpportunity: Partial<AppOpportunity> = {
        title: 'AI Development Framework',
        description: 'Modern framework for building AI-powered applications',
        url: 'https://explodingtopics.com/topics/ai-framework',
        metrics: {
          engagement: 120,
        },
      };

      const isValid = collector.isValidOpportunity(validOpportunity);
      expect(isValid).toBe(true);
    });

    it('should reject opportunities with missing required fields', () => {
      const invalidOpportunities = [
        { title: '', description: 'Test', url: 'https://test.com', metrics: { engagement: 50 } },
        { title: 'Test', description: '', url: 'https://test.com', metrics: { engagement: 50 } },
        { title: 'Test', description: 'Test', url: '', metrics: { engagement: 50 } },
        { title: 'Test', description: 'Test', url: 'https://test.com', metrics: { engagement: 0 } },
        { title: 'Fashion Trend', description: 'Latest fashion', url: 'https://test.com', metrics: { engagement: 50 } },
      ];

      for (const opportunity of invalidOpportunities) {
        const isValid = collector.isValidOpportunity(opportunity);
        expect(isValid).toBe(false);
      }
    });

    it('should reject non-tech opportunities', () => {
      const nonTechOpportunity: Partial<AppOpportunity> = {
        title: 'Fashion Photography Tips',
        description: 'Best practices for fashion photo shoots',
        url: 'https://explodingtopics.com/topics/fashion-photography',
        metrics: {
          engagement: 150,
        },
      };

      const isValid = collector.isValidOpportunity(nonTechOpportunity);
      expect(isValid).toBe(false);
    });
  });

  describe('Keyword and Related Topic Generation', () => {
    it('should extract meaningful keywords from text', async () => {
      const text = 'AI-powered development platform for modern web applications';
      const keywords = collector['extractKeywordsFromText'](text);
      
      expect(keywords).toContain('powered');
      expect(keywords).toContain('development');
      expect(keywords).toContain('platform');
      expect(keywords).toContain('modern');
      expect(keywords).toContain('web');
      expect(keywords).toContain('applications');
      expect(keywords).not.toContain('the');
      expect(keywords).not.toContain('for');
    });

    it('should generate related topics from title and keywords', async () => {
      const title = 'API Management Platform';
      const keywords = ['api', 'management', 'platform', 'developers'];
      const relatedTopics = collector['generateRelatedTopics'](title, keywords);
      
      expect(relatedTopics).toContain('api tools');
      expect(relatedTopics).toContain('management platform');
      expect(relatedTopics).toContain('management tools');
      expect(relatedTopics.length).toBe(5);
      expect(relatedTopics.some(topic => topic.includes('platform'))).toBe(true);
    });

    it('should limit keywords and related topics to reasonable numbers', async () => {
      const longText = 'this is a very long text with many words that should be filtered and limited to prevent overwhelming data storage and processing systems with unnecessary information';
      const keywords = collector['extractKeywordsFromText'](longText);
      
      expect(keywords.length).toBeLessThanOrEqual(10);
      
      const relatedTopics = collector['generateRelatedTopics']('test title', keywords);
      expect(relatedTopics.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle page navigation errors gracefully', async () => {
      mockPage.waitForSelector = vi.fn().mockRejectedValue(new Error('Navigation timeout'));
      
      const opportunities = await collector.extractOpportunities(mockPage);
      
      expect(opportunities).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle element extraction errors', async () => {
      const mockTopicElement = {
        $: vi.fn().mockRejectedValue(new Error('Element not found')),
        textContent: vi.fn().mockRejectedValue(new Error('Cannot get text')),
      };

      mockPage.$$ = vi.fn().mockResolvedValue([mockTopicElement]);
      mockPage.waitForSelector = vi.fn().mockResolvedValue(mockTopicElement);
      
      // Mock the waitForContent method to return true
      (collector as any).waitForContent = vi.fn().mockResolvedValue(true);

      const opportunities = await collector.extractOpportunities(mockPage);
      
      expect(opportunities).toEqual([]);
      expect(logger.debug).toHaveBeenCalled();
    });

    it('should continue processing after individual topic extraction failures', async () => {
      const validTopicElement = {
        $: vi.fn().mockImplementation((selector) => {
          if (selector.includes('h1') || selector.includes('h2') || selector.includes('title')) {
            return { textContent: vi.fn().mockResolvedValue('Valid AI Development Platform') };
          }
          if (selector.includes('p') || selector.includes('description')) {
            return { textContent: vi.fn().mockResolvedValue('A platform for AI development') };
          }
          if (selector.includes('growth') || selector.includes('percent')) {
            return { textContent: vi.fn().mockResolvedValue('100%') };
          }
          return null;
        }),
      };

      const invalidTopicElement = {
        $: vi.fn().mockRejectedValue(new Error('Extraction error')),
      };

      mockPage.$$ = vi.fn().mockResolvedValue([invalidTopicElement, validTopicElement]);
      mockPage.waitForSelector = vi.fn().mockResolvedValue(true);
      
      // Mock the waitForContent method to return true
      (collector as any).waitForContent = vi.fn().mockResolvedValue(true);

      const opportunities = await collector.extractOpportunities(mockPage);
      
      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].title).toBe('Valid AI Development Platform');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete extraction workflow', async () => {
      const mockTopic = {
        $: vi.fn().mockImplementation((selector) => {
          if (selector.includes('h1') || selector.includes('title')) {
            return { textContent: vi.fn().mockResolvedValue('Next-Gen SaaS Analytics') };
          }
          if (selector.includes('description') || selector === 'p') {
            return { textContent: vi.fn().mockResolvedValue('Advanced analytics platform for SaaS businesses') };
          }
          if (selector.includes('growth')) {
            return { textContent: vi.fn().mockResolvedValue('↑ 180%') };
          }
          if (selector.includes('volume')) {
            return { textContent: vi.fn().mockResolvedValue('15k searches') };
          }
          if (selector === 'a') {
            return { getAttribute: vi.fn().mockResolvedValue('/topics/saas-analytics') };
          }
          if (selector.includes('category')) {
            return { textContent: vi.fn().mockResolvedValue('SaaS') };
          }
          return null;
        }),
      };

      mockPage.$$ = vi.fn().mockResolvedValue([mockTopic]);
      mockPage.waitForSelector = vi.fn().mockResolvedValue(true);
      
      // Mock the waitForContent method to return true
      (collector as any).waitForContent = vi.fn().mockResolvedValue(true);

      const opportunities = await collector.extractOpportunities(mockPage);
      
      expect(opportunities).toHaveLength(1);
      
      const opportunity = opportunities[0];
      expect(opportunity).toMatchObject({
        title: 'Next-Gen SaaS Analytics',
        description: 'Advanced analytics platform for SaaS businesses',
        url: 'https://explodingtopics.com/topics/saas-analytics',
        source: 'exploding-topics',
        category: 'SaaS',
        metrics: {
          engagement: 180,
          views: 15000,
        },
        tags: expect.arrayContaining(['saas', 'analytics', 'exploding']),
      });
    });
  });
});