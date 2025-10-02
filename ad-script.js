/* ad-script.js
   Dynamic Automated Ads
   Sponsored by It Is Unique Official
   Namespace: iiuo-
   Plain & Professional
   Production-ready
*/

(function iiuoAds() {
  "use strict";

  // -------- Config -------- //
  const XML_PATH = "https://ads.itisuniqueofficial.com/ad-data.xml";
  const STORAGE_KEY = "iiuo_ad_metrics_final";
  const DISMISSED_KEY = "iiuo_ad_dismissed";
  const FREQUENCY_CAP = 5;
  const FETCH_TIMEOUT = 8000;
  const DEBUG = true;
  const BATCH_INTERVAL = 5000;
  const CLICK_DEBOUNCE_MS = 1500;

  let allAds = [];
  const batchedEvents = { clicks: [], impressions: [], sponsors: new Set() };
  const lastClickTimes = {};

  // -------- Helpers -------- //
  function debugLog(...args) {
    if (DEBUG) console.log("[iiuo-ads]", ...args);
  }

  const qText = (el, sel, def = "") =>
    el.querySelector(sel)?.textContent?.trim() ?? def;

  function adIdFrom(adEl) {
    const raw = qText(adEl, "href", "") + qText(adEl, "ad-title", "");
    return "iiuo_" + btoa(unescape(encodeURIComponent(raw))).replace(/=+$/, "");
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeURL(url) {
    try {
      const u = new URL(url, window.location.href);
      if (["http:", "https:"].includes(u.protocol)) return u.href;
    } catch {}
    return "#";
  }

  function safeLocalStorage(action, key, value) {
    try {
      if (action === "get") return JSON.parse(localStorage.getItem(key) || "{}");
      if (action === "set") localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      debugLog("LocalStorage blocked:", e);
      return action === "get" ? {} : undefined;
    }
  }

  function loadMetrics() {
    return safeLocalStorage("get", STORAGE_KEY);
  }
  function saveMetrics(m) {
    safeLocalStorage("set", STORAGE_KEY, m);
  }
  function ensureMetric(m, id) {
    if (!m[id]) {
      m[id] = {
        impressions: 0,
        clicks: 0,
        title: "",
        href: "",
        lastShownDay: null,
      };
    }
    return m[id];
  }

  function loadDismissed() {
    return safeLocalStorage("get", DISMISSED_KEY);
  }
  function saveDismissed(ids) {
    safeLocalStorage("set", DISMISSED_KEY, ids);
  }

  // -------- CSS Injection -------- //
  function injectCSS() {
    if (document.getElementById("iiuo-ad-style")) return;
    if (!document.querySelector(".iiuo-ad-container")) return;

    const style = document.createElement("style");
    style.id = "iiuo-ad-style";
    style.textContent = `
.iiuo-ad-container{width:100%;margin:16px 0;display:block;box-sizing:border-box;text-align:left}
.iiuo-ad-card{width:100%;border:1px solid #ddd;border-radius:6px;background:#fff;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;text-align:left}
.iiuo-ad-card a,.iiuo-ad-card a:visited{text-decoration:none;color:inherit;outline:none}
.iiuo-ad-top{display:flex;justify-content:space-between;align-items:center;padding:6px 12px;background:#f9f9f9;font-size:12px;color:#666;border-bottom:1px solid #e6e6e6;flex-wrap:wrap;gap:6px;text-align:left}
.iiuo-ad-top a{color:#0066cc;font-weight:500}
.iiuo-ad-close{border:none;background:none;font-size:18px;cursor:pointer;color:#777;line-height:1;padding:2px 6px}
.iiuo-ad-close:hover{color:#000}
.iiuo-ad-badge{display:inline-block;margin-left:6px;padding:1px 4px;font-size:10px;font-weight:600;color:#333;border:1px solid #ccc;background:#f4f4f4;text-transform:uppercase;letter-spacing:.5px;text-align:left}
.iiuo-ad-body{display:flex;gap:12px;padding:10px;align-items:flex-start;width:100%;box-sizing:border-box;text-align:left}
.iiuo-ad-icon{width:90px;height:90px;aspect-ratio:1/1;object-fit:cover;border:1px solid #ddd;border-radius:4px;flex-shrink:0}
.iiuo-ad-text{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;overflow-wrap:break-word;word-break:break-word;text-align:left}
.iiuo-ad-title{font-size:15px;font-weight:700;color:#0056a3;margin:0 0 4px;line-height:1.3;text-align:left}
.iiuo-ad-desc{font-size:13px;color:#444;margin:0 0 4px;line-height:1.5;text-align:left}
.iiuo-ad-link{font-size:12px;color:#006600;word-break:break-word;opacity:.9;text-align:left}
@media(max-width:600px){
  .iiuo-ad-body{flex-direction:column;gap:10px;align-items:flex-start;text-align:left}
  .iiuo-ad-icon{width:100%;height:auto;border-radius:0;border:none}
  .iiuo-ad-title{font-size:14px;text-align:left}
  .iiuo-ad-desc{font-size:13px;text-align:left}
  .iiuo-ad-link{font-size:12px;text-align:left}
}
@media(prefers-color-scheme:dark){
  .iiuo-ad-card{background:#1e1e1e;border-color:#333;color:#eee}
  .iiuo-ad-top{background:#2a2a2a;border-bottom-color:#333;color:#aaa}
  .iiuo-ad-title{color:#4da6ff}
  .iiuo-ad-link{color:#55dd55}
  .iiuo-ad-desc{color:#ccc}
  .iiuo-ad-badge{background:#333;border-color:#555;color:#bbb}
}
`;
    document.head.appendChild(style);
  }

  // -------- Daily Reset -------- //
  function resetDailyMetrics(metrics) {
    const today = new Date().toISOString().slice(0, 10);
    Object.values(metrics).forEach((metric) => {
      if (metric.lastShownDay !== today) {
        metric.impressions = 0;
        metric.lastShownDay = today;
      }
    });
    saveMetrics(metrics);
  }
  setInterval(() => {
    const metrics = loadMetrics();
    resetDailyMetrics(metrics);
  }, 3600000);

  // -------- Fetch Ads -------- //
  async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: "no-store",
      });
    } finally {
      clearTimeout(id);
    }
  }

  async function fetchAds(xmlPath) {
    try {
      const res = await fetchWithTimeout(xmlPath);
      if (!res.ok) throw new Error("HTTP " + res.status);

      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, "application/xml");

      allAds = Array.from(xml.getElementsByTagName("ad"));
      return {
        ads: allAds,
        rotationInterval:
          parseInt(xml.documentElement.getAttribute("rotation-interval")) || 0,
      };
    } catch (e) {
      debugLog("Ad fetch failed:", e);
      return { ads: [], rotationInterval: 0 };
    }
  }

  // -------- Queue & Selection -------- //
  function buildAdQueue() {
    return allAds
      .map((ad) => {
        const w = Math.max(1, parseInt(ad.getAttribute("weight")) || 1);
        return Array(w).fill(ad);
      })
      .flat();
  }

  function nextAd(metrics, dismissed) {
    const queue = buildAdQueue();
    for (let ad of queue) {
      const id = adIdFrom(ad);
      if (dismissed[id]) continue;
      const metric = ensureMetric(metrics, id);
      if (metric.impressions < FREQUENCY_CAP) return ad;
    }
    return queue[0] || null;
  }

  // -------- GA + Batching -------- //
  function enqueueEvent(type, data) {
    if (type === "click") batchedEvents.clicks.push(data);
    if (type === "impression") batchedEvents.impressions.push(data);
    if (type === "sponsor") batchedEvents.sponsors.add(data.sponsor);
    debugLog(`Enqueued ${type}:`, data);
  }

  function sendBatchedEvents() {
    if (batchedEvents.clicks.length > 0) {
      if (typeof gtag === "function")
        gtag("event", "ads-iiuo-clicks", { ads: batchedEvents.clicks });
      debugLog("Batched Clicks Sent:", batchedEvents.clicks);
      batchedEvents.clicks = [];
    }
    if (batchedEvents.impressions.length > 0) {
      if (typeof gtag === "function")
        gtag("event", "ads-iiuo-impressions", {
          ads: batchedEvents.impressions,
        });
      debugLog("Batched Impressions Sent:", batchedEvents.impressions);
      batchedEvents.impressions = [];
    }
    if (batchedEvents.sponsors.size > 0) {
      if (typeof gtag === "function")
        gtag("event", "ads-iiuo-sponsors", {
          sponsors: Array.from(batchedEvents.sponsors),
        });
      debugLog("Batched Sponsors Sent:", Array.from(batchedEvents.sponsors));
      batchedEvents.sponsors.clear();
    }
  }

  setInterval(sendBatchedEvents, BATCH_INTERVAL);
  window.addEventListener("beforeunload", sendBatchedEvents);
  window.addEventListener("pagehide", sendBatchedEvents);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) sendBatchedEvents();
  });

  // -------- Rendering -------- //
  function renderAdInto(container, adEl, metrics, dismissed) {
    const href = safeURL(qText(adEl, "href", "#"));
    const sponsorUrl = safeURL(qText(adEl, "sponsor-url", "#"));
    const sponsorName = escapeHTML(
      qText(adEl, "sponsor-name", "It Is Unique Official")
    );
    const src = safeURL(qText(adEl, "src", ""));
    const adTitle = escapeHTML(qText(adEl, "ad-title", "Untitled Ad"));
    const adDesc = escapeHTML(qText(adEl, "ad-desc", ""));
    const adLink = escapeHTML(qText(adEl, "ad-link", href));
    const id = adIdFrom(adEl);

    const metric = ensureMetric(metrics, id);
    metric.title = adTitle;
    metric.href = href;

    const adCard = document.createElement("aside");
    adCard.className = "iiuo-ad-card";
    adCard.setAttribute("role", "region");
    adCard.setAttribute("aria-label", "Advertisement");
    adCard.innerHTML = `
      <div class="iiuo-ad-top">
        <span class="iiuo-ad-sponsor">
          Sponsored · <a href="${sponsorUrl}" target="_blank" rel="noopener nofollow">${sponsorName}</a>
          <span class="iiuo-ad-badge">Ad</span>
        </span>
        <button class="iiuo-ad-close" aria-label="Dismiss ad">×</button>
      </div>
      <a class="iiuo-ad-body" href="${href}" target="_blank" rel="noopener sponsored nofollow">
        <img class="iiuo-ad-icon" src="${src}" alt="${adTitle} - ${sponsorName}" loading="lazy" />
        <div class="iiuo-ad-text">
          <div class="iiuo-ad-title">${adTitle}</div>
          <div class="iiuo-ad-desc">${adDesc}</div>
          <span class="iiuo-ad-link">${adLink}</span>
        </div>
      </a>
    `;

    // Close button with persistence
    adCard.querySelector(".iiuo-ad-close").addEventListener("click", () => {
      dismissed[id] = true;
      saveDismissed(dismissed);
      adCard.remove();
    });

    // Click tracking with debounce
    adCard.querySelector(".iiuo-ad-body").addEventListener("click", () => {
      const now = Date.now();
      if (lastClickTimes[id] && now - lastClickTimes[id] < CLICK_DEBOUNCE_MS) return;
      lastClickTimes[id] = now;
      metric.clicks++;
      saveMetrics(metrics);
      enqueueEvent("click", {
        ad_id: id,
        ad_title: adTitle,
        sponsor: sponsorName,
        href: href,
      });
    });

    // Impression tracking
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        if (entries[0].isIntersecting) {
          metric.impressions++;
          saveMetrics(metrics);
          enqueueEvent("impression", {
            ad_id: id,
            ad_title: adTitle,
            sponsor: sponsorName,
          });
          enqueueEvent("sponsor", { sponsor: sponsorName });
          obs.disconnect();
        }
      }, { threshold: 0.5 });
      observer.observe(adCard);
    } else {
      metric.impressions++;
      saveMetrics(metrics);
      enqueueEvent("impression", {
        ad_id: id,
        ad_title: adTitle,
        sponsor: sponsorName,
      });
      enqueueEvent("sponsor", { sponsor: sponsorName });
    }

    container.innerHTML = "";
    container.appendChild(adCard);
    debugLog("Rendered Ad:", { id, adTitle, sponsorName, href, impressions: metric.impressions, clicks: metric.clicks });
  }

  // -------- Boot -------- //
  async function boot() {
    injectCSS();
    const metrics = loadMetrics();
    const dismissed = loadDismissed();
    const { ads, rotationInterval } = await fetchAds(XML_PATH);

    const containers = document.querySelectorAll(".iiuo-ad-container");
    if (!ads.length) {
      containers.forEach((c) => (c.innerHTML = "<p style='text-align:left'>No ads available.</p>"));
      return;
    }

    function renderAll() {
      containers.forEach((container) => {
        const ad = nextAd(metrics, dismissed);
        if (ad) renderAdInto(container, ad, metrics, dismissed);
      });
    }

    renderAll();

    if (rotationInterval > 0) {
      setInterval(() => {
        if (!document.hidden) renderAll();
      }, rotationInterval * 1000);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);

})();
