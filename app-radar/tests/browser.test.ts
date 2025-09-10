import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserManager, withBrowser } from '../src/utils/browser.js';

describe('BrowserManager', () => {
  let browserManager: BrowserManager;

  beforeEach(async () => {
    browserManager = new BrowserManager();
  });

  afterEach(async () => {
    if (browserManager.isInitialized()) {
      await browserManager.shutdown();
    }
  });

  it('should initialize successfully', async () => {
    await browserManager.initialize();
    expect(browserManager.isInitialized()).toBe(true);
  });

  it('should create stealth context', async () => {
    await browserManager.initialize();
    const context = await browserManager.createStealthContext('test-session');
    expect(context).toBeDefined();
    
    await browserManager.closeContext('test-session');
  });

  it('should create page with stealth measures', async () => {
    await browserManager.initialize();
    const page = await browserManager.createPage('test-session');
    
    expect(page).toBeDefined();
    
    // Test that webdriver property is hidden
    const webdriverValue = await page.evaluate(() => navigator.webdriver);
    expect(webdriverValue).toBeUndefined();
    
    await page.close();
    await browserManager.closeContext('test-session');
  });

  it('should navigate to URL with retry', async () => {
    await browserManager.initialize();
    const page = await browserManager.createPage('test-session');
    
    // Use a reliable test URL
    await browserManager.navigateWithRetry(page, 'https://httpbin.org/html');
    
    const title = await page.title();
    expect(title).toBeDefined();
    
    await page.close();
    await browserManager.closeContext('test-session');
  });

  it('should apply human-like delays', async () => {
    const startTime = Date.now();
    await browserManager.humanDelay(100, 200);
    const duration = Date.now() - startTime;
    
    expect(duration).toBeGreaterThanOrEqual(100);
    expect(duration).toBeLessThan(300); // Allow some buffer
  });

  it('should shutdown cleanly', async () => {
    await browserManager.initialize();
    expect(browserManager.isInitialized()).toBe(true);
    
    await browserManager.shutdown();
    expect(browserManager.isInitialized()).toBe(false);
  });
});

describe('Browser Utilities', () => {
  it('should work with withBrowser helper', async () => {
    const result = await withBrowser('test-session', async (page) => {
      await page.goto('https://httpbin.org/html');
      return await page.title();
    });
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});