import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCredits, levelFor, compactTokens } from '../quota.js';

const data = (used = 25, remaining = 75, extras = {}) => ({ subscription: {
    active: true, limits: { weeklyInputTokens: 100 },
    weekly_tokens: { used, remaining, percentUsed: .25, resetAt: 1791763200000, ...extras },
} });

test('fraction returned by NanoGPT is not mistaken for a percent', () => {
    assert.equal(normalizeCredits(data()).weekly.percentUsed, 25);
});
test('zero usage is valid when the entire allowance is available', () => {
    assert.equal(normalizeCredits(data(0, 100)).weekly.remaining, 100);
});
test('exhaustion and over-quota usage remain visible', () => {
    assert.equal(normalizeCredits(data(100, 0)).weekly.percentUsed, 100);
    const over = normalizeCredits(data(110, 0)).weekly;
    assert.ok(Math.abs(over.percentUsed - 110) < 0.000001);
    assert.equal(levelFor(over), 'danger');
});
test('missing/degraded counters cannot become a full allowance', () => {
    for (const payload of [data(null, null), data(0, 0), data(0, 100, { degraded: true }), data(0, 100, { resetAt: 0 }), data(NaN, 100)]) {
        assert.equal(normalizeCredits(payload).weekly, null);
    }
});
test('daily limit is optional and inactive subscription is not a zero balance', () => {
    assert.equal(normalizeCredits(data()).daily, null);
    assert.equal(normalizeCredits({}).active, false);
    assert.equal(normalizeCredits({ subscription: { active: false } }).weekly, null);
    assert.equal(compactTokens(null), '—');
});
test('thresholds warn before exhaustion', () => {
    assert.equal(levelFor(normalizeCredits(data(74, 26)).weekly), 'normal');
    assert.equal(levelFor(normalizeCredits(data(75, 25)).weekly), 'warning');
    assert.equal(levelFor(normalizeCredits(data(90, 10)).weekly), 'danger');
});
