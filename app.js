/* HADOLİN EMLAK · Hızlı Not — müşteri ve portföy defteri
   Veriler yalnızca cihazda (localStorage) saklanır. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Sabitler
   * ------------------------------------------------------------------ */
  var KEYS = {
    musteriler: 'hadolin.musteriler.v1',
    portfoy: 'hadolin.portfoy.v1',
    taslakMusteri: 'hadolin.taslak.musteri.v1',
    taslakPortfoy: 'hadolin.taslak.portfoy.v1'
  };
  var MUSTERI_FIELDS = ['ad', 'tel', 'neAradi', 'butce', 'semt', 'notlar'];
  var PORFOY_FIELDS = ['baslik', 'tur', 'durum', 'fiyat', 'oda', 'm2', 'kat', 'binaYasi', 'iskan',
    'ozellikler', 'il', 'ilce', 'mahalle', 'sokak', 'sahibi', 'sahibiTel', 'kaynak', 'notlar'];
  /* "Boş mu?" kontrolünde varsayılan seçenekler (durum, iskan) sayılmaz */
  var MUSTERI_MEANINGFUL = MUSTERI_FIELDS;
  var PORFOY_MEANINGFUL = ['baslik', 'fiyat', 'oda', 'm2', 'kat', 'binaYasi', 'ozellikler',
    'il', 'ilce', 'mahalle', 'sokak', 'sahibi', 'sahibiTel', 'kaynak', 'notlar'];
  var PREFIX = { musteri: 'm_', portfoy: 'p_' };
  var ACTIVE = 'musteri';
  var editing = { musteri: null, portfoy: null };
  var query = { musteri: '', portfoy: '' };
  var lastDeleted = null;
  var toastTimer = null;
  var TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

  /* ------------------------------------------------------------------ *
   * Küçük yardımcılar
   * ------------------------------------------------------------------ */
  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(value) {
    return String(value == null ? '' : value)
      .replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/Ş/g, 'ş').replace(/Ğ/g, 'ğ')
      .replace(/Ü/g, 'ü').replace(/Ö/g, 'ö').replace(/Ç/g, 'ç')
      .toLowerCase().trim();
  }
  /* arama için: Türkçe aksanları sadeleştirir (ş→s, ı→i, ğ→g ...) */
  function fold(value) {
    return String(value == null ? '' : value)
      .replace(/[İIı]/g, 'i').replace(/[Şş]/g, 's').replace(/[Ğğ]/g, 'g')
      .replace(/[Üü]/g, 'u').replace(/[Öö]/g, 'o').replace(/[Çç]/g, 'c')
      .toLowerCase().trim();
  }
  function digits(value) { return String(value || '').replace(/\D/g, ''); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return ('0' + n).slice(-2); }

  function formatPhone(value) {
    var d = digits(value);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    if (d.length === 10) {
      return '0' + d.slice(0, 3) + ' ' + d.slice(3, 6) + ' ' + d.slice(6, 8) + ' ' + d.slice(8, 10);
    }
    return String(value || '').trim();
  }
  function telHref(value) {
    var d = digits(value);
    if (!d) return '';
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    if (d.length === 10) return 'tel:+90' + d;
    if (d.length > 10) return 'tel:+' + d;
    return 'tel:' + d;
  }
  function isApple() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function mapsHref(address) {
    var q = encodeURIComponent(address);
    return isApple() ? 'https://maps.apple.com/?q=' + q
      : 'https://www.google.com/maps/search/?api=1&query=' + q;
  }
  function fmtDate(ts) {
    var d = new Date(ts), now = new Date();
    var time = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (sameDay) return 'Bugün ' + time;
    if (d.getFullYear() === now.getFullYear()) return d.getDate() + ' ' + TR_MONTHS[d.getMonth()] + ' ' + time;
    return d.getDate() + ' ' + TR_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function fmtStamp(ts) {
    var d = new Date(ts);
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fileStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /* ------------------------------------------------------------------ *
   * Depolama
   * ------------------------------------------------------------------ */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var value = JSON.parse(raw);
      if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
      return value == null ? fallback : value;
    } catch (e) { return fallback; }
  }
  function store(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      toast('Kaydedilemedi — depolama alanı dolu olabilir', 'err');
      return false;
    }
  }
  function listOf(type) { return load(type === 'musteri' ? KEYS.musteriler : KEYS.portfoy, []); }
  function saveList(type, list) { return store(type === 'musteri' ? KEYS.musteriler : KEYS.portfoy, list); }

  /* ------------------------------------------------------------------ *
   * Bildirim ve onay penceresi
   * ------------------------------------------------------------------ */
  function toast(message, tone, action) {
    var box = $('toast'), msg = $('toastMsg'), btn = $('toastAction');
    msg.textContent = message;
    box.className = 'toast' + (tone ? ' ' + tone : '');
    if (action) {
      btn.textContent = action.label;
      btn.hidden = false;
      btn.onclick = function () { hideToast(); action.run(); };
    } else {
      btn.hidden = true;
      btn.onclick = null;
    }
    requestAnimationFrame(function () { box.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 6000 : 2400);
  }
  function hideToast() {
    var box = $('toast');
    box.classList.remove('show');
    $('toastAction').hidden = true;
  }
  function openModal(options) {
    return new Promise(function (resolve) {
      $('modalIcon').textContent = options.icon || '❓';
      $('modalTitle').textContent = options.title || 'Emin misiniz?';
      $('modalText').textContent = options.text || '';
      var wrap = $('modalActions');
      wrap.innerHTML = '';
      (options.buttons || [{ label: 'Vazgeç', value: null }, { label: 'Evet', value: 'ok', tone: 'red' }])
        .forEach(function (b) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = b.tone === 'red' ? 'modal-confirm' : b.tone === 'gold' ? 'modal-confirm gold' : 'modal-cancel';
          btn.textContent = b.label;
          btn.addEventListener('click', function () { closeModal(); resolve(b.value); });
          wrap.appendChild(btn);
        });
      $('modalOverlay').classList.add('show');
    });
  }
  function closeModal() { $('modalOverlay').classList.remove('show'); }

  /* ------------------------------------------------------------------ *
   * Sekmeler ve form açma/kapatma
   * ------------------------------------------------------------------ */
  function setTab(type) {
    ACTIVE = type;
    ['musteri', 'portfoy'].forEach(function (t) {
      $('tab-' + t).classList.toggle('active', t === type);
      $('panel-' + t).classList.toggle('active', t === type);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setComposer(type, open) {
    var form = $(type + 'Form');
    var toggle = $(type + 'Toggle');
    form.classList.toggle('collapsed', !open);
    toggle.classList.toggle('open', open);
    $(type + 'ToggleLabel').textContent = open
      ? '✕ Formu kapat'
      : (type === 'musteri' ? '＋ Yeni Müşteri Notu' : '＋ Yeni Portföy Kaydı');
    if (open) {
      setTimeout(function () { var first = form.querySelector('input, textarea, select'); if (first) first.focus(); }, 60);
    }
  }

  function focusFirst(type) {
    var first = $(type + 'Form').querySelector('input, textarea, select');
    if (first) setTimeout(function () { first.focus(); }, 80);
  }

  /* ------------------------------------------------------------------ *
   * Form okuma / yazma / taslak
   * ------------------------------------------------------------------ */
  function fieldEl(type, name) { return $(PREFIX[type] + name); }

  function readForm(type) {
    var fields = type === 'musteri' ? MUSTERI_FIELDS : PORFOY_FIELDS;
    var data = {};
    fields.forEach(function (name) {
      var el = fieldEl(type, name);
      if (el) data[name] = String(el.value || '').trim();
    });
    if (type === 'musteri') {
      data.etiketler = Array.prototype.slice
        .call(document.querySelectorAll('#mEtiketler input:checked'))
        .map(function (i) { return i.value; });
    }
    return data;
  }

  function fillForm(type, data) {
    var fields = type === 'musteri' ? MUSTERI_FIELDS : PORFOY_FIELDS;
    fields.forEach(function (name) {
      var el = fieldEl(type, name);
      if (el) el.value = data[name] == null ? '' : data[name];
    });
    if (type === 'musteri') {
      var tags = data.etiketler || [];
      Array.prototype.slice.call(document.querySelectorAll('#mEtiketler input')).forEach(function (i) {
        i.checked = tags.indexOf(i.value) !== -1;
      });
    }
  }

  function clearForm(type) {
    fillForm(type, {});
    if (type === 'portfoy') {
      fieldEl('portfoy', 'tur').value = 'Daire';
      fieldEl('portfoy', 'durum').value = 'Satılık';
      fieldEl('portfoy', 'iskan').value = '';
    }
  }

  function clearInvalid(type) {
    $(type + 'Form').querySelectorAll('.invalid').forEach(function (el) { el.classList.remove('invalid'); });
  }

  function validate(type, data) {
    var errors = [];
    clearInvalid(type);
    if (type === 'musteri') {
      if (!data.tel) { errors.push(fieldEl('musteri', 'tel')); }
      if (!data.neAradi) { errors.push(fieldEl('musteri', 'neAradi')); }
      if (errors.length) {
        toast('Cep numarası ve "Ne aradı?" alanlarını doldurun', 'err');
      }
    } else {
      var hasSomething = ['baslik', 'il', 'ilce', 'sahibiTel', 'ozellikler'].some(function (k) { return data[k]; });
      if (!hasSomething) {
        errors.push(fieldEl('portfoy', 'baslik'));
        toast('En az bir bilgi girin (başlık, konum veya sahibi)', 'err');
      }
    }
    errors.forEach(function (el) { if (el) el.classList.add('invalid'); });
    if (errors.length && errors[0]) setTimeout(function () { errors[0].focus(); }, 60);
    return errors.length === 0;
  }

  var draftTimer = null;
  function isFormEmpty(type) {
    var fields = type === 'musteri' ? MUSTERI_MEANINGFUL : PORFOY_MEANINGFUL;
    return !fields.some(function (name) {
      var el = fieldEl(type, name);
      return el && String(el.value || '').trim();
    }) && (type !== 'musteri' || !document.querySelector('#mEtiketler input:checked'));
  }
  function scheduleDraft(type) {
    if (editing[type]) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      var key = type === 'musteri' ? KEYS.taslakMusteri : KEYS.taslakPortfoy;
      if (isFormEmpty(type)) localStorage.removeItem(key);
      else store(key, readForm(type));
    }, 400);
  }
  function clearDraft(type) {
    localStorage.removeItem(type === 'musteri' ? KEYS.taslakMusteri : KEYS.taslakPortfoy);
  }
  function restoreDraft(type) {
    var draft = load(type === 'musteri' ? KEYS.taslakMusteri : KEYS.taslakPortfoy, null);
    if (!draft || !Object.keys(draft).length) return false;
    fillForm(type, draft);
    if (isFormEmpty(type)) {
      clearForm(type);
      clearDraft(type);
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Kaydet / güncelle
   * ------------------------------------------------------------------ */
  function submitForm(type) {
    var data = readForm(type);
    if (!validate(type, data)) return;
    var now = Date.now();
    var list = listOf(type);

    if (editing[type]) {
      var rec = list.filter(function (r) { return r.id === editing[type]; })[0];
      if (rec) {
        Object.keys(data).forEach(function (k) { rec[k] = data[k]; });
        rec.updatedAt = now;
        toast('Kayıt güncellendi ✅');
      } else {
        /* kayıt başka bir sekmede silinmişse yeni kayıt olarak ekle */
        data.id = uid();
        data.createdAt = now;
        data.updatedAt = now;
        list.unshift(data);
        toast('Kayıt bulunamadı, yeni kayıt olarak eklendi');
      }
      editing[type] = null;
    } else {
      data.id = uid();
      data.createdAt = now;
      data.updatedAt = now;
      list.unshift(data);
      toast(type === 'musteri' ? 'Müşteri notu kaydedildi ✅' : 'Portföy kaydedildi ✅');
    }

    if (saveList(type, list)) {
      clearForm(type);
      clearDraft(type);
      resetFormUi(type);
      render(type);
      updateStorageInfo();
      focusFirst(type);
    }
  }

  function startEdit(type, id) {
    var rec = listOf(type).filter(function (r) { return r.id === id; })[0];
    if (!rec) return;
    if (editing[type] && editing[type] !== id) {
      cancelEdit(type, true);
    }
    editing[type] = id;
    clearInvalid(type);
    fillForm(type, rec);
    setComposer(type, true);
    $(type + 'FormTitle').textContent = type === 'musteri' ? 'Müşteri Notunu Düzenle' : 'Portföy Kaydını Düzenle';
    $(type + 'SaveLabel').textContent = 'Güncelle';
    $(type + 'Cancel').hidden = false;
    var card = document.querySelector('[data-id="' + id + '"]');
    if (card) card.classList.add('editing');
    setTimeout(function () {
      $(type + 'Form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      var first = $(type + 'Form').querySelector('input, textarea, select');
      if (first) first.focus();
    }, 120);
  }

  function cancelEdit(type, silent) {
    editing[type] = null;
    resetFormUi(type);
    if (!silent) {
      clearForm(type);
      render(type);
      focusFirst(type);
    }
  }

  function resetFormUi(type) {
    $(type + 'FormTitle').textContent = type === 'musteri' ? 'Yeni Müşteri Notu' : 'Yeni Portföy Kaydı';
    $(type + 'SaveLabel').textContent = 'Kaydet';
    $(type + 'Cancel').hidden = true;
    document.querySelectorAll('.record.editing').forEach(function (el) { el.classList.remove('editing'); });
  }

  function removeRecord(type, id) {
    var list = listOf(type);
    var index = list.findIndex(function (r) { return r.id === id; });
    if (index === -1) return;
    var removed = list.splice(index, 1)[0];
    if (editing[type] === id) cancelEdit(type, true);
    saveList(type, list);
    render(type);
    updateStorageInfo();
    lastDeleted = { type: type, index: index, record: removed };
    toast('Kayıt silindi', '', {
      label: 'Geri Al',
      run: function () {
        var current = listOf(type);
        current.splice(Math.min(lastDeleted.index, current.length), 0, lastDeleted.record);
        saveList(type, current);
        render(type);
        updateStorageInfo();
        toast('Kayıt geri alındı ↩️');
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Listeleme, arama, sıralama
   * ------------------------------------------------------------------ */
  function haystackMusteri(r) {
    return [r.ad, r.tel, r.neAradi, r.butce, r.semt, r.notlar, (r.etiketler || []).join(' ')].join(' ');
  }
  function haystackPortfoy(r) {
    return [r.baslik, r.tur, r.durum, r.fiyat, r.oda, r.m2, r.kat, r.binaYasi, r.iskan, r.ozellikler,
      r.il, r.ilce, r.mahalle, r.sokak, r.sahibi, r.sahibiTel, r.kaynak, r.notlar].join(' ');
  }
  function searchable(type, r) {
    var raw = type === 'musteri' ? haystackMusteri(r) : haystackPortfoy(r);
    return { text: fold(raw), nums: digits(raw) };
  }
  function match(entry, q) {
    if (!q) return true;
    var words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    return words.every(function (w) {
      if (entry.text.indexOf(w) !== -1) return true;
      var wn = digits(w);
      return !!wn && entry.nums.indexOf(wn) !== -1;
    });
  }
  function sortItems(items, type, mode) {
    var copy = items.slice();
    if (mode === 'oldest') copy.sort(function (a, b) { return a.createdAt - b.createdAt; });
    else if (mode === 'name') {
      copy.sort(function (a, b) {
        var an = norm(type === 'musteri' ? (a.ad || a.neAradi) : a.baslik);
        var bn = norm(type === 'musteri' ? (b.ad || b.neAradi) : b.baslik);
        return an.localeCompare(bn, 'tr');
      });
    } else if (mode === 'price') {
      copy.sort(function (a, b) {
        var av = parseFloat(digits(a.fiyat)) || Infinity, bv = parseFloat(digits(b.fiyat)) || Infinity;
        return bv - av;
      });
    } else copy.sort(function (a, b) { return b.createdAt - a.createdAt; });
    return copy;
  }

  function render(type) {
    var q = query[type];
    var all = listOf(type);
    var items = sortItems(all.filter(function (r) {
      return match(searchable(type, r), q);
    }), type, $(type + 'Sort').value);

    $('badge' + (type === 'musteri' ? 'Musteri' : 'Portfoy')).textContent = all.length;
    $(type + 'Count').textContent = q
      ? all.length + ' kayıttan ' + items.length + ' sonuç'
      : all.length + ' kayıt';

    var card = type === 'musteri' ? musteriCard : portfoyCard;
    $(type + 'List').innerHTML = items.length
      ? items.map(card).join('')
      : emptyHtml(type, q);
  }

  function emptyHtml(type, q) {
    if (q) {
      return '<div class="empty"><div class="empty-icon">🔍</div>Aramanla eşleşen kayıt yok.<br><small>"' + esc(q) + '"</small></div>';
    }
    return type === 'musteri'
      ? '<div class="empty"><div class="empty-icon">👤</div>Henüz müşteri notu yok.<br>Yukarıdaki forma cep numarasını ve arama konusunu yaz.</div>'
      : '<div class="empty"><div class="empty-icon">🏠</div>Henüz portföy kaydı yok.<br>Yukarıdaki forma portföy özelliklerini ve sahibini yaz.</div>';
  }

  function musteriCard(r) {
    var tags = (r.etiketler || []).map(function (t) {
      return '<span class="tag' + (t === 'Tekrar arayacağım' ? ' gold' : '') + '">' + esc(t) + '</span>';
    }).join('');
    var kv = [];
    if (r.butce) kv.push('<span><b>Bütçe:</b> ' + esc(r.butce) + '</span>');
    if (r.semt) kv.push('<span><b>Bölge:</b> ' + esc(r.semt) + '</span>');
    return '' +
      '<article class="record' + (editing.musteri === r.id ? ' editing' : '') + '" data-id="' + esc(r.id) + '">' +
        '<div class="record-head">' +
          '<div class="record-title">' + esc(r.ad || 'İsimsiz müşteri') + '</div>' +
          '<div class="record-date">' + fmtDate(r.updatedAt || r.createdAt) + '</div>' +
        '</div>' +
        (r.tel ? '<a class="phone-link" href="' + telHref(r.tel) + '">📞 ' + esc(formatPhone(r.tel)) + '</a>'
               : '<div class="address">Cep numarası girilmemiş</div>') +
        (r.neAradi ? '<div class="record-note">' + esc(r.neAradi) + '</div>' : '') +
        (kv.length ? '<div class="kv">' + kv.join('') + '</div>' : '') +
        (r.notlar ? '<div class="record-note">' + esc(r.notlar) + '</div>' : '') +
        (tags ? '<div class="tags">' + tags + '</div>' : '') +
        '<div class="record-actions">' +
          '<button class="arc-btn load" type="button" data-action="edit" data-id="' + esc(r.id) + '">✏️ Düzenle</button>' +
          '<button class="arc-btn delete" type="button" data-action="delete" data-id="' + esc(r.id) + '">🗑️ Sil</button>' +
        '</div>' +
      '</article>';
  }

  function portfoyCard(r) {
    var address = [r.il, r.ilce, r.mahalle, r.sokak].filter(Boolean).join(' / ');
    var fullAddress = [r.il, r.ilce, r.mahalle, r.sokak].filter(Boolean).join(', ');
    var specs = [];
    if (r.fiyat) specs.push('<span><b>Fiyat:</b> ' + esc(r.fiyat) + '</span>');
    if (r.oda) specs.push('<span><b>Oda:</b> ' + esc(r.oda) + '</span>');
    if (r.m2) specs.push('<span><b>m²:</b> ' + esc(r.m2) + '</span>');
    if (r.kat) specs.push('<span><b>Kat:</b> ' + esc(r.kat) + '</span>');
    if (r.binaYasi) specs.push('<span><b>Bina:</b> ' + esc(r.binaYasi) + '</span>');
    if (r.iskan) specs.push('<span><b>İskan:</b> ' + esc(r.iskan) + '</span>');
    var statusClass = r.durum === 'Satılık' ? 'status-satilik'
      : r.durum === 'Kiralamaya' ? 'status-kiralama' : 'status-satildi';
    var owner = '';
    if (r.sahibi || r.sahibiTel) {
      owner = '<div class="owner">👤 ' +
        (r.sahibi ? '<b>' + esc(r.sahibi) + '</b>' : '<b>İsimsiz</b>') +
        (r.sahibiTel
          ? ' · <a class="owner-phone" href="' + telHref(r.sahibiTel) + '">' + esc(formatPhone(r.sahibiTel)) + '</a>'
          : '') +
        '</div>';
    }
    return '' +
      '<article class="record' + (editing.portfoy === r.id ? ' editing' : '') + '" data-id="' + esc(r.id) + '">' +
        '<div class="record-head">' +
          '<div class="record-title">' + esc(r.baslik || 'İsimsiz portföy') + '</div>' +
          '<div class="record-date">' + fmtDate(r.updatedAt || r.createdAt) + '</div>' +
        '</div>' +
        '<div class="tags">' + (r.tur ? '<span class="tag tur">' + esc(r.tur) + '</span>' : '') +
          (r.durum ? '<span class="tag ' + statusClass + '">' + esc(r.durum) + '</span>' : '') +
          (r.kaynak ? '<span class="tag gold">🧾 ' + esc(r.kaynak) + '</span>' : '') + '</div>' +
        (specs.length ? '<div class="kv">' + specs.join('') + '</div>' : '') +
        (address ? '<div class="address">📍 ' + esc(address) + '</div>' : '') +
        owner +
        (r.ozellikler ? '<div class="record-note">' + esc(r.ozellikler) + '</div>' : '') +
        (r.notlar ? '<div class="record-note">' + esc(r.notlar) + '</div>' : '') +
        '<div class="record-actions">' +
          (r.sahibiTel ? '<a class="arc-btn load" href="' + telHref(r.sahibiTel) + '">📞 Sahibi Ara</a>' : '') +
          (fullAddress ? '<a class="arc-btn pdf" target="_blank" rel="noopener" href="' + mapsHref(fullAddress) + '">🗺️ Harita</a>' : '') +
          '<button class="arc-btn pdf" type="button" data-action="edit" data-id="' + esc(r.id) + '">✏️ Düzenle</button>' +
          '<button class="arc-btn delete" type="button" data-action="delete" data-id="' + esc(r.id) + '">🗑️ Sil</button>' +
        '</div>' +
      '</article>';
  }

  function updateStorageInfo() {
    var m = listOf('musteri').length, p = listOf('portfoy').length;
    var bytes = 0;
    [KEYS.musteriler, KEYS.portfoy].forEach(function (k) {
      var v = localStorage.getItem(k);
      if (v) bytes += v.length;
    });
    $('storageInfo').textContent = m + ' müşteri · ' + p + ' portföy kaydı · yaklaşık ' +
      (bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(1) + ' KB');
  }

  /* ------------------------------------------------------------------ *
   * Yedekleme
   * ------------------------------------------------------------------ */
  function backupPayload() {
    return {
      app: 'hadolin-hizli-not',
      version: 1,
      exportedAt: new Date().toISOString(),
      musteriler: listOf('musteri'),
      portfoy: listOf('portfoy')
    };
  }
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function exportBackup() {
    var filename = 'hadolin-notlar-' + fileStamp() + '.json';
    var file;
    try {
      file = new File([JSON.stringify(backupPayload(), null, 2)], filename, { type: 'application/json' });
    } catch (e) {
      file = null;
    }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Hızlı Not yedeği' }).catch(function () { downloadFallback(); });
      return;
    }
    downloadFallback();

    function downloadFallback() {
      downloadBlob(new Blob([JSON.stringify(backupPayload(), null, 2)], { type: 'application/json' }), filename);
      toast('Yedek dosyası indirildi 📥');
    }
  }

  function csvEscape(value) {
    var s = String(value == null ? '' : value).replace(/\r?\n/g, ' · ');
    return /[";]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCsv() {
    var rows, header, name;
    if (ACTIVE === 'musteri') {
      header = ['Ad Soyad', 'Cep', 'Ne Aradı', 'Bütçe', 'Bölge', 'Etiketler', 'Ek Not', 'Tarih'];
      rows = listOf('musteri').map(function (r) {
        return [r.ad, formatPhone(r.tel), r.neAradi, r.butce, r.semt, (r.etiketler || []).join(', '), r.notlar, fmtStamp(r.createdAt)];
      });
      name = 'musteriler-' + fileStamp() + '.csv';
    } else {
      header = ['Portföy', 'Tür', 'Durum', 'Fiyat', 'Oda', 'm²', 'Kat', 'Bina Yaşı', 'İskan', 'Özellikler',
        'İl', 'İlçe', 'Mahalle', 'Sokak / Kapı', 'Sahibi', 'Sahibi Cep', 'Kimden Geldi', 'Ek Not', 'Tarih'];
      rows = listOf('portfoy').map(function (r) {
        return [r.baslik, r.tur, r.durum, r.fiyat, r.oda, r.m2, r.kat, r.binaYasi, r.iskan, r.ozellikler,
          r.il, r.ilce, r.mahalle, r.sokak, r.sahibi, formatPhone(r.sahibiTel), r.kaynak, r.notlar, fmtStamp(r.createdAt)];
      });
      name = 'portfoy-' + fileStamp() + '.csv';
    }
    var csv = '\ufeff' + [header].concat(rows).map(function (row) {
      return row.map(csvEscape).join(';');
    }).join('\r\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), name);
    toast('Excel dosyası indirildi 📊');
  }

  function mergeLists(current, incoming) {
    var seen = {};
    current.forEach(function (r) { if (r && r.id) seen[r.id] = true; });
    var added = 0;
    incoming.forEach(function (r) {
      if (!r || typeof r !== 'object' || !r.id || seen[r.id]) return;
      seen[r.id] = true;
      current.push(r);
      added += 1;
    });
    return added;
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(String(reader.result)); }
      catch (e) { toast('Dosya okunamadı — geçersiz yedek dosyası', 'err'); return; }
      if (!data || (!Array.isArray(data.musteriler) && !Array.isArray(data.portfoy))) {
        toast('Bu dosya Hızlı Not yedeği değil', 'err');
        return;
      }
      var m = Array.isArray(data.musteriler) ? data.musteriler : [];
      var p = Array.isArray(data.portfoy) ? data.portfoy : [];
      openModal({
        icon: '📥',
        title: 'Yedek geri yüklensin mi?',
        text: 'Yedekte ' + m.length + ' müşteri ve ' + p.length + ' portföy kaydı var. Birleştirme mevcut kayıtları korur, aynı kayıtlar iki kez eklenmez.',
        buttons: [
          { label: 'Vazgeç', value: null },
          { label: 'Değiştir', value: 'replace', tone: 'red' },
          { label: 'Birleştir', value: 'merge', tone: 'gold' }
        ]
      }).then(function (choice) {
        if (!choice) return;
        if (choice === 'replace') {
          store(KEYS.musteriler, m);
          store(KEYS.portfoy, p);
          toast('Yedek yüklendi ✅ ' + (m.length + p.length) + ' kayıt');
        } else {
          var musteriList = listOf('musteri');
          var portfoyList = listOf('portfoy');
          var added = mergeLists(musteriList, m) + mergeLists(portfoyList, p);
          saveList('musteri', musteriList);
          saveList('portfoy', portfoyList);
          toast(added ? added + ' yeni kayıt eklendi ✅' : 'Yedekte yeni kayıt yok');
        }
        render('musteri');
        render('portfoy');
        updateStorageInfo();
      });
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------------ *
   * Yazdırma
   * ------------------------------------------------------------------ */
  function printList() {
    openModal({
      icon: '🖨️',
      title: 'Ne yazdırılsın?',
      text: 'Yazdırmak istediğiniz listeyi seçin.',
      buttons: [
        { label: 'Vazgeç', value: null },
        { label: 'Portföy', value: 'portfoy' },
        { label: 'Müşteriler', value: 'musteri' },
        { label: 'İkisi', value: 'all', tone: 'gold' }
      ]
    }).then(function (choice) {
      if (!choice) return;
      var d = new Date();
      $('printHead').textContent = 'HADOLİN EMLAK · Müşteri & Portföy Defteri · ' +
        pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ' · ' +
        listOf('musteri').length + ' müşteri, ' + listOf('portfoy').length + ' portföy kaydı';
      ['musteri', 'portfoy'].forEach(function (t) {
        $('panel-' + t).style.display = (choice === 'all' || choice === t) ? '' : 'none';
      });
      var restore = function () {
        ['musteri', 'portfoy'].forEach(function (t) { $('panel-' + t).style.display = ''; });
        window.removeEventListener('afterprint', restore);
      };
      window.addEventListener('afterprint', restore);
      setTimeout(function () { window.print(); }, 100);
    });
  }

  /* ------------------------------------------------------------------ *
   * Uygulama başlatma
   * ------------------------------------------------------------------ */
  function buildCancelButtons() {
    ['musteri', 'portfoy'].forEach(function (type) {
      var bar = $(type + 'Form').querySelector('.actionbar');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-cancel';
      btn.id = type + 'Cancel';
      btn.textContent = 'Vazgeç';
      btn.hidden = true;
      btn.addEventListener('click', function () { cancelEdit(type); });
      bar.insertBefore(btn, bar.firstChild);
    });
  }

  function wireEvents() {
    $('tab-musteri').addEventListener('click', function () { setTab('musteri'); });
    $('tab-portfoy').addEventListener('click', function () { setTab('portfoy'); });

    ['musteri', 'portfoy'].forEach(function (type) {
      $(type + 'Toggle').addEventListener('click', function () {
        setComposer(type, $(type + 'Form').classList.contains('collapsed'));
      });
      $(type + 'Form').addEventListener('submit', function (e) {
        e.preventDefault();
        submitForm(type);
      });
      $(type + 'Form').addEventListener('input', function () { scheduleDraft(type); });
      $(type + 'Form').addEventListener('change', function () { scheduleDraft(type); });
      $(type + 'Search').addEventListener('input', function (e) {
        query[type] = e.target.value;
        render(type);
      });
      $(type + 'Search').addEventListener('search', function (e) {
        query[type] = e.target.value;
        render(type);
      });
      $(type + 'Sort').addEventListener('change', function () { render(type); });
      $(type + 'List').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-action]');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        if (btn.getAttribute('data-action') === 'edit') startEdit(type, id);
        else if (btn.getAttribute('data-action') === 'delete') removeRecord(type, id);
      });
      /* iOS klavye açınca alanları görünür tut */
      $(type + 'Form').addEventListener('focusin', function (e) {
        var target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          setTimeout(function () {
            try { target.scrollIntoView({ block: 'center' }); } catch (err) { /* yoksay */ }
          }, 280);
        }
      });
    });

    $('backupToggle').addEventListener('click', function () {
      $('backupBody').classList.toggle('open');
    });
    $('exportButton').addEventListener('click', exportBackup);
    $('exportCsvButton').addEventListener('click', exportCsv);
    $('printButton').addEventListener('click', printList);
    $('importInput').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) importBackup(file);
      e.target.value = '';
    });
    $('clearAllButton').addEventListener('click', function () {
      openModal({
        icon: '🗑️',
        title: 'Tüm kayıtlar silinsin mi?',
        text: 'Bu telefon kayıtlı ' + listOf('musteri').length + ' müşteri ve ' + listOf('portfoy').length + ' portföy notu kalıcı olarak silinecek. Önce yedek almanız önerilir.',
        buttons: [
          { label: 'Vazgeç', value: null },
          { label: 'Evet, hepsini sil', value: 'ok', tone: 'red' }
        ]
      }).then(function (choice) {
        if (!choice) return;
        localStorage.removeItem(KEYS.musteriler);
        localStorage.removeItem(KEYS.portfoy);
        localStorage.removeItem(KEYS.taslakMusteri);
        localStorage.removeItem(KEYS.taslakPortfoy);
        editing.musteri = null;
        editing.portfoy = null;
        resetFormUi('musteri');
        resetFormUi('portfoy');
        clearForm('musteri');
        clearForm('portfoy');
        render('musteri');
        render('portfoy');
        updateStorageInfo();
        toast('Tüm kayıtlar silindi');
      });
    });

    $('modalOverlay').addEventListener('click', function (e) {
      if (e.target === $('modalOverlay')) closeModal();
    });
  }

  function keepScreenAwake() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').catch(function () { /* desteklenmiyorsa sessiz geç */ });
  }

  function trackKeyboard() {
    if (!window.visualViewport) return;
    var vv = window.visualViewport;
    var update = function () {
      var offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', offset + 'px');
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
  }

  function init() {
    buildCancelButtons();
    wireEvents();
    trackKeyboard();
    render('musteri');
    render('portfoy');
    updateStorageInfo();
    setComposer('musteri', true);
    if (restoreDraft('musteri')) toast('Yarım kalan müşteri taslağı geri yüklendi', 'info');
    if (restoreDraft('portfoy')) toast('Yarım kalan portföy taslağı geri yüklendi', 'info');
    focusFirst('musteri');
    keepScreenAwake();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') keepScreenAwake();
    });

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* çevrimdışı destek yoksa sorun değil */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
