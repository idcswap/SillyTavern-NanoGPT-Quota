import { normalizeCredits, compactTokens, fullTokens, levelFor } from './quota.js';

const { eventSource, event_types, getRequestHeaders } = SillyTavern.getContext();
const POLL_MS = 5 * 60_000;
const AUTO_MIN_MS = 60_000;
const MANUAL_MIN_MS = 15_000;
let model = null;
let updatedAt = 0;
let attemptedAt = 0;
let pending = null;
let errorText = '';
let pinned = false;
let closeTimer;
let generationTimer;
let host;
let button;
let panel;

function setText(selector, text) { panel.querySelector(selector).textContent = text; }

function positionPanel() {
    const anchor = button.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
    const above = anchor.top - height - 10;
    const top = above >= 8 ? above : Math.max(8, Math.min(anchor.bottom + 10, window.innerHeight - height - 8));
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
}

function render() {
    const weekly = model?.weekly;
    const old = updatedAt > 0 && Date.now() - updatedAt >= 10 * 60_000;
    host.dataset.level = errorText || old ? 'unknown' : levelFor(weekly);
    panel.dataset.level = host.dataset.level;
    button.querySelector('.ngq-badge').textContent = weekly ? `${Math.max(0, Math.round(100 - weekly.percentUsed))}%` : '—';
    button.setAttribute('aria-label', weekly
        ? `NanoGPT: осталось ${fullTokens(weekly.remaining)} входных токенов за неделю. Открыть статистику.`
        : 'NanoGPT: открыть статистику подписки');
    setText('.ngq-remaining', weekly ? compactTokens(weekly.remaining) : '—');
    panel.querySelector('.ngq-remaining').title = weekly ? fullTokens(weekly.remaining) : '';
    setText('.ngq-used', weekly ? fullTokens(weekly.used) : '—');
    setText('.ngq-limit', weekly ? fullTokens(weekly.limit) : '—');
    setText('.ngq-reset', weekly
        ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(weekly.resetAt)
        : '—');
    const fill = panel.querySelector('.ngq-fill');
    fill.style.width = `${Math.max(0, Math.min(100, weekly?.percentUsed ?? 0))}%`;
    const meter = panel.querySelector('.ngq-meter');
    if (weekly) {
        meter.setAttribute('aria-valuenow', String(Math.round(Math.min(100, weekly.percentUsed))));
        meter.setAttribute('aria-valuetext', `Использовано ${weekly.percentUsed.toFixed(1)}% недельной квоты`);
    } else {
        meter.removeAttribute('aria-valuenow');
        meter.setAttribute('aria-valuetext', 'Расход неизвестен');
    }
    const daily = panel.querySelector('.ngq-daily-row');
    daily.hidden = !model?.daily;
    setText('.ngq-daily', model?.daily ? `${fullTokens(model.daily.remaining)} осталось` : '—');
    const overage = panel.querySelector('.ngq-overage');
    overage.hidden = !model?.allowOverage;
    setText('.ngq-status', errorText
        ? (updatedAt ? `Последние данные · ${errorText}` : errorText)
        : old ? 'Данные устарели — обнови статистику'
        : model && !model.active ? 'Активная подписка не получена'
        : model && !weekly ? 'Недельная квота недоступна'
        : pending ? 'Обновление…'
        : updatedAt ? `Обновлено в ${new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(updatedAt)}`
        : 'Загрузка статистики…');
    const refresh = panel.querySelector('.ngq-refresh');
    refresh.disabled = Boolean(pending);
    refresh.classList.toggle('ngq-loading', Boolean(pending));
    if (!panel.hidden) positionPanel();
}

async function refresh(manual = false) {
    if (pending || document.hidden) return;
    if (Date.now() - attemptedAt < (manual ? MANUAL_MIN_MS : AUTO_MIN_MS)) return;
    attemptedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    pending = (async () => {
        try {
            const response = await fetch('/api/nanogpt/credits', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: '{}',
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(response.status === 400 ? 'Добавь ключ NanoGPT в настройках API'
                    : response.status === 401 || response.status === 403 ? 'Проверь подключение и обнови страницу'
                    : 'NanoGPT не ответил; можно повторить позже');
            }
            model = normalizeCredits(await response.json());
            updatedAt = Date.now();
            errorText = '';
        } catch (error) {
            errorText = error.name === 'AbortError' ? 'Превышено время ожидания'
                : error instanceof TypeError ? 'Нет соединения с сервером'
                : error instanceof SyntaxError ? 'Не удалось прочитать статистику'
                : error.message;
        } finally {
            clearTimeout(timeout);
            pending = null;
            render();
        }
    })();
    render();
    await pending;
}

function open() {
    clearTimeout(closeTimer);
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    render();
    void refresh();
}

function close() {
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
}

function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
        if (!pinned && !panel.matches(':hover') && !host.matches(':hover')
            && !panel.contains(document.activeElement) && !host.contains(document.activeElement)) close();
    }, 200);
}

function init() {
    if (document.getElementById('ngq-host')) return;
    const target = document.getElementById('leftSendForm');
    if (!target) return;
    host = document.createElement('div');
    host.id = 'ngq-host';
    host.innerHTML = `<button type="button" class="ngq-trigger interactable" aria-haspopup="dialog" aria-expanded="false" aria-controls="ngq-panel">
        <i class="fa-solid fa-gauge-high" aria-hidden="true"></i><span class="ngq-badge">—</span></button>`;
    button = host.querySelector('button');
    target.append(host);
    panel = document.createElement('section');
    panel.id = 'ngq-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Недельная квота NanoGPT');
    panel.innerHTML = `<header class="ngq-header"><span><i class="fa-solid fa-gauge-high" aria-hidden="true"></i> NanoGPT</span>
        <button type="button" class="ngq-refresh" aria-label="Обновить статистику" title="Обновить статистику"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button></header>
        <div class="ngq-caption">Осталось на неделю</div><div class="ngq-remaining">—</div>
        <div class="ngq-meter" role="progressbar" aria-label="Использовано недельной квоты" aria-valuemin="0" aria-valuemax="100"><div class="ngq-fill"></div></div>
        <dl class="ngq-details"><div><dt>Использовано</dt><dd class="ngq-used">—</dd></div>
        <div><dt>Недельный лимит</dt><dd class="ngq-limit">—</dd></div>
        <div><dt>Сброс квоты</dt><dd class="ngq-reset">—</dd></div>
        <div class="ngq-daily-row" hidden><dt>На сегодня</dt><dd class="ngq-daily">—</dd></div></dl>
        <div class="ngq-overage" hidden>В подписке включена доплата после лимита.</div>
        <footer><div class="ngq-status" aria-live="polite"></div><div class="ngq-help">Входные токены · весь аккаунт<br>Статистика NanoGPT, не размер контекста чата</div></footer>`;
    document.body.append(panel);
    host.addEventListener('mouseenter', open);
    host.addEventListener('mouseleave', scheduleClose);
    host.addEventListener('focusin', open);
    host.addEventListener('focusout', scheduleClose);
    panel.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    panel.addEventListener('mouseleave', scheduleClose);
    panel.addEventListener('focusout', scheduleClose);
    button.addEventListener('click', () => {
        pinned = !pinned;
        if (pinned) open(); else close();
    });
    panel.querySelector('.ngq-refresh').addEventListener('click', () => void refresh(true));
    document.addEventListener('pointerdown', event => {
        if (!host.contains(event.target) && !panel.contains(event.target)) { pinned = false; close(); }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) {
            pinned = false;
            if (panel.contains(document.activeElement)) button.focus();
            close();
        }
    });
    window.addEventListener('resize', () => { if (!panel.hidden) positionPanel(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); void refresh(); } });
    eventSource.on(event_types.GENERATION_ENDED, () => {
        clearTimeout(generationTimer);
        generationTimer = setTimeout(() => void refresh(), 10_000);
    });
    for (const event of [event_types.SECRET_WRITTEN, event_types.SECRET_ROTATED, event_types.CONNECTION_PROFILE_LOADED]) {
        if (event) eventSource.on(event, () => {
            model = null; updatedAt = 0; errorText = ''; render();
            // Let an in-flight request finish before fetching the new selection.
            if (!pending && Date.now() - attemptedAt >= MANUAL_MIN_MS) void refresh(true);
        });
    }
    setInterval(() => { render(); void refresh(); }, POLL_MS);
    render();
    void refresh();
}

// APP_READY is emitted after extension loading and replays for late listeners.
eventSource.on(event_types.APP_READY, init);
