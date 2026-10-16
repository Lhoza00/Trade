(function () {
  UI.nav('calendar');
  var today = Store.today();
  var params = new URLSearchParams(location.search);
  var asked = params.get('date') || '';
  var sel = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : today;
  var view = new Date(+sel.slice(0, 4), +sel.slice(5, 7) - 1, 1);
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  $('dow').innerHTML = DOW.map(function (d) { return '<span>' + d + '</span>'; }).join('');

  function indexByDay(db) {
    var map = {};
    db.entries.forEach(function (e) {
      var m = map[e.date] || (map[e.date] = { analysis: 0, trade: 0, checkin: false });
      if (e.type === 'trade') m.trade++; else m.analysis++;
    });
    Object.keys(db.checkins).forEach(function (d) {
      var m = map[d] || (map[d] = { analysis: 0, trade: 0, checkin: false });
      m.checkin = true;
    });
    return map;
  }

  function renderGrid(db) {
    var y = view.getFullYear(), m = view.getMonth();
    var map = indexByDay(db);
    var offset = (new Date(y, m, 1).getDay() + 6) % 7; // Monday first
    var days = new Date(y, m + 1, 0).getDate();
    var html = '', a = 0, t = 0, i;

    for (i = 0; i < offset; i++) html += '<span class="blank"></span>';
    for (i = 1; i <= days; i++) {
      var ds = y + '-' + pad(m + 1) + '-' + pad(i);
      var info = map[ds] || { analysis: 0, trade: 0, checkin: false };
      a += info.analysis; t += info.trade;
      var cls = 'day' + (ds === today ? ' today' : '') + (ds === sel ? ' sel' : '');
      var dots = (info.analysis ? '<i class="dot a"></i>' : '') + (info.trade ? '<i class="dot t"></i>' : '') + (info.checkin ? '<i class="dot c"></i>' : '');
      var label = UI.fmtDate(ds) + (info.analysis ? ', ' + info.analysis + ' analysis' : '') + (info.trade ? ', ' + info.trade + ' trade' : '');
      html += '<button type="button" class="' + cls + '" data-d="' + ds + '" aria-pressed="' + (ds === sel) + '" aria-label="' + label + '">' +
        '<span class="n">' + i + '</span><span class="dots">' + dots + '</span></button>';
    }
    $('grid').innerHTML = html;
    $('monthTitle').textContent = view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    $('monthSummary').textContent = a + (a === 1 ? ' analysis' : ' analyses') + ' · ' + t + (t === 1 ? ' trade' : ' trades');
  }

  function renderDay(db) {
    $('dayTitle').textContent = sel === today ? 'Today · ' + UI.fmtDate(sel) : UI.fmtDate(sel);

    var c = db.checkins[sel];
    $('dayCheckin').innerHTML = c
      ? '<div class="card"><b>Wellbeing</b><p class="sub" style="margin-top:4px">Mood ' + (c.mood || '–') + ' · Energy ' + (c.energy || '–') +
        ' · Sleep ' + (c.sleep || '–') + ' · Stress ' + (c.stress || '–') + '</p>' +
        (c.note ? '<p style="margin-top:6px">' + UI.esc(c.note) + '</p>' : '') + '</div>'
      : '<div class="card empty">No wellbeing check-in for this day.</div>';

    var list = Store.entriesOn(sel);
    var an = list.filter(function (e) { return e.type !== 'trade'; });
    var tr = list.filter(function (e) { return e.type === 'trade'; });
    $('dayAnalyses').innerHTML = an.length ? an.map(UI.entryCard).join('') : '<div class="card empty">No analysis on this day.</div>';
    $('dayTrades').innerHTML = tr.length ? tr.map(UI.entryCard).join('') : '<div class="card empty">No trades on this day.</div>';

    $('addAnalysis').href = 'create.html?type=analysis&date=' + sel;
    $('addTrade').href = 'create.html?type=trade&date=' + sel;
  }

  function render() {
    var db = Store.all();
    renderGrid(db);
    renderDay(db);
  }

  $('grid').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-d]');
    if (!b) return;
    sel = b.dataset.d;
    render();
  });
  $('prev').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
  $('next').addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });
  $('todayBtn').addEventListener('click', function () {
    sel = today;
    view = new Date(+today.slice(0, 4), +today.slice(5, 7) - 1, 1);
    render();
  });

  render();
})();
