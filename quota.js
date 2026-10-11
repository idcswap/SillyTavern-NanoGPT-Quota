const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

// ST 1.19's built-in credits route coalesces missing NanoGPT counters to zero.
// Reject empty/inconsistent buckets rather than claiming the allowance is full.
function bucket(raw, limit) {
    if (!raw || raw.degraded || !nonnegative(raw.used) || !nonnegative(raw.remaining)) return null;
    if (!nonnegative(limit) || limit <= 0) return null;
    if (!nonnegative(raw.resetAt) || raw.resetAt <= 0) return null;
    const expected = Math.max(0, limit - raw.used);
    if (Math.abs(raw.remaining - expected) > Math.max(2, limit * 0.000001)) return null;
    return {
        used: raw.used,
        remaining: raw.remaining,
        limit,
        percentUsed: raw.used / limit * 100,
        resetAt: raw.resetAt,
    };
}

export function normalizeCredits(data) {
    const sub = data?.subscription;
    if (!sub || sub.active !== true) return { active: false, weekly: null, daily: null, allowOverage: false };
    return {
        active: true,
        weekly: bucket(sub.weekly_tokens, sub.limits?.weeklyInputTokens),
        daily: bucket(sub.daily_tokens, sub.limits?.dailyInputTokens),
        allowOverage: sub.allowOverage === true,
    };
}

export function compactTokens(value) {
    if (!nonnegative(value)) return '—';
    return new Intl.NumberFormat('ru-RU', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function fullTokens(value) {
    if (!nonnegative(value)) return '—';
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
}

export function levelFor(weekly) {
    if (!weekly) return 'unknown';
    if (weekly.percentUsed >= 90) return 'danger';
    if (weekly.percentUsed >= 75) return 'warning';
    return 'normal';
}
