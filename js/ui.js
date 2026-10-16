/* Shared UI helpers: bottom navbar, entry cards, toast, image compression. */
(function () {
  var ICONS = {
    dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    create: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    library: '<svg viewBox="0 0 24 24"><path d="M5 4h4v16H5zM11 4h4v16h-4zM17.5 5l3 .8-3.6 14.2-3-.8z"/></svg>',
    progress: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>'
  };
  var ITEMS = [
    ['dashboard', 'Dashboard', 'index.html'],
    ['calendar', 'Calendar', 'calendar.html'],
    ['create', 'Create', 'create.html'],
    ['library', 'Library', 'library.html'],
    ['progress', 'Progress', 'progress.html']
  ];
  var STAGE_LABEL = { 1: 'Forecast saved', 2: 'Outcome added', 3: 'Reviewed' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(str) {
    var p = str.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function nav(active) {
    var el = document.getElementById('nav');
    if (!el) return;
    el.className = 'bottom';
    el.innerHTML = '<div class="inner">' + ITEMS.map(function (it) {
      var icon = it[0] === 'create' ? '<span class="plus">' + ICONS.create + '</span>' : ICONS[it[0]];
      var cls = (it[0] === active ? 'active ' : '') + (it[0] === 'create' ? 'create' : '');
      return '<a href="' + it[2] + '" class="' + cls + '">' + icon + '<span>' + it[1] + '</span></a>';
    }).join('') + '</div>';
  }

  function entryCard(e) {
    var stage = Store.stageOf(e);
    var s1 = e.stage1_forecast || {};
    var thumb = (s1.images && s1.images[0]) ? '<img class="thumb" alt="" src="' + s1.images[0] + '">' : '';
    var bias = s1.bias ? '<span class="tag ' + (s1.bias === 'bullish' ? 'bull' : s1.bias === 'bearish' ? 'bear' : '') + '">' + esc(s1.bias) + '</span>' : '';
    return '<a class="card entry" href="entry.html?id=' + encodeURIComponent(e.id) + '">' +
      '<div class="row"><span class="tag">' + (e.type === 'trade' ? 'Trade' : 'Analysis') + '</span>' +
      '<span class="tag s' + stage + '">' + STAGE_LABEL[stage] + '</span>' + bias + '</div>' +
      '<div class="body">' + thumb + '<div><h3>' + esc(e.title || 'Untitled') + '</h3>' +
      '<p class="meta">' + esc(e.instrument || '') + (e.instrument ? ' · ' : '') + fmtDate(e.date) + '</p></div></div></a>';
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1800);
  }

  /* Shrinks a photo to max 1000px JPEG so localStorage (about 5MB) lasts longer. Used from Step 2. */
  function compressImage(file, maxSide, quality) {
    maxSide = maxSide || 1000; quality = quality || 0.72;
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function () {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Offline support, only when served over http(s)
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  window.UI = { nav: nav, esc: esc, fmtDate: fmtDate, entryCard: entryCard, toast: toast, compressImage: compressImage, STAGE_LABEL: STAGE_LABEL };
})();
