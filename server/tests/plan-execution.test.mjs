import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExecutionQuantityAndAmount } from '../routes/plans.js';

test('plan execution amount uses actual price times quantity instead of planned amount', () => {
  const result = resolveExecutionQuantityAndAmount(
    { quantity: 10, amount: 1000, executed_quantity: 0, executed_amount: 0 },
    { quantity: 10 },
    90,
  );

  assert.equal(result.actualQuantity, 10);
  assert.equal(result.actualAmount, 900);
});

test('remaining execution amount uses latest actual price times quantity', () => {
  const result = resolveExecutionQuantityAndAmount(
    { quantity: 10, amount: 1000, executed_quantity: 5, executed_amount: 450 },
    { quantity: 5 },
    80,
  );

  assert.equal(result.actualQuantity, 5);
  assert.equal(result.actualAmount, 400);
});
