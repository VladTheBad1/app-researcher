import type { Page } from 'playwright';
import { BaseCollector } from './base-collector.js';
import logger from '../utils/logger.js';
import type { AppOpportunity, CollectorConfig } from '../types/index.js';

interface TwitterTweet {
  id: string;
  text: string;
  url: string;
  author: {
    username: string;
    displayName: string;
    url: string;
    verified: boolean;
  };
  metrics: {
    retweets: number;
    likes: number;
    replies: number;
    engagement: number;
  };
  createdAt: Date;
  hashtags: string[];
  mentions: string[];
  hasRevenue: boolean;
  revenueAmount: number | undefined;
  isLaunchAnnouncement: boolean;
}

export class TwitterCollector extends BaseCollector {
  private static readonly BASE_URL = 'https://twitter.com';
  private static readonly X_BASE_URL = 'https://x.com';
  private static readonly SEARCH_QUERIES = [
    '#buildinpublic MRR',
    '#buildinpublic ARR', 
    '#buildinpublic revenue',
    'just launched app',
    'just launched tool',
    'just launched SaaS',
    '$10k MRR',
    '$50k MRR', 
    '$100k MRR',
    'reached $10k',
    'reached $50k',
    'reached $100k',
    '#indiehacker MRR',
    '#indiehacker launch',
    'bootstrapped to $',
  ];
  
  private currentQueryIndex = 0;
  private useXDomain = false; // Try both twitter.com and x.com
  
  constructor(config: CollectorConfig) {
    super(config);
  }
  
  getStartUrl(): string {
    const query = TwitterCollector.SEARCH_QUERIES[this.currentQueryIndex];
    const encodedQuery = encodeURIComponent(query);
    const baseUrl = this.useXDomain ? TwitterCollector.X_BASE_URL : TwitterCollector.BASE_URL;
    
    // Use advanced search with filters for quality content
    return `${baseUrl}/search?q=${encodedQuery}&src=typed_query&f=top`;
  }
  
  async getNextPageUrl(page: Page): Promise<string | null> {
    try {
      // First, try to scroll to load more tweets
      const currentUrl = page.url();
      
      // Scroll to bottom to trigger infinite scroll
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for new content to load
      await page.waitForTimeout(3000);
      
      // Check if more content loaded by comparing tweet count
      const tweetCount = await page.$$eval(
        '[data-testid="tweet"]', 
        elements => elements.length
      ).catch(() => 0);
      
      if (tweetCount > 5) { // If we found tweets, continue with same query
        return currentUrl;
      }
      
      // Move to next search query
      this.currentQueryIndex++;
      
      // If we've exhausted all queries with twitter.com, try x.com
      if (this.currentQueryIndex >= TwitterCollector.SEARCH_QUERIES.length && !this.useXDomain) {
        this.useXDomain = true;
        this.currentQueryIndex = 0;
        return this.getStartUrl();
      }
      
      // If we've exhausted all queries on both domains
      if (this.currentQueryIndex >= TwitterCollector.SEARCH_QUERIES.length) {
        return null;
      }
      
      // Return URL for next query
      return this.getStartUrl();
      
    } catch (error) {
      logger.error('Error finding next page URL for Twitter', { 
        error: error instanceof Error ? error.message : error 
      });
      return null;
    }
  }
  
  isValidOpportunity(opportunity: Partial<AppOpportunity>): boolean {
    return !!(
      opportunity.title?.trim() &&
      opportunity.description?.trim() &&
      opportunity.url &&
      opportunity.metrics &&
      (
        // Has revenue information OR high engagement
        opportunity.description.includes('$') || 
        opportunity.description.includes('MRR') ||
        opportunity.description.includes('ARR') ||
        opportunity.description.includes('launch') ||
        (opportunity.metrics.engagement && opportunity.metrics.engagement >= 100)
      )
    );
  }
  
  async extractOpportunities(page: Page): Promise<AppOpportunity[]> {
    // Setup Twitter-specific headers and behavior
    await this.setupTwitterPage(page);
    
    // Wait for content to load
    await page.waitForTimeout(5000);
    
    // Handle potential rate limiting or blocking
    await this.handleTwitterBlocking(page);
    
    // Simulate human behavior
    await this.simulateHumanBehavior(page);
    
    // Extract tweets
    return await this.performExtraction(page);
  }
  
  private async setupTwitterPage(page: Page): Promise<void> {
    // Set Twitter-specific headers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'DNT': '1',
    });
    
    // Additional Twitter-specific stealth measures
    await page.addInitScript(() => {
      // Override WebRTC to prevent IP leaks
      Object.defineProperty(window, 'RTCPeerConnection', {
        get: () => undefined,
      });
      
      // Hide automation indicators
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
      
      // Mock realistic screen properties
      Object.defineProperty(screen, 'availTop', {
        get: () => 23, // Mac menu bar height
      });
      
      // Mock touch support
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 0,
      });
    });
  }
  
  private async handleTwitterBlocking(page: Page): Promise<void> {
    try {
      const url = page.url();
      
      // Check for common blocking patterns
      if (url.includes('/i/flow/login') || 
          url.includes('/account/access') ||
          await page.$('[data-testid="loginButton"]')) {
        
        logger.warn('Twitter is requesting login, implementing workaround');
        
        // Try switching domain (twitter.com <-> x.com)
        this.useXDomain = !this.useXDomain;
        const newUrl = this.getStartUrl();
        await page.goto(newUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        return;
      }
      
      // Check for rate limit page
      const rateLimitElement = await page.$('text=Rate limit exceeded');
      if (rateLimitElement) {
        logger.warn('Twitter rate limit detected, applying extended delay');
        await page.waitForTimeout(60000); // Wait 1 minute
        return;
      }
      
      // Check for CAPTCHA or verification
      const captchaElement = await page.$('[data-testid="captcha"]');
      const verifyElement = await page.$('text=verify that you are human');
      if (captchaElement || verifyElement) {
        logger.error('Twitter CAPTCHA detected - manual intervention required');
        throw new Error('CAPTCHA detected');
      }
      
    } catch (error) {
      logger.debug('No blocking detected or error checking', { 
        error: error instanceof Error ? error.message : error 
      });
    }
  }
  
  private async performExtraction(page: Page): Promise<AppOpportunity[]> {
    const opportunities: AppOpportunity[] = [];
    
    try {
      // Wait for tweets to load
      const hasTweets = await this.waitForContent(page, [
        '[data-testid="tweet"]',
        '[data-testid="tweetText"]',
        'article[data-testid="tweet"]'
      ], 15000);
      
      if (!hasTweets) {
        logger.warn('No tweets found on page', { url: page.url() });
        return opportunities;
      }
      
      // Extract tweets
      const tweets = await this.extractTweets(page);
      
      // Filter for valuable tweets
      const valuableTweets = tweets.filter(tweet => 
        tweet.hasRevenue || 
        tweet.isLaunchAnnouncement || 
        tweet.metrics.engagement > 100
      );
      
      logger.info(`Found ${tweets.length} tweets, ${valuableTweets.length} valuable ones`, {
        query: TwitterCollector.SEARCH_QUERIES[this.currentQueryIndex],
        domain: this.useXDomain ? 'x.com' : 'twitter.com'
      });
      
      // Convert to AppOpportunity format
      for (const tweet of valuableTweets) {
        const opportunity = this.createOpportunityFromTweet(tweet);
        if (this.isValidOpportunity(opportunity)) {
          opportunities.push(opportunity);
        }
      }
      
      return opportunities;
      
    } catch (error) {
      logger.error('Failed to extract opportunities from Twitter', {
        error: error instanceof Error ? error.message : error,
        url: page.url()
      });
      return opportunities;
    }
  }
  
  private async extractTweets(page: Page): Promise<TwitterTweet[]> {
    const tweets: TwitterTweet[] = [];
    
    try {
      // Get all tweet elements
      const tweetElements = await page.$$('[data-testid="tweet"]');
      
      logger.debug(`Found ${tweetElements.length} tweet elements`);
      
      for (const element of tweetElements) {
        try {
          const tweet = await this.extractTweetData(page, element);
          if (tweet) {
            tweets.push(tweet);
          }
        } catch (error) {
          logger.debug('Failed to extract tweet data from element', {
            error: error instanceof Error ? error.message : error
          });
          continue;
        }
      }
      
      return tweets;
    } catch (error) {
      logger.error('Failed to extract tweets', { 
        error: error instanceof Error ? error.message : error 
      });
      return tweets;
    }
  }
  
  private async extractTweetData(page: Page, element: any): Promise<TwitterTweet | null> {
    try {
      // Extract tweet text
      const textSelectors = [
        '[data-testid="tweetText"]',
        '[lang] span',
        'div[dir="auto"] span'
      ];
      const text = await this.extractTextFromSelectors(page, element, textSelectors);
      
      if (!text || text.length < 10) {
        return null; // Skip very short tweets
      }
      
      // Extract author information
      let username = '';
      let displayName = '';
      let authorUrl = '';
      
      try {
        const authorLink = await element.$('[data-testid="User-Name"] a[href*="/"]');
        if (authorLink) {
          const href = await authorLink.getAttribute('href');
          if (href) {
            username = href.replace('/', '').split('?')[0];
            authorUrl = this.useXDomain 
              ? `${TwitterCollector.X_BASE_URL}${href}`
              : `${TwitterCollector.BASE_URL}${href}`;
          }
          
          const nameElement = await authorLink.$('span');
          if (nameElement) {
            displayName = await nameElement.textContent() || username;
          }
        }
      } catch (error) {
        logger.debug('Failed to extract author info', { error });
      }
      
      // Extract tweet URL
      const timeElement = await element.$('time');
      let tweetUrl = '';
      let tweetId = '';
      if (timeElement) {
        const linkElement = await timeElement.$('..');
        if (linkElement) {
          const href = await linkElement.getAttribute('href');
          if (href) {
            tweetUrl = this.useXDomain 
              ? `${TwitterCollector.X_BASE_URL}${href}`
              : `${TwitterCollector.BASE_URL}${href}`;
            tweetId = href.split('/').pop() || '';
          }
        }
      }
      
      // Extract metrics
      const likes = await this.extractMetricFromSelectors(element, [
        '[data-testid="like"] span',
        '[aria-label*="like"] span'
      ]);
      
      const retweets = await this.extractMetricFromSelectors(element, [
        '[data-testid="retweet"] span',
        '[aria-label*="repost"] span'
      ]);
      
      const replies = await this.extractMetricFromSelectors(element, [
        '[data-testid="reply"] span',
        '[aria-label*="repl"] span'
      ]);
      
      // Calculate engagement
      const engagement = likes + retweets + replies;
      
      // Extract hashtags and mentions from text
      const hashtags = this.extractHashtags(text);
      const mentions = this.extractMentions(text);
      
      // Analyze for revenue and launch indicators
      const { hasRevenue, revenueAmount } = this.analyzeRevenue(text);
      const isLaunchAnnouncement = this.analyzeLaunch(text);
      
      // Try to extract creation date
      let createdAt = new Date();
      try {
        const timeElement = await element.$('time');
        if (timeElement) {
          const datetime = await timeElement.getAttribute('datetime');
          if (datetime) {
            createdAt = new Date(datetime);
          }
        }
      } catch (error) {
        // Use current date as fallback
      }
      
      return {
        id: tweetId || `tweet-${Date.now()}-${Math.random()}`,
        text: text.trim(),
        url: tweetUrl,
        author: {
          username: username || 'unknown',
          displayName: displayName || username || 'Unknown User',
          url: authorUrl,
          verified: await this.checkVerifiedStatus(element),
        },
        metrics: {
          likes,
          retweets,
          replies,
          engagement,
        },
        createdAt,
        hashtags,
        mentions,
        hasRevenue,
        revenueAmount,
        isLaunchAnnouncement,
      };
      
    } catch (error) {
      logger.error('Failed to extract tweet data', { 
        error: error instanceof Error ? error.message : error 
      });
      return null;
    }
  }
  
  private async extractTextFromSelectors(_page: Page, element: any, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const textElement = await element.$(selector);
        if (textElement) {
          const text = await textElement.textContent();
          if (text?.trim()) {
            return text.trim();
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }
  
  private async extractMetricFromSelectors(element: any, selectors: string[]): Promise<number> {
    for (const selector of selectors) {
      try {
        const metricElement = await element.$(selector);
        if (metricElement) {
          const text = await metricElement.textContent();
          if (text) {
            return this.parseMetricNumber(text);
          }
        }
      } catch {
        continue;
      }
    }
    return 0;
  }
  
  private parseMetricNumber(text: string): number {
    const cleanText = text.replace(/,/g, '');
    
    // Handle K suffix (1.2K -> 1200)
    if (text.includes('K')) {
      const num = parseFloat(cleanText.replace('K', ''));
      return Math.round(num * 1000);
    }
    
    // Handle M suffix (1.5M -> 1500000)
    if (text.includes('M')) {
      const num = parseFloat(cleanText.replace('M', ''));
      return Math.round(num * 1000000);
    }
    
    // Regular number
    const num = parseInt(cleanText, 10);
    return isNaN(num) ? 0 : num;
  }
  
  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[\w]+/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.substring(1)) : [];
  }
  
  private extractMentions(text: string): string[] {
    const mentionRegex = /@[\w]+/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map(mention => mention.substring(1)) : [];
  }
  
  private analyzeRevenue(text: string): { hasRevenue: boolean; revenueAmount: number | undefined } {
    
    // Common revenue patterns
    const revenuePatterns = [
      /\$[\d,]+k?\s*(mrr|arr|revenue|month|annual)/i,
      /[\d,]+k?\s*\$\s*(mrr|arr|revenue)/i,
      /(mrr|arr|revenue).*\$[\d,]+k?/i,
      /reached\s*\$[\d,]+k?/i,
      /hit\s*\$[\d,]+k?/i,
    ];
    
    for (const pattern of revenuePatterns) {
      const match = text.match(pattern);
      if (match) {
        // Extract the numeric amount
        const numberMatch = match[0].match(/[\d,]+k?/i);
        if (numberMatch) {
          let amount = parseInt(numberMatch[0].replace(/[,k]/gi, ''), 10);
          if (numberMatch[0].toLowerCase().includes('k')) {
            amount *= 1000;
          }
          return { hasRevenue: true, revenueAmount: amount };
        }
        return { hasRevenue: true };
      }
    }
    
    return { hasRevenue: false };
  }
  
  private analyzeLaunch(text: string): boolean {
    const launchPatterns = [
      /just launched/i,
      /launching today/i,
      /finally launched/i,
      /excited to launch/i,
      /proud to announce/i,
      /introducing/i,
      /announcing/i,
      /released/i,
      /available now/i,
    ];
    
    return launchPatterns.some(pattern => pattern.test(text));
  }
  
  private async checkVerifiedStatus(element: any): Promise<boolean> {
    try {
      const verifiedElement = await element.$('[data-testid="icon-verified"]');
      return !!verifiedElement;
    } catch {
      return false;
    }
  }
  
  private createOpportunityFromTweet(tweet: TwitterTweet): AppOpportunity {
    const tags = [...tweet.hashtags];
    
    // Add contextual tags based on content analysis
    if (tweet.hasRevenue) tags.push('revenue');
    if (tweet.isLaunchAnnouncement) tags.push('launch');
    if (tweet.revenueAmount) tags.push('metrics');
    if (tweet.author.verified) tags.push('verified');
    
    // Create a descriptive title
    let title = `${tweet.author.displayName} - `;
    if (tweet.hasRevenue && tweet.revenueAmount) {
      title += `$${tweet.revenueAmount.toLocaleString()} Revenue`;
    } else if (tweet.isLaunchAnnouncement) {
      title += 'Product Launch';
    } else {
      title += tweet.text.substring(0, 50) + '...';
    }
    
    // Determine category
    let category = 'Social Media';
    if (tweet.hasRevenue) category = 'Revenue';
    if (tweet.isLaunchAnnouncement) category = 'Launch';
    if (tweet.hashtags.includes('buildinpublic')) category = 'Build in Public';
    
    return this.createOpportunity({
      title,
      description: tweet.text,
      url: tweet.url,
      category,
      tags,
      metrics: {
        upvotes: tweet.metrics.likes,
        comments: tweet.metrics.replies,
        views: tweet.metrics.retweets,
        engagement: tweet.metrics.engagement,
      },
      createdAt: tweet.createdAt,
    });
  }
  
  private async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movements
      await page.mouse.move(
        Math.random() * 1200 + 200,
        Math.random() * 800 + 200
      );
      
      // Simulate reading behavior with pauses and scrolls
      const scrollCount = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < scrollCount; i++) {
        // Scroll down
        const scrollDistance = Math.floor(Math.random() * 800) + 400;
        await page.evaluate((distance) => {
          window.scrollBy(0, distance);
        }, scrollDistance);
        
        // Random pause to "read" content
        const readTime = Math.floor(Math.random() * 3000) + 2000;
        await page.waitForTimeout(readTime);
        
        // Sometimes hover over tweets
        if (Math.random() > 0.7) {
          try {
            const tweets = await page.$$('[data-testid="tweet"]');
            if (tweets.length > 0) {
              const randomTweet = tweets[Math.floor(Math.random() * tweets.length)];
              await randomTweet.hover();
              await page.waitForTimeout(Math.random() * 1500 + 500);
            }
          } catch {
            // Hovering is optional
          }
        }
      }
      
      // Scroll back up occasionally
      if (Math.random() > 0.6) {
        await page.evaluate(() => {
          window.scrollBy(0, -300);
        });
        await page.waitForTimeout(1000);
      }
      
    } catch (error) {
      logger.debug('Error simulating human behavior on Twitter', { 
        error: error instanceof Error ? error.message : error 
      });
    }
  }
}