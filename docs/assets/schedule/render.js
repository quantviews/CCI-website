/* assets/schedule/render.js
   Renders a compact "publication schedule" block from assets/schedule/events.json

   Usage in .qmd/.html:
     <div class="schedule-block" data-market="all" data-limit="6"></div>
     <script src="assets/schedule/render.js" defer></script>

   Optional attributes:
     data-market="coal"   // filter by market key
     data-limit="12"      // number of items (fallback mode)
     data-mode="week"     // "week" (current week Mon-Sun) or "next" (next N items). default: "next"
*/

(function () {
  "use strict";

  // ---------- Config ----------
  const EVENTS_URL = "assets/schedule/events.json";
  const SELECTOR = ".schedule-block";
  const LOCALE = "ru-RU";

  // ---------- Boot ----------
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }

  async function main() {
    const blocks = document.querySelectorAll(SELECTOR);
    if (!blocks.length) return;

    // Render skeletons first to avoid "layout jump"
    blocks.forEach((b) => (b.innerHTML = skeletonHtml()));

    let events;
    try {
      events = await loadEvents(EVENTS_URL);
    } catch (err) {
      console.error("Schedule: failed to load events:", err);
      blocks.forEach((b) => renderError(b, "Не удалось загрузить план публикаций."));
      return;
    }

    // Normalize + sort ascending by date
    const normalized = normalizeEvents(events).sort((a, b) => a.dateISO.localeCompare(b.dateISO));

    blocks.forEach((block) => {
      try {
        renderBlock(block, normalized);
      } catch (err) {
        console.error("Schedule: render error:", err);
        renderError(block, "Ошибка отображения плана публикаций.");
      }
    });
  }

  // ---------- Rendering ----------
  function renderBlock(block, events) {
    const market = (block.dataset.market || "all").trim();
    // Минимум 10 ближайших публикаций по умолчанию,
    // даже если где-то задан меньший data-limit.
    const limitRaw = clampInt(block.dataset.limit, 1, 100, 10);
    const limit = Math.max(limitRaw, 10);
    const mode = (block.dataset.mode || "next").trim().toLowerCase(); // "week" or "next"

    const filteredByMarket = events.filter((e) => market === "all" || e.market === market);

    const now = new Date();
    const selected =
      mode === "week"
        ? filterCurrentWeek(filteredByMarket, now)
        : nextNEvents(filteredByMarket, now, limit);

    // Fallback: if "week" has too few items, show next N
    const items = mode === "week" && selected.length < Math.min(3, limit)
      ? nextNEvents(filteredByMarket, now, limit)
      : selected;

    if (!items.length) {
      block.innerHTML = emptyHtml(market);
      return;
    }

    const subtitle = buildSubtitle(market, mode, items.length);
    const itemsHtml = items.map((e) => itemHtml(e)).join("");

    block.innerHTML = `
      <section class="sched" aria-label="План публикаций отчетов">
        <div class="sched__head">
          <div>
            <h3 class="sched__title">План публикаций</h3>
            <div class="sched__subtitle">${escapeHtml(subtitle)}</div>
          </div>
          <a class="sched__link" href="https://pbc-index.ru/pdf/%D0%A6%D0%A6%D0%98_%D0%B3%D1%80%D0%B0%D1%84%D0%B8%D0%BA_%D0%BE%D1%82%D1%87%D0%B5%D1%82%D0%BE%D0%B2_2026.pdf" target="_blank" rel="noopener">Весь план</a>
        </div>

        <div class="sched__list">
          ${itemsHtml}
        </div>
      </section>
    `;
  }

  function itemHtml(e) {
    return `
      <article class="sched__item">
        <time class="sched__date" datetime="${e.dateISO}">
          <span class="sched__day">${fmtDay(e.date)}</span>
          <span class="sched__mon">${fmtMon(e.date)}</span>
        </time>

        <div class="sched__body">
          <div class="sched__meta">
            <span class="sched__badge">${escapeHtml(e.marketTitle)}</span>
            ${e.cadence ? `<span class="sched__badge sched__badge--muted">${escapeHtml(cadenceLabel(e.cadence))}</span>` : ``}
          </div>
          <div class="sched__text">Запланирован выпуск «${escapeHtml(e.title)}»</div>

        </div>
      </article>
    `;
  }

  function skeletonHtml() {
    return `
      <section class="sched" aria-label="План публикаций отчетов">
        <div class="sched__head">
          <div>
            <h3 class="sched__title">План публикаций</h3>
            <div class="sched__subtitle">Загрузка…</div>
          </div>
        </div>
        <div class="sched__list">
          ${[0, 1, 2].map(() => `
            <div class="sched__item" style="opacity:.6">
              <div class="sched__date">&nbsp;</div>
              <div class="sched__body">
                <div class="sched__meta">
                  <span class="sched__badge">…</span>
                </div>
                <div class="sched__text">…</div>
              </div>
            </div>`).join("")}
        </div>
      </section>
    `;
  }

  function emptyHtml(market) {
    const msg = market === "all"
      ? "Публикации по графику отсутствуют."
      : "Публикации по этому рынку по графику отсутствуют.";
    return `
      <section class="sched" aria-label="План публикаций отчетов">
        <div class="sched__head">
          <div>
            <h3 class="sched__title">План публикаций</h3>
            <div class="sched__subtitle">${escapeHtml(msg)}</div>
          </div>
          <a class="sched__link" href="https://pbc-index.ru/pdf/%D0%A6%D0%A6%D0%98_%D0%B3%D1%80%D0%B0%D1%84%D0%B8%D0%BA_%D0%BE%D1%82%D1%87%D0%B5%D1%82%D0%BE%D0%B2_2026.pdf" target="_blank" rel="noopener">Весь план</a>
        </div>
      </section>
    `;
  }

  function renderError(block, message) {
    block.innerHTML = `
      <section class="sched" aria-label="План публикаций отчетов">
        <div class="sched__head">
          <div>
            <h3 class="sched__title">План публикаций</h3>
            <div class="sched__subtitle">${escapeHtml(message)}</div>
          </div>
        </div>
      </section>
    `;
  }

  // ---------- Data ----------
  async function loadEvents(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("events.json must be an array");
    return data;
  }

  function normalizeEvents(arr) {
    // Expected minimal fields:
    // { date: "YYYY-MM-DD", market: "coal", market_title: "Уголь", title: "..." }
    return arr
      .map((raw) => {
        const dateISO = String(raw.date || "").trim();
        const date = parseISODate(dateISO);
        if (!date) return null;

        const market = String(raw.market || "").trim();
        const marketTitle = String(raw.market_title || raw.marketTitle || market || "Рынок").trim();
        const title = String(raw.title || "").trim();

        // optional
        const cadence = raw.cadence ? String(raw.cadence).trim() : "";

        return {
          dateISO,
          date,
          market,
          marketTitle,
          title,
          cadence,
        };
      })
      .filter(Boolean);
  }

  function parseISODate(s) {
    // Strict YYYY-MM-DD, avoid timezone surprises
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    // Validate round-trip
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d
    ) return null;
    // Use local Date for formatting but keep the same Y-M-D
    return new Date(y, mo - 1, d, 12, 0, 0, 0);
  }

  // ---------- Selection logic ----------
  function nextNEvents(events, now, n) {
    // take next n events, including today and future
    const today = stripTime(now);
    const upcoming = events.filter((e) => stripTime(e.date) >= today);
    return upcoming.slice(0, n);
  }

  function filterCurrentWeek(events, now) {
    const [w0, w1] = weekBounds(now); // [Mon 00:00, next Mon 00:00)
    return events.filter((e) => {
      const dt = stripTime(e.date);
      return dt >= w0 && dt < w1;
    });
  }

  function weekBounds(date) {
    const d = stripTime(date);
    const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
    const mon = new Date(d);
    mon.setDate(d.getDate() - day);
    mon.setHours(0, 0, 0, 0);
    const nextMon = new Date(mon);
    nextMon.setDate(mon.getDate() + 7);
    return [mon, nextMon];
  }

  function stripTime(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  // ---------- Formatting ----------
  function fmtDay(d) {
    return new Intl.DateTimeFormat(LOCALE, { day: "2-digit" }).format(d);
  }

  function fmtMon(d) {
    // "янв", "фев", ... remove trailing dot if present
    return new Intl.DateTimeFormat(LOCALE, { month: "short" })
      .format(d)
      .replace(".", "")
      .toLowerCase();
  }

  function cadenceLabel(c) {
    const map = {
      daily: "ежедн.",
      weekly: "еженед.",
      monthly: "ежемес.",
      quarterly: "кварт.",
      yearly: "год.",
    };
    return map[c] || c;
  }

  function buildSubtitle(market, mode, count) {
    const where = market === "all" ? "" : ` по рынку: ${market}`;
    if (mode === "week") return `На этой неделе${where}: ${count}`;
    return `Ближайшие публикации${where}: ${count}`;
  }

  // ---------- Utils ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (ch) => {
      switch (ch) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#39;";
        default: return ch;
      }
    });
  }

  function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }
})();
