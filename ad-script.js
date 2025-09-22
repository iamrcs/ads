/* ad-script.js
   Dynamic Automated Ads
   Sponsored by It Is Unique Official
   Namespace: iiuo-
   Clean, Minimal, Responsive
*/

(function iiuoAds() {
  "use strict";

  const XML_PATH = "https://ads.itisuniqueofficial.com/ad-data.xml";
  const STORAGE_KEY = "iiuo_ad_metrics_v3";
  const FREQUENCY_CAP = 5; // max times same ad shown per session
  const FETCH_TIMEOUT = 8000; // ms
  const DEBUG = true;

  let adQueue = [];
  let allAds = [];

  // -------- CSS Injection -------- //
  function injectCSS() {
    if (document.getElementById("iiuo-ad-style")) return;
    const style = document.createElement("style");
    style.id = "iiuo-ad-style";
    style.textContent = `
      .iiuo-ad-container {
        width: 100%;
        margin: 16px 0;
        font-family: system-ui, Arial, sans-serif;
        display: block;
        box-sizing: border-box;
      }
      .iiuo-ad-card {
        width: 100%;
        border: 1px solid #ddd;
        border-radius: 10px;
        background: #fff;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      .iiuo-ad-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .iiuo-ad-card a,
      .iiuo-ad-card a:visited {
        text-decoration: none;
        color: inherit;
        outline: none;
      }
      .iiuo-ad-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 12px;
        background: #fafafa;
        font-size: 12px;
        color: #666;
        border-bottom: 1px solid #e6e6e6;
        flex-wrap: wrap;
        gap: 6px;
      }
      .iiuo-ad-top a { 
        color: #0066cc; 
        font-weight: 500; 
      }
      .iiuo-ad-close {
        border: none; 
        background: none;
        font-size: 18px; 
        cursor: pointer;
        color: #777; 
        line-height: 1;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .iiuo-ad-close:hover { 
        background: #eee; 
        color: #000; 
      }
      .iiuo-ad-badge {
        display: inline-block;
        margin-left: 6px;
        padding: 2px 6px;
        font-size: 10px;
        font-weight: 600;
        color: #333;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #f4f4f4;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .iiuo-ad-body {
        display: flex;
        gap: 14px;
        padding: 12px;
        align-items: flex-start;
        width: 100%;
        box-sizing: border-box;
        color: inherit;
        transition: background 0.2s ease;
      }
      .iiuo-ad-body:hover { background: #f9f9f9; }
      .iiuo-ad-icon {
        width: 90px; 
        height: 90px;
        border-radius: 6px;
        object-fit: cover;
        border: 1px solid #ddd;
        flex-shrink: 0;
      }
      .iiuo-ad-text {
        flex: 1; 
        min-width: 0;
        display: flex; 
        flex-direction: column;
        justify-content: center;
        overflow-wrap: break-word;
        word-break: break-word;
        line-break: anywhere;
      }
      .iiuo-ad-title {
        font-size: 16px; 
        font-weight: 700;
        color: #0056a3;
        margin: 0 0 6px; 
        line-height: 1.3;
      }
      .iiuo-ad-desc {
        font-size: 13px; 
        color: #444;
        margin: 0 0 6px; 
        line-height: 1.5;
      }
      .iiuo-ad-link {
        font-size: 12px; 
        color: #006600;
        word-break: break-word;
        opacity: 0.9;
      }
      @media (max-width: 600px) {
        .iiuo-ad-body { 
          flex-direction: column; 
          gap: 10px; 
          align-items: flex-start; 
        }
        .iiuo-ad-icon { 
          width: 100%; 
          max-height: 220px; 
          height: auto; 
        }
        .iiuo-ad-title { font-size: 15px; }
        .iiuo-ad-desc { font-size: 13px; }
        .iiuo-ad-link { font-size: 12px; }
      }
      @media (prefers-color-scheme: dark) {
        .iiuo-ad-card { 
          background: #1e1e1e; 
          border-color: #333; 
          color: #eee; 
        }
        .iiuo-ad-top { 
          background: #2a2a2a; 
          border-bottom-color: #333; 
          color: #aaa; 
        }
        .iiuo-ad-title { color: #4da6ff; }
        .iiuo-ad-link { color: #55dd55; }
        .iiuo-ad-desc { color: #ccc; }
        .iiuo-ad-badge { 
          background: #333; 
          border-color: #555; 
          color: #bbb; 
        }
        .iiuo-ad-close:hover { background: #444; }
        .iiuo-ad-body:hover { background: #242424; }
      }
    `;
    document.head.appendChild(style);
  }

  // -------- Helpers -------- //
  const qText = (el, sel, def = "") => el.querySelector(sel)?.textContent?.trim() ?? def;

  function adIdFrom(adEl) {
    const href = qText(adEl, "href", "");
    const title = qText(adEl, "ad-title", "");
    const str = href + "||" + title;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return `iiuo_${Math.abs(hash)}`;
  }

  function safeLocalStorage(action, key, value) {
    try {
      if (action === "get") return JSON.parse(localStorage.getItem(key) || "{}");
      if (action === "set") localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      if (DEBUG) console.warn("LocalStorage blocked:", e);
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
    if (!m[id]) m[id] = { impressions: 0, clicks: 0, title: "", href: "" };
    return m[id];
  }

  // -------- Fetch Ads (no cache + timeout) -------- //
  async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, { ...options, signal: controller.signal, cache: "no-store" });
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
        rotationInterval: parseInt(xml.documentElement.getAttribute("rotation-interval")) || 0,
      };
    } catch (e) {
      if (DEBUG) console.error("Ad fetch failed:", e);
      return { ads: [], rotationInterval: 0 };
    }
  }

  // -------- Queue & Selection -------- //
  function buildAdQueue() {
    adQueue = [];
    allAds.forEach((ad) => {
      const w = Math.max(1, parseInt(ad.getAttribute("weight")) || 1);
      for (let i = 0; i < w; i++) adQueue.push(ad);
    });
    for (let i = adQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [adQueue[i], adQueue[j]] = [adQueue[j], adQueue[i]];
    }
  }

  function nextAd(usedIds, metrics) {
    if (adQueue.length === 0) buildAdQueue();
    let tries = 0;
    while (adQueue.length && tries < adQueue.length) {
      const ad = adQueue.shift();
      const id = adIdFrom(ad);
      const metric = ensureMetric(metrics, id);
      if (usedIds.has(id)) { tries++; continue; }
      if (metric.impressions >= FREQUENCY_CAP) { tries++; continue; }
      return ad;
    }
    return null;
  }

  // -------- Rendering -------- //
  function renderAdInto(container, adEl, metrics) {
    const href = qText(adEl, "href", "#");
    const sponsorUrl = qText(adEl, "sponsor-url", "#");
    const sponsorName = qText(adEl, "sponsor-name", "It Is Unique Official");
    const src = qText(adEl, "src", "");
    const adTitle = qText(adEl, "ad-title", "Untitled Ad");
    const adDesc = qText(adEl, "ad-desc", "");
    const adLink = qText(adEl, "ad-link", href);

    const id = adIdFrom(adEl);
    const metric = ensureMetric(metrics, id);
    metric.title = adTitle; metric.href = href;

    const adCard = document.createElement("aside");
    adCard.className = "iiuo-ad-card";
    adCard.innerHTML = `
      <header class="iiuo-ad-top">
        <span class="iiuo-ad-sponsor">
          Sponsored · <a href="${sponsorUrl}" target="_blank" rel="noopener nofollow">${sponsorName}</a>
          <span class="iiuo-ad-badge">Ad</span>
        </span>
        <button class="iiuo-ad-close" aria-label="Dismiss ad">×</button>
      </header>
      <a class="iiuo-ad-body" href="${href}" target="_blank" rel="noopener sponsored">
        <img class="iiuo-ad-icon" src="${src}" alt="${sponsorName} ad" loading="lazy" />
        <div class="iiuo-ad-text">
          <h3 class="iiuo-ad-title">${adTitle}</h3>
          <p class="iiuo-ad-desc">${adDesc}</p>
          <span class="iiuo-ad-link">${adLink}</span>
        </div>
      </a>
    `;

    adCard.querySelector(".iiuo-ad-close").addEventListener("click", () => adCard.remove());

    adCard.querySelector(".iiuo-ad-body").addEventListener("click", () => {
      metric.clicks++;
      saveMetrics(metrics);
    });

    const observer = new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) {
        metric.impressions++;
        saveMetrics(metrics);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(adCard);

    container.innerHTML = "";
    container.appendChild(adCard);

    return { id, adTitle, sponsorName, href, impressions: metric.impressions, clicks: metric.clicks };
  }

  function consoleReport(detailsList) {
    if (!DEBUG || !detailsList.length) return;
    console.groupCollapsed("%c✔ Ads Report", "color:green;font-weight:700;");
    console.log("Sponsored by: It Is Unique Official");
    console.table(detailsList.map((d, i) => ({
      "#": i + 1, Title: d.adTitle, Sponsor: d.sponsorName,
      Impressions: d.impressions, Clicks: d.clicks,
      CTR: d.impressions ? ((d.clicks / d.impressions) * 100).toFixed(2) + "%" : "0%"
    })));
    console.groupEnd();
  }

  // -------- Boot -------- //
  async function boot() {
    injectCSS();
    const metrics = loadMetrics();
    const { ads, rotationInterval } = await fetchAds(XML_PATH);

    const containers = document.querySelectorAll(".iiuo-ad-container");
    if (!ads.length) {
      containers.forEach(c => c.innerHTML = "<p>No ads available.</p>");
      return;
    }

    function renderAll() {
      const details = [];
      const usedIds = new Set();
      containers.forEach(container => {
        const ad = nextAd(usedIds, metrics);
        if (ad) {
          usedIds.add(adIdFrom(ad));
          details.push(renderAdInto(container, ad, metrics));
        }
      });
      consoleReport(details);
    }

    renderAll();
    if (rotationInterval > 0) {
      setInterval(() => {
        if (document.hidden) return; // pause rotation when tab inactive
        renderAll();
      }, rotationInterval * 1000);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);

})();
