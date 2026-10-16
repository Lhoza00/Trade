(function () {
  UI.nav('dashboard');
  var C = Store.CATEGORIES;
  var MAX_IMAGES = 6;
  var MARKINGS = ['FVG', 'Order block', 'Liquidity', 'Structure'];
  var LESSON_CATEGORIES = ['Execution mistake', 'Psychological mistake', 'Risk mistake', 'External factor', 'Positive behaviour'];
  var id = new URLSearchParams(location.search).get('id');
  var entry = id ? Store.entry(id) : null;

  function $(i) { return document.getElementById(i); }
  if (!entry) { $('content').hidden = true; $('missing').hidden = false; return; }

  // Make sure every part of the entry exists
  entry.stage1_forecast = entry.stage1_forecast || {};
  entry.stage1_forecast.images = entry.stage1_forecast.images || [];
  entry.stage1_forecast.markings = entry.stage1_forecast.markings || [];
  entry.stage2_outcome = entry.stage2_outcome || {};
  entry.stage2_outcome.images = entry.stage2_outcome.images || [];
  entry.stage3_verdict = entry.stage3_verdict || { reviewed: false };
  var v = entry.stage3_verdict;
  v.primaryMistake = v.primaryMistake || { category: '', mistake: '' };
  if (!v.setup && entry.stage1_forecast.setup) v.setup = entry.stage1_forecast.setup;
  if (!v.marketContext && entry.stage1_forecast.marketContext) v.marketContext = entry.stage1_forecast.marketContext;

  function getP(o, p) { return p.split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function setP(o, p, val) {
    var ks = p.split('.'), last = ks.pop();
    var t = ks.reduce(function (a, k) { if (a[k] == null || typeof a[k] !== 'object') a[k] = {}; return a[k]; }, o);
    t[last] = val;
  }
  function options(list, placeholder) {
    return '<option value="">' + placeholder + '</option>' + list.map(function (x) { return '<option>' + UI.esc(x) + '</option>'; }).join('');
  }

  // Saving
  var pending = false, timer = null;
  function status(msg) { $('status').textContent = msg; }
  function save() {
    clearTimeout(timer); pending = false;
    if (Store.saveEntry(entry)) { status('Saved'); renderHead(); return true; }
    status('Not saved: storage is full');
    return false;
  }
  function schedule() { pending = true; status('Saving…'); clearTimeout(timer); timer = setTimeout(save, 400); }
  window.addEventListener('pagehide', function () { if (pending) save(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden && pending) save(); });

  // Header
  function renderHead() {
    var stage = Store.stageOf(entry);
    var bias = entry.stage1_forecast.bias;
    $('hTitle').textContent = entry.title || 'Untitled';
    $('hMeta').textContent = (entry.instrument ? entry.instrument + ' · ' : '') + UI.fmtDate(entry.date);
    $('hTags').innerHTML = '<span class="tag">' + (entry.type === 'trade' ? 'Trade' : 'Analysis') + '</span>' +
      '<span class="tag s' + stage + '">' + UI.STAGE_LABEL[stage] + '</span>' +
      (bias ? '<span class="tag ' + (bias === 'bullish' ? 'bull' : bias === 'bearish' ? 'bear' : '') + '">' + UI.esc(bias) + '</span>' : '');
    $('reviewBtn').textContent = v.reviewed ? 'Reopen review' : 'Mark as reviewed';
    $('reviewBtn').className = 'btn' + (v.reviewed ? ' secondary' : '');
    document.title = (entry.title || 'Entry') + ' · Trading Journal';
  }

  // Dropdowns
  document.querySelectorAll('select[data-opts]').forEach(function (s) {
    s.innerHTML = options(C[s.dataset.opts], s.dataset.ph);
  });
  $('pmCat').innerHTML = options(LESSON_CATEGORIES, 'Choose category');
  function fillItems() {
    var cat = v.primaryMistake.category;
    $('pmItem').innerHTML = options(cat && C[cat] ? C[cat] : [], cat ? 'Choose one' : 'Pick a category first');
    $('pmItem').disabled = !cat;
  }
  fillItems();

  // Load saved values into every bound field
  document.querySelectorAll('[data-k]').forEach(function (el) {
    var val = getP(entry, el.dataset.k);
    if (val != null) el.value = val;
  });

  // Typing and choosing
  function onEdit(ev) {
    var el = ev.target;
    if (!el.dataset || !el.dataset.k) return;
    setP(entry, el.dataset.k, el.value);
    if (el.id === 'pmCat') {
      v.primaryMistake.mistake = '';
      fillItems();
    }
    schedule();
  }
  document.addEventListener('input', onEdit);
  document.addEventListener('change', onEdit);

  // Marked-on-chart chips
  function renderMarkings() {
    $('markings').innerHTML = MARKINGS.map(function (m) {
      var on = entry.stage1_forecast.markings.indexOf(m) > -1;
      return '<button type="button" data-m="' + m + '" aria-pressed="' + on + '">' + m + '</button>';
    }).join('');
  }
  $('markings').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-m]');
    if (!b) return;
    var list = entry.stage1_forecast.markings, i = list.indexOf(b.dataset.m);
    if (i > -1) list.splice(i, 1); else list.push(b.dataset.m);
    renderMarkings(); schedule();
  });
  renderMarkings();

  // Picture galleries (Stage 1 and Stage 2)
  function openLightbox(src) {
    $('lbImg').src = src;
    $('lbScroll').classList.remove('zoom');
    $('lb').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() { $('lb').hidden = true; $('lbImg').removeAttribute('src'); document.body.style.overflow = ''; }
  $('lbClose').addEventListener('click', closeLightbox);
  $('lbImg').addEventListener('click', function () { $('lbScroll').classList.toggle('zoom'); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') closeLightbox(); });

  function gallery(path, n) {
    var thumbs = $('thumbs' + n), file = $('file' + n), upload = $('upload' + n), count = $('count' + n);
    function arr() { return getP(entry, path); }
    function render() {
      var a = arr();
      thumbs.innerHTML = a.map(function (src, i) {
        return '<div class="t"><img alt="Picture ' + (i + 1) + '" src="' + src + '" data-open="' + i + '">' +
          '<button type="button" data-i="' + i + '" aria-label="Remove picture">×</button></div>';
      }).join('');
      thumbs.style.display = a.length ? 'grid' : 'none';
      count.textContent = a.length ? '(' + a.length + '/' + MAX_IMAGES + ')' : '';
      upload.style.display = a.length >= MAX_IMAGES ? 'none' : 'flex';
    }
    thumbs.addEventListener('click', function (ev) {
      var rm = ev.target.closest('button[data-i]');
      if (rm) {
        if (!confirm('Remove this picture?')) return;
        arr().splice(+rm.dataset.i, 1);
        save(); render();
        return;
      }
      var im = ev.target.closest('img[data-open]');
      if (im) openLightbox(arr()[+im.dataset.open]);
    });
    file.addEventListener('change', function (ev) {
      var files = Array.prototype.slice.call(ev.target.files).slice(0, MAX_IMAGES - arr().length);
      ev.target.value = '';
      files.reduce(function (chain, f) {
        return chain.then(function () {
          return UI.compressImage(f).then(function (data) {
            var a = arr();
            a.push(data);
            if (!save()) a.pop();
            render();
          });
        }).catch(function () { UI.toast('Could not read one picture'); });
      }, Promise.resolve());
    });
    render();
  }
  gallery('stage1_forecast.images', 1);
  gallery('stage2_outcome.images', 2);

  // Open Stage 1 straight away only if nothing was filled in yet
  var f1 = entry.stage1_forecast;
  $('dS1').open = !(f1.images.length || f1.reasoning || f1.bias);

  // Review and delete
  $('reviewBtn').addEventListener('click', function () {
    if (!v.reviewed && !v.directionCorrect) { UI.toast('Answer "Was the bias correct?" first'); return; }
    v.reviewed = !v.reviewed;
    if (save()) UI.toast(v.reviewed ? 'Marked as reviewed' : 'Review reopened');
  });
  $('deleteBtn').addEventListener('click', function () {
    if (!confirm('Delete this entry and all its pictures? This cannot be undone.')) return;
    Store.deleteEntry(entry.id);
    location.href = 'index.html';
  });

  // Send the lesson from this verdict to the Library
  function libraryItemFor() {
    return Store.all().library.filter(function (x) { return x.source === entry.id; })[0] || null;
  }
  function renderLibBtn() {
    $('libBtn').textContent = libraryItemFor() ? 'Saved in Library · view' : 'Save lesson to Library';
  }
  $('libBtn').addEventListener('click', function () {
    if (pending) save();
    var existing = libraryItemFor();
    if (existing) { location.href = 'library.html?open=' + encodeURIComponent(existing.id); return; }
    var pm = v.primaryMistake;
    if (!(pm.mistake || v.cause || v.nextTime || v.correctiveAction)) { UI.toast('Fill in what you learned first'); return; }
    var parts = [];
    if (v.cause) parts.push('What caused it: ' + v.cause);
    if (v.evidence) parts.push('Evidence: ' + v.evidence);
    if (v.nextTime) parts.push('Next time: ' + v.nextTime);
    if (v.correctiveAction) parts.push('Corrective action: ' + v.correctiveAction);
    var now = Date.now();
    var item = {
      id: Store.uid(),
      kind: Store.MISTAKE_CATEGORIES.indexOf(pm.category) > -1 ? 'mistake' : 'lesson',
      title: (pm.mistake || 'Lesson') + ' · ' + (entry.title || 'Untitled'),
      body: parts.join('\n\n'),
      images: [],
      category: pm.category || '',
      item: pm.mistake || '',
      source: entry.id,
      createdAt: now,
      updatedAt: now
    };
    if (Store.saveLibraryItem(item)) { UI.toast('Saved to Library'); renderLibBtn(); }
  });

  renderHead();
  renderLibBtn();
})();
