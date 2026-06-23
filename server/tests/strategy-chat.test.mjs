import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatPrompt, buildChatRepairPrompt } from '../services/strategy-chat.js';

const strategy = {
  id: 1,
  name: '测试策略',
  type: 'grid',
  parameters: JSON.stringify({ low: 80, high: 120, grids: 4, amount_per: 1000 }),
};

const plans = [
  { id: 11, seq: 1, trigger_type: 'price_below', trigger_value: 110, action: 'buy', amount: 1000 },
  { id: 12, seq: 2, trigger_type: 'price_below', trigger_value: 100, action: 'buy', amount: 1000 },
];

test('strategy chat prompt asks for contextual semantic understanding instead of keyword matching', () => {
  const prompt = buildChatPrompt(strategy, plans, '调整一下');

  assert.match(prompt, /不要做关键词硬匹配/);
  assert.match(prompt, /结合策略类型、现有参数、现有计划/);
  assert.match(prompt, /风险水平、执行频率、仓位\/金额、价格触发线/);
  assert.match(prompt, /只有完全无法映射为策略、参数或计划修改时/);
});

test('strategy chat repair prompt includes the failed result and asks for a general second-pass interpretation', () => {
  const firstResult = {
    understood: false,
    interpretation: '无法理解',
    changes: null,
    summary: '请更具体地描述您想做的调整',
  };
  const prompt = buildChatRepairPrompt(strategy, plans, '太怂了', firstResult, '{"understood":false}');

  assert.match(prompt, /上一次策略调整理解失败/);
  assert.match(prompt, /这不是关键词适配任务/);
  assert.match(prompt, /方向性调整/);
  assert.match(prompt, /太怂了/);
  assert.match(prompt, /无法理解/);
});
