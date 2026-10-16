(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var fmtPct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
  var fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

  var KEY_INS = 'sandra.assurances';
  var KEY_HIST = 'sandra.historique';
  var KEY_LAST = 'sandra.derniereAssurance';
  var NONE = '';

  // ---------- Stockage (dans le téléphone uniquement) ----------
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var assurances = load(KEY_INS, []);   // [{ id, nom, taux }]
  var historique = load(KEY_HIST, []);  // [{ id, ts, jour, assurance, libelle, montant, taux, partAssurance, partAdherent }]

  // ---------- Outils ----------
  function parseNum(s) {
    var clean = String(s).replace(/[\s  ]/g, '').replace(',', '.');
    if (clean === '') return NaN;
    return Number(clean);
  }
  function dayKey(d) {
    var m = d.getMonth() + 1, j = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j;
  }
  function keyToDate(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function findIns(id) { for (var i = 0; i < assurances.length; i++) if (assurances[i].id === id) return assurances[i]; return null; }

  // La part assurance est arrondie au franc ; la part adhérent est le reste,
  // ainsi les deux parts font toujours exactement le montant total.
  function compute(montant, taux) {
    var ins = Math.round(montant * taux / 100);
    return { partAssurance: ins, partAdherent: montant - ins };
  }

  var toastTimer;
  function toast(msg) {
    $('toast').textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').textContent = ''; }, 2000);
  }

  // ---------- Onglets ----------
  function showView(name) {
    ['calcul', 'historique', 'assurances'].forEach(function (v) { $('view-' + v).hidden = v !== name; });
    document.querySelectorAll('nav.tabs [data-view]').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.view === name));
    });
    if (name === 'historique') renderHistory();
    window.scrollTo(0, 0);
  }
  document.querySelector('nav.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-view]'); if (b) showView(b.dataset.view);
  });

  // ---------- Calcul ----------
  function current() {
    var montant = parseNum($('montant').value);
    var taux = parseNum($('taux').value);
    if (!isFinite(montant) || montant < 0) return { error: 'Le montant doit être un nombre positif, par exemple 8000.' };
    if (!isFinite(taux) || taux < 0 || taux > 100) return { error: 'Le taux doit être compris entre 0 et 100 %.' };
    montant = Math.round(montant);
    var r = compute(montant, taux);
    return { montant: montant, taux: taux, partAssurance: r.partAssurance, partAdherent: r.partAdherent };
  }

  function renderSelect() {
    var sel = $('assurance');
    var value = sel.value || load(KEY_LAST, NONE);
    var opts = '<option value="">Aucune (taux libre)</option>';
    opts += assurances.map(function (a) {
      return '<option value="' + esc(a.id) + '">' + esc(a.nom) + ' · ' + fmtPct.format(a.taux) + ' %</option>';
    }).join('');
    sel.innerHTML = opts;
    sel.value = findIns(value) ? value : NONE;
  }

  function renderHint(c) {
    var a = findIns($('assurance').value);
    var hint = $('assurance-hint');
    if (!a) {
      hint.hidden = assurances.length > 0;
      hint.textContent = "Astuce : enregistre tes assurances dans l'onglet Assurances pour ne plus retaper le taux.";
      return;
    }
    if (!c.error && c.taux !== a.taux) {
      hint.hidden = false;
      hint.textContent = 'Taux changé pour cet adhérent (taux habituel de ' + a.nom + ' : ' + fmtPct.format(a.taux) + ' %).';
    } else {
      hint.hidden = true;
    }
  }

  function render() {
    var c = current();
    var bad = !!c.error;
    $('err').hidden = !bad;
    $('err').textContent = c.error || '';
    $('save').disabled = bad;
    $('copy').disabled = bad;
    renderHint(c);
    document.querySelectorAll('[data-rate]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(!bad && c.taux === Number(b.dataset.rate)));
    });
    document.querySelectorAll('[data-amount]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(!bad && c.montant === Number(b.dataset.amount)));
    });
    if (bad) {
      $('r-ins').textContent = '—'; $('r-pat').textContent = '—'; $('expr').textContent = '';
      $('detail').textContent = '';
      return;
    }
    $('expr').textContent = fmt.format(c.montant) + ' FCFA × ' + fmtPct.format(c.taux) + ' %';
    $('r-ins').textContent = fmt.format(c.partAssurance);
    $('r-pat').textContent = fmt.format(c.partAdherent);
    $('r-ins-pct').textContent = fmtPct.format(c.taux) + ' %';
    $('r-pat-pct').textContent = fmtPct.format(100 - c.taux) + ' %';
    $('bar').style.width = c.taux + '%';
    $('detail').innerHTML =
      fmt.format(c.montant) + ' × ' + fmtPct.format(c.taux) + ' % = <b>' + fmt.format(c.partAssurance) +
      '</b> pour l\'assurance · ' + fmt.format(c.montant) + ' − ' + fmt.format(c.partAssurance) +
      ' = <b>' + fmt.format(c.partAdherent) + '</b> à payer par l\'adhérent';
  }

  // Espaces entre les milliers pendant la saisie du montant.
  $('montant').addEventListener('input', function (e) {
    var digits = e.target.value.replace(/\D/g, '');
    e.target.value = digits ? fmt.format(Number(digits)) : '';
    render();
  });
  $('taux').addEventListener('input', render);
  $('montants').addEventListener('click', function (e) {
    var b = e.target.closest('[data-amount]'); if (!b) return;
    $('montant').value = fmt.format(Number(b.dataset.amount)); render();
  });
  $('taux-chips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rate]'); if (!b) return;
    $('taux').value = b.dataset.rate; render();
  });
  $('assurance').addEventListener('change', function () {
    var a = findIns(this.value);
    if (a) $('taux').value = String(a.taux).replace('.', ',');
    store(KEY_LAST, this.value);
    render();
  });

  $('save').addEventListener('click', function () {
    var c = current(); if (c.error) return;
    var a = findIns($('assurance').value);
    var now = new Date();
    historique.push({
      id: uid(), ts: now.getTime(), jour: dayKey(now),
      assurance: a ? a.nom : '', libelle: $('libelle').value.trim(),
      montant: c.montant, taux: c.taux, partAssurance: c.partAssurance, partAdherent: c.partAdherent
    });
    store(KEY_HIST, historique);
    $('libelle').value = '';
    toast('Enregistré dans l\'historique');
  });

  $('copy').addEventListener('click', function () {
    var c = current(); if (c.error) return;
    var a = findIns($('assurance').value);
    var label = $('libelle').value.trim();
    var text = (label ? label + ' : ' : '') + 'Montant ' + fmt.format(c.montant) + ' FCFA — ' +
      (a ? a.nom : 'Assurance') + ' ' + fmtPct.format(c.taux) + ' % = ' + fmt.format(c.partAssurance) +
      ' FCFA — Adhérent ' + fmtPct.format(100 - c.taux) + ' % = ' + fmt.format(c.partAdherent) + ' FCFA';
    function fallback() {
      $('detail').textContent = text;
      var r = document.createRange(); r.selectNodeContents($('detail'));
      var s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast('Texte sélectionné, copie-le');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copié'); }, fallback);
    } else { fallback(); }
  });

  // ---------- Historique ----------
  var shownDay = dayKey(new Date());

  function renderHistory() {
    var today = dayKey(new Date());
    $('day').value = shownDay;
    $('day').max = today;
    $('day-next').disabled = shownDay >= today;
    $('h-title').textContent = shownDay === today ? "Aujourd'hui" : capitalize(fmtDay.format(keyToDate(shownDay)));

    var list = historique.filter(function (h) { return h.jour === shownDay; })
      .sort(function (x, y) { return y.ts - x.ts; });

    var tA = 0, tI = 0, tP = 0, groups = {};
    list.forEach(function (h) {
      tA += h.montant; tI += h.partAssurance; tP += h.partAdherent;
      var g = h.assurance || 'Sans assurance enregistrée';
      groups[g] = groups[g] || { n: 0, ins: 0, pat: 0 };
      groups[g].n++; groups[g].ins += h.partAssurance; groups[g].pat += h.partAdherent;
    });
    $('t-count').textContent = fmt.format(list.length);
    $('t-amt').textContent = fmt.format(tA);
    $('t-ins').textContent = fmt.format(tI);
    $('t-pat').textContent = fmt.format(tP);

    var names = Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    $('by-ins-card').hidden = list.length === 0;
    $('by-ins').innerHTML = names.map(function (n) {
      var g = groups[n];
      return '<tr><td>' + esc(n) + '</td><td>' + g.n + '</td><td class="ins">' + fmt.format(g.ins) +
        '</td><td class="pat">' + fmt.format(g.pat) + '</td></tr>';
    }).join('');

    $('h-empty').hidden = list.length > 0;
    $('entries').innerHTML = list.map(function (h) {
      var title = h.libelle || h.assurance || 'Acte';
      var meta = fmtTime.format(new Date(h.ts)) + ' · ' + (h.assurance ? esc(h.assurance) + ' · ' : '') +
        fmt.format(h.montant) + ' FCFA à ' + fmtPct.format(h.taux) + ' %';
      return '<li class="entry">' +
        '<span class="t">' + esc(title) + '</span>' +
        '<button type="button" class="icon-btn" data-del="' + esc(h.id) + '" aria-label="Supprimer cet acte">×</button>' +
        '<span class="meta">' + meta + '</span>' +
        '<span class="nums"><span>Assurance <span class="ins">' + fmt.format(h.partAssurance) + '</span></span>' +
        '<span>Adhérent <span class="pat">' + fmt.format(h.partAdherent) + '</span></span></span>' +
        '</li>';
    }).join('');
  }

  // Suppression en deux appuis pour éviter les erreurs.
  var pendingDel = null, pendingTimer;
  $('entries').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    var id = b.dataset.del;
    if (pendingDel !== id) {
      pendingDel = id; b.textContent = 'Supprimer ?'; b.style.fontSize = '.85rem';
      clearTimeout(pendingTimer);
      pendingTimer = setTimeout(function () { pendingDel = null; renderHistory(); }, 3000);
      return;
    }
    pendingDel = null;
    historique = historique.filter(function (h) { return h.id !== id; });
    store(KEY_HIST, historique);
    renderHistory();
  });

  function shiftDay(n) {
    var d = keyToDate(shownDay); d.setDate(d.getDate() + n);
    var k = dayKey(d);
    if (k > dayKey(new Date())) return;
    shownDay = k; renderHistory();
  }
  $('day-prev').addEventListener('click', function () { shiftDay(-1); });
  $('day-next').addEventListener('click', function () { shiftDay(1); });
  $('day').addEventListener('change', function () { if (this.value) { shownDay = this.value; renderHistory(); } });

  // ---------- Assurances ----------
  function renderInsurers() {
    $('ins-empty').hidden = assurances.length > 0;
    $('ins-list').innerHTML = assurances.map(function (a) {
      return '<li class="ins-item">' +
        '<span class="name">' + esc(a.nom) + '</span>' +
        '<span class="rate"><input data-rate-for="' + esc(a.id) + '" inputmode="decimal" value="' + fmtPct.format(a.taux) + '" aria-label="Taux de ' + esc(a.nom) + '"> %</span>' +
        '<button type="button" class="icon-btn" data-ins-del="' + esc(a.id) + '" aria-label="Supprimer ' + esc(a.nom) + '">×</button>' +
        '</li>';
    }).join('');
    renderSelect();
    render();
  }

  $('ins-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var nom = $('ins-name').value.trim();
    var taux = parseNum($('ins-rate').value);
    var err = $('ins-err');
    if (!nom) { err.hidden = false; err.textContent = "Écris le nom de l'assurance."; return; }
    if (!isFinite(taux) || taux < 0 || taux > 100) { err.hidden = false; err.textContent = 'Le taux doit être compris entre 0 et 100 %.'; return; }
    err.hidden = true;
    var same = assurances.filter(function (a) { return a.nom.toLowerCase() === nom.toLowerCase(); })[0];
    if (same) same.taux = taux; else assurances.push({ id: uid(), nom: nom, taux: taux });
    assurances.sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
    store(KEY_INS, assurances);
    $('ins-name').value = ''; $('ins-rate').value = '';
    renderInsurers();
    toast(same ? 'Taux mis à jour' : 'Assurance ajoutée');
  });

  $('ins-list').addEventListener('change', function (e) {
    var input = e.target.closest('[data-rate-for]'); if (!input) return;
    var a = findIns(input.dataset.rateFor);
    var taux = parseNum(input.value);
    if (!a) return;
    if (isFinite(taux) && taux >= 0 && taux <= 100) {
      a.taux = taux; store(KEY_INS, assurances);
      if ($('assurance').value === a.id) $('taux').value = String(taux).replace('.', ',');
    }
    renderInsurers();
  });

  var pendingInsDel = null;
  $('ins-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-ins-del]'); if (!b) return;
    var id = b.dataset.insDel;
    if (pendingInsDel !== id) {
      pendingInsDel = id; b.textContent = 'Supprimer ?'; b.style.fontSize = '.85rem';
      setTimeout(function () { if (pendingInsDel === id) { pendingInsDel = null; renderInsurers(); } }, 3000);
      return;
    }
    pendingInsDel = null;
    assurances = assurances.filter(function (a) { return a.id !== id; });
    store(KEY_INS, assurances);
    renderInsurers();
  });

  // ---------- Thème : automatique (suit le téléphone), clair ou sombre ----------
  var KEY_THEME = 'sandra.theme';
  var THEMES = ['auto', 'light', 'dark'];
  var THEME_LABEL = { auto: 'automatique', light: 'clair', dark: 'sombre' };
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    $('theme').setAttribute('aria-label', 'Thème : ' + THEME_LABEL[t]);
    $('theme').title = 'Thème : ' + THEME_LABEL[t];
    var dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      if (t === 'auto') m.setAttribute('content', m.media.indexOf('dark') >= 0 ? '#121316' : '#e6e8ec');
      else m.setAttribute('content', dark ? '#121316' : '#e6e8ec');
    });
  }
  var theme = load(KEY_THEME, 'auto');
  if (THEMES.indexOf(theme) < 0) theme = 'auto';
  applyTheme(theme);
  $('theme').addEventListener('click', function () {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    store(KEY_THEME, theme); applyTheme(theme);
    toast('Thème ' + THEME_LABEL[theme]);
  });

  // ---------- Installation (PWA) ----------
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferredPrompt = e; $('install').hidden = false;
  });
  $('install').addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () { deferredPrompt = null; $('install').hidden = true; });
  });
  window.addEventListener('appinstalled', function () { $('install').hidden = true; });

  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  $('ios-tip').hidden = !(ios && !standalone);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }

  // ---------- Démarrage ----------
  $('today').textContent = capitalize(fmtDay.format(new Date()));
  renderInsurers();
  var last = findIns($('assurance').value);
  if (last) $('taux').value = String(last.taux).replace('.', ',');
  render();
})();
