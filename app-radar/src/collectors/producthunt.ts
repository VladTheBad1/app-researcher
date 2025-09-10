import type { Page } from 'playwright';
import { BaseCollector } from './base-collector.js';
// Removed unused imports that are available in base class
import logger from '../utils/logger.js';
import type { AppOpportunity, CollectorConfig } from '../types/index.js';

interface ProductHuntProduct {
  title: string;
  tagline: string;
  description: string;
  url: string;
  websiteUrl: string;
  upvotes: number;
  comments: number;
  makers: string[];
  categories: string[];
  tags: string[];
  createdAt: Date;
}

export class ProductHuntCollector extends BaseCollector {
  private static readonly BASE_URL = 'https://www.producthunt.com';
  private static readonly DAILY_URL = `${ProductHuntCollector.BASE_URL}/topics/tech`;
  
  constructor(config: CollectorConfig) {
    super(config);
  }
  
  getStartUrl(): string {
    return ProductHuntCollector.DAILY_URL;
  }
  
  
  async getNextPageUrl(page: Page): Promise<string | null> {
    try {
      // Look for next page button or load more button
      const nextButton = await page.$('a[rel="next"], button[class*="loadMore"], a[class*="next"]');
      
      if (nextButton) {
        const href = await nextButton.getAttribute('href');
        if (href) {
          return new URL(href, ProductHuntCollector.BASE_URL).toString();
        }
        
        // If it's a button that loads more content, click it and return current URL
        const isButton = await nextButton.evaluate((el: Element) => el.tagName.toLowerCase() === 'button');
        if (isButton) {
          await nextButton.click();
          await page.waitForTimeout(2000); // Wait for content to load
          return page.url(); // Return same URL to re-process with new content
        }
      }
      
      // Try date-based navigation (go to previous day)
      const currentUrl = page.url();
      const dateMatch = currentUrl.match(/\/(\d{4})\/(\d{2})\/(\d{2})/);
      
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        const currentDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const previousDay = new Date(currentDate);
        previousDay.setDate(currentDate.getDate() - 1);
        
        const prevYear = previousDay.getFullYear();
        const prevMonth = String(previousDay.getMonth() + 1).padStart(2, '0');
        const prevDay = String(previousDay.getDate()).padStart(2, '0');
        
        return `${ProductHuntCollector.BASE_URL}/${prevYear}/${prevMonth}/${prevDay}`;
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
      opportunity.metrics?.upvotes &&
      opportunity.metrics.upvotes >= 100 // Only high-value products
    );
  }
  
  private async extractProducts(page: Page): Promise<ProductHuntProduct[]> {
    const products: ProductHuntProduct[] = [];
    
    try {
      // Multiple selectors to handle different Product Hunt layouts
      const productSelectors = [
        '[data-test*="post-item"]',
        '[class*="styles_item"]',
        '[data-test="homepage-section-0"] > div > div',
        'article[class*="post"]',
        '[class*="postItem"]'
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
  
  private async extractProductData(page: Page, element: any): Promise<ProductHuntProduct | null> {
    try {
      // Extract title
      const titleSelectors = ['h3 a', 'h2 a', '[class*="title"] a', 'a[class*="postTitle"]', 'strong a'];
      const title = await this.extractTextFromSelectors(page, element, titleSelectors);
      
      if (!title) {
        logger.debug('No title found for product');
        return null;
      }
      
      // Extract tagline/description
      const taglineSelectors = [
        '[class*="tagline"]',
        '[class*="description"]',
        'p',
        '[class*="subtitle"]',
        'div[class*="post"] > div:nth-child(2)'
      ];
      const tagline = await this.extractTextFromSelectors(page, element, taglineSelectors) || '';
      
      // Extract Product Hunt URL
      const urlSelectors = ['h3 a', 'h2 a', '[class*="title"] a', 'a[class*="postTitle"]'];
      const relativeUrl = await this.extractHrefFromSelectors(page, element, urlSelectors);
      const productUrl = relativeUrl ? new URL(relativeUrl, ProductHuntCollector.BASE_URL).toString() : '';
      
      // Extract upvotes
      const upvoteSelectors = [
        '[class*="vote"] [class*="count"]',
        '[class*="upvote"]',
        '[data-test*="vote"] span',
        'button[class*="vote"] span',
        '[class*="voteCount"]'
      ];
      const upvotes = await this.extractNumberFromSelectors(page, element, upvoteSelectors) || 0;
      
      // Extract comments count
      const commentSelectors = [
        '[class*="comment"] [class*="count"]',
        '[class*="comments"]',
        'a[href*="comments"] span',
        '[data-test*="comment"] span'
      ];
      const comments = await this.extractNumberFromSelectors(page, element, commentSelectors) || 0;
      
      // Try to extract website URL (this might require clicking through to the product page)
      let websiteUrl = '';
      try {
        if (productUrl) {
          // Open product page in new tab to extract website URL
          const newPage = await page.context().newPage();
          await newPage.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          
          const websiteSelectors = [
            'a[data-test="post-url"]',
            'a[class*="website"]',
            'a[href*="http"]:not([href*="producthunt.com"])'
          ];
          
          for (const selector of websiteSelectors) {
            try {
              const href = await newPage.getAttribute(selector, 'href');
              if (href && !href.includes('producthunt.com')) {
                websiteUrl = href;
                break;
              }
            } catch {
              continue;
            }
          }
          
          await newPage.close();
        }
      } catch (error) {
        logger.debug('Failed to extract website URL', { error: error instanceof Error ? error.message : error });
      }
      
      // Extract makers (simplified)
      const makers: string[] = [];
      try {
        const makerElements = await element.$$('a[href*="/users/"]');
        for (const makerEl of makerElements.slice(0, 3)) { // Limit to 3 makers
          const makerName = await makerEl.textContent();
          if (makerName?.trim()) {
            makers.push(makerName.trim());
          }
        }
      } catch {
        // Makers extraction is optional
      }
      
      // Extract categories/tags (simplified)
      const categories: string[] = [];
      const tags: string[] = [];
      try {
        const tagElements = await element.$$('[class*="tag"], [class*="category"], [class*="badge"]');
        for (const tagEl of tagElements.slice(0, 5)) { // Limit to 5 tags
          const tagText = await tagEl.textContent();
          if (tagText?.trim()) {
            tags.push(tagText.trim());
          }
        }
      } catch {
        // Tags extraction is optional
      }
      
      return {
        title: title.trim(),
        tagline: tagline.trim(),
        description: tagline.trim(), // Use tagline as description for now
        url: productUrl,
        websiteUrl,
        upvotes,
        comments,
        makers,
        categories,
        tags,
        createdAt: new Date(), // Product Hunt shows daily products
      };
      
    } catch (error) {
      logger.error('Failed to extract product data', { error: error instanceof Error ? error.message : error });
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
  
  private createOpportunityFromProduct(product: ProductHuntProduct): AppOpportunity {
    const tags = [...product.tags, ...product.categories].filter(Boolean);
    
    return this.createOpportunity({
      title: product.title,
      description: product.description || product.tagline,
      url: product.url,
      category: product.categories[0] || 'Tech',
      tags,
      metrics: {
        upvotes: product.upvotes,
        comments: product.comments,
      },
      createdAt: product.createdAt,
    });
  }
  
  // Add Product Hunt specific setup before extraction
  private async setupProductHuntPage(page: Page): Promise<void> {
    // Set additional headers for Product Hunt
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
  }
  
  // Override extractOpportunities to include Product Hunt specific setup
  async extractOpportunities(page: Page): Promise<AppOpportunity[]> {
    // Setup Product Hunt specific headers and behavior
    await this.setupProductHuntPage(page);
    
    // Wait longer for Product Hunt's dynamic content  
    await page.waitForTimeout(3000);
    
    // Simulate human behavior
    await this.simulateHumanBehavior(page);
    
    // Now perform the actual extraction
    return await this.performExtraction(page);
  }
  
  private async performExtraction(page: Page): Promise<AppOpportunity[]> {
    const opportunities: AppOpportunity[] = [];
    
    try {
      // Wait for the main product feed to load
      const hasProducts = await this.waitForContent(page, [
        '[data-test="homepage-section-0"] > div',
        '[class*="productsListWrapper"]',
        '[class*="postsList"]'
      ], 15000);
      
      if (!hasProducts) {
        logger.warn('No products found on page', { url: page.url() });
        return opportunities;
      }
      
      // Extract products from the page
      const products = await this.extractProducts(page);
      
      // Filter products with 100+ upvotes as requested
      const highValueProducts = products.filter(product => product.upvotes >= 100);
      
      logger.info(`Found ${products.length} products, ${highValueProducts.length} with 100+ upvotes`);
      
      // Convert to AppOpportunity format
      for (const product of highValueProducts) {
        const opportunity = this.createOpportunityFromProduct(product);
        if (this.isValidOpportunity(opportunity)) {
          opportunities.push(opportunity);
        }
      }
      
      return opportunities;
      
    } catch (error) {
      logger.error('Failed to extract opportunities from Product Hunt', {
        error: error instanceof Error ? error.message : error,
        url: page.url()
      });
      return opportunities;
    }
  }
  
  private async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Random mouse movements
      await page.mouse.move(
        Math.random() * 800 + 200,
        Math.random() * 600 + 200
      );
      
      // Random scroll with pauses
      const scrollCount = Math.floor(Math.random() * 4) + 2;
      for (let i = 0; i < scrollCount; i++) {
        const scrollY = Math.floor(Math.random() * 800) + 300;
        await page.evaluate((y: number) => window.scrollBy(0, y), scrollY);
        
        // Random pause between scrolls
        const pauseTime = Math.floor(Math.random() * 2000) + 1000;
        await page.waitForTimeout(pauseTime);
      }
      
      // Sometimes hover over random elements
      if (Math.random() > 0.5) {
        try {
          const elements = await page.$$('[data-test*="post"], article, [class*="item"]');
          if (elements.length > 0) {
            const randomElement = elements[Math.floor(Math.random() * elements.length)];
            await randomElement.hover();
            await page.waitForTimeout(Math.random() * 1000 + 500);
          }
        } catch {
          // Hovering is optional
        }
      }
      
    } catch (error) {
      logger.debug('Error simulating human behavior', { 
        error: error instanceof Error ? error.message : error 
      });
    }
  }
}