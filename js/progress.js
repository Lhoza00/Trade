(function () {
  UI.nav('progress');
  var range = '30';
  var RANGES = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']];
  var METRICS = [['mood', 'Mood'], ['energy', 'Energy'], ['sleep', 'Sleep quality'], ['stress', 'Stress (5 = high)']];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return UI.esc(s); }
  function parse(ds) { var p = ds.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function cutoffFor(r) {
    if (r === 'all') return '';
    var d = new Date(); d.setDate(d.getDate() - (+r - 1));
    return Store.dateStr(d);
  }
  function weekStart(ds) {
    var d = parse(ds); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return Store.dateStr(d);
  }
  function avg(list) {
    if (!list.length) return null;
    return Math.round(list.reduce(function (a, b) { return a + b; }, 0) / list.length * 10) / 10;
  }

  // ---------- Numbers ----------
  function compute(db) {
    var cutoff = cutoffFor(range);
    var inRange = db.entries.filter(function (e) { return !cutoff || e.date >= cutoff; });
    var reviewed = inRange.filter(function (e) { return Store.stageOf(e) === 3; });
    var r = {
      inRange: inRange.length, reviewed: reviewed.length, awaiting: inRange.length - reviewed.length,
      bias: { yes: 0, partly: 0, no: 0 }, valid: { yes: 0, no: 0 }, plan: { yes: 0, partly: 0, no: 0 },
      mistakes: {}, positives: {}, cats: {}, setups: {},
      well: { followed: { n: 0, sums: {} }, not: { n: 0, sums: {} } }
    };
    METRICS.forEach(function (m) { r.well.followed.sums[m[0]] = []; r.well.not.sums[m[0]] = []; });

    reviewed.forEach(function (e) {
      var v = e.stage3_verdict || {}, f = e.stage1_forecast || {};
      if (r.bias[v.directionCorrect] != null) r.bias[v.directionCorrect]++;
      if (r.valid[v.setupValid] != null) r.valid[v.setupValid]++;
      if (r.plan[v.planFollowed] != null) r.plan[v.planFollowed]++;

      var pm = v.primaryMistake || {};
      if (pm.mistake) {
        if (pm.category === 'Positive behaviour') {
          r.positives[pm.mistake] = (r.positives[pm.mistake] || 0) + 1;
        } else if (Store.MISTAKE_CATEGORIES.indexOf(pm.category) > -1) {
          var m = r.mistakes[pm.mistake] || (r.mistakes[pm.mistake] = { n: 0, cat: pm.category });
          m.n++;
          r.cats[pm.category] = (r.cats[pm.category] || 0) + 1;
        }
      }

      var setup = v.setup || f.setup || 'No setup chosen';
      var s = r.setups[setup] || (r.setups[setup] = { n: 0, right: 0, valid: 0 });
      s.n++;
      if (v.directionCorrect === 'yes') s.right++;
      if (v.setupValid === 'yes') s.valid++;

      var c = db.checkins[e.date];
      if (c && v.planFollowed) {
        var g = v.planFollowed === 'yes' ? r.well.followed : r.well.not;
        g.n++;
        METRICS.forEach(function (mt) { if (typeof c[mt[0]] === 'number') g.sums[mt[0]].push(c[mt[0]]); });
      }
    });

    // Weekly trend, always the last 8 weeks, independent of the range filter
    var start = weekStart(Store.today()), weeks = [], i;
    for (i = 7; i >= 0; i--) {
      var d = parse(start); d.setDate(d.getDate() - 7 * i);
      weeks.push({ start: Store.dateStr(d), correct: 0, other: 0 });
    }
    db.entries.forEach(function (e) {
      if (Store.stageOf(e) !== 3) return;
      var ws = weekStart(e.date);
      weeks.forEach(function (w) {
        if (w.start === ws) { if (e.stage3_verdict.directionCorrect === 'yes') w.correct++; else w.other++; }
      });
    });
    r.weeks = weeks;
    return r;
  }

  // ---------- Pieces ----------
  function ofTotal(o) { return Object.keys(o).reduce(function (a, k) { return a + o[k]; }, 0); }

  function stackRow(title, parts) {
    var total = parts.reduce(function (a, p) { return a + p.n; }, 0);
    if (!total) return '<div class="arow"><div class="atitle">' + esc(title) + '</div><p class="sub">No answers yet.</p></div>';
    var segs = parts.filter(function (p) { return p.n > 0; }).map(function (p) {
      return '<span class="seg ' + p.k + '" style="flex:' + p.n + '" data-tip="' + esc(title + ': ' + p.label + ' ' + p.n + ' of ' + total) + '"></span>';
    }).join('');
    var keys = parts.map(function (p) {
      return '<span class="key"><i class="sw ' + p.k + '"></i>' + p.label + ' ' + p.n + '</span>';
    }).join('');
    return '<div class="arow"><div class="atitle">' + esc(title) + '</div><div class="stack" role="img" aria-label="' + esc(title) + '">' + segs + '</div><div class="keys">' + keys + '</div></div>';
  }

  function barList(map, getN, getCat, emptyMsg, unit) {
    var names = Object.keys(map).sort(function (a, b) { return getN(map[b]) - getN(map[a]) || (a < b ? -1 : 1); });
    if (!names.length) return '<p class="sub">' + emptyMsg + '</p>';
    var max = getN(map[names[0]]);
    return names.map(function (name) {
      var n = getN(map[name]), cat = getCat ? getCat(map[name]) : '';
      return '<div class="hrow" tabindex="0" data-tip="' + esc(name + (cat ? ' · ' + cat : '') + ': ' + n + ' ' + (n === 1 ? unit : unit + 's')) + '">' +
        '<div class="top"><span>' + esc(name) + '</span>' + (cat ? '<span class="cat">' + esc(cat) + '</span>' : '') + '</div>' +
        '<div class="hbar"><span class="fill" style="width:' + Math.max(4, Math.round(n / max * 78)) + '%"></span><span class="val">' + n + '</span></div></div>';
    }).join('');
  }

  function weeklyChart(weeks) {
    var max = Math.max.apply(null, weeks.map(function (w) { return w.correct + w.other; }));
    if (!max) return '<p class="sub">No reviewed entries in the last 8 weeks.</p>';
    var unit = 104 / max;
    function label(ws) { return parse(ws).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); }
    var cols = weeks.map(function (w) {
      var tot = w.correct + w.other;
      var segs = (w.other ? '<span class="s other" style="height:' + Math.max(4, Math.round(w.other * unit)) + 'px"></span>' : '') +
        (w.correct ? '<span class="s ok" style="height:' + Math.max(4, Math.round(w.correct * unit)) + 'px"></span>' : '');
      return '<div class="col" tabindex="0" data-tip="' + esc('Week of ' + label(w.start) + ': ' + w.correct + ' correct, ' + w.other + ' partly or wrong') + '">' +
        (tot ? '<span class="tot">' + tot + '</span>' : '') + '<div class="stackc">' + segs + '</div></div>';
    }).join('');
    var xs = weeks.map(function (w) { return '<span>' + label(w.start) + '</span>'; }).join('');
    var rows = weeks.map(function (w) {
      return '<tr><td>' + label(w.start) + '</td><td class="num">' + w.correct + '</td><td class="num">' + w.other + '</td></tr>';
    }).join('');
    return '<div class="cols" role="img" aria-label="Reviewed entries per week">' + cols + '</div><div class="colsx">' + xs + '</div>' +
      '<div class="keys" style="margin-top:10px"><span class="key"><i class="sw yes"></i>Bias correct</span><span class="key"><i class="sw no"></i>Partly or wrong</span></div>' +
      '<details class="tview"><summary>View as table</summary><table class="tbl"><thead><tr><th>Week of</th><th class="num">Correct</th><th class="num">Partly or wrong</th></tr></thead><tbody>' + rows + '</tbody></table></details>';
  }

  function setupTable(setups) {
    var names = Object.keys(setups).sort(function (a, b) { return setups[b].n - setups[a].n || (a < b ? -1 : 1); });
    if (!names.length) return '<p class="sub">No reviewed entries yet.</p>';
    return '<table class="tbl"><thead><tr><th>Setup</th><th class="num">Reviewed</th><th class="num">Bias right</th><th class="num">Valid</th></tr></thead><tbody>' +
      names.map(function (n) {
        var s = setups[n];
        return '<tr><td>' + esc(n) + '</td><td class="num">' + s.n + '</td><td class="num">' + s.right + '</td><td class="num">' + s.valid + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function wellbeingTable(w) {
    if (!w.followed.n || !w.not.n) {
      return '<p class="sub">This compares your wellbeing check-ins on days you followed your plan with days you did not. It needs reviewed entries in both groups that have a check-in for the same day (so far: followed ' +
        w.followed.n + ', did not ' + w.not.n + ').</p>';
    }
    function cell(g, key) { var a = avg(g.sums[key]); return a == null ? '–' : a.toFixed(1); }
    var rows = METRICS.map(function (m) {
      return '<tr><td>' + m[1] + '</td><td class="num">' + cell(w.followed, m[0]) + '</td><td class="num">' + cell(w.not, m[0]) + '</td></tr>';
    }).join('');
    var small = Math.min(w.followed.n, w.not.n) < 5;
    return '<table class="tbl"><thead><tr><th>Average (1 to 5)</th><th class="num">Followed plan (' + w.followed.n + ')</th><th class="num">Did not (' + w.not.n + ')</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="hint">' + (small ? 'Small sample, so treat this as a hint rather than proof. ' : '') + 'Based on the check-in for the day of each reviewed entry.</p>';
  }

  // ---------- Page ----------
  function render() {
    $('range').innerHTML = RANGES.map(function (x) {
      return '<button type="button" data-r="' + x[0] + '" aria-pressed="' + (range === x[0]) + '">' + x[1] + '</button>';
    }).join('');

    var r = compute(Store.all());
    if (!r.reviewed) {
      $('report').hidden = true;
      $('empty').hidden = false;
      $('empty').innerHTML = (r.inRange
        ? 'No reviewed entries in this range yet.<br>' + r.awaiting + (r.awaiting === 1 ? ' entry is' : ' entries are') + ' waiting for a verdict.'
        : 'No entries in this range yet.') +
        '<br><a href="index.html">Open the Dashboard</a> and review a card to start seeing patterns.';
      return;
    }
    $('report').hidden = false;
    $('empty').hidden = true;

    var planTotal = ofTotal(r.plan);
    $('tiles').innerHTML = [
      [r.reviewed, 'Reviewed'],
      [r.bias.yes + '/' + r.reviewed, 'Bias was correct'],
      [planTotal ? r.plan.yes + '/' + planTotal : '–', 'Plan was followed'],
      [r.awaiting, 'Awaiting a verdict']
    ].map(function (t) { return '<div class="tile"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>'; }).join('');

    $('accuracy').innerHTML =
      stackRow('Was the bias correct?', [{ k: 'yes', label: 'Yes', n: r.bias.yes }, { k: 'partly', label: 'Partly', n: r.bias.partly }, { k: 'no', label: 'No', n: r.bias.no }]) +
      stackRow('Was the setup valid?', [{ k: 'yes', label: 'Yes', n: r.valid.yes }, { k: 'no', label: 'No', n: r.valid.no }]) +
      stackRow('Did you follow your plan?', [{ k: 'yes', label: 'Yes', n: r.plan.yes }, { k: 'partly', label: 'Partly', n: r.plan.partly }, { k: 'no', label: 'No', n: r.plan.no }]);

    $('weekly').innerHTML = weeklyChart(r.weeks);

    var catLine = Store.MISTAKE_CATEGORIES.map(function (c) {
      return '<span class="key">' + esc(c.replace(' mistake', '')) + ' ' + (r.cats[c] || 0) + '</span>';
    }).join('');
    $('mistakes').innerHTML = barList(r.mistakes, function (m) { return m.n; }, function (m) { return m.cat; },
      'No mistakes recorded in reviewed entries. Nice, or time to add more detail.', 'time') +
      '<div class="keys" style="margin-top:12px">' + catLine + '</div>';

    $('positives').innerHTML = barList(r.positives, function (n) { return n; }, null,
      'Pick "Positive behaviour" as the category in a verdict to see what is working.', 'time');

    $('setups').innerHTML = setupTable(r.setups);
    $('wellbeing').innerHTML = wellbeingTable(r.well);
  }

  $('range').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-r]');
    if (!b) return;
    range = b.dataset.r;
    render();
  });

  // ---------- Tooltip (hover on desktop, tap on phones) ----------
  var tip = $('tip'), tipFor = null;
  function showTip(el) {
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    var rc = el.getBoundingClientRect();
    var x = Math.min(Math.max(8, rc.left + rc.width / 2 - tip.offsetWidth / 2), window.innerWidth - tip.offsetWidth - 8);
    tip.style.left = x + 'px';
    tip.style.top = Math.max(8, rc.top - tip.offsetHeight - 8) + 'px';
    tipFor = el;
  }
  function hideTip() { tip.hidden = true; tipFor = null; }
  document.addEventListener('pointerover', function (ev) {
    if (ev.pointerType !== 'mouse') return;
    var t = ev.target.closest && ev.target.closest('[data-tip]');
    if (t) showTip(t); else hideTip();
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target.closest('[data-tip]');
    if (t && t !== tipFor) showTip(t); else hideTip();
  });
  document.addEventListener('focusin', function (ev) { var t = ev.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('focusout', hideTip);
  window.addEventListener('scroll', hideTip, { passive: true });

  render();
})();
