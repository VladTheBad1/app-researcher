import type { Page } from 'playwright';
import { BaseCollector } from './base-collector.js';
import logger from '../utils/logger.js';
import type { AppOpportunity, CollectorConfig } from '../types/index.js';

interface IndieHackersProduct {
  title: string;
  description: string;
  url: string;
  websiteUrl?: string;
  revenue?: string;
  mrr?: number;
  arr?: number;
  upvotes: number;
  comments: number;
  founder: string;
  categories: string[];
  tags: string[];
  milestones: string[];
  createdAt: Date;
  lastUpdated?: Date;
}

export class IndieHackersCollector extends BaseCollector {
  private static readonly BASE_URL = 'https://www.indiehackers.com';
  private static readonly PRODUCTS_URL = `${IndieHackersCollector.BASE_URL}/products`;
  private static readonly INTERVIEWS_URL = `${IndieHackersCollector.BASE_URL}/interviews`;
  
  private currentPage = 1;
  private currentUrl = IndieHackersCollector.PRODUCTS_URL;
  
  constructor(config: CollectorConfig) {
    super(config);
  }
  
  getStartUrl(): string {
    return this.currentUrl;
  }
  
  async getNextPageUrl(page: Page): Promise<string | null> {
    try {
      // Try to find next page button or pagination
      const nextButton = await page.$('a[rel="next"], .pagination a:has-text("Next"), .pagination .next:not(.disabled), button:has-text("Load more"), a[aria-label="Next page"]');
      
      if (nextButton) {
        const href = await nextButton.getAttribute('href');
        if (href) {
          return new URL(href, IndieHackersCollector.BASE_URL).toString();
        }
        
        // If it's a load more button, click it and return current URL
        const isButton = await nextButton.evaluate((el: Element) => el.tagName.toLowerCase() === 'button');
        if (isButton) {
          await nextButton.click();
          await page.waitForTimeout(3000); // Wait for content to load
          return page.url(); // Return same URL to re-process with new content
        }
      }
      
      // Try pagination with page numbers
      this.currentPage++;
      const hasMorePages = await page.$(`a[href*="page=${this.currentPage}"], a:has-text("${this.currentPage}")`);
      
      if (hasMorePages || this.currentPage <= 10) { // Limit to reasonable page count
        if (this.currentUrl.includes('/products')) {
          return `${IndieHackersCollector.PRODUCTS_URL}?page=${this.currentPage}`;
        } else {
          return `${IndieHackersCollector.INTERVIEWS_URL}?page=${this.currentPage}`;
        }
      }
      
      // Switch between products and interviews if we're done with current section
      if (this.currentUrl.includes('/products')) {
        this.currentUrl = IndieHackersCollector.INTERVIEWS_URL;
        this.currentPage = 1;
        return this.currentUrl;
      }
      
      return null;
    } catch (error) {
      logger.error('Error finding next page URL', { error: error instanceof Error ? error.message : error });
      return null;
    }
  }
  
  isValidOpportunity(opportunity: Partial<AppOpportunity>): boolean {
    return !!(
      opportunity.title?.trim() &&
      opportunity.description?.trim() &&
      opportunity.url &&
      (
        // Either has revenue data OR has significant engagement
        (opportunity.metrics?.upvotes && opportunity.metrics.upvotes >= 10) ||
        (opportunity.metrics?.comments && opportunity.metrics.comments >= 5) ||
        opportunity.description?.toLowerCase().includes('revenue') ||
        opportunity.description?.toLowerCase().includes('mrr') ||
        opportunity.description?.toLowerCase().includes('arr') ||
        opportunity.description?.toLowerCase().includes('$')
      )
    );
  }
  
  async extractOpportunities(page: Page): Promise<AppOpportunity[]> {
    // Setup IndieHackers specific headers and behavior
    await this.setupIndieHackersPage(page);
    
    // Wait for content to load
    await page.waitForTimeout(2000);
    
    // Simulate human behavior
    await this.simulateHumanBehavior(page);
    
    // Determine content type and extract accordingly
    const url = page.url();
    if (url.includes('/products')) {
      return await this.extractProductOpportunities(page);
    } else if (url.includes('/interviews')) {
      return await this.extractInterviewOpportunities(page);
    } else {
      return await this.extractGeneralOpportunities(page);
    }
  }
  
  private async setupIndieHackersPage(page: Page): Promise<void> {
    // Set additional headers for IndieHackers
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
    });
    
    // Block unnecessary resources to speed up loading
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });
  }
  
  private async extractProductOpportunities(page: Page): Promise<AppOpportunity[]> {
    const opportunities: AppOpportunity[] = [];
    
    try {
      // Wait for products to load
      const hasProducts = await this.waitForContent(page, [
        '.product-card',
        '.product-item',
        '[data-testid="product"]',
        '.product',
        'article',
        '.list-item'
      ], 15000);
      
      if (!hasProducts) {
        logger.warn('No products found on page', { url: page.url() });
        return opportunities;
      }
      
      // Extract products from the page
      const products = await this.extractProducts(page);
      
      logger.info(`Found ${products.length} products on IndieHackers products page`);
      
      // Convert to AppOpportunity format
      for (const product of products) {
        const opportunity = this.createOpportunityFromProduct(product);
        if (this.isValidOpportunity(opportunity)) {
          opportunities.push(opportunity);
        }
      }
      
      return opportunities;
      
    } catch (error) {
      logger.error('Failed to extract product opportunities from IndieHackers', {
        error: error instanceof Error ? error.message : error,
        url: page.url()
      });
      return opportunities;
    }
  }
  
  private async extractInterviewOpportunities(page: Page): Promise<AppOpportunity[]> {
    const opportunities: AppOpportunity[] = [];
    
    try {
      // Wait for interviews to load
      const hasInterviews = await this.waitForContent(page, [
        '.interview-card',
        '.interview-item',
        '[data-testid="interview"]',
        '.interview',
        'article',
        '.post'
      ], 15000);
      
      if (!hasInterviews) {
        logger.warn('No interviews found on page', { url: page.url() });
        return opportunities;
      }
      
      // Extract interviews from the page
      const interviews = await this.extractInterviews(page);
      
      logger.info(`Found ${interviews.length} interviews on IndieHackers interviews page`);
      
      // Convert to AppOpportunity format
      for (const interview of interviews) {
        const opportunity = this.createOpportunityFromInterview(interview);
        if (this.isValidOpportunity(opportunity)) {
          opportunities.push(opportunity);
        }
      }
      
      return opportunities;
      
    } catch (error) {
      logger.error('Failed to extract interview opportunities from IndieHackers', {
        error: error instanceof Error ? error.message : error,
        url: page.url()
      });
      return opportunities;
    }
  }
  
  private async extractGeneralOpportunities(page: Page): Promise<AppOpportunity[]> {
    // Fallback for other types of content (discussions, posts, etc.)
    return await this.extractProductOpportunities(page);
  }
  
  private async extractProducts(page: Page): Promise<IndieHackersProduct[]> {
    const products: IndieHackersProduct[] = [];
    
    try {
      // Multiple selectors to handle different IndieHackers layouts
      const productSelectors = [
        '.product-card',
        '.product-item',
        '[data-testid="product"]',
        '.product',
        'article[class*="product"]',
        '.list-item',
        '.card',
        '[class*="ProductCard"]'
      ];
      
      let productElements: any[] = [];
      
      for (const selector of productSelectors) {
        try {
          productElements = await page.$$(selector);
          if (productElements.length > 0) {
            logger.debug(`Found ${productElements.length} products using selector: ${selector}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (productElements.length === 0) {
        logger.warn('No product elements found with any selector');
        return products;
      }
      
      // Extract data from each product element
      for (const element of productElements) {
        try {
          const product = await this.extractProductData(page, element);
          if (product) {
            products.push(product);
          }
        } catch (error) {
          logger.debug('Failed to extract product data from element', {
            error: error instanceof Error ? error.message : error
          });
          continue;
        }
      }
      
      return products;
    } catch (error) {
      logger.error('Failed to extract products', { error: error instanceof Error ? error.message : error });
      return products;
    }
  }
  
  private async extractInterviews(page: Page): Promise<IndieHackersProduct[]> {
    const interviews: IndieHackersProduct[] = [];
    
    try {
      // Multiple selectors to handle different interview layouts
      const interviewSelectors = [
        '.interview-card',
        '.interview-item',
        '[data-testid="interview"]',
        '.interview',
        'article[class*="interview"]',
        '.post',
        '.story',
        '[class*="PostCard"]'
      ];
      
      let interviewElements: any[] = [];
      
      for (const selector of interviewSelectors) {
        try {
          interviewElements = await page.$$(selector);
          if (interviewElements.length > 0) {
            logger.debug(`Found ${interviewElements.length} interviews using selector: ${selector}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (interviewElements.length === 0) {
        logger.warn('No interview elements found with any selector');
        return interviews;
      }
      
      // Extract data from each interview element
      for (const element of interviewElements) {
        try {
          const interview = await this.extractInterviewData(page, element);
          if (interview) {
            interviews.push(interview);
          }
        } catch (error) {
          logger.debug('Failed to extract interview data from element', {
            error: error instanceof Error ? error.message : error
          });
          continue;
        }
      }
      
      return interviews;
    } catch (error) {
      logger.error('Failed to extract interviews', { error: error instanceof Error ? error.message : error });
      return interviews;
    }
  }
  
  private async extractProductData(page: Page, element: any): Promise<IndieHackersProduct | null> {
    try {
      // Extract title
      const titleSelectors = [
        'h3 a', 'h2 a', 'h1 a', 'h4 a',
        '.title a', '.product-title a', '.name a',
        'a[class*="title"]', 'a[class*="name"]',
        '.card-title a', '.heading a'
      ];
      const title = await this.extractTextFromSelectors(page, element, titleSelectors);
      
      if (!title) {
        logger.debug('No title found for product');
        return null;
      }
      
      // Extract description/tagline
      const descriptionSelectors = [
        '.description', '.tagline', '.subtitle',
        '[class*="description"]', '[class*="tagline"]',
        'p', '.summary', '.excerpt',
        '.card-text', '.content'
      ];
      const description = await this.extractTextFromSelectors(page, element, descriptionSelectors) || '';
      
      // Extract IndieHackers URL
      const urlSelectors = [
        'h3 a', 'h2 a', 'h1 a',
        '.title a', '.product-title a',
        'a[class*="title"]'
      ];
      const relativeUrl = await this.extractHrefFromSelectors(page, element, urlSelectors);
      const productUrl = relativeUrl ? new URL(relativeUrl, IndieHackersCollector.BASE_URL).toString() : '';
      
      // Extract revenue/MRR data
      const revenueData = await this.extractRevenueData(page, element, description);
      
      // Extract engagement metrics
      const upvotes = await this.extractNumberFromSelectors(page, element, [
        '.upvotes', '.votes', '.likes',
        '[class*="vote"]', '[class*="like"]',
        '.score', '.points'
      ]);
      
      const comments = await this.extractNumberFromSelectors(page, element, [
        '.comments', '.replies', '.responses',
        '[class*="comment"]', '[class*="reply"]',
        '.discussion-count'
      ]);
      
      // Extract founder/maker info
      const founder = await this.extractTextFromSelectors(page, element, [
        '.founder', '.maker', '.author',
        '[class*="founder"]', '[class*="maker"]',
        '.by', '.created-by'
      ]) || '';
      
      // Extract categories and tags
      const categories: string[] = [];
      const tags: string[] = [];
      
      try {
        const tagElements = await element.$$('.tag, .category, .badge, [class*="tag"], [class*="category"]');
        for (const tagEl of tagElements.slice(0, 5)) {
          const tagText = await tagEl.textContent();
          if (tagText?.trim()) {
            if (tagText.toLowerCase().includes('saas') || tagText.toLowerCase().includes('app') || tagText.toLowerCase().includes('tool')) {
              categories.push(tagText.trim());
            } else {
              tags.push(tagText.trim());
            }
          }
        }
      } catch {
        // Tags extraction is optional
      }
      
      // Extract milestones from description
      const milestones = this.extractMilestones(description);
      
      const result: IndieHackersProduct = {
        title: title.trim(),
        description: description.trim(),
        url: productUrl,
        upvotes: upvotes ?? 0,
        comments: comments ?? 0,
        founder: founder?.trim() || '',
        categories,
        tags,
        milestones,
        createdAt: new Date(),
      };
      
      // Add optional fields only if they exist
      if (revenueData.revenue) result.revenue = revenueData.revenue;
      if (revenueData.mrr) result.mrr = revenueData.mrr;
      if (revenueData.arr) result.arr = revenueData.arr;
      
      return result;
      
    } catch (error) {
      logger.error('Failed to extract product data', { error: error instanceof Error ? error.message : error });
      return null;
    }
  }
  
  private async extractInterviewData(page: Page, element: any): Promise<IndieHackersProduct | null> {
    try {
      // Similar to product extraction but focused on interview content
      const titleSelectors = [
        'h3 a', 'h2 a', 'h1 a',
        '.title a', '.interview-title a',
        'a[class*="title"]', '.headline a'
      ];
      const title = await this.extractTextFromSelectors(page, element, titleSelectors);
      
      if (!title) {
        logger.debug('No title found for interview');
        return null;
      }
      
      // Extract description/summary
      const descriptionSelectors = [
        '.summary', '.excerpt', '.description',
        '[class*="summary"]', '[class*="excerpt"]',
        'p', '.content', '.interview-summary'
      ];
      const description = await this.extractTextFromSelectors(page, element, descriptionSelectors) || '';
      
      // Extract interview URL
      const urlSelectors = [
        'h3 a', 'h2 a', '.title a',
        'a[class*="title"]', '.read-more a'
      ];
      const relativeUrl = await this.extractHrefFromSelectors(page, element, urlSelectors);
      const interviewUrl = relativeUrl ? new URL(relativeUrl, IndieHackersCollector.BASE_URL).toString() : '';
      
      // Extract revenue/metrics from interview text
      const revenueData = await this.extractRevenueData(page, element, `${title} ${description}`);
      
      // Extract founder name
      const founder = await this.extractTextFromSelectors(page, element, [
        '.founder', '.interviewee', '.author',
        '[class*="founder"]', '[class*="author"]',
        '.by', '.with'
      ]) || '';
      
      // Extract milestones and revenue info from content
      const milestones = this.extractMilestones(`${title} ${description}`);
      
      const result: IndieHackersProduct = {
        title: title.trim(),
        description: description.trim(),
        url: interviewUrl,
        upvotes: 0,
        comments: 0,
        founder: founder?.trim() || '',
        categories: ['Interview'],
        tags: ['founder-story'],
        milestones,
        createdAt: new Date(),
      };
      
      // Add optional fields only if they exist
      if (revenueData.revenue) result.revenue = revenueData.revenue;
      if (revenueData.mrr) result.mrr = revenueData.mrr;
      if (revenueData.arr) result.arr = revenueData.arr;
      
      return result;
      
    } catch (error) {
      logger.error('Failed to extract interview data', { error: error instanceof Error ? error.message : error });
      return null;
    }
  }
  
  private async extractRevenueData(_page: Page, element: any, text: string): Promise<{revenue?: string, mrr?: number, arr?: number}> {
    const data: {revenue?: string, mrr?: number, arr?: number} = {};
    
    try {
      // Look for revenue in specific elements first
      const revenueSelectors = [
        '.revenue', '.mrr', '.arr',
        '[class*="revenue"]', '[class*="mrr"]',
        '.metrics', '.stats', '.numbers'
      ];
      
      for (const selector of revenueSelectors) {
        try {
          const revenueElement = await element.$(selector);
          if (revenueElement) {
            const revenueText = await revenueElement.textContent();
            if (revenueText) {
              const extractedData = this.parseRevenueText(revenueText);
              Object.assign(data, extractedData);
            }
          }
        } catch {
          continue;
        }
      }
      
      // Fallback to parsing the full text
      if (!data.revenue && !data.mrr && !data.arr) {
        const extractedData = this.parseRevenueText(text);
        Object.assign(data, extractedData);
      }
      
    } catch (error) {
      logger.debug('Failed to extract revenue data', { error: error instanceof Error ? error.message : error });
    }
    
    return data;
  }
  
  private parseRevenueText(text: string): {revenue?: string, mrr?: number, arr?: number} {
    const data: {revenue?: string, mrr?: number, arr?: number} = {};
    
    // Common revenue patterns
    const patterns = [
      // MRR patterns
      /\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/mo|\/month|per month|monthly|mrr)/gi,
      /mrr[\s:]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
      
      // ARR patterns
      /\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:\/yr|\/year|per year|yearly|annually|arr)/gi,
      /arr[\s:]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
      
      // General revenue patterns
      /revenue[\s:]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
      /making[\s:]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
      /earning[\s:]*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
      
      // K/M notation
      /\$?(\d+(?:\.\d+)?)[kK][\s\/]*(?:mo|month|mrr)/gi,
      /\$?(\d+(?:\.\d+)?)[mM][\s\/]*(?:mo|month|mrr)/gi,
    ];
    
    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        const value = matches[0][1];
        const numValue = this.parseNumericValue(value);
        
        if (pattern.source.includes('mrr') || pattern.source.includes('mo')) {
          data.mrr = numValue;
        } else if (pattern.source.includes('arr') || pattern.source.includes('yr')) {
          data.arr = numValue;
        } else if (!data.revenue) {
          data.revenue = `$${value}`;
        }
      }
    }
    
    return data;
  }
  
  private parseNumericValue(value: string): number {
    // Remove commas and parse
    const cleaned = value.replace(/,/g, '');
    return parseInt(cleaned, 10) || 0;
  }
  
  private extractMilestones(text: string): string[] {
    const milestones: string[] = [];
    
    // Common milestone patterns
    const patterns = [
      /reached \$?[\d,]+/gi,
      /hit \$?[\d,]+/gi,
      /\$?[\d,]+ in revenue/gi,
      /\$?[\d,]+ mrr/gi,
      /\$?[\d,]+ arr/gi,
      /launched .+/gi,
      /acquired .+/gi,
      /raised \$?[\d,]+/gi,
      /funding .+/gi,
      /exit .+/gi,
      /sold .+/gi,
    ];
    
    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        if (match[0].length < 100) { // Keep milestones concise
          milestones.push(match[0].trim());
        }
      }
    }
    
    return milestones.slice(0, 3); // Limit to 3 milestones
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
  
  private async extractHrefFromSelectors(_page: Page, element: any, selectors: string[]): Promise<string | null> {
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
  
  private async extractNumberFromSelectors(_page: Page, element: any, selectors: string[]): Promise<number | null> {
    for (const selector of selectors) {
      try {
        const numberElement = await element.$(selector);
        if (numberElement) {
          const text = await numberElement.textContent();
          if (text) {
            const number = parseInt(text.replace(/[^\d]/g, ''), 10);
            if (!isNaN(number)) {
              return number;
            }
          }
        }
      } catch {
        continue;
      }
    }
    return null;
  }
  
  private createOpportunityFromProduct(product: IndieHackersProduct): AppOpportunity {
    const tags = [...product.tags, ...product.categories, ...product.milestones].filter(Boolean);
    
    // Add revenue tags for easier filtering
    if (product.revenue || product.mrr || product.arr) {
      tags.push('revenue-data');
    }
    
    if (product.mrr && product.mrr > 0) {
      tags.push(`mrr-${Math.floor(product.mrr/1000)}k`);
    }
    
    let description = product.description;
    if (product.revenue) {
      description += ` | Revenue: ${product.revenue}`;
    }
    if (product.mrr) {
      description += ` | MRR: $${product.mrr.toLocaleString()}`;
    }
    if (product.arr) {
      description += ` | ARR: $${product.arr.toLocaleString()}`;
    }
    if (product.founder) {
      description += ` | Founder: ${product.founder}`;
    }
    
    return this.createOpportunity({
      title: product.title,
      description,
      url: product.url,
      category: product.categories[0] || 'Startup',
      tags,
      metrics: {
        ...(product.upvotes > 0 && { upvotes: product.upvotes }),
        ...(product.comments > 0 && { comments: product.comments }),
      },
      createdAt: product.createdAt,
    });
  }
  
  private createOpportunityFromInterview(interview: IndieHackersProduct): AppOpportunity {
    const tags = [...interview.tags, 'interview', 'founder-story'].filter(Boolean);
    
    // Add revenue tags for easier filtering
    if (interview.revenue || interview.mrr || interview.arr) {
      tags.push('revenue-data');
    }
    
    let description = interview.description;
    if (interview.revenue) {
      description += ` | Revenue: ${interview.revenue}`;
    }
    if (interview.mrr) {
      description += ` | MRR: $${interview.mrr.toLocaleString()}`;
    }
    if (interview.founder) {
      description += ` | Founder: ${interview.founder}`;
    }
    
    return this.createOpportunity({
      title: interview.title,
      description,
      url: interview.url,
      category: 'Interview',
      tags,
      metrics: {
        ...(interview.upvotes > 0 && { upvotes: interview.upvotes }),
        ...(interview.comments > 0 && { comments: interview.comments }),
      },
      createdAt: interview.createdAt,
    });
  }
  
  private async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movements
      await page.mouse.move(
        Math.random() * 1200 + 100,
        Math.random() * 800 + 100
      );
      
      // Random scroll with pauses (IndieHackers has a lot of content)
      const scrollCount = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < scrollCount; i++) {
        const scrollY = Math.floor(Math.random() * 600) + 200;
        await page.evaluate((y: number) => window.scrollBy(0, y), scrollY);
        
        // Longer pauses to mimic reading content
        const pauseTime = Math.floor(Math.random() * 3000) + 1500;
        await page.waitForTimeout(pauseTime);
      }
      
      // Sometimes hover over elements to simulate interest
      if (Math.random() > 0.4) {
        try {
          const elements = await page.$$('.product-card, .interview-card, article, .card, .post');
          if (elements.length > 0) {
            const randomElement = elements[Math.floor(Math.random() * elements.length)];
            await randomElement.hover();
            await page.waitForTimeout(Math.random() * 2000 + 1000);
          }
        } catch {
          // Hovering is optional
        }
      }
      
      // Random short pause before extraction
      await page.waitForTimeout(Math.random() * 2000 + 1000);
      
    } catch (error) {
      logger.debug('Error simulating human behavior', { 
        error: error instanceof Error ? error.message : error 
      });
    }
  }
}