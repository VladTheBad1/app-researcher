import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Page } from 'playwright';
import { TwitterCollector } from '../../src/collectors/twitter.js';
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

describe('TwitterCollector', () => {
  let collector: TwitterCollector;
  let mockConfig: CollectorConfig;
  let mockPage: Page;

  beforeEach(() => {
    mockConfig = {
      source: 'twitter',
      enabled: true,
      interval: 30,
      maxPages: 5,
      rateLimitMs: 2000,
      retryAttempts: 3,
      filters: {
        keywords: ['MRR', 'launch', 'buildinpublic'],
      },
    };

    collector = new TwitterCollector(mockConfig);

    // Mock page object with Twitter-specific methods
    mockPage = {
      url: vi.fn().mockReturnValue('https://twitter.com/search?q=%23buildinpublic%20MRR'),
      goto: vi.fn(),
      waitForTimeout: vi.fn(),
      setExtraHTTPHeaders: vi.fn(),
      addInitScript: vi.fn(),
      mouse: {
        move: vi.fn(),
      },
      evaluate: vi.fn(),
      $$eval: vi.fn(),
      $$: vi.fn(),
      $: vi.fn(),
      waitForSelector: vi.fn(),
      context: vi.fn().mockReturnValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn(),
          getAttribute: vi.fn(),
          close: vi.fn(),
        }),
      }),
      close: vi.fn(),
      scrollBy: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getStartUrl', () => {
    it('should return Twitter search URL with encoded query', () => {
      const url = collector.getStartUrl();
      expect(url).toMatch(/^https:\/\/twitter\.com\/search\?q=/);
      expect(url).toMatch(/buildinpublic/);
    });

    it('should use X.com domain when useXDomain is true', () => {
      // Access private property for testing
      (collector as any).useXDomain = true;
      const url = collector.getStartUrl();
      expect(url).toMatch(/^https:\/\/x\.com\/search\?q=/);
    });

    it('should cycle through different search queries', () => {
      const url1 = collector.getStartUrl();
      (collector as any).currentQueryIndex = 1;
      const url2 = collector.getStartUrl();
      
      expect(url1).not.toBe(url2);
      expect(url2).toMatch(/ARR/);
    });
  });

  describe('isValidOpportunity', () => {
    it('should return true for opportunity with revenue mention', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Reached $10k MRR!',
        description: 'Just hit $10,000 in monthly recurring revenue with my SaaS app!',
        url: 'https://twitter.com/user/status/123456',
        metrics: {
          upvotes: 50,
          engagement: 150,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(true);
    });

    it('should return true for launch announcement', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Product Launch',
        description: 'Excited to launch my new app today! Check it out',
        url: 'https://twitter.com/user/status/123456',
        metrics: {
          engagement: 80,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(true);
    });

    it('should return true for high engagement content', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Popular Tweet',
        description: 'Some engaging content about building in public',
        url: 'https://twitter.com/user/status/123456',
        metrics: {
          engagement: 200,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(true);
    });

    it('should return false for low value content', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: 'Random Tweet',
        description: 'Just a regular tweet with no value',
        url: 'https://twitter.com/user/status/123456',
        metrics: {
          engagement: 5,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(false);
    });

    it('should return false for missing required fields', () => {
      const opportunity: Partial<AppOpportunity> = {
        title: '',
        description: 'Some content',
        url: 'https://twitter.com/user/status/123456',
        metrics: {
          engagement: 100,
        },
      };

      expect(collector.isValidOpportunity(opportunity)).toBe(false);
    });
  });

  describe('getNextPageUrl', () => {
    beforeEach(() => {
      mockPage.evaluate.mockResolvedValue(undefined);
      mockPage.$$eval.mockResolvedValue(10); // Mock tweet count
    });

    it('should return same URL when more content is loaded', async () => {
      const currentUrl = 'https://twitter.com/search?q=test';
      mockPage.url.mockReturnValue(currentUrl);
      mockPage.$$eval.mockResolvedValue(15); // More tweets found

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBe(currentUrl);
      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should return URL for next query when no more content', async () => {
      mockPage.$$eval.mockResolvedValue(3); // Few tweets found
      
      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toMatch(/search\?q=/);
      expect(nextUrl).not.toBe(mockPage.url());
    });

    it('should switch to X.com domain after exhausting twitter.com queries', async () => {
      // Simulate exhausting all queries
      (collector as any).currentQueryIndex = 13; // Last query index
      mockPage.$$eval.mockResolvedValue(2); // Few tweets

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toMatch(/x\.com/);
      expect((collector as any).useXDomain).toBe(true);
    });

    it('should return null when all queries are exhausted', async () => {
      (collector as any).currentQueryIndex = 13;
      (collector as any).useXDomain = true;
      mockPage.$$eval.mockResolvedValue(2);

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(nextUrl).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Scroll error'));

      const nextUrl = await collector.getNextPageUrl(mockPage);

      expect(logger.error).toHaveBeenCalledWith(
        'Error finding next page URL for Twitter',
        expect.objectContaining({
          error: 'Scroll error',
        })
      );
      expect(nextUrl).toBeNull();
    });
  });

  describe('extractOpportunities', () => {
    beforeEach(() => {
      // Mock the various methods called during extraction
      vi.spyOn(collector as any, 'setupTwitterPage').mockResolvedValue(undefined);
      vi.spyOn(collector as any, 'handleTwitterBlocking').mockResolvedValue(undefined);
      vi.spyOn(collector as any, 'simulateHumanBehavior').mockResolvedValue(undefined);
      vi.spyOn(collector as any, 'waitForContent').mockResolvedValue(true);
      
      // Mock extractTweets
      vi.spyOn(collector as any, 'extractTweets').mockResolvedValue([
        {
          id: 'tweet1',
          text: 'Just hit $10k MRR with my SaaS app! #buildinpublic',
          url: 'https://twitter.com/user/status/123456',
          author: {
            username: 'testuser',
            displayName: 'Test User',
            url: 'https://twitter.com/testuser',
            verified: false,
          },
          metrics: {
            likes: 100,
            retweets: 25,
            replies: 15,
            engagement: 140,
          },
          createdAt: new Date('2023-01-15'),
          hashtags: ['buildinpublic'],
          mentions: [],
          hasRevenue: true,
          revenueAmount: 10000,
          isLaunchAnnouncement: false,
        },
        {
          id: 'tweet2',
          text: 'Just a regular tweet without much value',
          url: 'https://twitter.com/user/status/123457',
          author: {
            username: 'regularuser',
            displayName: 'Regular User',
            url: 'https://twitter.com/regularuser',
            verified: false,
          },
          metrics: {
            likes: 5,
            retweets: 1,
            replies: 2,
            engagement: 8,
          },
          createdAt: new Date('2023-01-15'),
          hashtags: [],
          mentions: [],
          hasRevenue: false,
          isLaunchAnnouncement: false,
        },
      ]);
    });

    it('should extract valuable opportunities from tweets', async () => {
      const opportunities = await collector.extractOpportunities(mockPage);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0].title).toContain('$10,000 Revenue');
      expect(opportunities[0].source).toBe('twitter');
      expect(opportunities[0].tags).toContain('revenue');
    });

    it('should handle pages with no tweets', async () => {
      vi.spyOn(collector as any, 'waitForContent').mockResolvedValue(false);

      const opportunities = await collector.extractOpportunities(mockPage);

      expect(opportunities).toHaveLength(0);
      expect(logger.warn).toHaveBeenCalledWith('No tweets found on page', {
        url: expect.any(String),
      });
    });

    it('should call all setup methods in correct order', async () => {
      await collector.extractOpportunities(mockPage);

      expect(collector['setupTwitterPage']).toHaveBeenCalledWith(mockPage);
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(5000);
      expect(collector['handleTwitterBlocking']).toHaveBeenCalledWith(mockPage);
      expect(collector['simulateHumanBehavior']).toHaveBeenCalledWith(mockPage);
    });
  });

  describe('extractTweets', () => {
    let mockTweetElements: any[];

    beforeEach(() => {
      mockTweetElements = [
        {
          $: vi.fn(),
          $$: vi.fn(),
        },
        {
          $: vi.fn(),
          $$: vi.fn(),
        },
      ];

      mockPage.$$.mockResolvedValue(mockTweetElements);
      
      // Mock extractTweetData
      vi.spyOn(collector as any, 'extractTweetData').mockResolvedValue({
        id: 'tweet1',
        text: 'Sample tweet text',
        url: 'https://twitter.com/user/status/123456',
        author: {
          username: 'testuser',
          displayName: 'Test User',
          url: 'https://twitter.com/testuser',
          verified: false,
        },
        metrics: {
          likes: 10,
          retweets: 5,
          replies: 3,
          engagement: 18,
        },
        createdAt: new Date(),
        hashtags: [],
        mentions: [],
        hasRevenue: false,
        isLaunchAnnouncement: false,
      });
    });

    it('should extract tweets from all found elements', async () => {
      const tweets = await (collector as any).extractTweets(mockPage);

      expect(tweets).toHaveLength(2);
      expect(mockPage.$$).toHaveBeenCalledWith('[data-testid="tweet"]');
    });

    it('should handle extraction errors gracefully', async () => {
      vi.spyOn(collector as any, 'extractTweetData')
        .mockResolvedValueOnce(null) // First call returns null
        .mockResolvedValueOnce({ id: 'tweet1', text: 'valid tweet' }); // Second call succeeds

      const tweets = await (collector as any).extractTweets(mockPage);

      expect(tweets).toHaveLength(1);
      expect(tweets[0].text).toBe('valid tweet');
    });
  });

  describe('extractTweetData', () => {
    let mockElement: any;

    beforeEach(() => {
      mockElement = {
        $: vi.fn(),
        $$: vi.fn(),
      };

      // Mock helper methods
      vi.spyOn(collector as any, 'extractTextFromSelectors').mockImplementation((page, element, selectors) => {
        if (selectors.includes('[data-testid="tweetText"]')) {
          return Promise.resolve('Just hit $10k MRR with my new SaaS app! #buildinpublic');
        }
        return Promise.resolve(null);
      });

      // Mock author link extraction
      const mockAuthorLink = {
        getAttribute: vi.fn().mockResolvedValue('/testuser'),
        $: vi.fn().mockResolvedValue({
          textContent: vi.fn().mockResolvedValue('Test User'),
        }),
      };
      mockElement.$.mockImplementation((selector) => {
        if (selector.includes('User-Name')) {
          return Promise.resolve(mockAuthorLink);
        }
        if (selector === 'time') {
          return Promise.resolve({
            $: vi.fn().mockResolvedValue({
              getAttribute: vi.fn().mockResolvedValue('/testuser/status/123456'),
            }),
            getAttribute: vi.fn().mockResolvedValue('2023-01-15T10:00:00.000Z'),
          });
        }
        return Promise.resolve(null);
      });

      // Mock metric extraction
      vi.spyOn(collector as any, 'extractMetricFromSelectors').mockImplementation((element, selectors) => {
        if (selectors.some(s => s.includes('like'))) return Promise.resolve(100);
        if (selectors.some(s => s.includes('retweet'))) return Promise.resolve(25);
        if (selectors.some(s => s.includes('reply'))) return Promise.resolve(15);
        return Promise.resolve(0);
      });

      vi.spyOn(collector as any, 'checkVerifiedStatus').mockResolvedValue(false);
    });

    it('should extract complete tweet data', async () => {
      const tweet = await (collector as any).extractTweetData(mockPage, mockElement);

      expect(tweet).toEqual(expect.objectContaining({
        text: 'Just hit $10k MRR with my new SaaS app! #buildinpublic',
        url: 'https://twitter.com/testuser/status/123456',
        author: expect.objectContaining({
          username: 'testuser',
          displayName: 'Test User',
          url: 'https://twitter.com/testuser',
          verified: false,
        }),
        metrics: expect.objectContaining({
          likes: 100,
          retweets: 25,
          replies: 15,
          engagement: 140,
        }),
        hashtags: ['buildinpublic'],
        hasRevenue: true,
        revenueAmount: 10000,
      }));
    });

    it('should return null for very short tweets', async () => {
      vi.spyOn(collector as any, 'extractTextFromSelectors').mockResolvedValue('short');

      const tweet = await (collector as any).extractTweetData(mockPage, mockElement);

      expect(tweet).toBeNull();
    });

    it('should handle missing text gracefully', async () => {
      vi.spyOn(collector as any, 'extractTextFromSelectors').mockResolvedValue(null);

      const tweet = await (collector as any).extractTweetData(mockPage, mockElement);

      expect(tweet).toBeNull();
    });
  });

  describe('analyzeRevenue', () => {
    it('should detect MRR mentions with dollar amounts', () => {
      const result = (collector as any).analyzeRevenue('Just hit $10k MRR this month!');
      expect(result.hasRevenue).toBe(true);
      expect(result.revenueAmount).toBe(10000);
    });

    it('should detect ARR mentions', () => {
      const result = (collector as any).analyzeRevenue('Reached $50k ARR in my first year');
      expect(result.hasRevenue).toBe(true);
      expect(result.revenueAmount).toBe(50000);
    });

    it('should detect "reached" pattern', () => {
      const result = (collector as any).analyzeRevenue('Finally reached $25k in monthly revenue!');
      expect(result.hasRevenue).toBe(true);
      expect(result.revenueAmount).toBe(25000);
    });

    it('should handle comma-separated numbers', () => {
      const result = (collector as any).analyzeRevenue('Hit $100,000 ARR milestone!');
      expect(result.hasRevenue).toBe(true);
      expect(result.revenueAmount).toBe(100000);
    });

    it('should return false for non-revenue content', () => {
      const result = (collector as any).analyzeRevenue('Just a regular tweet about coding');
      expect(result.hasRevenue).toBe(false);
      expect(result.revenueAmount).toBeUndefined();
    });
  });

  describe('analyzeLaunch', () => {
    it('should detect launch announcements', () => {
      expect((collector as any).analyzeLaunch('Just launched my new app!')).toBe(true);
      expect((collector as any).analyzeLaunch('Excited to launch today')).toBe(true);
      expect((collector as any).analyzeLaunch('Finally launched after months')).toBe(true);
      expect((collector as any).analyzeLaunch('Announcing my new product')).toBe(true);
    });

    it('should return false for non-launch content', () => {
      expect((collector as any).analyzeLaunch('Working on my app')).toBe(false);
      expect((collector as any).analyzeLaunch('Regular update about progress')).toBe(false);
    });
  });

  describe('parseMetricNumber', () => {
    it('should parse regular numbers', () => {
      expect((collector as any).parseMetricNumber('123')).toBe(123);
      expect((collector as any).parseMetricNumber('1,234')).toBe(1234);
    });

    it('should parse K suffix numbers', () => {
      expect((collector as any).parseMetricNumber('1.2K')).toBe(1200);
      expect((collector as any).parseMetricNumber('5K')).toBe(5000);
    });

    it('should parse M suffix numbers', () => {
      expect((collector as any).parseMetricNumber('1.5M')).toBe(1500000);
      expect((collector as any).parseMetricNumber('2M')).toBe(2000000);
    });

    it('should return 0 for invalid numbers', () => {
      expect((collector as any).parseMetricNumber('invalid')).toBe(0);
      expect((collector as any).parseMetricNumber('')).toBe(0);
    });
  });

  describe('extractHashtags', () => {
    it('should extract hashtags from text', () => {
      const hashtags = (collector as any).extractHashtags('Love #buildinpublic and #indiehacker community!');
      expect(hashtags).toEqual(['buildinpublic', 'indiehacker']);
    });

    it('should return empty array when no hashtags', () => {
      const hashtags = (collector as any).extractHashtags('No hashtags in this text');
      expect(hashtags).toEqual([]);
    });
  });

  describe('extractMentions', () => {
    it('should extract mentions from text', () => {
      const mentions = (collector as any).extractMentions('Thanks @user1 and @user2 for the feedback!');
      expect(mentions).toEqual(['user1', 'user2']);
    });

    it('should return empty array when no mentions', () => {
      const mentions = (collector as any).extractMentions('No mentions in this text');
      expect(mentions).toEqual([]);
    });
  });

  describe('handleTwitterBlocking', () => {
    it('should detect login requirement and switch domains', async () => {
      mockPage.url.mockReturnValue('https://twitter.com/i/flow/login');
      mockPage.goto.mockResolvedValue(undefined);
      
      await (collector as any).handleTwitterBlocking(mockPage);

      expect(logger.warn).toHaveBeenCalledWith('Twitter is requesting login, implementing workaround');
      expect((collector as any).useXDomain).toBe(true);
      expect(mockPage.goto).toHaveBeenCalled();
    });

    it('should detect rate limiting', async () => {
      mockPage.$.mockImplementation((selector) => {
        if (selector === 'text=Rate limit exceeded') {
          return Promise.resolve({}); // Mock element found
        }
        return Promise.resolve(null);
      });

      await (collector as any).handleTwitterBlocking(mockPage);

      expect(logger.warn).toHaveBeenCalledWith('Twitter rate limit detected, applying extended delay');
      expect(mockPage.waitForTimeout).toHaveBeenCalledWith(60000);
    });

    it('should throw error for CAPTCHA detection', async () => {
      mockPage.$.mockImplementation((selector) => {
        if (selector === '[data-testid="captcha"]') {
          return Promise.resolve({}); // Mock CAPTCHA element found
        }
        return Promise.resolve(null);
      });

      await expect((collector as any).handleTwitterBlocking(mockPage)).rejects.toThrow('CAPTCHA detected');
    });
  });

  describe('simulateHumanBehavior', () => {
    beforeEach(() => {
      mockPage.$$ = vi.fn().mockResolvedValue([
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
        'Error simulating human behavior on Twitter',
        expect.objectContaining({
          error: 'Mouse error',
        })
      );
    });
  });

  describe('createOpportunityFromTweet', () => {
    const mockTweet = {
      id: 'tweet123',
      text: 'Just hit $10k MRR with my SaaS app! #buildinpublic',
      url: 'https://twitter.com/user/status/123456',
      author: {
        username: 'testuser',
        displayName: 'Test User',
        url: 'https://twitter.com/testuser',
        verified: true,
      },
      metrics: {
        likes: 100,
        retweets: 25,
        replies: 15,
        engagement: 140,
      },
      createdAt: new Date('2023-01-15'),
      hashtags: ['buildinpublic'],
      mentions: [],
      hasRevenue: true,
      revenueAmount: 10000,
      isLaunchAnnouncement: false,
    };

    it('should create opportunity with revenue-focused title', () => {
      const opportunity = (collector as any).createOpportunityFromTweet(mockTweet);

      expect(opportunity.title).toContain('$10,000 Revenue');
      expect(opportunity.description).toBe(mockTweet.text);
      expect(opportunity.url).toBe(mockTweet.url);
      expect(opportunity.category).toBe('Revenue');
      expect(opportunity.tags).toContain('revenue');
      expect(opportunity.tags).toContain('buildinpublic');
      expect(opportunity.tags).toContain('verified');
    });

    it('should create opportunity with launch-focused title for launch announcements', () => {
      const launchTweet = {
        ...mockTweet,
        hasRevenue: false,
        revenueAmount: undefined,
        isLaunchAnnouncement: true,
      };

      const opportunity = (collector as any).createOpportunityFromTweet(launchTweet);

      expect(opportunity.title).toContain('Product Launch');
      expect(opportunity.category).toBe('Launch');
      expect(opportunity.tags).toContain('launch');
    });

    it('should map metrics correctly', () => {
      const opportunity = (collector as any).createOpportunityFromTweet(mockTweet);

      expect(opportunity.metrics.upvotes).toBe(100); // likes -> upvotes
      expect(opportunity.metrics.comments).toBe(15); // replies -> comments
      expect(opportunity.metrics.views).toBe(25); // retweets -> views
      expect(opportunity.metrics.engagement).toBe(140);
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

      // Mock page content and extraction
      vi.spyOn(collector as any, 'waitForContent').mockResolvedValue(true);
      vi.spyOn(collector as any, 'extractTweets').mockResolvedValue([
        {
          id: 'tweet1',
          text: 'Just hit $25k MRR! #buildinpublic journey continues',
          url: 'https://twitter.com/user/status/123456',
          author: {
            username: 'entrepreneur',
            displayName: 'Entrepreneur',
            url: 'https://twitter.com/entrepreneur',
            verified: false,
          },
          metrics: {
            likes: 200,
            retweets: 50,
            replies: 30,
            engagement: 280,
          },
          createdAt: new Date(),
          hashtags: ['buildinpublic'],
          mentions: [],
          hasRevenue: true,
          revenueAmount: 25000,
          isLaunchAnnouncement: false,
        },
      ]);

      const result = await collector.collect();

      expect(result.success).toBe(true);
      expect(result.opportunities).toHaveLength(1);
      expect(result.totalProcessed).toBe(1);
      expect(result.opportunities[0].source).toBe('twitter');
      expect(database.saveOpportunities).toHaveBeenCalledWith(result.opportunities);
    });

    it('should handle collection errors gracefully', async () => {
      // Mock the browser utilities to throw an error
      const mockWithBrowser = vi.mocked(await import('../../src/utils/browser.js')).withBrowser;
      mockWithBrowser.mockRejectedValue(new Error('Network error'));

      const result = await collector.collect();

      expect(result.success).toBe(false);
      expect(result.opportunities).toHaveLength(0);
      expect(result.errors).toContain('Network error');
    });
  });
});