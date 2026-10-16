/* Storage layer. Everything lives in the phone's localStorage under one key. */
(function () {
  var KEY = 'tj.v1';

  var CATEGORIES = {
    'Setup': ['FVG', 'Order block', 'BOS/CHOCH', 'Liquidity sweep'],
    'Market context': ['Daily bias', 'Session', 'Trend', 'Volatility'],
    'Execution mistake': ['Early entry', 'Late entry', 'Moved stop-loss'],
    'Psychological mistake': ['Impatience', 'Fear', 'Revenge trading', 'Overconfidence'],
    'Risk mistake': ['Oversized position', 'Poor stop placement', 'Excessive risk'],
    'External factor': ['Spread', 'Slippage', 'Platform issue'],
    'Positive behaviour': ['Waited for confirmation', 'Followed plan', 'Skipped invalid setup']
  };
  var MISTAKE_CATEGORIES = ['Execution mistake', 'Psychological mistake', 'Risk mistake', 'External factor'];

  function blank() { return { version: 1, entries: [], checkins: {}, library: [] }; }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      return Object.assign(blank(), JSON.parse(raw));
    } catch (e) {
      console.warn('Could not read storage', e);
      return blank();
    }
  }

  function save(db) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      alert('Storage is full. Remove some pictures or export a backup, then try again.');
      return false;
    }
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dateStr(new Date()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* Stage of an entry: 1 = forecast saved, 2 = outcome added, 3 = reviewed */
  function stageOf(e) {
    if (e.stage3_verdict && e.stage3_verdict.reviewed) return 3;
    if (e.stage2_outcome && e.stage2_outcome.images && e.stage2_outcome.images.length) return 2;
    return 1;
  }

  function stats() {
    var db = load();
    var weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 6);
    var weekStr = dateStr(weekAgo);
    var reviewed = db.entries.filter(function (e) { return stageOf(e) === 3; });
    var correct = reviewed.filter(function (e) { return e.stage3_verdict.directionCorrect === 'yes'; }).length;
    var counts = {};
    reviewed.forEach(function (e) {
      var m = e.stage3_verdict.primaryMistake;
      if (m && m.mistake && MISTAKE_CATEGORIES.indexOf(m.category) > -1) counts[m.mistake] = (counts[m.mistake] || 0) + 1;
    });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    return {
      week: db.entries.filter(function (e) { return e.date >= weekStr; }).length,
      awaiting: db.entries.length - reviewed.length,
      reviewed: reviewed.length,
      correct: correct,
      topMistake: top ? { name: top, count: counts[top] } : null
    };
  }

  /* ----- Backup file reading: every field is cleaned, because a backup file is untrusted input ----- */
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  function str(x, max) { return typeof x === 'string' ? x.slice(0, max || 20000) : ''; }
  function oneOf(x, list) { return list.indexOf(x) > -1 ? x : ''; }
  function cleanImages(a) {
    return (Array.isArray(a) ? a : []).filter(function (s) {
      return typeof s === 'string' && s.indexOf('data:image/') === 0 && !/["'<>\s]/.test(s);
    }).slice(0, 6);
  }
  function cleanEntry(e) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !e.id || !DATE_RE.test(e.date || '')) return null;
    var f = e.stage1_forecast || {}, o = e.stage2_outcome || {}, v = e.stage3_verdict || {}, pm = v.primaryMistake || {};
    return {
      id: str(e.id, 64), type: e.type === 'trade' ? 'trade' : 'analysis', date: e.date,
      title: str(e.title, 200), instrument: str(e.instrument, 60), createdAt: +e.createdAt || Date.now(),
      stage1_forecast: {
        images: cleanImages(f.images), bias: oneOf(f.bias, ['bullish', 'bearish', 'neutral']),
        markings: (Array.isArray(f.markings) ? f.markings : []).filter(function (m) { return ['FVG', 'Order block', 'Liquidity', 'Structure'].indexOf(m) > -1; }),
        setup: str(f.setup, 100), marketContext: str(f.marketContext, 100), entry: str(f.entry, 500),
        invalidation: str(f.invalidation, 500), target: str(f.target, 500), reasoning: str(f.reasoning)
      },
      stage2_outcome: { images: cleanImages(o.images), notes: str(o.notes) },
      stage3_verdict: {
        reviewed: v.reviewed === true,
        directionCorrect: oneOf(v.directionCorrect, ['yes', 'partly', 'no']),
        setupValid: oneOf(v.setupValid, ['yes', 'no']),
        planFollowed: oneOf(v.planFollowed, ['yes', 'partly', 'no']),
        setup: str(v.setup, 100), marketContext: str(v.marketContext, 100),
        primaryMistake: { category: str(pm.category, 100), mistake: str(pm.mistake, 100) },
        evidence: str(v.evidence), cause: str(v.cause), nextTime: str(v.nextTime), correctiveAction: str(v.correctiveAction)
      }
    };
  }
  function cleanLibraryItem(x) {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id) return null;
    return {
      id: str(x.id, 64), kind: oneOf(x.kind, ['lesson', 'strategy', 'mistake', 'reference']) || 'reference',
      title: str(x.title, 200), body: str(x.body), images: cleanImages(x.images),
      category: str(x.category, 100), item: str(x.item, 100), source: typeof x.source === 'string' ? str(x.source, 64) : null,
      createdAt: +x.createdAt || Date.now(), updatedAt: +x.updatedAt || +x.createdAt || Date.now()
    };
  }
  function cleanCheckin(date, c) {
    if (!DATE_RE.test(date) || !c || typeof c !== 'object') return null;
    var out = { date: date };
    ['mood', 'energy', 'sleep', 'stress'].forEach(function (k) { if (typeof c[k] === 'number' && c[k] >= 1 && c[k] <= 5) out[k] = Math.round(c[k]); });
    if (typeof c.note === 'string') out.note = c.note.slice(0, 2000);
    return out;
  }
  function normalizeDb(raw) {
    var skipped = 0, db = blank();
    (Array.isArray(raw.entries) ? raw.entries : []).forEach(function (e) {
      var c = cleanEntry(e); if (c) db.entries.push(c); else skipped++;
    });
    (Array.isArray(raw.library) ? raw.library : []).forEach(function (x) {
      var c = cleanLibraryItem(x); if (c) db.library.push(c); else skipped++;
    });
    var ci = raw.checkins && typeof raw.checkins === 'object' ? raw.checkins : {};
    Object.keys(ci).forEach(function (d) { var c = cleanCheckin(d, ci[d]); if (c) db.checkins[d] = c; else skipped++; });
    return { db: db, skipped: skipped };
  }
  function parseBackup(text) {
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: 'This file is not a valid backup. It could not be read.' }; }
    var data = obj && obj.data && typeof obj.data === 'object' ? obj.data : obj;
    if (!data || typeof data !== 'object' || !Array.isArray(data.entries)) return { ok: false, error: 'This file does not look like a Trading Journal backup.' };
    var n = normalizeDb(data);
    return { ok: true, db: n.db, skipped: n.skipped, exportedAt: obj && typeof obj.exportedAt === 'string' ? obj.exportedAt : '' };
  }
  function imageChars(list, pick) {
    var chars = 0, count = 0;
    list.forEach(function (x) { pick(x).forEach(function (a) { (a || []).forEach(function (s) { chars += s.length; count++; }); }); });
    return { chars: chars, count: count };
  }

  window.Store = {
    CATEGORIES: CATEGORIES,
    MISTAKE_CATEGORIES: MISTAKE_CATEGORIES,
    today: today, dateStr: dateStr, uid: uid, stageOf: stageOf, stats: stats,
    all: function () { return load(); },
    entries: function () {
      return load().entries.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    },
    entry: function (id) { return load().entries.filter(function (e) { return e.id === id; })[0] || null; },
    entriesOn: function (date) { return this.entries().filter(function (e) { return e.date === date; }); },
    saveEntry: function (entry) {
      var db = load();
      var i = db.entries.findIndex(function (e) { return e.id === entry.id; });
      if (i > -1) db.entries[i] = entry; else db.entries.push(entry);
      return save(db);
    },
    deleteEntry: function (id) {
      var db = load();
      db.entries = db.entries.filter(function (e) { return e.id !== id; });
      return save(db);
    },
    checkin: function (date) { return load().checkins[date] || null; },
    saveCheckin: function (date, data) {
      var db = load();
      db.checkins[date] = Object.assign({ date: date }, data);
      return save(db);
    },
    libraryItems: function () {
      return load().library.slice().sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    },
    libraryItem: function (id) { return load().library.filter(function (x) { return x.id === id; })[0] || null; },
    saveLibraryItem: function (item) {
      var db = load();
      var i = db.library.findIndex(function (x) { return x.id === item.id; });
      if (i > -1) db.library[i] = item; else db.library.push(item);
      return save(db);
    },
    deleteLibraryItem: function (id) {
      var db = load();
      db.library = db.library.filter(function (x) { return x.id !== id; });
      return save(db);
    },

    /* Backup, restore and housekeeping (Settings page) */
    meta: function () { try { return JSON.parse(localStorage.getItem('tj.meta') || '{}'); } catch (e) { return {}; } },
    setMeta: function (patch) {
      var m = Object.assign(this.meta(), patch);
      try { localStorage.setItem('tj.meta', JSON.stringify(m)); } catch (e) {}
    },
    exportData: function () { return { app: 'trading-journal', version: 1, exportedAt: new Date().toISOString(), data: load() }; },
    parseBackup: parseBackup,
    replaceAll: function (db) { return save(db); },
    mergeIn: function (incoming) {
      var db = load(), r = { entries: 0, library: 0, updated: 0, checkins: 0, ok: true };
      var have = {};
      db.entries.forEach(function (e) { have[e.id] = true; });
      incoming.entries.forEach(function (e) { if (!have[e.id]) { db.entries.push(e); r.entries++; } });
      incoming.library.forEach(function (x) {
        var i = db.library.findIndex(function (y) { return y.id === x.id; });
        if (i === -1) { db.library.push(x); r.library++; }
        else if ((x.updatedAt || 0) > (db.library[i].updatedAt || 0)) { db.library[i] = x; r.updated++; }
      });
      Object.keys(incoming.checkins).forEach(function (d) { if (!db.checkins[d]) { db.checkins[d] = incoming.checkins[d]; r.checkins++; } });
      r.ok = save(db);
      return r;
    },
    eraseAll: function () { try { localStorage.removeItem(KEY); localStorage.removeItem('tj.meta'); } catch (e) {} },
    usage: function () {
      var raw = ''; try { raw = localStorage.getItem(KEY) || ''; } catch (e) {}
      var db = load();
      var a = imageChars(db.entries, function (e) { return [(e.stage1_forecast || {}).images, (e.stage2_outcome || {}).images]; });
      var b = imageChars(db.library, function (x) { return [x.images]; });
      return {
        chars: raw.length, limit: 5000000, imageChars: a.chars + b.chars, images: a.count + b.count,
        entries: db.entries.length, library: db.library.length, checkins: Object.keys(db.checkins).length
      };
    }
  };
})();
