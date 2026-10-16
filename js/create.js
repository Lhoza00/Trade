(function () {
  UI.nav('create');
  var C = Store.CATEGORIES;
  var MAX_IMAGES = 6;
  var MARKINGS = ['FVG', 'Order block', 'Liquidity', 'Structure'];
  var params = new URLSearchParams(location.search);
  var type = params.get('type') === 'trade' ? 'trade' : 'analysis';
  var images = [];
  var marked = {};

  function $(id) { return document.getElementById(id); }
  function options(list, placeholder) {
    return '<option value="">' + placeholder + '</option>' +
      list.map(function (x) { return '<option>' + UI.esc(x) + '</option>'; }).join('');
  }

  // Dropdowns and chips
  $('setup').innerHTML = options(C['Setup'], 'Choose setup');
  $('context').innerHTML = options(C['Market context'], 'Choose context');
  $('markings').innerHTML = MARKINGS.map(function (m) {
    return '<button type="button" data-m="' + m + '" aria-pressed="false">' + m + '</button>';
  }).join('');
  $('markings').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-m]');
    if (!b) return;
    marked[b.dataset.m] = !marked[b.dataset.m];
    b.setAttribute('aria-pressed', marked[b.dataset.m] ? 'true' : 'false');
  });

  // Type toggle
  function setType(t) {
    type = t;
    document.querySelectorAll('#typeSeg button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.t === t ? 'true' : 'false');
    });
    $('save').textContent = t === 'trade' ? 'Save trade' : 'Save analysis';
  }
  $('typeSeg').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-t]');
    if (b) setType(b.dataset.t);
  });
  setType(type);

  $('date').value = params.get('date') || Store.today();

  // Pictures
  function renderThumbs() {
    $('thumbs').innerHTML = images.map(function (src, i) {
      return '<div class="t"><img alt="Chart ' + (i + 1) + '" src="' + src + '">' +
        '<button type="button" data-i="' + i + '" aria-label="Remove picture">×</button></div>';
    }).join('');
    $('thumbs').style.display = images.length ? 'grid' : 'none';
    $('imgCount').textContent = images.length ? images.length + '/' + MAX_IMAGES : '';
    $('uploadBtn').style.display = images.length >= MAX_IMAGES ? 'none' : 'flex';
  }
  $('thumbs').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-i]');
    if (!b) return;
    images.splice(+b.dataset.i, 1);
    renderThumbs();
  });
  $('file').addEventListener('change', function (ev) {
    var files = Array.prototype.slice.call(ev.target.files).slice(0, MAX_IMAGES - images.length);
    ev.target.value = '';
    files.reduce(function (chain, f) {
      return chain.then(function () {
        return UI.compressImage(f).then(function (data) { images.push(data); renderThumbs(); });
      }).catch(function () { UI.toast('Could not read one picture'); });
    }, Promise.resolve());
  });
  renderThumbs();

  // Save
  $('save').addEventListener('click', function () {
    var instrument = $('instrument').value.trim();
    var title = $('title').value.trim();
    var reasoning = $('reasoning').value.trim();
    if (!title && !instrument && !images.length && !reasoning) {
      UI.toast('Add a title, a screenshot or your reasoning first');
      return;
    }
    var date = $('date').value || Store.today();
    if (!title) title = instrument ? instrument + (type === 'trade' ? ' trade' : ' analysis') : (type === 'trade' ? 'Trade ' : 'Analysis ') + date;
    var entry = {
      id: Store.uid(),
      type: type,
      date: date,
      title: title,
      instrument: instrument,
      createdAt: Date.now(),
      stage1_forecast: {
        images: images.slice(),
        bias: $('bias').value,
        markings: MARKINGS.filter(function (m) { return marked[m]; }),
        setup: $('setup').value,
        marketContext: $('context').value,
        entry: $('entry').value.trim(),
        invalidation: $('invalidation').value.trim(),
        target: $('target').value.trim(),
        reasoning: reasoning
      },
      stage2_outcome: { images: [], notes: '' },
      stage3_verdict: { reviewed: false }
    };
    if (Store.saveEntry(entry)) {
      try { sessionStorage.setItem('tj.flash', (type === 'trade' ? 'Trade' : 'Analysis') + ' saved. Tap the card to add more.'); } catch (e) {}
      location.href = 'index.html';
    }
  });
})();
