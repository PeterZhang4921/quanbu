/* 泉簿 · 应用逻辑 */
(() => {
  'use strict';

  // ---------- 分类预设 ----------
  const CATS = {
    expense: [
      { key: 'food',    name: '餐饮', ico: '🍜' },
      { key: 'traffic', name: '交通', ico: '🚌' },
      { key: 'shop',    name: '购物', ico: '🛍️' },
      { key: 'home',    name: '居住', ico: '🏠' },
      { key: 'fun',     name: '娱乐', ico: '🎮' },
      { key: 'health',  name: '医疗', ico: '💊' },
      { key: 'phone',   name: '通讯', ico: '📱' },
      { key: 'other',   name: '其他', ico: '📦' },
    ],
    income: [
      { key: 'salary',  name: '工资', ico: '💰' },
      { key: 'bonus',   name: '红包', ico: '🧧' },
      { key: 'invest',  name: '理财', ico: '📈' },
      { key: 'other',   name: '其他', ico: '✨' },
    ],
  };
  const COLORS = ['#5f7a6f','#b1584e','#b8944d','#6b8b9e','#8a6d8b','#7d8a5a','#b07d5a','#9a9488'];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- 状态 ----------
  let type = 'expense';
  let amountStr = '0';
  let cache = [];                 // 全部账目缓存
  let statMonth = ymNow();        // 统计页当前月份 'YYYY-MM'
  let searchQuery = '';           // 明细搜索关键词
  const selectedCats = new Set(); // 已选大类，元素形如 'expense:food'

  // ---------- 工具 ----------
  function ymNow() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function fmt(n) {
    const v = Math.round(n * 100) / 100;
    return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function catOf(t, key) {
    return CATS[t].find(c => c.key === key) || { name: '其他', ico: t === 'income' ? '✨' : '📦' };
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (el.hidden = true), 1500);
  }

  // ================= 记一笔 =================
  function renderCats() {
    const wrap = $('#cats');
    wrap.innerHTML = CATS[type].map(c =>
      `<button class="cat" data-cat="${c.key}"><span class="cat__ico">${c.ico}</span><span class="cat__txt">${c.name}</span></button>`
    ).join('');
  }

  function setType(t) {
    type = t;
    $$('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === t));
    $('#view-entry').classList.toggle('income-mode', t === 'income');
    $('#amount-sign').style.color = t === 'income' ? 'var(--jade)' : 'var(--ink-soft)';
    renderCats();
  }

  function refreshAmount() { $('#amount-value').textContent = amountStr; }

  function press(k) {
    if (k === 'del') {
      amountStr = amountStr.length <= 1 ? '0' : amountStr.slice(0, -1);
      if (amountStr === '') amountStr = '0';
    } else if (k === '.') {
      if (!amountStr.includes('.')) amountStr += '.';
    } else {
      if (amountStr === '0') amountStr = k;
      else {
        // 限制两位小数
        const dot = amountStr.indexOf('.');
        if (dot >= 0 && amountStr.length - dot > 2) return;
        if (amountStr.replace('.', '').length >= 9) return; // 防溢出
        amountStr += k;
      }
    }
    refreshAmount();
  }

  async function saveEntry(catKey) {
    const amount = parseFloat(amountStr);
    if (!amount || amount <= 0) { toast('请先输入金额'); return; }
    const noteEl = $('#note-input');
    const rec = {
      id: uid(),
      type,
      amount: Math.round(amount * 100) / 100,
      category: catKey,
      note: noteEl.value.trim(),
      date: todayISO(),
      createdAt: Date.now(),
    };
    await DB.add(rec);
    cache.unshift(rec);
    amountStr = '0';
    refreshAmount();
    noteEl.value = '';
    noteEl.blur();
    toast('已记一笔 · ' + catOf(type, catKey).name);
    renderList();
    renderStats();
  }

  // ================= 明细 =================
  function monthSum(t, ym) {
    return cache
      .filter(r => r.type === t && r.date.slice(0, 7) === ym)
      .reduce((s, r) => s + r.amount, 0);
  }

  function isFiltering() { return searchQuery.trim() !== '' || selectedCats.size > 0; }

  // 单条记录是否命中当前筛选（大类 + 关键词）
  function matchesFilter(r) {
    if (selectedCats.size && !selectedCats.has(r.type + ':' + r.category)) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const c = catOf(r.type, r.category);
    const hay = [
      r.date,                    // 2026-07-03
      r.date.replace(/-/g, ''),  // 20260703
      fmtDate(r.date),           // 7月3日 周五
      String(r.amount),          // 188 / 66.5
      r.note || '',
      c.name,
    ].join(' ').toLowerCase();
    return hay.includes(q);
  }

  function renderSearchCats() {
    const chip = (t, c) => `<button class="chip" data-type="${t}" data-key="${c.key}">${c.ico} ${c.name}</button>`;
    $('#search-cats').innerHTML =
      `<div class="chip-group"><span class="chip-group__label">支出</span>${CATS.expense.map(c => chip('expense', c)).join('')}</div>` +
      `<div class="chip-group"><span class="chip-group__label">收入</span>${CATS.income.map(c => chip('income', c)).join('')}</div>`;
  }

  function renderList() {
    $('#list-month-expense').textContent = fmt(monthSum('expense', ymNow()));
    const body = $('#list-body');
    const summary = $('#search-summary');
    const list = cache.filter(matchesFilter);

    if (isFiltering()) {
      const exp = list.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
      const inc = list.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
      summary.hidden = false;
      summary.textContent = `共 ${list.length} 笔` + (exp ? ` · 支 ${fmt(exp)}` : '') + (inc ? ` · 收 ${fmt(inc)}` : '');
    } else {
      summary.hidden = true;
    }

    if (!list.length) {
      body.innerHTML = `<p class="empty">${isFiltering() ? '没有匹配的记录' : '还没有记录，去记一笔吧'}</p>`;
      return;
    }

    const groups = {};
    for (const r of list) (groups[r.date] ||= []).push(r);

    body.innerHTML = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => {
      const items = groups[date];
      const exp = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
      const inc = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
      const sub = [exp ? '支 ' + fmt(exp) : '', inc ? '收 ' + fmt(inc) : ''].filter(Boolean).join('  ');
      const rows = items.map(r => {
        const c = catOf(r.type, r.category);
        const sign = r.type === 'income' ? '+' : '-';
        return `<div class="tx" data-id="${r.id}">
          <div class="tx__ico">${c.ico}</div>
          <div class="tx__main">
            <div class="tx__cat">${c.name}</div>
            ${r.note ? `<div class="tx__note">${escapeHtml(r.note)}</div>` : ''}
          </div>
          <div class="tx__amt ${r.type}">${sign}${fmt(r.amount).slice(1)}</div>
        </div>`;
      }).join('');
      return `<div class="day-group">
        <div class="day-group__head"><span>${fmtDate(date)}</span><span>${sub}</span></div>
        ${rows}
      </div>`;
    }).join('');
  }

  function fmtDate(iso) {
    const [y, m, d] = iso.split('-');
    const wk = ['日','一','二','三','四','五','六'][new Date(iso).getDay()];
    return `${+m}月${+d}日 周${wk}`;
  }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  // ================= 统计 =================
  function shiftMonth(delta) {
    let [y, m] = statMonth.split('-').map(Number);
    m += delta;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    statMonth = `${y}-${pad(m)}`;
    renderStats();
  }

  function renderStats() {
    $('#month-cur').textContent = statMonth;
    const exp = monthSum('expense', statMonth);
    const inc = monthSum('income', statMonth);
    $('#stat-expense').textContent = fmt(exp);
    $('#stat-income').textContent = fmt(inc);

    // 收支对比：两条横条按较大值等比缩放
    const cmpMax = Math.max(exp, inc, 1);
    $('#bar-income').style.width = (inc / cmpMax * 100) + '%';
    $('#bar-expense').style.width = (exp / cmpMax * 100) + '%';

    // 结余：正数绿(+)、负数红(-)
    const bal = Math.round((inc - exp) * 100) / 100;
    const sign = bal > 0 ? '+' : (bal < 0 ? '-' : '');
    const balEl = $('#stat-balance');
    balEl.textContent = sign + fmt(Math.abs(bal));
    balEl.classList.toggle('pos', bal > 0);
    balEl.classList.toggle('neg', bal < 0);

    // 分类占比（支出）
    const byCat = {};
    cache.filter(r => r.type === 'expense' && r.date.slice(0, 7) === statMonth)
      .forEach(r => { byCat[r.category] = (byCat[r.category] || 0) + r.amount; });
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    const rankWrap = $('#rank-wrap'), rankList = $('#rank-list'), empty = $('#stats-empty');
    if (!entries.length) {
      rankList.innerHTML = ''; rankWrap.style.display = 'none'; empty.hidden = false;
      return;
    }
    rankWrap.style.display = 'block';
    empty.hidden = true;

    const total = entries.reduce((s, [, v]) => s + v, 0);
    rankList.innerHTML = entries.map(([key, val], i) => {
      const c = catOf('expense', key);
      const pctNum = val / total * 100;
      const pct = pctNum < 10 ? pctNum.toFixed(1) : pctNum.toFixed(0);
      const color = COLORS[i % COLORS.length];
      return `<div class="rank-item">
        <div class="rank-head">
          <span class="rank-cat">${c.ico} ${c.name}</span>
          <span class="rank-meta"><span class="rank-pct">${pct}%</span><span class="rank-amt">${fmt(val)}</span></span>
        </div>
        <div class="rank-bar"><span class="rank-fill" style="width:${pctNum}%;background:${color}"></span></div>
      </div>`;
    }).join('');
  }

  // ================= 编辑 =================
  let editingId = null;
  function openEdit(id) {
    const r = cache.find(x => x.id === id);
    if (!r) return;
    editingId = id;
    $('#edit-amount').value = r.amount;
    $('#edit-category').innerHTML = CATS[r.type]
      .map(c => `<option value="${c.key}" ${c.key === r.category ? 'selected' : ''}>${c.ico} ${c.name}</option>`).join('');
    $('#edit-date').value = r.date;
    $('#edit-note').value = r.note || '';
    show('#edit-modal');
  }
  async function saveEdit() {
    const r = cache.find(x => x.id === editingId);
    if (!r) return;
    const amt = parseFloat($('#edit-amount').value);
    if (!amt || amt <= 0) { toast('金额无效'); return; }
    r.amount = Math.round(amt * 100) / 100;
    r.category = $('#edit-category').value;
    r.date = $('#edit-date').value || r.date;
    r.note = $('#edit-note').value.trim();
    await DB.put(r);
    cache.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt - a.createdAt));
    hide('#edit-modal');
    toast('已保存');
    renderList(); renderStats();
  }
  async function deleteEdit() {
    if (!editingId) return;
    await DB.remove(editingId);
    cache = cache.filter(x => x.id !== editingId);
    hide('#edit-modal');
    toast('已删除');
    renderList(); renderStats();
  }

  // ================= 备份 =================
  function exportData() {
    const payload = { app: 'quanbu', version: 1, exportedAt: new Date().toISOString(), data: cache };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `泉簿备份_${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('已导出 ' + cache.length + ' 条');
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const records = Array.isArray(parsed) ? parsed : parsed.data;
        if (!Array.isArray(records)) throw new Error('格式不对');
        // 基本校验
        const clean = records.filter(r => r && r.id && r.type && typeof r.amount === 'number' && r.date);
        if (!clean.length) throw new Error('没有有效记录');
        if (!confirm(`将用备份中的 ${clean.length} 条记录替换当前数据，确定？`)) return;
        await DB.replaceAll(clean);
        cache = await DB.all();
        hide('#backup-modal');
        toast('已恢复 ' + clean.length + ' 条');
        renderList(); renderStats();
      } catch (e) {
        toast('恢复失败：' + e.message);
      }
    };
    reader.readAsText(file);
  }

  // ================= 弹层 / 导航 =================
  function show(sel) { $(sel).hidden = false; }
  function hide(sel) { $(sel).hidden = true; }

  function switchView(name) {
    $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
    if (name === 'list') renderList();
    if (name === 'stats') { statMonth = ymNow(); renderStats(); }
  }

  // ================= 绑定事件 =================
  function bind() {
    $('#type-toggle').addEventListener('click', e => {
      const b = e.target.closest('.type-btn'); if (b) setType(b.dataset.type);
    });
    $('#keypad').addEventListener('click', e => {
      const b = e.target.closest('.key'); if (b) press(b.dataset.k);
    });
    $('#cats').addEventListener('click', e => {
      const b = e.target.closest('.cat'); if (b) saveEntry(b.dataset.cat);
    });
    $('#tabbar').addEventListener('click', e => {
      const b = e.target.closest('.tab'); if (b) switchView(b.dataset.view);
    });
    $('#list-body').addEventListener('click', e => {
      const tx = e.target.closest('.tx'); if (tx) openEdit(tx.dataset.id);
    });

    // 搜索：点搜索框展开大类多选；输入实时过滤金额/日期/备注
    const si = $('#search-input');
    si.addEventListener('focus', () => { $('#search-cats').hidden = false; });
    si.addEventListener('input', () => {
      searchQuery = si.value;
      $('#search-clear').hidden = si.value === '';
      renderList();
    });
    $('#search-clear').addEventListener('click', () => {
      si.value = ''; searchQuery = ''; $('#search-clear').hidden = true; si.focus(); renderList();
    });
    $('#search-cats').addEventListener('click', e => {
      const chip = e.target.closest('.chip'); if (!chip) return;
      const id = chip.dataset.type + ':' + chip.dataset.key;
      if (selectedCats.has(id)) { selectedCats.delete(id); chip.classList.remove('on'); }
      else { selectedCats.add(id); chip.classList.add('on'); }
      renderList();
    });
    $('#month-prev').addEventListener('click', () => shiftMonth(-1));
    $('#month-next').addEventListener('click', () => shiftMonth(1));

    // 编辑弹层
    $('#edit-save').addEventListener('click', saveEdit);
    $('#edit-delete').addEventListener('click', deleteEdit);

    // 备份弹层
    $('#backup-btn').addEventListener('click', () => show('#backup-modal'));
    $('#export-btn').addEventListener('click', exportData);
    $('#import-btn').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ''; });

    // 关闭弹层
    $$('[data-close]').forEach(el => el.addEventListener('click', () => {
      el.closest('.modal').hidden = true;
    }));
  }

  // ================= 启动 =================
  async function init() {
    setType('expense');
    refreshAmount();
    renderSearchCats();
    bind();
    cache = await DB.all();
    renderList();
    renderStats();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
