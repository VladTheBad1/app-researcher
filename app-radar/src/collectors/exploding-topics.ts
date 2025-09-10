import type { Page } from 'playwright';
import { BaseCollector } from './base-collector.js';
import logger from '../utils/logger.js';
import type { AppOpportunity, CollectorConfig } from '../types/index.js';

interface ExplodingTopic {
  title: string;
  description: string;
  url: string;
  growth: number;
  searchVolume?: number;
  timePeriod: 'exploding' | 'growing' | 'stable';
  category?: string;
  relatedTopics: string[];
  keywords: string[];
  discoveredAt: Date;
}

export class ExplodingTopicsCollector extends BaseCollector {
  private static readonly BASE_URL = 'https://explodingtopics.com';
  private static readonly TECH_CATEGORIES = [
    'technology',
    'startups',
    'software',
    'apps',
    'saas',
    'artificial-intelligence',
    'blockchain',
    'cybersecurity',
    'fintech',
    'productivity',
    'developer-tools',
    'no-code',
    'automation',
    'cloud-computing',
    'mobile-apps'
  ];
  
  constructor(config: CollectorConfig) {
    super(config);
  }
  
  getStartUrl(): string {
    return ExplodingTopicsCollector.BASE_URL;
  }
  
  async getNextPageUrl(page: Page): Promise<string | null> {
    try {
      // Check for load more button or pagination
      const loadMoreButton = await page.$('button[class*="load-more"], button[class*="show-more"], a[class*="next"]');
      
      if (loadMoreButton) {
        const isDisabled = await loadMoreButton.isDisabled();
        if (!isDisabled) {
          // Click load more and return current URL to re-process
          await loadMoreButton.click();
          await page.waitForTimeout(3000); // Wait for content to load
          await this.simulateHumanBehavior(page);
          return page.url();
        }
      }
      
      // Try pagination links
      const nextPageLink = await page.$('a[rel="next"], a[class*="next-page"], a[aria-label*="next"]');
      if (nextPageLink) {
        const href = await nextPageLink.getAttribute('href');
        if (href) {
          return new URL(href, ExplodingTopicsCollector.BASE_URL).toString();
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Error finding next page URL', { 
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
      opportunity.metrics?.engagement &&
      opportunity.metrics.engagement > 0 &&
      this.isTechRelated(opportunity.title + ' ' + opportunity.description)
    );
  }
  
  private isTechRelated(content: string): boolean {
    const techKeywords = [
      'app', 'software', 'saas', 'platform', 'tool', 'api', 'sdk', 'framework',
      'library', 'database', 'cloud', 'serverless', 'microservice', 'devops',
      'automation', 'workflow', 'productivity', 'dashboard',
      'analytics', 'monitoring', 'security', 'crypto', 'blockchain', 'fintech',
      'startup', 'tech', 'digital', 'online', 'web', 'mobile', 'ios', 'android',
      'javascript', 'python', 'react', 'node', 'docker', 'kubernetes',
      'no-code', 'low-code', 'integration', 'webhook', 'rest', 'graphql',
      'development', 'developer', 'coding', 'programming', 'engineer'
    ];
    
    const specialKeywords = [
      ' ai ', ' ml ', ' ai.', 'artificial intelligence', 'machine learning',
      'ai-powered', 'ai technology'
    ];
    
    const lowerContent = ` ${content.toLowerCase()} `;
    
    // Check for regular tech keywords
    const hasRegularKeyword = techKeywords.some(keyword => 
      lowerContent.includes(keyword)
    );
    
    // Check for special AI/ML keywords with word boundaries
    const hasSpecialKeyword = specialKeywords.some(keyword => 
      lowerContent.includes(keyword)
    );
    
    return hasRegularKeyword || hasSpecialKeyword;
  }
  
  async extractOpportunities(page: Page): Promise<AppOpportunity[]> {
    await this.setupExplodingTopicsPage(page);
    
    // Wait for content to load
    await page.waitForTimeout(3000);
    
    // Simulate human behavior
    await this.simulateHumanBehavior(page);
    
    return await this.performExtraction(page);
  }
  
  private async setupExplodingTopicsPage(page: Page): Promise<void> {
    // Set stealth headers specific to Exploding Topics
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
      'Referer': 'https://www.google.com/'
    });
    
    // Add custom scripts to avoid detection
    await page.addInitScript(() => {
      // Override Object.getOwnPropertyDescriptor for webdriver
      const originalGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
      Object.getOwnPropertyDescriptor = function(obj, prop) {
        if (prop === 'webdriver') {
          return undefined;
        }
        return originalGetOwnPropertyDescriptor.call(this, obj, prop);
      };
      
      // Mock chrome runtime
      if (!window.chrome) {
        (window as any).chrome = {
          runtime: {
            onConnect: null,
            onMessage: null
          }
        };
      }
      
      // Override navigator properties
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });
      
      // Mock screen resolution variance
      Object.defineProperty(screen, 'availWidth', {
        get: () => 1920 + Math.floor(Math.random() * 100),
      });
      
      Object.defineProperty(screen, 'availHeight', {
        get: () => 1080 + Math.floor(Math.random() * 100),
      });
    });
  }
  
  private async performExtraction(page: Page): Promise<AppOpportunity[]> {
    const opportunities: AppOpportunity[] = [];
    
    try {
      // Wait for topic cards or list items to load
      const hasTopics = await this.waitForContent(page, [
        '[class*="topic-card"]',
        '[class*="trend-item"]',
        '[class*="trending-topic"]',
        '.topic',
        '.trend',
        '[data-topic]',
        'article',
        '[class*="card"]'
      ], 15000);
      
      if (!hasTopics) {
        logger.warn('No topic elements found on page', { url: page.url() });
        return opportunities;
      }
      
      // Extract trending topics
      const topics = await this.extractTopics(page);
      
      // Filter for tech-related topics only
      const techTopics = topics.filter(topic => 
        this.isTechRelated(topic.title + ' ' + topic.description) &&
        topic.growth > 0
      );
      
      logger.info(`Found ${topics.length} topics, ${techTopics.length} tech-related`);
      
      // Convert to AppOpportunity format
      for (const topic of techTopics) {
        const opportunity = this.createOpportunityFromTopic(topic);
        if (this.isValidOpportunity(opportunity)) {
          opportunities.push(opportunity);
        }
      }
      
      return opportunities;
      
    } catch (error) {
      logger.error('Failed to extract opportunities from Exploding Topics', {
        error: error instanceof Error ? error.message : error,
        url: page.url()
      });
      return opportunities;
    }
  }
  
  private async extractTopics(page: Page): Promise<ExplodingTopic[]> {
    const topics: ExplodingTopic[] = [];
    
    try {
      // Multiple selectors to handle different layouts
      const topicSelectors = [
        '[class*="topic-card"]',
        '[class*="trend-item"]',
        '[class*="trending-topic"]',
        '.topic',
        '.trend',
        '[data-topic]',
        'article[class*="topic"]',
        'div[class*="card"]:has(h2, h3, h4)',
        'li[class*="topic"]',
        '.grid > div',
        '[class*="trending"] > div'
      ];
      
      let topicElements: any[] = [];
      
      // Try each selector until we find elements
      for (const selector of topicSelectors) {
        try {
          topicElements = await page.$$(selector);
          if (topicElements.length > 0) {
            logger.debug(`Found ${topicElements.length} topics using selector: ${selector}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (topicElements.length === 0) {
        // Fallback: try to extract any structured content
        topicElements = await page.$$('h2, h3, h4').then(elements => 
          elements.filter(async (el) => {
            const text = await el.textContent();
            return text && text.length > 3 && text.length < 100;
          })
        );
      }
      
      if (topicElements.length === 0) {
        logger.warn('No topic elements found with any selector');
        return topics;
      }
      
      // Extract data from each topic element
      for (const element of topicElements.slice(0, 50)) { // Limit to first 50
        try {
          const topic = await this.extractTopicData(page, element);
          if (topic) {
            topics.push(topic);
          }
        } catch (error) {
          logger.debug('Failed to extract topic data from element', {
            error: error instanceof Error ? error.message : error
          });
          continue;
        }
      }
      
      return topics;
    } catch (error) {
      logger.error('Failed to extract topics', { 
        error: error instanceof Error ? error.message : error 
      });
      return topics;
    }
  }
  
  private async extractTopicData(page: Page, element: any): Promise<ExplodingTopic | null> {
    try {
      // Extract title
      const titleSelectors = [
        'h1', 'h2', 'h3', 'h4', 'h5',
        '[class*="title"]',
        '[class*="name"]',
        '[class*="topic-name"]',
        'a[class*="link"]',
        'strong',
        '.topic-title'
      ];
      const title = await this.extractTextFromSelectors(page, element, titleSelectors);
      
      if (!title || title.length < 3) {
        return null;
      }
      
      // Extract description
      const descriptionSelectors = [
        'p',
        '[class*="description"]',
        '[class*="desc"]',
        '[class*="summary"]',
        '[class*="subtitle"]',
        'div:not(:has(h1,h2,h3,h4))'
      ];
      const description = await this.extractTextFromSelectors(page, element, descriptionSelectors) || title;
      
      // Extract growth percentage
      const growthSelectors = [
        '[class*="growth"]',
        '[class*="percent"]',
        '[class*="increase"]',
        '[class*="trend-up"]',
        'span:contains("%")',
        '[class*="score"]'
      ];
      const growthText = await this.extractTextFromSelectors(page, element, growthSelectors);
      const growth = this.parseGrowthNumber(growthText) || 0;
      
      // Extract search volume
      const volumeSelectors = [
        '[class*="volume"]',
        '[class*="searches"]',
        '[class*="search-volume"]',
        'span[class*="number"]'
      ];
      const volumeText = await this.extractTextFromSelectors(page, element, volumeSelectors);
      const searchVolume = this.parseVolumeNumber(volumeText);
      
      // Extract URL
      const urlSelectors = ['a'];
      const relativeUrl = await this.extractHrefFromSelectors(page, element, urlSelectors);
      const url = relativeUrl ? 
        (relativeUrl.startsWith('http') ? relativeUrl : new URL(relativeUrl, ExplodingTopicsCollector.BASE_URL).toString())
        : ExplodingTopicsCollector.BASE_URL;
      
      // Determine time period based on growth
      let timePeriod: 'exploding' | 'growing' | 'stable' = 'stable';
      if (growth > 100) timePeriod = 'exploding';
      else if (growth > 20) timePeriod = 'growing';
      
      // Extract category (simplified)
      const categorySelectors = [
        '[class*="category"]',
        '[class*="tag"]',
        '[class*="badge"]',
        'small'
      ];
      const category = await this.extractTextFromSelectors(page, element, categorySelectors);
      
      // Generate related topics and keywords from title
      const keywords = this.extractKeywordsFromText(title + ' ' + description);
      const relatedTopics = this.generateRelatedTopics(title, keywords);
      
      return {
        title: title.trim(),
        description: description.trim(),
        url,
        growth,
        searchVolume,
        timePeriod,
        category: category || 'Technology',
        relatedTopics,
        keywords,
        discoveredAt: new Date()
      };
      
    } catch (error) {
      logger.error('Failed to extract topic data', { 
        error: error instanceof Error ? error.message : error 
      });
      return null;
    }
  }
  
  private parseGrowthNumber(text: string | null): number {
    if (!text) return 0;
    
    const matches = text.match(/(\d+(?:\.\d+)?)\s*%?/);
    if (matches) {
      return parseFloat(matches[1]);
    }
    
    // Handle textual indicators
    if (text.toLowerCase().includes('exploding')) return 200;
    if (text.toLowerCase().includes('trending')) return 50;
    if (text.toLowerCase().includes('growing')) return 25;
    
    return 0;
  }
  
  private parseVolumeNumber(text: string | null): number | undefined {
    if (!text) return undefined;
    
    const cleanText = text.toLowerCase().replace(/[^\d.,km]/g, '');
    const matches = cleanText.match(/(\d+(?:\.\d+)?)\s*([km])?/);
    
    if (matches) {
      const baseNumber = parseFloat(matches[1]);
      const multiplier = matches[2];
      
      if (multiplier === 'k') return baseNumber * 1000;
      if (multiplier === 'm') return baseNumber * 1000000;
      return baseNumber;
    }
    
    return undefined;
  }
  
  private extractKeywordsFromText(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && word.length < 20);
    
    // Remove common stop words
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'man', 'men', 'too', 'use', 'way']);
    
    return [...new Set(words.filter(word => !stopWords.has(word)))].slice(0, 10);
  }
  
  private generateRelatedTopics(title: string, keywords: string[]): string[] {
    const related: string[] = [];
    
    // Generate variations based on keywords
    keywords.forEach(keyword => {
      if (keyword !== title.toLowerCase()) {
        related.push(keyword + ' tools');
        related.push(keyword + ' platform');
        related.push(keyword + ' software');
      }
    });
    
    // Add some common tech suffixes
    if (keywords.includes('platform')) {
      related.push('platform software');
    }
    
    return [...new Set(related)].slice(0, 5);
  }
  
  private async extractTextFromSelectors(page: Page, element: any, selectors: string[]): Promise<string | null> {
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
    
    // Fallback: try to get text directly from element
    try {
      const text = await element.textContent();
      if (text?.trim()) {
        return text.trim();
      }
    } catch {
      // Continue to next selector
    }
    
    return null;
  }
  
  private async extractHrefFromSelectors(page: Page, element: any, selectors: string[]): Promise<string | null> {
    for (const selector of selectors) {
      try {
        const linkElement = await element.$(selector);
        if (linkElement) {
          const href = await linkElement.getAttribute('href');
          if (href) {
            return href;
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }
  
  private createOpportunityFromTopic(topic: ExplodingTopic): AppOpportunity {
    const tags = [
      ...topic.keywords,
      topic.timePeriod,
      topic.category || 'Technology',
      ...topic.relatedTopics
    ].filter(Boolean).slice(0, 10);
    
    return this.createOpportunity({
      title: topic.title,
      description: topic.description,
      url: topic.url,
      category: topic.category || 'Technology',
      tags,
      metrics: {
        engagement: topic.growth,
        views: topic.searchVolume
      },
      createdAt: topic.discoveredAt
    });
  }
  
  private async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movements
      const viewport = page.viewportSize() || { width: 1920, height: 1080 };
      await page.mouse.move(
        Math.random() * viewport.width,
        Math.random() * viewport.height
      );
      
      // Simulate reading behavior with pauses and scrolling
      const scrollCount = Math.floor(Math.random() * 5) + 2;
      for (let i = 0; i < scrollCount; i++) {
        const scrollY = Math.floor(Math.random() * 800) + 200;
        await page.evaluate((y: number) => window.scrollBy(0, y), scrollY);
        
        // Random pause to simulate reading
        const pauseTime = Math.floor(Math.random() * 3000) + 1000;
        await page.waitForTimeout(pauseTime);
      }
      
      // Sometimes interact with the page (hover over elements)
      if (Math.random() > 0.3) {
        try {
          const interactableElements = await page.$$('[class*="topic"], [class*="card"], h2, h3, a');
          if (interactableElements.length > 0) {
            const randomElement = interactableElements[Math.floor(Math.random() * Math.min(interactableElements.length, 5))];
            await randomElement.hover();
            await page.waitForTimeout(Math.random() * 2000 + 500);
          }
        } catch {
          // Interaction is optional
        }
      }
      
      // Scroll back up occasionally
      if (Math.random() > 0.7) {
        await page.evaluate(() => window.scrollBy(0, -400));
        await page.waitForTimeout(1000);
      }
      
    } catch (error) {
      logger.debug('Error simulating human behavior', { 
        error: error instanceof Error ? error.message : error 
      });
    }
  }
}