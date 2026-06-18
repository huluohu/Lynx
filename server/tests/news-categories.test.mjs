import test from 'node:test';
import assert from 'node:assert/strict';

const newsApi = await import('../services/news.js');

test('categorizeNewsItem uses source hints for crypto and metals', () => {
  assert.equal(newsApi.categorizeNewsItem({ title: 'Market update' }, { name: 'CoinDesk', type: 'crypto' }), 'crypto');
  assert.equal(newsApi.categorizeNewsItem({ title: 'Gold price rises' }, { name: 'Kitco News', type: 'gold' }), 'precious_metals');
  assert.equal(newsApi.categorizeNewsItem({ title: 'Budget update' }, { name: 'BBC Business', category: 'macro' }), 'macro');
  assert.equal(newsApi.categorizeNewsItem({ title: 'Election tensions rise' }, { name: 'CNBC World', category: 'risk' }), 'risk');
});

test('categorizeNewsItem detects asset classes from title and summary keywords', () => {
  assert.equal(newsApi.categorizeNewsItem({ title: 'EUR/USD jumps as dollar weakens' }), 'forex');
  assert.equal(newsApi.categorizeNewsItem({ title: 'Nvidia earnings lift Nasdaq stocks' }), 'equity');
  assert.equal(newsApi.categorizeNewsItem({ title: 'Fed inflation data moves treasury yields' }), 'macro');
  assert.equal(newsApi.categorizeNewsItem({ title: 'Oil and copper rally on commodity demand' }), 'commodities');
  assert.equal(newsApi.categorizeNewsItem({ title: 'Election and tariff tensions increase geopolitical risk' }), 'risk');
});

test('categorizeNewsItem handles Chinese finance keywords', () => {
  assert.equal(newsApi.categorizeNewsItem({ title: '比特币上涨，以太坊链上活跃度提升' }), 'crypto');
  assert.equal(newsApi.categorizeNewsItem({ title: '美联储利率路径影响全球经济预期' }), 'macro');
  assert.equal(newsApi.categorizeNewsItem({ title: '黄金价格刷新高位，贵金属需求升温' }), 'precious_metals');
  assert.equal(newsApi.categorizeNewsItem({ title: '地缘冲突与关税政策影响全球市场' }), 'risk');
});

test('normalizeNewsCategory rejects unsupported values', () => {
  assert.equal(newsApi.normalizeNewsCategory('crypto'), 'crypto');
  assert.equal(newsApi.normalizeNewsCategory('unknown-category'), '');
  assert.equal(newsApi.normalizeNewsCategory(''), '');
});

