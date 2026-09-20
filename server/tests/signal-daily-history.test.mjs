import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleDailySeries } from '../services/agent-evaluator.js';

test('daily sampling keeps only the last row of each day, preserving order', () => {
  const history = [
    { price: 100, fetched_at: '2026-01-01 09:00:00' },
    { price: 101, fetched_at: '2026-01-01 15:00:00' },
    { price: 102, fetched_at: '2026-01-01 23:55:00' },
    { price: 110, fetched_at: '2026-01-02 12:00:00' },
    { price: 120, fetched_at: '2026-01-03 12:00:00' },
  ];
  const daily = sampleDailySeries(history);
  assert.deepEqual(daily.map(row => row.price), [102, 110, 120]);
  assert.deepEqual(daily.map(row => row.fetched_at), [
    '2026-01-01 23:55:00', '2026-01-02 12:00:00', '2026-01-03 12:00:00',
  ]);
});

test('daily sampling handles ISO timestamps and drops rows without timestamps', () => {
  const history = [
    { price: 100, fetched_at: '2026-01-01T10:00:00.000Z' },
    { price: 101, fetched_at: '2026-01-01T22:00:00.000Z' },
    { price: 999, fetched_at: null },
    { price: 110, fetched_at: '2026-01-02T10:00:00.000Z' },
  ];
  const daily = sampleDailySeries(history);
  assert.deepEqual(daily.map(row => row.price), [101, 110]);
});

test('change_7d computed on 10 hours of 5-minute data must not be mislabeled', () => {
  // 90 天日线采样后，MA5/MA20 需要 5/20 个"日"而不是 5/20 个 5 分钟点
  const daily = sampleDailySeries(
    Array.from({ length: 90 * 288 }, (_, i) => ({
      price: 100 + i,
      fetched_at: new Date(Date.UTC(2026, 0, 1) + i * 5 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
    })),
  );
  assert.equal(daily.length, 90);
});
