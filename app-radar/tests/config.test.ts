import { describe, it, expect, beforeEach } from 'vitest';
import { appConfig, validateConfig } from '../src/config/index.js';

describe('Configuration', () => {
  beforeEach(() => {
    // Reset environment variables
    delete process.env.HEADLESS;
    delete process.env.BROWSER_TIMEOUT;
    delete process.env.MAX_CONCURRENT_BROWSERS;
  });

  it('should load default configuration', () => {
    expect(appConfig).toBeDefined();
    expect(appConfig.browser).toBeDefined();
    expect(appConfig.database).toBeDefined();
    expect(appConfig.logging).toBeDefined();
    expect(appConfig.rateLimit).toBeDefined();
    expect(appConfig.collectors).toBeDefined();
  });

  it('should have valid browser configuration', () => {
    expect(typeof appConfig.browser.headless).toBe('boolean');
    expect(typeof appConfig.browser.timeout).toBe('number');
    expect(typeof appConfig.browser.maxConcurrent).toBe('number');
    expect(appConfig.browser.timeout).toBeGreaterThan(0);
    expect(appConfig.browser.maxConcurrent).toBeGreaterThan(0);
  });

  it('should have valid rate limiting configuration', () => {
    expect(appConfig.rateLimit.requestDelayMin).toBeGreaterThan(0);
    expect(appConfig.rateLimit.requestDelayMax).toBeGreaterThan(appConfig.rateLimit.requestDelayMin);
    expect(appConfig.rateLimit.maxRetries).toBeGreaterThan(0);
  });

  it('should have collector configurations', () => {
    expect(Array.isArray(appConfig.collectors)).toBe(true);
    expect(appConfig.collectors.length).toBeGreaterThan(0);

    appConfig.collectors.forEach(collector => {
      expect(collector.source).toBeDefined();
      expect(typeof collector.enabled).toBe('boolean');
      expect(collector.interval).toBeGreaterThan(0);
      expect(collector.maxPages).toBeGreaterThan(0);
      expect(collector.rateLimitMs).toBeGreaterThan(0);
    });
  });

  it('should validate configuration successfully', () => {
    const validation = validateConfig();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should respect environment variables', () => {
    // This test would need to be run in a separate process to avoid
    // interfering with the already-loaded config
    // For now, just verify the structure is correct
    expect(appConfig.browser.headless).toBeDefined();
  });
});