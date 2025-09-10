import axios from 'axios';
import { createLogger } from '../utils/logger.js';
import { delay, retryWithBackoff } from '../utils/helpers.js';

const logger = createLogger('twitter-revenue');

export class TwitterRevenueCollector {
  constructor(config = {}) {
    this.bearerToken = config.twitterBearerToken;
    this.baseUrl = 'https://api.twitter.com/2';
    this.maxRetries = config.maxRetries || 3;
    this.delayBetweenRequests = config.delay || 1000;
    
    // Revenue-related search terms
    this.revenueKeywords = [
      'made $', 'revenue $', 'earned $', 'monthly recurring revenue',
      'mrr $', 'arr $', 'first $', 'hit $', 'milestone $',
      'indie hacker', 'bootstrap', 'side project revenue',
      'app store revenue', 'saas revenue', 'profit $'
    ];
    
    // Popular indie maker accounts to monitor
    this.targetAccounts = [
      'levelsio', 'dvassallo', 'ajlkn', 'anthilemoon',
      'dinkydani21', 'marckohlbrugge', 'jamiemtch', 'stephsmithio',
      'thisiskp_', 'dannypostmaa', 'rondy', 'patio11'
    ];
  }

  async collectRevenueShares(options = {}) {
    if (!this.bearerToken) {
      logger.error('Twitter Bearer Token not provided');
      return [];
    }

    const results = [];
    const searchQueries = this.buildSearchQueries();
    
    for (const query of searchQueries) {
      try {
        logger.info(`Searching for: ${query}`);
        const tweets = await this.searchTweets(query, options);
        const analyzed = await this.analyzeTweets(tweets);
        results.push(...analyzed);
        
        await delay(this.delayBetweenRequests);
      } catch (error) {
        logger.error(`Error searching for "${query}":`, error.message);
      }
    }
    
    return this.deduplicateResults(results);
  }

  buildSearchQueries() {
    const queries = [];
    
    // General revenue keywords
    this.revenueKeywords.forEach(keyword => {
      queries.push(`"${keyword}" -is:retweet lang:en`);
    });
    
    // Target specific accounts
    this.targetAccounts.forEach(account => {
      queries.push(`from:${account} (${'|'.join(['$', 'revenue', 'made', 'earned'])}) -is:retweet`);
    });
    
    // App-specific revenue searches
    const appTerms = ['app', 'saas', 'tool', 'product', 'startup'];
    appTerms.forEach(term => {
      queries.push(`"${term}" "made $" -is:retweet lang:en`);
      queries.push(`"${term}" "revenue" -is:retweet lang:en`);
    });
    
    return queries;
  }

  async searchTweets(query, options = {}) {
    const params = {
      query,
      max_results: options.maxResults || 50,
      'tweet.fields': 'created_at,author_id,public_metrics,context_annotations,referenced_tweets',
      'user.fields': 'username,name,verified,public_metrics,description',
      'expansions': 'author_id,referenced_tweets.id',
      ...options.additionalParams
    };

    return retryWithBackoff(async () => {
      const response = await axios.get(`${this.baseUrl}/tweets/search/recent`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'Content-Type': 'application/json',
        },
        params,
        timeout: 30000,
      });

      return response.data;
    }, this.maxRetries);
  }

  async analyzeTweets(searchResults) {
    if (!searchResults.data) {
      return [];
    }

    const analyzedTweets = [];
    const users = this.mapUsers(searchResults.includes?.users || []);

    for (const tweet of searchResults.data) {
      try {
        const analysis = this.extractRevenueInfo(tweet.text);
        const user = users[tweet.author_id];
        
        if (analysis.hasRevenue) {
          analyzedTweets.push({
            tweetId: tweet.id,
            text: tweet.text,
            author: {
              id: tweet.author_id,
              username: user?.username,
              name: user?.name,
              verified: user?.verified,
              followers: user?.public_metrics?.followers_count,
              description: user?.description,
            },
            createdAt: tweet.created_at,
            metrics: tweet.public_metrics,
            revenueData: analysis,
            url: `https://twitter.com/${user?.username}/status/${tweet.id}`,
            collectedAt: new Date().toISOString(),
            source: 'twitter'
          });
        }
      } catch (error) {
        logger.warn(`Error analyzing tweet ${tweet.id}:`, error.message);
      }
    }

    return analyzedTweets;
  }

  mapUsers(users) {
    return users.reduce((acc, user) => {
      acc[user.id] = user;
      return acc;
    }, {});
  }

  extractRevenueInfo(text) {
    const analysis = {
      hasRevenue: false,
      amounts: [],
      currency: 'USD',
      timeframe: null,
      context: null,
      confidence: 0,
    };

    // Extract dollar amounts
    const dollarMatches = text.match(/\$[\d,]+(?:\.\d{2})?[kKmM]?/g);
    if (dollarMatches) {
      analysis.amounts = dollarMatches.map(match => this.parseAmount(match));
      analysis.hasRevenue = true;
      analysis.confidence += 30;
    }

    // Extract timeframe context
    const timeframes = ['month', 'monthly', 'year', 'yearly', 'week', 'weekly', 'day', 'daily', 'quarter', 'annual'];
    const timeframeMatch = timeframes.find(tf => text.toLowerCase().includes(tf));
    if (timeframeMatch) {
      analysis.timeframe = timeframeMatch;
      analysis.confidence += 20;
    }

    // Extract context clues
    const revenueContexts = [
      'made', 'earned', 'revenue', 'profit', 'sales', 'income',
      'mrr', 'arr', 'milestone', 'hit', 'reached', 'generated'
    ];
    
    const contextMatches = revenueContexts.filter(context => 
      text.toLowerCase().includes(context.toLowerCase())
    );
    
    if (contextMatches.length > 0) {
      analysis.context = contextMatches;
      analysis.confidence += contextMatches.length * 15;
      analysis.hasRevenue = true;
    }

    // Product/app mentions
    const productMentions = ['app', 'saas', 'tool', 'product', 'startup', 'business', 'side project'];
    const productMatches = productMentions.filter(product =>
      text.toLowerCase().includes(product)
    );
    
    if (productMatches.length > 0) {
      analysis.productType = productMatches;
      analysis.confidence += 10;
    }

    // Confidence threshold
    analysis.hasRevenue = analysis.hasRevenue && analysis.confidence >= 40;

    return analysis;
  }

  parseAmount(amountStr) {
    const cleanAmount = amountStr.replace(/[$,]/g, '');
    let multiplier = 1;
    
    if (cleanAmount.toLowerCase().includes('k')) {
      multiplier = 1000;
    } else if (cleanAmount.toLowerCase().includes('m')) {
      multiplier = 1000000;
    }
    
    const number = parseFloat(cleanAmount.replace(/[kKmM]/g, ''));
    return number * multiplier;
  }

  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(tweet => {
      if (seen.has(tweet.tweetId)) {
        return false;
      }
      seen.add(tweet.tweetId);
      return true;
    });
  }

  async getAccountTimeline(username, options = {}) {
    try {
      // First get user ID
      const userResponse = await axios.get(`${this.baseUrl}/users/by/username/${username}`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
        params: {
          'user.fields': 'public_metrics,description,verified'
        }
      });

      const userId = userResponse.data.data.id;
      
      // Get timeline
      const timeline = await axios.get(`${this.baseUrl}/users/${userId}/tweets`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
        },
        params: {
          max_results: options.maxResults || 100,
          'tweet.fields': 'created_at,public_metrics,context_annotations',
          exclude: 'retweets,replies',
        }
      });

      return {
        user: userResponse.data.data,
        tweets: timeline.data.data || []
      };
    } catch (error) {
      logger.error(`Error getting timeline for ${username}:`, error.message);
      return null;
    }
  }
}

export default TwitterRevenueCollector;