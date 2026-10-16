(function () {
  UI.nav('dashboard');
  var today = Store.today();

  // Confirmation after saving from Create
  try {
    var flash = sessionStorage.getItem('tj.flash');
    if (flash) { sessionStorage.removeItem('tj.flash'); setTimeout(function () { UI.toast(flash); }, 250); }
  } catch (e) {}

  // Header
  var h = new Date().getHours();
  document.getElementById('greeting').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.getElementById('todayLabel').textContent = UI.fmtDate(today);

  // Wellbeing check-in
  var FIELDS = [
    ['mood', 'Mood', 'low', 'high'],
    ['energy', 'Energy', 'low', 'high'],
    ['sleep', 'Sleep quality', 'poor', 'great'],
    ['stress', 'Stress', 'calm', 'high']
  ];
  var current = Store.checkin(today) || {};
  var box = document.getElementById('checkinFields');
  box.innerHTML = FIELDS.map(function (f) {
    var btns = [1, 2, 3, 4, 5].map(function (n) {
      return '<button type="button" data-f="' + f[0] + '" data-v="' + n + '" aria-pressed="' + (current[f[0]] === n) + '">' + n + '</button>';
    }).join('');
    return '<div class="scale"><label>' + f[1] + '<span>1 ' + f[2] + ' · 5 ' + f[3] + '</span></label><div class="seg">' + btns + '</div></div>';
  }).join('');
  document.getElementById('checkinNote').value = current.note || '';
  var saveBtn = document.getElementById('saveCheckin');
  if (current.mood) saveBtn.textContent = 'Update check-in';

  box.addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-f]');
    if (!b) return;
    current[b.dataset.f] = +b.dataset.v;
    box.querySelectorAll('button[data-f="' + b.dataset.f + '"]').forEach(function (x) {
      x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
    });
  });
  saveBtn.addEventListener('click', function () {
    current.note = document.getElementById('checkinNote').value.trim();
    if (Store.saveCheckin(today, current)) { UI.toast('Check-in saved'); saveBtn.textContent = 'Update check-in'; }
  });

  // Today's analysis
  var todays = Store.entriesOn(today).filter(function (e) { return e.type === 'analysis'; });
  document.getElementById('todayList').innerHTML = todays.length
    ? todays.map(UI.entryCard).join('')
    : '<div class="card empty">No analysis for today yet.<br><a href="create.html">Start today\'s analysis</a></div>';

  // Summary
  var s = Store.stats();
  var tiles = [
    [s.week, 'Entries, last 7 days'],
    [s.awaiting, 'Awaiting your verdict'],
    [s.reviewed, 'Reviewed'],
    [s.reviewed ? s.correct + '/' + s.reviewed : '–', 'Bias was correct']
  ];
  document.getElementById('summary').innerHTML = tiles.map(function (t) {
    return '<div class="tile"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>';
  }).join('');
  var ins = document.getElementById('insight');
  if (s.topMistake) {
    ins.hidden = false;
    ins.textContent = 'Most repeated mistake: ' + s.topMistake.name + ' (' + s.topMistake.count + 'x)';
  }

  // Gentle backup reminder: once there is something worth keeping, and no backup in the last 14 days
  var u = Store.usage(), lastBackup = Store.meta().lastBackup;
  if (u.entries + u.library >= 3 && (!lastBackup || Date.now() - lastBackup > 14 * 86400000)) {
    var note = document.getElementById('backupNote');
    note.hidden = false;
    note.innerHTML = (lastBackup ? 'It has been a while since your last backup. ' : 'You have not backed up your journal yet. ') + '<a class="link" href="settings.html" style="color:inherit;text-decoration:underline">Back up now</a>';
  }

  // Recent activity
  var recent = Store.entries().slice(0, 6);
  document.getElementById('recentList').innerHTML = recent.length
    ? recent.map(UI.entryCard).join('')
    : '<div class="card empty">Your saved analyses and trades will appear here as cards.</div>';
})();
