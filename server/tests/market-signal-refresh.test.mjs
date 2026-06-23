import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MARKET_SIGNAL_REFRESH_INTERVAL_MINUTES,
  getMarketSignalRefreshIntervalMinutes,
} from '../services/market-signal-refresh.js';

function dbWithSetting(value) {
  return {
    prepare() {
      return {
        get() {
          return value === undefined ? undefined : { value };
        },
      };
    },
  };
}

test('market signal refresh interval uses default when setting is absent or invalid', () => {
  assert.equal(getMarketSignalRefreshIntervalMinutes(dbWithSetting(undefined)), DEFAULT_MARKET_SIGNAL_REFRESH_INTERVAL_MINUTES);
  assert.equal(getMarketSignalRefreshIntervalMinutes(dbWithSetting('not-a-number')), DEFAULT_MARKET_SIGNAL_REFRESH_INTERVAL_MINUTES);
});

test('market signal refresh interval supports disabling with zero and clamps negatives', () => {
  assert.equal(getMarketSignalRefreshIntervalMinutes(dbWithSetting('0')), 0);
  assert.equal(getMarketSignalRefreshIntervalMinutes(dbWithSetting('-10')), 0);
});

test('market signal refresh interval returns configured minute value', () => {
  assert.equal(getMarketSignalRefreshIntervalMinutes(dbWithSetting('45')), 45);
});
