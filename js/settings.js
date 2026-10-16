(function () {
  UI.nav('');
  var pending = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return UI.esc(s); }
  function size(n) { return n < 100000 ? Math.max(1, Math.round(n / 1000)) + ' KB' : (n / 1000000).toFixed(1) + ' MB'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function when(ts) {
    var d = new Date(ts);
    return Store.dateStr(d) + ' at ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  // ---------- Storage ----------
  function renderStorage() {
    var u = Store.usage();
    var pct = Math.min(100, Math.round(u.chars / u.limit * 100));
    $('storageText').innerHTML = '<b>' + size(u.chars) + '</b> of about 5 MB used · ' + pct + '% full';
    $('meterFill').style.width = Math.max(pct, 1) + '%';
    $('meter').className = 'meter' + (pct >= 70 ? ' warn' : '');
    $('storageDetail').textContent = plural(u.entries, 'entry', 'entries') + ', ' + plural(u.library, 'library item', 'library items') + ', ' +
      plural(u.checkins, 'check-in', 'check-ins') + ', ' + plural(u.images, 'picture', 'pictures') + ' (' + size(u.imageChars) + ').';
    var w = $('storageWarn');
    if (pct >= 90) { w.hidden = false; w.textContent = 'Almost full. Download a backup, then remove some pictures you no longer need.'; }
    else if (pct >= 70) { w.hidden = false; w.textContent = 'Getting full. Download a backup and consider removing old pictures.'; }
    else w.hidden = true;
  }

  // ---------- Backup ----------
  function renderBackup() {
    var m = Store.meta();
    $('lastBackup').textContent = m.lastBackup ? 'Last backup: ' + when(m.lastBackup) : 'You have not made a backup yet.';
  }
  function fileName() { return 'trading-journal-backup-' + Store.today() + '.json'; }
  function backupBlob() { return new Blob([JSON.stringify(Store.exportData())], { type: 'application/json' }); }
  $('dlBtn').addEventListener('click', function () {
    var url = URL.createObjectURL(backupBlob());
    var a = document.createElement('a');
    a.href = url; a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    Store.setMeta({ lastBackup: Date.now() });
    renderBackup(); UI.toast('Backup downloaded');
  });
  try {
    var probe = new File(['{}'], 'x.json', { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [probe] })) $('shareBtn').hidden = false;
  } catch (e) {}
  $('shareBtn').addEventListener('click', function () {
    var file = new File([backupBlob()], fileName(), { type: 'application/json' });
    navigator.share({ files: [file], title: 'Trading journal backup' }).then(function () {
      Store.setMeta({ lastBackup: Date.now() }); renderBackup(); UI.toast('Backup shared');
    }).catch(function () {});
  });

  // ---------- Restore ----------
  function showRestoreError(msg) {
    pending = null;
    $('restoreBox').hidden = false;
    $('restoreBox').innerHTML = '<p style="color:var(--warn)"><b>Could not restore.</b> ' + esc(msg) + '</p>';
  }
  function showRestoreChoice(res, fileName) {
    pending = res;
    var db = res.db;
    var now = Store.usage();
    $('restoreBox').hidden = false;
    $('restoreBox').innerHTML =
      '<p><b>' + esc(fileName) + '</b>' + (res.exportedAt ? '<br><span class="sub">Made on ' + esc(res.exportedAt.slice(0, 10)) + '</span>' : '') + '</p>' +
      '<p class="sub" style="margin-top:6px">Contains ' + plural(db.entries.length, 'entry', 'entries') + ', ' + plural(db.library.length, 'library item', 'library items') + ' and ' +
      plural(Object.keys(db.checkins).length, 'check-in', 'check-ins') + '. You currently have ' + plural(now.entries, 'entry', 'entries') + ', ' +
      plural(now.library, 'library item', 'library items') + ' and ' + plural(now.checkins, 'check-in', 'check-ins') + '.' +
      (res.skipped ? ' ' + plural(res.skipped, 'unreadable item was', 'unreadable items were') + ' skipped.' : '') + '</p>' +
      '<div class="stackbtn" style="margin-top:12px">' +
      '<button class="btn" id="mergeBtn" type="button">Merge into my journal</button>' +
      '<p class="hint" style="margin:0">Adds what is missing and keeps everything you already have. Safest choice.</p>' +
      '<button class="btn danger" id="replaceBtn" type="button">Replace my journal with this backup</button>' +
      '<p class="hint" style="margin:0">Removes what is on this phone first. Cannot be undone.</p></div>';
  }
  $('restoreFile').addEventListener('change', function (ev) {
    var f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > 60 * 1024 * 1024) { showRestoreError('That file is too large to be a backup.'); return; }
    var r = new FileReader();
    r.onerror = function () { showRestoreError('The file could not be read.'); };
    r.onload = function () {
      var res = Store.parseBackup(String(r.result));
      if (!res.ok) showRestoreError(res.error); else showRestoreChoice(res, f.name);
    };
    r.readAsText(f);
  });
  $('restoreBox').addEventListener('click', function (ev) {
    if (!pending) return;
    if (ev.target.id === 'mergeBtn') {
      var out = Store.mergeIn(pending.db);
      if (!out.ok) return;
      pending = null; $('restoreBox').hidden = true;
      UI.toast('Added ' + plural(out.entries, 'entry', 'entries') + ', ' + plural(out.library + out.updated, 'library item', 'library items'));
      renderStorage();
    } else if (ev.target.id === 'replaceBtn') {
      if (!confirm('Replace everything on this phone with the backup? This cannot be undone.')) return;
      if (!Store.replaceAll(pending.db)) return;
      pending = null; $('restoreBox').hidden = true;
      UI.toast('Journal restored'); renderStorage();
    }
  });

  // ---------- Install, offline, persistence ----------
  var deferred = null;
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  $('installStatus').innerHTML = standalone ? '<b>Installed.</b> You are using the app from your home screen.' : '<b>Not installed.</b> Add it to your home screen to open it like an app.';
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; if (!standalone) $('installBtn').hidden = false; });
  window.addEventListener('appinstalled', function () { $('installBtn').hidden = true; $('installStatus').innerHTML = '<b>Installed.</b>'; });
  $('installBtn').addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; $('installBtn').hidden = true; });
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    $('offlineStatus').textContent = 'Setting up offline use…';
    navigator.serviceWorker.ready.then(function () {
      $('offlineStatus').textContent = 'Works offline. After the first visit the app opens without a connection.';
    }).catch(function () { $('offlineStatus').textContent = 'Offline use could not be set up in this browser.'; });
  } else {
    $('offlineStatus').textContent = 'Offline use needs the app to be opened from its https web address.';
  }

  if (navigator.storage && navigator.storage.persisted) {
    $('persistBox').hidden = false;
    var showPersist = function (ok) {
      $('persistStatus').textContent = ok ? 'Your browser has agreed to protect this data from automatic clean-up.' : 'The browser may clear this data if the phone runs low on space.';
      $('persistBtn').hidden = ok;
    };
    navigator.storage.persisted().then(showPersist);
    $('persistBtn').addEventListener('click', function () {
      navigator.storage.persist().then(function (ok) { showPersist(ok); UI.toast(ok ? 'Data protected' : 'The browser said no'); });
    });
  }

  // ---------- Erase ----------
  $('eraseBtn').addEventListener('click', function () {
    var answer = prompt('This erases everything on this phone. Type DELETE to confirm.');
    if (answer === null) return;
    if (answer.trim().toUpperCase() !== 'DELETE') { UI.toast('Nothing was erased'); return; }
    Store.eraseAll();
    $('restoreBox').hidden = true; pending = null;
    renderStorage(); renderBackup();
    UI.toast('All data erased');
  });

  renderStorage();
  renderBackup();
})();
