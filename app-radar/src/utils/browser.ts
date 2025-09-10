import { Browser, Page, chromium, BrowserContext } from 'playwright';
import UserAgent from 'user-agents';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { appConfig } from '../config/index.js';
import logger, { logBrowserAction, logRateLimit, logSecurityEvent } from './logger.js';

export class BrowserManager {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private concurrencyLimit: ReturnType<typeof pLimit>;
  private userAgentGenerator: UserAgent;
  
  constructor() {
    this.concurrencyLimit = pLimit(appConfig.browser.maxConcurrent);
    this.userAgentGenerator = new UserAgent();
  }
  
  async initialize(): Promise<void> {
    try {
      logBrowserAction('initialize');
      
      this.browser = await chromium.launch({
        headless: appConfig.browser.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1920,1080',
        ],
      });
      
      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }
  
  async createStealthContext(sessionId: string): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }
    
    const userAgent = this.userAgentGenerator.toString();
    
    const context = await this.browser.newContext({
      userAgent,
      viewport: { width: 1920, height: 1080 },
      ...(appConfig.browser.proxy && { proxy: appConfig.browser.proxy }),
      // Additional stealth settings
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
    });
    
    // Add stealth scripts
    await context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock languages and plugins
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5], // Fake plugins array
      });
      
      // Override the permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    this.contexts.set(sessionId, context);
    logBrowserAction('create_context', undefined, { sessionId, userAgent });
    
    return context;
  }
  
  async createPage(sessionId: string): Promise<Page> {
    return this.concurrencyLimit(async () => {
      let context = this.contexts.get(sessionId);
      
      if (!context) {
        context = await this.createStealthContext(sessionId);
      }
      
      const page = await context.newPage();
      
      // Set additional stealth measures
      await page.setExtraHTTPHeaders({
        'sec-ch-ua': '"Google Chrome";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
      });
      
      // Handle timeout
      page.setDefaultTimeout(appConfig.browser.timeout);
      
      // Log blocked requests for monitoring
      page.on('requestfailed', (request) => {
        logSecurityEvent('request_blocked', {
          url: request.url(),
          failure: request.failure()?.errorText,
        });
      });
      
      logBrowserAction('create_page', undefined, { sessionId });
      return page;
    });
  }
  
  async navigateWithRetry(page: Page, url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle'; timeout?: number }): Promise<void> {
    const navigate = async () => {
      logBrowserAction('navigate', url);
      
      try {
        const response = await page.goto(url, {
          waitUntil: options?.waitUntil || 'domcontentloaded',
          timeout: options?.timeout || appConfig.browser.timeout,
        });
        
        if (!response || response.status() >= 400) {
          throw new Error(`Navigation failed with status: ${response?.status()}`);
        }
        
        // Random delay to appear more human-like
        await this.humanDelay();
        
      } catch (error) {
        logger.error('Navigation failed', { url, error: error instanceof Error ? error.message : error });
        throw error;
      }
    };
    
    await pRetry(navigate, {
      retries: appConfig.rateLimit.maxRetries,
      onFailedAttempt: (error) => {
        logger.warn('Navigation retry', { 
          url, 
          attempt: error.attemptNumber, 
          retriesLeft: error.retriesLeft,
          error: error.message 
        });
      },
    });
  }
  
  async humanDelay(min?: number, max?: number): Promise<void> {
    const minDelay = min || appConfig.rateLimit.requestDelayMin;
    const maxDelay = max || appConfig.rateLimit.requestDelayMax;
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
    
    logRateLimit('human_delay', delay);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  async randomScroll(page: Page): Promise<void> {
    const scrollCount = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < scrollCount; i++) {
      const scrollDistance = Math.floor(Math.random() * 500) + 200;
      await page.evaluate((distance) => {
        window.scrollBy(0, distance);
      }, scrollDistance);
      
      await this.humanDelay(500, 1500);
    }
    
    logBrowserAction('random_scroll', undefined, { scrollCount });
  }
  
  async closeContext(sessionId: string): Promise<void> {
    const context = this.contexts.get(sessionId);
    if (context) {
      await context.close();
      this.contexts.delete(sessionId);
      logBrowserAction('close_context', undefined, { sessionId });
    }
  }
  
  async shutdown(): Promise<void> {
    try {
      // Close all contexts
      for (const [sessionId] of this.contexts) {
        await this.closeContext(sessionId);
      }
      
      // Close browser
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      logBrowserAction('shutdown');
      logger.info('Browser shutdown complete');
    } catch (error) {
      logger.error('Error during browser shutdown', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }
  
  isInitialized(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}

// Global browser manager instance
export const browserManager = new BrowserManager();

// Utility functions
export async function withBrowser<T>(sessionId: string, callback: (page: Page) => Promise<T>): Promise<T> {
  if (!browserManager.isInitialized()) {
    await browserManager.initialize();
  }
  
  const page = await browserManager.createPage(sessionId);
  
  try {
    return await callback(page);
  } finally {
    await page.close();
  }
}

export async function extractText(page: Page, selector: string): Promise<string | null> {
  try {
    const element = await page.$(selector);
    return element ? await element.textContent() : null;
  } catch (error) {
    logger.debug('Failed to extract text', { selector, error: error instanceof Error ? error.message : error });
    return null;
  }
}

export async function extractAttribute(page: Page, selector: string, attribute: string): Promise<string | null> {
  try {
    const element = await page.$(selector);
    return element ? await element.getAttribute(attribute) : null;
  } catch (error) {
    logger.debug('Failed to extract attribute', { selector, attribute, error: error instanceof Error ? error.message : error });
    return null;
  }
}

export async function waitForSelectorSafe(page: Page, selector: string, timeout: number = 5000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}