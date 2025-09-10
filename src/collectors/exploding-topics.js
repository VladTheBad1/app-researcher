import axios from 'axios';
import * as cheerio from 'cheerio';
import { createLogger } from '../utils/logger.js';
import { delay, retryWithBackoff } from '../utils/helpers.js';

const logger = createLogger('exploding-topics');

export class ExplodingTopicsCollector {
  constructor(config = {}) {
    this.baseUrl = 'https://explodingtopics.com';
    this.userAgent = config.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    this.maxRetries = config.maxRetries || 3;
    this.delayBetweenRequests = config.delay || 2000;
  }

  async collectTrendingApps(categories = ['apps', 'saas', 'mobile', 'tech']) {
    const results = [];
    
    for (const category of categories) {
      try {
        logger.info(`Collecting trending apps from category: ${category}`);
        const categoryData = await this.scrapeCategory(category);
        results.push(...categoryData);
        
        await delay(this.delayBetweenRequests);
      } catch (error) {
        logger.error(`Error collecting from category ${category}:`, error.message);
      }
    }
    
    return this.deduplicateResults(results);
  }

  async scrapeCategory(category) {
    const url = `${this.baseUrl}/topics/${category}`;
    
    return retryWithBackoff(async () => {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      const apps = [];

      // Parse trending topics/apps from the page
      $('.topic-card, .trend-item, .app-listing').each((i, element) => {
        const $el = $(element);
        
        const name = $el.find('.topic-name, .app-name, h3, h4').first().text().trim();
        const description = $el.find('.topic-description, .app-description, p').first().text().trim();
        const growthRate = this.extractGrowthRate($el);
        const searchVolume = this.extractSearchVolume($el);
        const link = $el.find('a').first().attr('href');
        
        if (name && name.length > 2) {
          apps.push({
            name,
            description,
            category,
            growthRate,
            searchVolume,
            sourceUrl: link ? (link.startsWith('http') ? link : `${this.baseUrl}${link}`) : url,
            collectedAt: new Date().toISOString(),
            source: 'exploding-topics'
          });
        }
      });

      logger.info(`Found ${apps.length} apps in category: ${category}`);
      return apps;
    }, this.maxRetries);
  }

  extractGrowthRate(element) {
    const growthText = element.find('.growth-rate, .trend-growth, .percentage').text();
    const match = growthText.match(/(\d+(?:\.\d+)?)\s*%/);
    return match ? parseFloat(match[1]) : null;
  }

  extractSearchVolume(element) {
    const volumeText = element.find('.search-volume, .volume').text();
    const match = volumeText.match(/(\d+(?:,\d+)*)/);
    return match ? parseInt(match[1].replace(/,/g, '')) : null;
  }

  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(app => {
      const key = `${app.name.toLowerCase()}-${app.category}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async getAppDetails(appUrl) {
    try {
      const response = await axios.get(appUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      
      return {
        detailedDescription: $('.content, .description, .overview').first().text().trim(),
        tags: $('.tags, .categories').find('span, a').map((i, el) => $(el).text().trim()).get(),
        metrics: this.extractMetrics($),
        competitors: $('.competitors, .similar-apps').find('a').map((i, el) => $(el).text().trim()).get(),
      };
    } catch (error) {
      logger.warn(`Could not fetch details for ${appUrl}:`, error.message);
      return null;
    }
  }

  extractMetrics($) {
    const metrics = {};
    
    // Look for common metric patterns
    $('.metric, .stat, .number').each((i, el) => {
      const $el = $(el);
      const label = $el.find('.label, .metric-label').text().trim().toLowerCase();
      const value = $el.find('.value, .metric-value').text().trim();
      
      if (label && value) {
        metrics[label] = value;
      }
    });
    
    return metrics;
  }
}

export default ExplodingTopicsCollector;