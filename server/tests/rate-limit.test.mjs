import test from 'node:test';
import assert from 'node:assert/strict';
import createRateLimiter, { createHitCounter } from '../utils/rate-limit.js';

test('hit counter allows up to max within window then blocks', () => {
  const counter = createHitCounter({ windowMs: 60_000, max: 3 });
  assert.equal(counter.hit('ip1').ok, true);
  assert.equal(counter.hit('ip1').ok, true);
  assert.equal(counter.hit('ip1').ok, true);
  const blocked = counter.hit('ip1');
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSec > 0);
  // 其他 key 不受影响
  assert.equal(counter.hit('ip2').ok, true);
});

test('hit counter lockout persists until reset or expiry', () => {
  const counter = createHitCounter({ windowMs: 1000, max: 1, lockoutMs: 60_000 });
  assert.equal(counter.hit('ip1').ok, true);
  assert.equal(counter.hit('ip1').ok, false);
  counter.reset('ip1');
  assert.equal(counter.hit('ip1').ok, true);
});

test('rate limiter middleware returns 429 and Retry-After', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
  const req = { ip: '203.0.113.7', connection: {} };
  const responses = [];
  const res = {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { responses.push(code); return { json() {} }; },
  };
  const next = () => responses.push('next');
  limiter(req, res, next);
  limiter(req, res, next);
  assert.deepEqual(responses, ['next', 429]);
  assert.ok(Number(res.headers['Retry-After']) > 0);
});
