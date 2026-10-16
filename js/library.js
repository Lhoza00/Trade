(function () {
  UI.nav('library');
  var C = Store.CATEGORIES, CATS = Object.keys(C), MAX_IMAGES = 6;
  var KINDS = [
    { id: 'lesson', plural: 'Lessons', one: 'Lesson', cls: 'bull' },
    { id: 'strategy', plural: 'Strategies', one: 'Strategy', cls: 's1' },
    { id: 'mistake', plural: 'Mistakes', one: 'Mistake', cls: 'bear' },
    { id: 'reference', plural: 'Reference', one: 'Reference', cls: '' }
  ];
  var filter = 'all', query = '', draft = null, isNew = false, dirty = false;

  function $(id) { return document.getElementById(id); }
  function kindOf(id) { return KINDS.filter(function (k) { return k.id === id; })[0] || KINDS[0]; }
  function options(list, placeholder) {
    return '<option value="">' + placeholder + '</option>' + list.map(function (x) { return '<option>' + UI.esc(x) + '</option>'; }).join('');
  }

  $('eKind').innerHTML = KINDS.map(function (k) { return '<option value="' + k.id + '">' + k.one + '</option>'; }).join('');
  $('eCat').innerHTML = options(CATS, 'None');

  // List view
  function matches(it) {
    if (filter !== 'all' && it.kind !== filter) return false;
    if (!query) return true;
    return [it.title, it.body, it.category, it.item].join(' ').toLowerCase().indexOf(query) > -1;
  }
  function renderFilters(all) {
    var chips = [{ id: 'all', label: 'All', n: all.length }].concat(KINDS.map(function (k) {
      return { id: k.id, label: k.plural, n: all.filter(function (x) { return x.kind === k.id; }).length };
    }));
    $('filters').innerHTML = chips.map(function (c) {
      return '<button type="button" data-f="' + c.id + '" aria-pressed="' + (filter === c.id) + '">' + c.label + ' ' + c.n + '</button>';
    }).join('');
  }
  function renderList() {
    var all = Store.libraryItems();
    renderFilters(all);
    var shown = all.filter(matches);
    if (!shown.length) {
      $('list').innerHTML = all.length
        ? '<div class="card empty">Nothing matches.</div>'
        : '<div class="card empty">Your library is empty.<br>Save lessons from reviewed entries, or tap <b>+ New</b> to add a strategy, a mistake to avoid or reference material.</div>';
      return;
    }
    $('list').innerHTML = shown.map(function (it) {
      var k = kindOf(it.kind);
      var thumb = it.images && it.images[0] ? '<img class="thumb" alt="" src="' + it.images[0] + '">' : '';
      var snippet = (it.body || '').slice(0, 240);
      return '<a class="card entry libitem" href="library.html?open=' + encodeURIComponent(it.id) + '" data-id="' + UI.esc(it.id) + '">' +
        '<div class="row"><span class="tag ' + k.cls + '">' + k.one + '</span>' + (it.item ? '<span class="tag">' + UI.esc(it.item) + '</span>' : '') + '</div>' +
        '<div class="body">' + thumb + '<div><h3>' + UI.esc(it.title || 'Untitled') + '</h3>' +
        (snippet ? '<p class="snip">' + UI.esc(snippet) + '</p>' : '') + '</div></div></a>';
    }).join('');
  }
  $('filters').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    renderList();
  });
  $('q').addEventListener('input', function () { query = $('q').value.trim().toLowerCase(); renderList(); });
  $('list').addEventListener('click', function (ev) {
    var a = ev.target.closest('a[data-id]');
    if (!a) return;
    ev.preventDefault();
    openEditor(a.dataset.id);
  });
  $('newBtn').addEventListener('click', function () { openEditor(null); });

  // Editor
  function fillItems() {
    var cat = draft ? draft.category : '';
    $('eItem').innerHTML = options(cat && C[cat] ? C[cat] : [], cat ? 'Choose one' : 'Pick a category first');
    $('eItem').disabled = !cat;
    if (draft) $('eItem').value = draft.item || '';
  }
  function renderThumbs() {
    var a = draft.images;
    $('thumbs').innerHTML = a.map(function (src, i) {
      return '<div class="t"><img alt="Picture ' + (i + 1) + '" src="' + src + '" data-open="' + i + '">' +
        '<button type="button" data-i="' + i + '" aria-label="Remove picture">×</button></div>';
    }).join('');
    $('thumbs').style.display = a.length ? 'grid' : 'none';
    $('count').textContent = a.length ? '(' + a.length + '/' + MAX_IMAGES + ')' : '';
    $('upload').style.display = a.length >= MAX_IMAGES ? 'none' : 'flex';
  }
  function openEditor(id) {
    var existing = id ? Store.libraryItem(id) : null;
    isNew = !existing;
    dirty = false;
    draft = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: Store.uid(), kind: filter !== 'all' ? filter : 'lesson', title: '', body: '', images: [],
      category: '', item: '', source: null, createdAt: Date.now()
    };
    draft.images = draft.images || [];
    $('editTitle').textContent = isNew ? 'New item' : 'Edit item';
    $('eKind').value = draft.kind;
    $('eTitle').value = draft.title || '';
    $('eBody').value = draft.body || '';
    $('eCat').value = draft.category || '';
    fillItems();
    renderThumbs();
    $('deleteBtn').hidden = isNew;
    var src = draft.source && Store.entry(draft.source);
    $('sourceLine').hidden = !src;
    if (src) $('sourceLink').href = 'entry.html?id=' + encodeURIComponent(src.id);
    $('listView').hidden = true;
    $('editView').hidden = false;
    window.scrollTo(0, 0);
  }
  function closeEditor(force) {
    if (!force && dirty && !confirm('Discard your changes?')) return;
    draft = null;
    $('editView').hidden = true;
    $('listView').hidden = false;
    try { history.replaceState(null, '', 'library.html'); } catch (e) {}
    renderList();
    window.scrollTo(0, 0);
  }
  function onEdit(ev) {
    if (!draft) return;
    var map = { eKind: 'kind', eTitle: 'title', eBody: 'body', eCat: 'category', eItem: 'item' };
    var key = map[ev.target.id];
    if (!key) return;
    draft[key] = ev.target.value;
    if (key === 'category') { draft.item = ''; fillItems(); }
    dirty = true;
  }
  $('editView').addEventListener('input', onEdit);
  $('editView').addEventListener('change', onEdit);
  $('backBtn').addEventListener('click', function () { closeEditor(false); });

  $('saveBtn').addEventListener('click', function () {
    var title = (draft.title || '').trim(), body = (draft.body || '').trim();
    if (!title && !body && !draft.images.length) { UI.toast('Add a title or some notes first'); return; }
    if (!title) title = body ? body.slice(0, 40) : 'Untitled';
    draft.title = title;
    draft.updatedAt = Date.now();
    if (Store.saveLibraryItem(draft)) { UI.toast('Saved'); closeEditor(true); }
  });
  $('deleteBtn').addEventListener('click', function () {
    if (!confirm('Delete this item and its pictures? This cannot be undone.')) return;
    Store.deleteLibraryItem(draft.id);
    closeEditor(true);
  });

  // Pictures and full-screen viewer
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

  $('thumbs').addEventListener('click', function (ev) {
    var rm = ev.target.closest('button[data-i]');
    if (rm) {
      if (!confirm('Remove this picture?')) return;
      draft.images.splice(+rm.dataset.i, 1);
      dirty = true; renderThumbs();
      return;
    }
    var im = ev.target.closest('img[data-open]');
    if (im) openLightbox(draft.images[+im.dataset.open]);
  });
  $('file').addEventListener('change', function (ev) {
    var files = Array.prototype.slice.call(ev.target.files).slice(0, MAX_IMAGES - draft.images.length);
    ev.target.value = '';
    files.reduce(function (chain, f) {
      return chain.then(function () {
        return UI.compressImage(f).then(function (data) { draft.images.push(data); dirty = true; renderThumbs(); });
      }).catch(function () { UI.toast('Could not read one picture'); });
    }, Promise.resolve());
  });

  // Start
  var params = new URLSearchParams(location.search);
  renderList();
  if (params.get('open') && Store.libraryItem(params.get('open'))) openEditor(params.get('open'));
  else if (params.get('new')) {
    if (KINDS.some(function (k) { return k.id === params.get('kind'); })) filter = params.get('kind');
    openEditor(null);
  }
})();
