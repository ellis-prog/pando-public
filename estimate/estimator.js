// Pando earnings estimator. Hosted on GitHub Pages; embedded on pandorefitters.com/pages/sell with:
//   <div id="pando-estimator" data-source="sell-page"></div>
//   <link rel="stylesheet" href="https://approve.pandorefitters.com/estimate/estimator.css">
//   <script src="https://approve.pandorefitters.com/estimate/estimator.js" defer></script>
// Optional attributes on the div: data-heading="false" hides the built-in heading; data-source labels the traffic.
(() => {
  const host = document.getElementById("pando-estimator");
  if (!host || host.dataset.peMounted) return;
  host.dataset.peMounted = "1";
  host.classList.add("pe");
  host.innerHTML = "<div class=\"pe-head\">\n  <div class=\"pe-eyebrow\">Mail-in program</div>\n  <h1 class=\"pe-h1\">What will my gear earn?</h1>\n  <p class=\"pe-lede\">Tell us what you have. We'll show what similar gear has earned at Pando, and whether we can take it.</p>\n</div>\n\n<div class=\"pe-row\">\n  <section class=\"pe-card pe-form\" aria-label=\"Your item\">\n    <div>\n      <label class=\"pe-step-label\" for=\"pe-cat\">1 \u00b7 What is it?</label>\n      <div id=\"pe-cat-search\">\n        <input id=\"pe-cat\" class=\"pe-input\" type=\"text\" role=\"combobox\" aria-autocomplete=\"list\" aria-expanded=\"false\" aria-controls=\"pe-cat-list\" autocomplete=\"off\" placeholder=\"Loading\u2026\" disabled>\n        <div id=\"pe-cat-list\" class=\"pe-list\" role=\"listbox\" hidden></div>\n        <div id=\"pe-cat-brand\" class=\"pe-hint pe-brand-note\" hidden></div>\n        <div id=\"pe-cat-nomatch\" class=\"pe-hint\" hidden>No match yet. Try a simpler word, like \u201cjacket\u201d, \u201cpack\u201d or \u201cskis\u201d.</div>\n      </div>\n      <div id=\"pe-cat-chip\" hidden></div>\n      <div id=\"pe-labels\" hidden style=\"margin-top:12px\"></div>\n    </div>\n\n    <div id=\"pe-accept\" class=\"pe-accept\" hidden></div>\n\n    <div id=\"pe-brand-step\" hidden>\n      <label class=\"pe-step-label\" for=\"pe-brand\">2 \u00b7 Brand</label>\n      <div id=\"pe-brand-search\">\n        <input id=\"pe-brand\" class=\"pe-input\" type=\"text\" role=\"combobox\" aria-autocomplete=\"list\" aria-expanded=\"false\" aria-controls=\"pe-brand-list\" autocomplete=\"off\" placeholder=\"Start typing a brand\">\n        <div id=\"pe-brand-list\" class=\"pe-list\" role=\"listbox\" hidden></div>\n      </div>\n      <div id=\"pe-brand-chip\" hidden></div>\n    </div>\n\n    <div id=\"pe-fit-wrap\" hidden>\n      <div class=\"pe-step-label\">3 \u00b7 Fit <span class=\"pe-opt\">(optional)</span></div>\n      <div id=\"pe-fit\" class=\"pe-pills\"></div>\n    </div>\n  </section>\n\n  <section class=\"pe-card pe-result\" id=\"pe-result\" aria-live=\"polite\"></section>\n</div>\n\n<section class=\"pe-card pe-bag\" id=\"pe-bag\" aria-label=\"Your estimate\"></section>";
  // Stack into one column when the space is narrow (a phone, or a narrow page column on desktop).
  const fit = () => {
    const w = host.clientWidth;
    host.classList.toggle("pe-stacked", w < 820);
    host.classList.toggle("pe-compact", w < 540);
  };
  fit();
  if ("ResizeObserver" in window) new ResizeObserver(fit).observe(host); else window.addEventListener("resize", fit);
})();
(() => {
  // ---------------- config ----------------
  const CONFIG = {
    functionUrl: "https://ehzcymnztsbbroxzcidq.supabase.co/functions/v1/earnings-estimate",
    restUrl: "https://ehzcymnztsbbroxzcidq.supabase.co/rest/v1",
    // Public (anon) key: safe to embed. It can only call the estimator and the brand list.
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoemN5bW56dHNiYnJveHpjaWRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4OTUxOTIsImV4cCI6MjA5MDQ3MTE5Mn0.mwNRsmt9WGZAu85WY3GQ74VYilX3P9833gHBOrleTi8",
    mailInUrl: "https://pandorefitters.typeform.com/sendgear?typeform-source=estimator",     // where "Start my mail-in" goes
    freeShippingNote: "Shipping is on us, when your gear is assessed by our team with a trade in or cash value $100 or higher. Need to send a smaller load? Shipping is a simple flat $7.95 deducted from your offer.",
    source: "estimate-page",
    skiMailInMinYear: 2024,          // skis/snowboards: oldest model year we take by mail (update each season)
    skiStoreMinYear: 2019,           // skis/snowboards: oldest model year we take in store
    // Shorthand customers type for brands. Only used if the brand exists in our sales history.
    brandAliases: {
      "tnf": "The North Face", "north face": "The North Face", "northface": "The North Face",
      "bd": "Black Diamond", "mhw": "Mountain Hardwear", "hh": "Helly Hansen", "bca": "Backcountry Access",
      "sportiva": "La Sportiva", "patagucci": "Patagonia", "5 10": "Five Ten", "510": "Five Ten", "fiveten": "Five Ten",
      "rei coop": "REI Co-op", "pearl izumi": "PEARL iZUMi", "troy lee": "Troy Lee Designs", "tld": "Troy Lee Designs",
    },
  };

  const root = document.getElementById("pando-estimator");
  if (!root || !root.querySelector(".pe-row") || root.dataset.peStarted) return;
  root.dataset.peStarted = "1";
  if (root.dataset.source) CONFIG.source = root.dataset.source.slice(0, 64);
  const $ = (id) => root.querySelector("#" + id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n).toLocaleString("en-US");
  // Lowercase, strip accents and apostrophes, turn other punctuation into spaces.
  const fold = (x) => String(x ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[\u2019'`]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const shortName = (c) => { const p = c.split(" - "); return p[p.length - 1].trim(); };
  const headers = { "Content-Type": "application/json", Authorization: "Bearer " + CONFIG.anonKey, apikey: CONFIG.anonKey };

  const sessionId = (() => {
    try { let s = localStorage.getItem("pe-visitor"); if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("pe-visitor", s); } return s; }
    catch { return Math.random().toString(36).slice(2); }
  })();

  const CONDITIONS = [
    { id: "Excellent", label: "Like new", desc: "No visible wear. Could pass for new." },
    { id: "Great", label: "Great", desc: "Light wear you'd have to look for." },
    { id: "Good", label: "Good", desc: "Visible wear, fully functional." },
    { id: "Fair", label: "Well used", desc: "Obvious wear or cosmetic flaws." },
  ];
  const AGES = [
    { id: "Current", label: "Current", desc: "Still sold new, or 1\u20133 years old" },
    { id: "Recent", label: "A few years old", desc: "3\u20139 years old" },
    { id: "Legacy", label: "Older", desc: "10+ years old" },
  ];
  const ELIG = {
    "Mail-in OK": ["Mail-in accepted", "pe-tag-ok"],
    "In store only": ["In store only", "pe-tag-warn"],
    "Ask first": ["Case by case", "pe-tag-warn"],
    "Not accepting": ["Not accepting", "pe-tag-no"],
    "Donation only": ["Donation only", "pe-tag-warn"],
  };
  const ICON_CHECK = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5"/></svg>';
  const ICON = {
    ok: '<span class="pe-ico pe-ico-ok" aria-label="Accepted"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5"/></svg></span>',
    warn: '<span class="pe-ico pe-ico-warn" aria-label="Heads up"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 2.5v4.2"/><path d="M6 9.3v.1"/></svg></span>',
    no: '<span class="pe-ico pe-ico-no" aria-label="Not accepted"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3.3 3.3l5.4 5.4M8.7 3.3l-5.4 5.4"/></svg></span>',
  };

  // ---------------- state ----------------
  const S = {
    cats: [], brands: [],
    catResults: [], catActive: 0, cat: null, label: null, catBrand: "", catIgnored: [],
    brandResults: [], brandActive: 0, brand: "",
    msrp: "", msrpDraft: "", cond: "", age: "", size: "", payout: "credit", flash: "", flow: { open: false, step: 1 }, compsOpen: false,
    result: null, loading: false, error: "", added: false,
    req: { open: false, email: "", note: "", model: "", sending: false, sent: false, error: "" },
    team: { year: "", brand: "", model: "", size: "", cond: "", note: "", email: "", sending: false, sent: false, error: "", added: false },
    bag: loadBag(),
  };
  function loadBag() { try { return JSON.parse(localStorage.getItem("pe-bag") || "[]"); } catch { return []; } }
  function saveBag() { try { localStorage.setItem("pe-bag", JSON.stringify(S.bag)); } catch {} }
  // "What we accept" comes from Airtable (Inventory Categories: Estimator Status / Estimator Rules).
  const ruleFor = (cat) => (cat && cat.rules && cat.rules.m ? cat.rules : { m: "Ask first", r: [] });

  // ---------------- tracking ----------------
  function track(name, extra) {
    try {
      fetch(CONFIG.functionUrl, { method: "POST", headers, keepalive: true,
        body: JSON.stringify(Object.assign({ event: "track", name, sessionId, source: CONFIG.source }, extra || {})) }).catch(() => {});
    } catch {}
  }
  const itemTrack = () => ({ category: S.cat && S.cat.id, categoryName: S.cat && S.cat.name, label: S.label, brand: S.brand });
  const mailInHref = () => {
    const u = CONFIG.mailInUrl;
    return `${u}${u.includes("?") ? "&" : "?"}sid=${encodeURIComponent(sessionId)}&items=${S.bag.length}`;
  };

  // ---------------- data loading ----------------
  async function init() {
    try {
      const [catRes, brandRes] = await Promise.all([
        fetch(CONFIG.functionUrl + "?action=categories", { headers }),
        fetch(CONFIG.restUrl + "/rpc/estimator_brands", { method: "POST", headers, body: "{}" }).catch(() => null),
      ]);
      S.cats = (await catRes.json()).categories || [];
      if (brandRes && brandRes.ok) S.brands = (await brandRes.json()).map((b) => b.brand);
      const input = $("pe-cat");
      input.disabled = false;
      input.placeholder = "Try \u201cpuffy\u201d, \u201cskis\u201d or \u201ctent\u201d";
    } catch (e) {
      $("pe-cat").placeholder = "Couldn't load. Please refresh.";
    }
    renderResult(); renderBag();
    track("page_view");
  }

  // ---------------- category search ----------------
  // Customers type things like "patagonia jacket" or "tnf puffy". We pull out a brand if we can,
  // ignore words that don't match any category ("blue", "mens", typos), and search on what's left.
  let brandIndex = null, catHay = null;
  function buildIndexes() {
    brandIndex = new Map();
    for (const b of S.brands) {
      const k = fold(b);
      if (k.length < 2) continue;
      brandIndex.set(k, b);
      brandIndex.set(k.replace(/ /g, ""), b);
      if (k.startsWith("the ")) brandIndex.set(k.slice(4), b);
    }
    const byKey = new Map(S.brands.map((b) => [fold(b), b]));
    for (const [alias, target] of Object.entries(CONFIG.brandAliases || {})) {
      const b = byKey.get(fold(target));
      if (b) brandIndex.set(fold(alias), b);
    }
    catHay = S.cats.map((cat) => " " + fold([cat.name, ...cat.labels, ...(cat.searchTerms || [])].join(" ")) + " ");
  }
  const inAnyCat = (t) => catHay.some((h) => h.includes(" " + t));
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function parseQuery(q) {
    if (!brandIndex) buildIndexes();
    let words = fold(q).split(" ").filter(Boolean);
    let brand = "";
    // 1) exact brand phrase, longest first (3 words down to 1)
    outer: for (let n = Math.min(3, words.length); n >= 1; n--) {
      for (let i = 0; i + n <= words.length; i++) {
        const phrase = words.slice(i, i + n).join(" ");
        // One-word brands that are also gear words ("camp", "head", "backcountry") are too ambiguous to auto-fill.
        if (n === 1 && inAnyCat(phrase)) continue;
        const hit = brandIndex.get(phrase) || (n > 1 && brandIndex.get(phrase.replace(/ /g, "")));
        if (hit) { brand = hit; words = words.slice(0, i).concat(words.slice(i + n)); break outer; }
      }
    }
    // 2) close misspelling of a one-word brand ("pataginia"), only for words that aren't gear words
    if (!brand) {
      for (let i = 0; i < words.length && !brand; i++) {
        const w = words[i];
        if (w.length < 7 || inAnyCat(w)) continue;
        for (const [k, b] of brandIndex) {
          if (k.includes(" ") || k.length < 7) continue;
          if (editDistance(w, k) <= (k.length >= 8 ? 2 : 1)) { brand = b; words.splice(i, 1); break; }
        }
      }
    }
    // 3) keep words that match some category; the rest are ignored
    const keep = words.filter((w) => w.length >= 2 && inAnyCat(w));
    const ignored = words.filter((w) => !keep.includes(w));
    // Ambiguous brand words only count when nothing else does: "head skis" searches "skis".
    const strong = keep.filter((w) => !brandIndex.has(w));
    return { brand, tokens: strong.length ? strong : keep, ignored };
  }

  function searchCats(q) {
    if (fold(q).length < 2) { S.catBrand = ""; S.catIgnored = []; return []; }
    let { brand, tokens, ignored } = parseQuery(q);
    // A brand name that's also a gear word ("head") typed alone: search it as a word too.
    if (!tokens.length && brand && inAnyCat(fold(brand))) tokens = [fold(brand)];
    S.catBrand = brand; S.catIgnored = ignored;
    if (!tokens.length) return [];
    const query = tokens.join(" ");
    const scored = [];
    S.cats.forEach((cat, idx) => {
      const hay = catHay[idx];
      const matched = tokens.filter((t) => hay.includes(" " + t)).length;
      if (!matched) return;
      const labels = cat.labels.length ? cat.labels : [shortName(cat.name)];
      const terms = cat.searchTerms || [];
      let best = 0, viaTerm = null;
      for (const t of terms) {
        const tl = fold(t);
        const sc = tl === query ? 9 : tl.startsWith(query) ? 7 : tl.includes(query) ? 5 : 0;
        if (sc > best) { best = sc; viaTerm = t; }
      }
      const labelHits = labels.map((l) => {
        const ll = fold(l);
        return { l, s: ll === query ? 10 : ll.startsWith(query) ? 8 : ll.includes(query) ? 6 : tokens.some((t) => (" " + ll).includes(" " + t)) ? 3 : 0 };
      }).filter((x) => x.s > 0);
      if (labelHits.length) {
        for (const h of labelHits) scored.push({ cat, matched, label: cat.labels.length ? h.l : null, title: h.l, score: h.s });
      } else {
        const nameScore = fold(cat.name).includes(query) ? 4 : 2;
        scored.push({ cat, matched, label: cat.labels[0] || null, title: labels[0], via: viaTerm, score: Math.max(best, nameScore) });
      }
    });
    // Prefer categories that match the most of the typed words.
    const top = Math.max(0, ...scored.map((x) => x.matched));
    const out = scored.filter((x) => x.matched === top);
    const elig = (c) => ruleFor(c).m;
    out.sort((a, b) => (b.score - a.score) || ((elig(a.cat) === "Not accepting") - (elig(b.cat) === "Not accepting")) || a.title.localeCompare(b.title));
    return out.slice(0, 8);
  }

  let noMatchTimer = null;
  function onCatInput() {
    const q = $("pe-cat").value;
    S.catResults = searchCats(q);
    S.catActive = 0;
    renderCatList();
    clearTimeout(noMatchTimer);
    // Log anything that didn't fully land: no results, or words we had to ignore.
    if (q.trim().length >= 3 && (!S.catResults.length || S.catIgnored.length)) {
      noMatchTimer = setTimeout(() => {
        fetch(CONFIG.functionUrl, { method: "POST", headers, body: JSON.stringify({ event: "search_no_match", query: q.trim(), sessionId, source: CONFIG.source }) }).catch(() => {});
      }, 1500);
    }
  }

  function renderCatList() {
    const list = $("pe-cat-list"), input = $("pe-cat");
    const q = input.value.trim();
    const brandNote = $("pe-cat-brand");
    brandNote.hidden = !(q && S.catBrand);
    if (S.catBrand) brandNote.innerHTML = S.catResults.length
      ? `Brand: <b>${esc(S.catBrand)}</b>. We'll fill that in for you.`
      : `Got it, <b>${esc(S.catBrand)}</b>. What kind of item is it? Try \u201cjacket\u201d, \u201cpack\u201d or \u201cskis\u201d.`;
    $("pe-cat-nomatch").hidden = !(q.length >= 3 && !S.catResults.length && !S.catBrand);
    if (!S.catResults.length) { list.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    list.innerHTML = S.catResults.map((r, i) => {
      const e = ELIG[ruleFor(r.cat).m];
      const tag = e && ruleFor(r.cat).m !== "Mail-in OK" ? `<span class="pe-tag ${e[1]}">${esc(e[0])}</span>` : "";
      return `<button type="button" class="pe-option" role="option" id="pe-cat-opt-${i}" aria-selected="${i === S.catActive}" data-i="${i}">
        <span class="pe-option-main"><span class="pe-option-title">${esc(r.title)}</span><span class="pe-option-sub">${esc(r.cat.name)}</span></span>${tag}</button>`;
    }).join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", "pe-cat-opt-" + S.catActive);
  }

  function selectCat(r) {
    S.cat = r.cat; S.label = r.label;
    S.size = r.cat.sizeTypes.length === 1 ? r.cat.sizeTypes[0] : "";
    resetItem(); S.flash = "";
    if (S.catBrand) { S.brand = S.catBrand; S.catBrand = ""; }
    $("pe-cat").value = ""; S.catResults = []; renderCatList();
    if (teamKind(S.cat)) {
      S.team.brand = S.brand && S.brand !== "Other" ? S.brand : S.team.brand;
      renderAll(); track("staff_form_view", itemTrack());
      return;
    }
    renderAll(); requestEstimate();
    if (!S.brand) setTimeout(() => $("pe-brand") && $("pe-brand").focus(), 0);
  }

  // ---------------- brand search ----------------
  function searchBrands(q) {
    const s = fold(q);
    if (!s) return [];
    if (!brandIndex) buildIndexes();
    const starts = [], contains = [];
    const alias = brandIndex.get(s) || brandIndex.get(s.replace(/ /g, ""));
    if (alias) starts.push(alias);
    for (const b of S.brands) {
      if (b === alias) continue;
      const bl = fold(b), bn = bl.replace(/ /g, ""), sn = s.replace(/ /g, "");
      if (bl.startsWith(s) || bn.startsWith(sn)) starts.push(b); else if (bl.includes(s) || bn.includes(sn)) contains.push(b);
    }
    const res = starts.concat(contains).slice(0, 6);
    if (!alias && !res.some((b) => fold(b) === s) && q.trim().length >= 2) res.push({ custom: q.trim() });
    res.push("Other / not sure");
    return res;
  }
  function renderBrandList() {
    const list = $("pe-brand-list"), input = $("pe-brand");
    if (!S.brandResults.length) { list.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    list.innerHTML = S.brandResults.map((b, i) => {
      const label = typeof b === "object" ? `Use \u201c${esc(b.custom)}\u201d` : esc(b);
      return `<button type="button" class="pe-option" role="option" id="pe-brand-opt-${i}" aria-selected="${i === S.brandActive}" data-i="${i}"><span class="pe-option-title">${label}</span></button>`;
    }).join("");
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-activedescendant", "pe-brand-opt-" + S.brandActive);
  }
  function selectBrand(b) {
    S.brand = typeof b === "object" ? b.custom : (b === "Other / not sure" ? "Other" : b);
    S.added = false; resetReq();
    $("pe-brand").value = ""; S.brandResults = []; renderBrandList();
    renderAll(); requestEstimate();
  }

  function comboKeys(e, kind) {
    const isCat = kind === "cat";
    const list = isCat ? S.catResults : S.brandResults;
    if (!list.length) return;
    const key = isCat ? "catActive" : "brandActive";
    if (e.key === "ArrowDown") { e.preventDefault(); S[key] = Math.min(S[key] + 1, list.length - 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); S[key] = Math.max(S[key] - 1, 0); }
    else if (e.key === "Enter") { e.preventDefault(); isCat ? selectCat(list[S[key]]) : selectBrand(list[S[key]]); return; }
    else if (e.key === "Escape") { if (isCat) { S.catResults = []; } else { S.brandResults = []; } }
    else return;
    isCat ? renderCatList() : renderBrandList();
  }

  // ---------------- form rendering ----------------
  function renderAll() {
    const cat = S.cat;
    const rule = ruleFor(cat);
    const paying = cat && rule.m !== "Not accepting" && rule.m !== "Donation only";

    $("pe-cat-search").hidden = !!cat;
    $("pe-cat-chip").hidden = !cat;
    if (cat) {
      $("pe-cat-chip").innerHTML = `<div class="pe-chip"><div><div class="pe-chip-title">${esc(S.label || shortName(cat.name))}</div><div class="pe-chip-sub">${esc(cat.name)}</div></div><button type="button" class="pe-btn-ghost" data-act="clear-cat">Change</button></div>`;
    }
    const labels = $("pe-labels");
    labels.hidden = !(cat && cat.labels.length > 1);
    if (cat && cat.labels.length > 1) {
      labels.innerHTML = `<div class="pe-sublabel">Which type?</div><div class="pe-pills">${cat.labels.map((l) => `<button type="button" class="pe-pill" aria-pressed="${l === S.label}" data-act="label" data-v="${esc(l)}">${esc(l)}</button>`).join("")}</div>`;
    }

    const acc = $("pe-accept");
    acc.hidden = !cat;
    if (cat) {
      const e = ELIG[rule.m] || ELIG["Ask first"];
      const rows = rule.r.length ? rule.r.map((x) => {
        const kind = x[0] === "+" ? "ok" : x[0] === "-" ? "no" : "warn";
        return `<div class="pe-rule">${ICON[kind]}<span>${esc(x.slice(2))}</span></div>`;
      }).join("") : `<div class="pe-rule"><span>We'll review this one by hand. Ask us if you're not sure.</span></div>`;
      acc.innerHTML = `<div class="pe-accept-head"><span>What we accept</span><span class="pe-tag ${e[1]}">${esc(e[0])}</span></div>${rows}`;
    }

    $("pe-brand-step").hidden = !paying || !!teamKind(cat);
    $("pe-brand-search").hidden = !!S.brand;
    $("pe-brand-chip").hidden = !S.brand;
    if (S.brand) {
      $("pe-brand-chip").innerHTML = `<div class="pe-chip"><div class="pe-chip-title">${esc(S.brand === "Other" ? "Other / not sure" : S.brand)}</div><button type="button" class="pe-btn-ghost" data-act="clear-brand">Change</button></div>`;
    }

    const fits = cat ? cat.sizeTypes : [];
    $("pe-fit-wrap").hidden = !paying || fits.length < 2 || !!teamKind(cat);
    $("pe-fit").innerHTML = fits.map((z) => `<button type="button" class="pe-pill" aria-pressed="${z === S.size}" data-act="size" data-v="${esc(z)}">${esc(z)}</button>`).join("");

    renderResult();
  }

  // ---------------- estimate ----------------
  let estTimer = null, reqSeq = 0;
  function requestEstimate(delay = 300) {
    clearTimeout(estTimer);
    const rule = ruleFor(S.cat);
    if (!S.cat || !S.brand || teamKind(S.cat) || rule.m === "Not accepting" || rule.m === "Donation only") { S.result = null; S.loading = false; renderResult(); return; }
    S.loading = true; renderResult();
    estTimer = setTimeout(async () => {
      const seq = ++reqSeq;
      try {
        const res = await fetch(CONFIG.functionUrl, {
          method: "POST", headers,
          body: JSON.stringify({ category: S.cat.id, label: S.label, brand: S.brand, sizeType: S.size || null,
            condition: S.cond || null, age: S.age || null, msrp: S.msrp ? Number(S.msrp) : null, sessionId, source: CONFIG.source }),
        });
        const data = await res.json();
        if (seq !== reqSeq) return;
        if (!res.ok) throw new Error(data.error || "Request failed");
        S.result = data; S.error = "";
      } catch (e) {
        if (seq !== reqSeq) return;
        S.result = null; S.error = "We couldn't get an estimate right now. Please try again in a moment.";
      }
      S.loading = false; renderResult();
    }, delay);
  }

  // ---------------- result rendering ----------------
  // Leads with what similar gear has earned (a dot strip of past payouts), then where the customer's
  // item likely lands. Skis, snowboards and bikes skip the numbers and go to our team instead.
  const TRUST_TEXT = "A look at past sales, not an offer. A gear expert personally inspects your item before making a final offer. Not happy with it? We\u2019ll send your gear back.";
  const trustHtml = (text) => `<div class="pe-trust"><svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="#2E5B47" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;margin-top:2px"><path d="M9 1.8l5.6 2.3v4.3c0 3.6-2.4 6.4-5.6 7.8-3.2-1.4-5.6-4.2-5.6-7.8V4.1L9 1.8z"/><path d="M6.4 9.1l1.8 1.8 3.5-3.6"/></svg><span>${text}</span></div>`;

  const nounFor = (r) => (S.label || shortName(r.category.name)).toLowerCase();
  const itemLabel = () => S.label || (S.cat ? shortName(S.cat.name) : "item");
  const hasDetails = () => !!(S.msrp || S.cond || S.age);

  // Skis, snowboards and bikes: a person on our team estimates these for now.
  const teamKind = (cat) => {
    if (!cat) return null;
    const n = cat.name.trim();
    if (/^bikes\b/i.test(n)) return "bike";
    if (/^skis\b/i.test(n)) return "ski";
    if (/^snowboard$/i.test(n)) return "snowboard";
    return null;
  };
  // Ski/snowboard model years roll over mid-year (2027 models arrive in fall 2026).
  const modelYear = () => { const d = new Date(); return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear(); };

  // Past payouts as a dot strip, with the customer's likely range marked when we have one.
  function stripHtml(dist, est) {
    const vals = dist.credit, most = dist.most.credit;
    const sorted = [...vals].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1];
    const W = Math.round(Math.max(280, Math.min(620, ($("pe-result").clientWidth || 470) - 48)));
    let max = Math.max(p95 * 1.15, most.high * 1.25, est ? est.high * 1.12 : 0, 10);
    const step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000].find((s) => max / s <= (W < 400 ? 3 : 4)) || 5000;
    max = Math.ceil(max / step) * step;
    const L = 16, R = W - 16, X = (v) => L + (Math.min(v, max) / max) * (R - L);
    const H = est ? 86 : 58;
    let h = `<rect x="${X(most.low)}" y="20" width="${Math.max(4, X(most.high) - X(most.low))}" height="30" rx="5" fill="var(--pe-band)"/>`;
    h += `<line x1="${L}" y1="35" x2="${R}" y2="35" stroke="#C9CEC3" stroke-width="1"/>`;
    for (let t = 0; t <= max; t += step) h += `<text x="${X(t)}" y="12" text-anchor="middle" font-size="12" fill="#6B746E">$${t.toLocaleString("en-US")}</text>`;
    const stacks = {};
    const offsets = [0, -9, 9, -18, 18];
    for (const v of sorted) {
      const b = Math.round(X(v) / 8);
      const i = stacks[b] = (stacks[b] ?? -1) + 1;
      h += `<circle cx="${X(v).toFixed(1)}" cy="${35 + offsets[i % offsets.length]}" r="4.5" fill="var(--pe-dot)" fill-opacity="${i >= offsets.length ? 0.5 : 0.9}"/>`;
    }
    if (est) {
      const a = X(est.low), b = Math.max(X(est.high), a + 6);
      h += `<rect x="${a}" y="60" width="${b - a}" height="7" rx="3.5" fill="var(--pe-accent)"/>`;
      h += `<text x="${Math.min(Math.max((a + b) / 2, 30), W - 30)}" y="82" text-anchor="middle" font-size="13" font-weight="700" fill="var(--pe-accent-dark)">Yours</text>`;
    }
    const label = `${dist.n} past sales. Most earned ${money(most.low)} to ${money(most.high)} in store credit.${est ? ` Your estimate: ${money(est.low)} to ${money(est.high)}.` : ""}`;
    return `<svg class="pe-strip" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${h}</svg>`;
  }

  // Recent sales live behind a disclosure: proof when wanted, quiet when not.
  function compsHtml(comps, toggleLabel, lede) {
    if (!comps || !comps.length) return "";
    const open = S.compsOpen;
    const chev = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="transition:transform .15s;${open ? "transform:rotate(180deg)" : ""}"><path d="M3.5 5.5L7 9l3.5-3.5"/></svg>`;
    const rows = comps.map((c) => {
      const meta = [c.condition ? c.condition + " condition" : null, "sold " + c.soldMonth].filter(Boolean).join(" \u00b7 ");
      return `<div class="pe-comp"><div style="min-width:0"><div class="pe-comp-title">${esc(c.title)}</div><div class="pe-comp-meta">${esc(meta)}</div></div>
        <div class="pe-comp-earn"><span>${money(c.credit)} credit</span><span class="pe-comp-meta">${money(c.cash)} cash</span></div></div>`;
    }).join("");
    return `<div class="pe-evidence">
      <button type="button" class="pe-evidence-toggle" data-act="comps" aria-expanded="${open}">${toggleLabel}${chev}</button>
      ${open ? `<div class="pe-evidence-body"><p class="pe-evidence-lede">${lede}</p>${rows}</div>` : ""}
    </div>`;
  }

  function requestHtml() {
    const q = S.req;
    if (q.sent) return `<div class="pe-note pe-note-green"><strong>Thanks, we've got it.</strong> We'll email you at ${esc(q.email)} with a personal estimate.</div>`;
    if (!q.open) return "";
    return `<div class="pe-req" id="pe-req">
      <h4>Get a personal estimate</h4>
      <div style="font-size:14px;color:var(--pe-muted)">Someone on our team will take a look and email you back.</div>
      <label class="pe-sublabel" for="pe-req-model" style="margin:0">Model name</label>
      <input id="pe-req-model" class="pe-input" type="text" placeholder="${esc(S.brand && S.brand !== "Other" ? S.brand + " " : "")}model, as best you know it" value="${esc(q.model)}">
      <label class="pe-sublabel" for="pe-req-note" style="margin:0">Tell us more <span class="pe-opt">(optional)</span></label>
      <textarea id="pe-req-note" class="pe-textarea" placeholder="Size, how much it's been used, anything special about it">${esc(q.note)}</textarea>
      <label class="pe-sublabel" for="pe-req-email" style="margin:0">Email</label>
      <input id="pe-req-email" class="pe-input" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(q.email)}">
      ${q.error ? `<div class="pe-note pe-note-red">${esc(q.error)}</div>` : ""}
      <button type="button" class="pe-btn" data-act="req-send" ${q.sending ? "disabled" : ""}>${q.sending ? '<span class="pe-spin"></span>Sending\u2026' : "Send my request"}</button>
    </div>`;
  }

  // One question at a time: retail price -> age -> condition. Taps advance; the last tap runs the estimate.
  function stepperHtml(retailRequired) {
    const step = S.flow.step;
    const done = [];
    if (step > 1 && S.msrpDraft) done.push(`${money(S.msrpDraft)} new`);
    if (step > 2 && S.age) done.push((AGES.find((a) => a.id === S.age) || {}).label);
    const top = `<div class="pe-flow-top"><span>Question ${step} of 3${done.length ? ` \u00b7 <span class="pe-flow-done">${done.map(esc).join(" \u00b7 ")}</span>` : ""}</span>
      ${step > 1 ? `<button type="button" class="pe-textlink" data-act="flow-back">Back</button>` : ""}</div>`;
    const opts = (list, cur, act) => `<div class="pe-opts">${list.map((x) => `<button type="button" class="pe-opt-row" aria-pressed="${x.id === cur}" data-act="${act}" data-v="${x.id}"><b>${x.label}</b><span>${x.desc}</span></button>`).join("")}</div>`;
    let body;
    if (step === 1) {
      const ready = Number(S.msrpDraft) > 0;
      body = `<label class="pe-flow-q" for="pe-msrp-inline">Roughly what did it cost new?</label>
        <div class="pe-inline-msrp"><div class="pe-money"><span style="font-weight:600">$</span><input id="pe-msrp-inline" class="pe-input" type="number" inputmode="decimal" min="0" placeholder="e.g. 300" value="${esc(S.msrpDraft)}"></div>
        <button type="button" class="pe-btn pe-btn-inline" data-act="flow-next" ${ready ? "" : 'aria-disabled="true"'}>Next</button></div>
        <div class="pe-hint">A guess is fine.${retailRequired ? "" : ` <button type="button" class="pe-textlink" data-act="flow-skip" style="font-size:13px">Not sure, skip</button>`}</div>`;
    } else if (step === 2) {
      body = `<div class="pe-flow-q">How old is it?</div>${opts(AGES, S.age, "flow-age")}`;
    } else {
      body = `<div class="pe-flow-q">What shape is it in?</div>${opts(CONDITIONS, S.cond, "flow-cond")}`;
    }
    return `<div class="pe-flow">${top}${body}</div>`;
  }

  function usedInputsHtml() {
    const bits = [];
    if (S.msrp) bits.push(`${money(S.msrp)} new`);
    if (S.age) bits.push((AGES.find((a) => a.id === S.age) || {}).label);
    if (S.cond) bits.push((CONDITIONS.find((c) => c.id === S.cond) || {}).label);
    if (!bits.length) return "";
    return `<div class="pe-used">Using: ${bits.map(esc).join(" \u00b7 ")} <button type="button" class="pe-textlink" data-act="flow-open">Edit</button></div>`;
  }

  // ---- skis, snowboards and bikes: our team estimates these ----
  function teamHtml(kind) {
    const T = S.team;
    const noun = kind === "bike" ? "bike" : kind === "ski" ? "ski" : "snowboard";
    const plural = kind === "bike" ? "Bikes" : kind === "ski" ? "Skis" : "Snowboards";
    const parts = [];
    parts.push(`<p class="pe-rough-head">Let's make sure you get a solid estimate.</p>`);
    parts.push(`<p class="pe-rough-body">${plural} get a personal look from our team. Tell us about yours and we'll email you back.</p>`);
    if (kind === "bike") {
      parts.push(`<div class="pe-note pe-note-amber"><strong>Bikes are in-store only.</strong> We can't take them by mail. Get an estimate here, then bring it to our Provo store at 249 N University Ave.</div>`);
    } else {
      parts.push(`<div class="pe-note pe-note-soft"><strong>Mail-in for skis and snowboards works as a trade.</strong> Order a ski or snowboard from us, then ship your old one back in the same box. Our team approves each one first. Please note: for mail-in, we only accept skis and snowboards from ${CONFIG.skiMailInMinYear} or newer.</div>`);
    }
    if (T.sent) {
      parts.push(`<div class="pe-note pe-note-green"><strong>Thanks, we've got it.</strong> We'll email you at ${esc(T.email)} with an estimate.</div>`);
      if (kind !== "bike" && !T.added) parts.push(`<button type="button" class="pe-btn-secondary" data-act="team-add">Add to my estimate</button>`);
      return parts.join("");
    }
    const my = modelYear();
    const years = [];
    for (let y = my; y >= my - 12; y--) years.push(y);
    const yr = kind !== "bike" && T.year && T.year !== "older" ? Number(T.year) : null;
    const yearNote = yr == null ? ""
      : yr < CONFIG.skiStoreMinYear ? `We're only able to take skis and snowboards from ${CONFIG.skiStoreMinYear} or newer, even in store.`
      : yr < CONFIG.skiMailInMinYear ? `That's older than we take by mail (${CONFIG.skiMailInMinYear} or newer), but we're happy to look at it in our Provo store.` : "";
    const sizeHint = kind === "bike" ? "e.g. Medium or 54 cm" : kind === "ski" ? "e.g. 172 cm" : "e.g. 156 cm";
    parts.push(`<div class="pe-team">
      <div class="pe-team-row">
        <div><label class="pe-sublabel" for="pe-t-year" style="display:block">Year</label>
          <select id="pe-t-year" class="pe-input pe-select"><option value="">Choose a year</option>${years.map((y) => `<option value="${y}" ${String(y) === T.year ? "selected" : ""}>${y}</option>`).join("")}<option value="older" ${T.year === "older" ? "selected" : ""}>Older / not sure</option></select></div>
        <div><label class="pe-sublabel" for="pe-t-size" style="display:block">Size <span class="pe-opt">(optional)</span></label>
          <input id="pe-t-size" class="pe-input" type="text" placeholder="${sizeHint}" value="${esc(T.size)}"></div>
      </div>
      ${yearNote ? `<div class="pe-note pe-note-amber">${yearNote}</div>` : ""}
      <div><label class="pe-sublabel" for="pe-t-brand" style="display:block">Brand</label>
        <input id="pe-t-brand" class="pe-input" type="text" placeholder="e.g. Rossignol" value="${esc(T.brand)}"></div>
      <div><label class="pe-sublabel" for="pe-t-model" style="display:block">Model</label>
        <input id="pe-t-model" class="pe-input" type="text" placeholder="${kind === "bike" ? "e.g. Stumpjumper Comp" : kind === "ski" ? "e.g. Experience 88" : "e.g. Custom Flying V"}" value="${esc(T.model)}"></div>
      <div><div class="pe-sublabel">Condition</div><div class="pe-opts">${CONDITIONS.map((c) => `<button type="button" class="pe-opt-row" aria-pressed="${c.id === T.cond}" data-act="team-cond" data-v="${c.id}"><b>${c.label}</b><span>${c.desc}</span></button>`).join("")}</div></div>
      <div><label class="pe-sublabel" for="pe-t-note" style="display:block">Tell us more <span class="pe-opt">(optional)</span></label>
        <textarea id="pe-t-note" class="pe-textarea" placeholder="${kind === "ski" ? "Bindings included? Any base or edge damage?" : kind === "snowboard" ? "Bindings included? Any base or edge damage?" : "Upgrades, recent service, anything worn out?"}">${esc(T.note)}</textarea></div>
      <div><label class="pe-sublabel" for="pe-t-email" style="display:block">Email</label>
        <input id="pe-t-email" class="pe-input" type="email" autocomplete="email" placeholder="you@example.com" value="${esc(T.email)}"></div>
      ${T.error ? `<div class="pe-note pe-note-red">${esc(T.error)}</div>` : ""}
      <button type="button" class="pe-btn" data-act="team-send" ${T.sending ? "disabled" : ""}>${T.sending ? '<span class="pe-spin"></span>Sending\u2026' : `Get my ${noun} estimate`}</button>
    </div>`);
    return parts.join("");
  }

  function renderResult() {
    const box = $("pe-result");
    const cat = S.cat;
    const rule = ruleFor(cat);
    if (!cat) {
      box.innerHTML = (S.flash ? `<div class="pe-note pe-note-green" style="font-weight:600">${esc(S.flash)}</div>` : "")
        + `<div class="pe-empty"><div class="pe-empty-title">${S.flash ? "What's next?" : "Your estimate shows up here"}</div>Search for what you have, then pick a brand.</div>`;
      return;
    }
    if (rule.m === "Not accepting") {
      const why = (rule.r.find((x) => x[0] === "-") || "- Not currently accepting").slice(2);
      box.innerHTML = `<div class="pe-note pe-note-red"><div style="font-size:19px;font-weight:700;margin-bottom:4px">We're not taking this right now</div>${esc(why)}.</div>
        <p style="margin:0;color:var(--pe-muted)">Still want it to do some good? Our donation bags turn gear we can't resell into support for our conservation partners.</p>`;
      return;
    }
    if (rule.m === "Donation only") {
      box.innerHTML = `<div class="pe-note pe-note-amber"><div style="font-size:19px;font-weight:700;margin-bottom:4px">Donation only</div>We can't pay for this one, but we'd gladly take it in a donation bag. Proceeds support our conservation partners.</div>`;
      return;
    }
    const kind = teamKind(cat);
    if (kind) { box.innerHTML = teamHtml(kind); return; }
    if (!S.brand) { box.innerHTML = `<div class="pe-empty"><div class="pe-empty-title">Add a brand to see your estimate</div>Pick \u201cOther / not sure\u201d if you don't see it.</div>`; return; }
    if (S.error) { box.innerHTML = `<div class="pe-note pe-note-red">${esc(S.error)}</div>`; return; }
    if (S.loading && !S.result) { box.innerHTML = `<div class="pe-empty"><span class="pe-spin"></span>Checking recent sales\u2026</div>`; return; }
    const r = S.result;
    if (!r) return;

    const where = nounFor(r);
    const inStore = rule.m === "In store only";
    const parts = [];
    const conf = r.status !== "ok" ? "none" : (r.confidence || "strong");
    const reasons = r.confidenceReasons || [];
    const est = r.estimate;
    const d = r.dist && r.dist.n >= 3 ? r.dist : null;
    const brandReq = !!S.brand && S.brand !== "Other";
    const fallbackCat = brandReq && !r.match.brandMatched;
    const who = brandReq && r.match.brandMatched ? `${esc(S.brand)} ` : "";
    const retailOnly = reasons.includes("retail_price_only");
    // Show prices when the sales are a good guide (strong), when only the brand was missing and the
    // category's prices are fairly tight, or once the customer has told us more.
    const showPrices = !!est && (conf === "strong" || (conf === "rough" && reasons.every((x) => x === "brand_not_matched")));

    // ---- what similar gear has earned ----
    if (d) {
      if (fallbackCat) parts.push(`<p class="pe-fallback">We haven't had many ${esc(S.brand)} ${esc(where)} sales yet, so here's what all ${esc(where)} sales have earned.</p>`);
      else parts.push(`<div class="pe-kicker">What similar gear has earned</div>`);
      const most = d.most.credit;
      const sorted = [...d.credit].sort((a, b) => a - b);
      parts.push(`<div class="pe-headline">${d.n < 5
        ? `We've only taken in ${d.n} of these. They earned ${money(sorted[0])}\u2013${money(sorted[sorted.length - 1])} in credit.`
        : `Most ${who}${esc(where)} sales earned ${money(most.low)}\u2013${money(most.high)} in credit`}</div>`);
      parts.push(stripHtml(d, showPrices ? est.credit : null));
      if (showPrices && hasDetails()) {
        if (est.credit.low > most.high) parts.push(`<div class="pe-pos">Higher than most ${esc(where)} sales. Newer, high-end pieces usually are.</div>`);
        else if (est.credit.high < most.low) parts.push(`<div class="pe-pos">Lower than most, which is typical for older or well-used gear.</div>`);
      }
    } else if (!showPrices) {
      parts.push(`<p class="pe-rough-head">We don't have enough past ${esc(where)} sales to show yet.</p>`);
    }

    if (!showPrices) {
      // Prices vary too much (or there's nothing to go on): ask for the three details first.
      if (!S.flow.open) S.flow = { open: true, step: 1 };
      if (d) parts.push(`<div class="pe-divider"></div>`);
      parts.push(`<p class="pe-ask">Tell us a little more for an estimate on yours.</p>`);
      parts.push(stepperHtml(true));
      const links = [];
      if (!S.req.open && !S.req.sent) links.push(`<button type="button" class="pe-textlink" data-act="req-open">Rather have a person look at it?</button>`);
      if (!inStore) links.push(`<button type="button" class="pe-textlink" data-act="add-pending">Add without a price</button>`);
      if (links.length) parts.push(`<div class="pe-links">${links.join("")}</div>`);
      parts.push(requestHtml());
      parts.push(compsHtml(r.comps, `See recent ${esc(where)} sales`, `What sellers earned on a few of them. For reference only.`));
      box.innerHTML = parts.join("");
      return;
    }

    // ---- where yours likely lands ----
    if (d) parts.push(`<div class="pe-divider"></div>`);
    const lead = retailOnly ? "Based on your retail price, age and condition, yours would likely earn"
      : hasDetails() ? "Based on what you told us, yours would likely earn"
      : fallbackCat ? `Based on all ${esc(where)} sales, yours would likely earn`
      : `Based on recent ${who}${esc(where)} sales, yours would likely earn`;
    parts.push(`<div class="pe-lead">${lead}${S.loading ? ' <span class="pe-spin" style="margin:0 0 0 6px"></span>' : ""}</div>`);
    const w = r.weeksToSell;
    const cashWhen = w ? `When it sells \u00b7 ~${w.low === w.high ? w.low : w.low + "\u2013" + w.high} weeks` : "When it sells";
    const boxHtml = (label, rng, when) => `<div class="pe-box"><div class="pe-box-label">${label}</div><div class="pe-box-value">${money(rng.low)}\u2013${money(rng.high)}</div><div class="pe-box-when">${when}</div></div>`;
    parts.push(`<div class="pe-boxes">${boxHtml("Store credit", est.credit, "Right away")}${boxHtml("Cash", est.cash, cashWhen)}</div>`);
    parts.push(trustHtml(TRUST_TEXT));

    if (hasDetails()) parts.push(usedInputsHtml());
    if (S.flow.open) parts.push(stepperHtml(false));
    else if (!hasDetails()) parts.push(`<button type="button" class="pe-nudge" data-act="flow-open"><span><strong>Is yours newer or high-end?</strong> Tell us about it and we'll show where it might land.</span><span class="pe-nudge-go">Tell us more</span></button>`);

    if (est.credit.high < 12) parts.push(`<div class="pe-note pe-note-amber"><strong>Probably not worth mailing on its own.</strong> Send it along with other gear, or in a donation bag.</div>`);
    if (inStore) {
      parts.push(`<div class="pe-note pe-note-amber"><strong>Bring this one to our Provo store.</strong> We can't take it by mail. Drop it off at 249 N University Ave and we'll look at it with you.</div>`);
    } else {
      if (rule.m === "Ask first") parts.push(`<div class="pe-note pe-note-amber">We decide on this one case by case, so we'll confirm with you before you ship it.</div>`);
      parts.push(`<button type="button" class="pe-btn" data-act="add">Add to Estimate</button>`);
    }
    if (hasDetails() && !S.flow.open && !S.req.open && !S.req.sent) parts.push(`<button type="button" class="pe-textlink" data-act="req-open">Still think it's worth more? Send us the model for a personal estimate</button>`);
    parts.push(requestHtml());
    parts.push(compsHtml(r.comps, d ? `See recent ${esc(where)} sales` : "See recent sales", `What sellers earned on a few of them. For reference only.`));
    box.innerHTML = parts.join("");
  }

  async function sendRequest() {
    const q = S.req;
    q.email = ($("pe-req-email") || {}).value?.trim() || q.email;
    q.note = ($("pe-req-note") || {}).value || q.note;
    q.model = ($("pe-req-model") || {}).value?.trim() || q.model;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.email)) { q.error = "Enter a valid email address."; renderResult(); return; }
    q.error = ""; q.sending = true; renderResult();
    const r = S.result;
    const shownEst = r && r.status === "ok" ? (r.estimate || r.earnings) : null;
    try {
      const res = await fetch(CONFIG.functionUrl, {
        method: "POST", headers,
        body: JSON.stringify({ event: "estimate_request", kind: "personal", email: q.email, note: q.note, model: q.model, category: S.cat && S.cat.id, label: S.label, brand: S.brand,
          sizeType: S.size || null, condition: S.cond || null, age: S.age || null, msrp: (S.msrp || S.msrpDraft) ? Number(S.msrp || S.msrpDraft) : null,
          shown: shownEst ? { confidence: r.confidence, credit: { low: shownEst.credit.low, high: shownEst.credit.high } } : { confidence: "none" },
          sessionId, source: CONFIG.source }),
      });
      if (!res.ok) throw new Error();
      q.sent = true; q.open = false;
    } catch {
      q.error = "Something went wrong sending that. Try again, or email us at hello@pandorefitters.com.";
    }
    q.sending = false; renderResult();
  }

  async function sendTeamRequest() {
    const T = S.team, kind = teamKind(S.cat);
    if (!T.model.trim()) { T.error = "Add the model so our team can look it up."; renderResult(); setTimeout(() => $("pe-t-model") && $("pe-t-model").focus(), 0); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(T.email.trim())) { T.error = "Enter a valid email address."; renderResult(); setTimeout(() => $("pe-t-email") && $("pe-t-email").focus(), 0); return; }
    T.error = ""; T.sending = true; renderResult();
    try {
      const res = await fetch(CONFIG.functionUrl, {
        method: "POST", headers,
        body: JSON.stringify({ event: "estimate_request", kind: "team", email: T.email.trim(), note: T.note, model: T.model.trim(),
          year: T.year === "older" ? "Older / not sure" : T.year, size: T.size, brand: T.brand.trim(), condition: T.cond || null,
          category: S.cat.id, label: S.label, shown: { confidence: "team" }, sessionId, source: CONFIG.source }),
      });
      if (!res.ok) throw new Error();
      T.sent = true;
      S.req.email = T.email.trim();
    } catch {
      T.error = "Something went wrong sending that. Try again, or email us at hello@pandorefitters.com.";
    }
    T.sending = false; renderResult();
    void kind;
  }

  // ---------------- bag ----------------
  function renderBag() {
    const box = $("pe-bag");
    const n = S.bag.length;
    if (!n) {
      box.innerHTML = `<div class="pe-bag-head"><h2>Your Estimate</h2><span class="pe-opt">0 items</span></div><p style="margin:0;color:var(--pe-faint)">Most people send several items at once. Add each one to see your combined estimate.</p>`;
      return;
    }
    const priced = S.bag.filter((x) => !x.pending);
    const pendingCount = n - priced.length;
    const sum = (k) => priced.reduce((a, x) => a + x[k], 0);
    const total = priced.length
      ? `<div class="pe-total"><div class="pe-range-label">Estimated total${pendingCount ? ` (${priced.length} of ${n} items)` : ""}</div><div class="pe-total-value">${money(sum("creditLo"))}\u2013${money(sum("creditHi"))} credit</div><div class="pe-comp-meta">or ${money(sum("cashLo"))}\u2013${money(sum("cashHi"))} cash${pendingCount ? ` \u00b7 plus ${pendingCount} item${pendingCount === 1 ? "" : "s"} we'll price when they arrive` : ""}</div></div>`
      : `<div class="pe-total"><div class="pe-range-label">Estimated total</div><div class="pe-comp-meta">We'll price ${pendingCount === 1 ? "this item" : "these items"} by hand when ${pendingCount === 1 ? "it arrives" : "they arrive"}, and you approve before anything is listed.</div></div>`;
    box.innerHTML = `<div class="pe-bag-head"><h2>Your Estimate</h2><span class="pe-opt">${n} item${n === 1 ? "" : "s"}</span></div>
      <div>${S.bag.map((it) => `<div class="pe-bag-item"><div><div style="font-weight:600">${esc(it.label)}</div>${it.pending
        ? `<div class="pe-pending">${esc(it.pendingText || "Priced when it arrives")}</div>`
        : `<div class="pe-comp-meta">${money(it.creditLo)}\u2013${money(it.creditHi)} credit \u00b7 ${money(it.cashLo)}\u2013${money(it.cashHi)} cash</div>`}</div>
        <button type="button" class="pe-x" data-act="remove" data-id="${it.id}" aria-label="Remove ${esc(it.label)}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg></button></div>`).join("")}</div>
      ${total}
      <div style="font-size:14px;color:#3F4A44">${esc(CONFIG.freeShippingNote)}</div>
      <a class="pe-link-btn" href="${esc(mailInHref())}" data-act="start-mail-in">Start my mail-in</a>`;
  }

  // ---------------- events ----------------
  $("pe-cat").addEventListener("input", onCatInput);
  $("pe-cat").addEventListener("keydown", (e) => comboKeys(e, "cat"));
  $("pe-brand").addEventListener("input", () => { S.brandResults = searchBrands($("pe-brand").value); S.brandActive = 0; renderBrandList(); });
  $("pe-brand").addEventListener("keydown", (e) => comboKeys(e, "brand"));
  $("pe-cat-list").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) selectCat(S.catResults[+b.dataset.i]); });
  $("pe-brand-list").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) selectBrand(S.brandResults[+b.dataset.i]); });

  // Keep request-form typing in state without re-rendering (so focus isn't lost).
  root.addEventListener("input", (e) => {
    if (e.target.id === "pe-req-email") S.req.email = e.target.value;
    if (e.target.id === "pe-req-note") S.req.note = e.target.value;
    if (e.target.id === "pe-req-model") S.req.model = e.target.value;
    const teamField = { "pe-t-brand": "brand", "pe-t-model": "model", "pe-t-size": "size", "pe-t-note": "note", "pe-t-email": "email" }[e.target.id];
    if (teamField) {
      S.team[teamField] = e.target.value;
      if (S.team.error) { S.team.error = ""; const n = root.querySelector(".pe-team .pe-note-red"); if (n) n.remove(); }
    }
    if (e.target.id === "pe-msrp-inline") {
      S.msrpDraft = e.target.value;
      const go = root.querySelector('[data-act="flow-next"]');
      if (go) { if (Number(S.msrpDraft) > 0) go.removeAttribute("aria-disabled"); else go.setAttribute("aria-disabled", "true"); }
    }
  });
  root.addEventListener("change", (e) => {
    if (e.target.id === "pe-t-year") { S.team.year = e.target.value; renderResult(); setTimeout(() => $("pe-t-year") && $("pe-t-year").focus(), 0); }
  });
  root.addEventListener("keydown", (e) => {
    if (e.target.id === "pe-msrp-inline" && e.key === "Enter") { e.preventDefault(); root.querySelector('[data-act="flow-next"]').click(); }
  });
  const resetReq = () => {
    S.req = { open: false, email: S.req.email, note: "", model: "", sending: false, sent: false, error: "" };
    S.team = { year: "", brand: S.brand && S.brand !== "Other" ? S.brand : "", model: "", size: "", cond: "", note: "", email: S.req.email || S.team.email, sending: false, sent: false, error: "", added: false };
  };
  // Everything that describes one specific item. Cleared when the item changes or is added to the bag.
  function resetItem() {
    S.msrp = ""; S.msrpDraft = ""; S.cond = ""; S.age = ""; S.flow = { open: false, step: 1 }; S.compsOpen = false;
    S.added = false; S.result = null; S.error = ""; S.loading = false;
    resetReq();
  }
  function startNextItem(message) {
    S.cat = null; S.label = null; S.brand = ""; S.size = ""; resetItem();
    S.flash = message; renderAll(); renderBag();
    const top = root.querySelector('.pe-form');
    if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => $("pe-cat").focus({ preventScroll: true }), 0);
  }

  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) return;
    const v = t.dataset.v;
    switch (t.dataset.act) {
      case "clear-cat": S.cat = null; S.label = null; resetItem(); renderAll(); setTimeout(() => $("pe-cat").focus(), 0); return;
      case "clear-brand": S.brand = ""; resetItem(); renderAll(); setTimeout(() => $("pe-brand").focus(), 0); return;
      case "label": S.label = v; break;
      case "size": S.size = S.size === v ? "" : v; break;
      case "payout": S.payout = v; renderResult(); return;
      case "req-open": S.req.open = true; renderResult(); setTimeout(() => $("pe-req-email") && $("pe-req-email").focus(), 0); return;
      case "req-send": sendRequest(); return;
      case "comps": S.compsOpen = !S.compsOpen; renderResult(); return;
      case "team-cond": S.team.cond = v; renderResult(); return;
      case "team-send": sendTeamRequest(); return;
      case "team-add": {
        const T = S.team;
        const label = [T.brand, T.model || (S.label || shortName(S.cat.name))].filter(Boolean).join(" ");
        S.bag.push({ id: Date.now(), label, pending: true, pendingText: "Priced by our team" });
        saveBag(); track("add_to_estimate", Object.assign(itemTrack(), { brand: T.brand, label }));
        startNextItem(`Added ${label} to your estimate. Our team will price it.`); return;
      }
      case "start-mail-in": track("start_mail_in", { items: S.bag.length,
        creditLo: S.bag.filter((x) => !x.pending).reduce((a, x) => a + x.creditLo, 0), creditHi: S.bag.filter((x) => !x.pending).reduce((a, x) => a + x.creditHi, 0) }); return;
      case "flow-open": S.msrpDraft = S.msrp; S.flow = { open: true, step: 1 }; renderResult(); setTimeout(() => $("pe-msrp-inline") && $("pe-msrp-inline").focus(), 0); return;
      case "flow-back": S.flow.step = Math.max(1, S.flow.step - 1); renderResult(); return;
      case "flow-next": {
        if (!(Number(S.msrpDraft) > 0)) { $("pe-msrp-inline") && $("pe-msrp-inline").focus(); return; }
        S.flow.step = 2; renderResult(); return;
      }
      case "flow-skip": S.msrpDraft = ""; S.flow.step = 2; renderResult(); return;
      case "flow-age": S.age = v; S.flow.step = 3; renderResult(); return;
      case "flow-cond": {
        S.cond = v; S.msrp = S.msrpDraft; S.flow = { open: false, step: 1 }; S.compsOpen = false;
        S.added = false; S.result = null; renderResult(); requestEstimate(0); return;
      }
      case "add-pending": {
        const label = (S.brand && S.brand !== "Other" ? S.brand + " " : "") + (S.label || shortName(S.cat.name));
        S.bag.push({ id: Date.now(), label, pending: true });
        saveBag(); track("add_to_estimate", itemTrack()); startNextItem(`Added ${label} to your estimate. We'll price it when it arrives.`); return;
      }
      case "add": {
        const r = S.result; if (!r || r.status !== "ok") return;
        const label = (S.brand && S.brand !== "Other" ? S.brand + " " : "") + (S.label || shortName(S.cat.name));
        const est = r.estimate || r.earnings;
        S.bag.push({ id: Date.now(), label, creditLo: est.credit.low, creditHi: est.credit.high, cashLo: est.cash.low, cashHi: est.cash.high });
        saveBag(); track("add_to_estimate", Object.assign(itemTrack(), { creditLo: est.credit.low, creditHi: est.credit.high, cashLo: est.cash.low, cashHi: est.cash.high })); startNextItem(`Added ${label} to your estimate.`); return;
      }
      case "remove": S.bag = S.bag.filter((x) => String(x.id) !== t.dataset.id); saveBag(); renderBag(); return;
      default: return;
    }
    S.added = false; renderAll(); requestEstimate();
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (root.querySelector(".pe-strip")) renderResult(); }, 150); });

  init();
})();
