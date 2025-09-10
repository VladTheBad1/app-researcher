import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../src/database/index.js';
import type { AppOpportunity } from '../src/types/index.js';

describe('Database', () => {
  let db: Database;

  beforeEach(async () => {
    db = new Database();
    await db.initialize();
  });

  it('should initialize successfully', async () => {
    expect(db).toBeDefined();
  });

  it('should save and retrieve opportunities', async () => {
    const opportunity: AppOpportunity = {
      id: 'test-id-1',
      title: 'Test App',
      description: 'A test application for testing purposes',
      url: 'https://example.com/test-app',
      source: 'producthunt',
      category: 'productivity',
      tags: ['test', 'app'],
      metrics: {
        upvotes: 100,
        comments: 25,
        views: 1000,
        engagement: 125,
      },
      createdAt: new Date('2024-01-01'),
      discoveredAt: new Date(),
      lastUpdated: new Date(),
      status: 'discovered',
    };

    // Save opportunity
    await db.saveOpportunity(opportunity);

    // Retrieve opportunities
    const opportunities = await db.getOpportunities();
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].id).toBe(opportunity.id);
    expect(opportunities[0].title).toBe(opportunity.title);
    expect(opportunities[0].source).toBe(opportunity.source);
  });

  it('should filter opportunities by source', async () => {
    const opportunities: AppOpportunity[] = [
      {
        id: 'ph-1',
        title: 'ProductHunt App',
        description: 'From ProductHunt',
        url: 'https://producthunt.com/app1',
        source: 'producthunt',
        tags: [],
        metrics: { upvotes: 50 },
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
      {
        id: 'ih-1',
        title: 'IndieHackers App',
        description: 'From IndieHackers',
        url: 'https://indiehackers.com/app1',
        source: 'indiehackers',
        tags: [],
        metrics: { upvotes: 30 },
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
    ];

    await db.saveOpportunities(opportunities);

    // Filter by ProductHunt
    const phOpportunities = await db.getOpportunities({ source: 'producthunt' });
    expect(phOpportunities).toHaveLength(1);
    expect(phOpportunities[0].source).toBe('producthunt');

    // Filter by IndieHackers
    const ihOpportunities = await db.getOpportunities({ source: 'indiehackers' });
    expect(ihOpportunities).toHaveLength(1);
    expect(ihOpportunities[0].source).toBe('indiehackers');
  });

  it('should filter opportunities by minimum upvotes', async () => {
    const opportunities: AppOpportunity[] = [
      {
        id: 'high-votes',
        title: 'Popular App',
        description: 'High upvotes',
        url: 'https://example.com/popular',
        source: 'producthunt',
        tags: [],
        metrics: { upvotes: 100 },
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
      {
        id: 'low-votes',
        title: 'Unpopular App',
        description: 'Low upvotes',
        url: 'https://example.com/unpopular',
        source: 'producthunt',
        tags: [],
        metrics: { upvotes: 5 },
        createdAt: new Date(),
        discoveredAt: new Date(),
        lastUpdated: new Date(),
        status: 'discovered',
      },
    ];

    await db.saveOpportunities(opportunities);

    const popularOpportunities = await db.getOpportunities({ minUpvotes: 50 });
    expect(popularOpportunities).toHaveLength(1);
    expect(popularOpportunities[0].id).toBe('high-votes');
  });

  it('should update opportunity status', async () => {
    const opportunity: AppOpportunity = {
      id: 'status-test',
      title: 'Status Test App',
      description: 'Testing status updates',
      url: 'https://example.com/status-test',
      source: 'producthunt',
      tags: [],
      metrics: {},
      createdAt: new Date(),
      discoveredAt: new Date(),
      lastUpdated: new Date(),
      status: 'discovered',
    };

    await db.saveOpportunity(opportunity);
    await db.updateOpportunityStatus('status-test', 'bookmarked');

    const opportunities = await db.getOpportunities({ status: 'bookmarked' });
    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].status).toBe('bookmarked');
  });

  it('should save and retrieve collector stats', async () => {
    const stats = {
      source: 'producthunt',
      totalCollected: 100,
      totalErrors: 5,
      lastRun: new Date(),
      avgRunTime: 30000,
      successRate: 0.95,
    };

    await db.saveCollectorStats(stats);

    const retrievedStats = await db.getCollectorStats('producthunt');
    expect(retrievedStats).toHaveLength(1);
    expect(retrievedStats[0].source).toBe(stats.source);
    expect(retrievedStats[0].totalCollected).toBe(stats.totalCollected);
    expect(retrievedStats[0].successRate).toBe(stats.successRate);
  });

  it('should cleanup old ignored opportunities', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

    const oldOpportunity: AppOpportunity = {
      id: 'old-ignored',
      title: 'Old Ignored App',
      description: 'Should be cleaned up',
      url: 'https://example.com/old',
      source: 'producthunt',
      tags: [],
      metrics: {},
      createdAt: oldDate,
      discoveredAt: oldDate,
      lastUpdated: oldDate,
      status: 'ignored',
    };

    const newOpportunity: AppOpportunity = {
      id: 'new-ignored',
      title: 'New Ignored App',
      description: 'Should not be cleaned up',
      url: 'https://example.com/new',
      source: 'producthunt',
      tags: [],
      metrics: {},
      createdAt: new Date(),
      discoveredAt: new Date(),
      lastUpdated: new Date(),
      status: 'ignored',
    };

    await db.saveOpportunities([oldOpportunity, newOpportunity]);

    // Cleanup opportunities older than 30 days
    const deletedCount = await db.cleanup(30);
    expect(deletedCount).toBe(1);

    // Verify only new opportunity remains
    const remainingOpportunities = await db.getOpportunities();
    expect(remainingOpportunities).toHaveLength(1);
    expect(remainingOpportunities[0].id).toBe('new-ignored');
  });
});