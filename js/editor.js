/* ============================================================
 * 基准数据在线编辑器 — 逻辑
 * 依赖 data.js：DEFAULT_CONFIG / validateConfig / applyConfig /
 * exportConfig / saveStoredConfig / loadStoredConfig / resetToDefault /
 * CONV_STEPS / FUNNEL_STAGES / SCHEMA_VERSION
 * 编辑器与主程序共用 STORAGE_KEY，保存后主程序载入即生效。
 * ============================================================ */
(function () {
  'use strict';

  /* 工作态：当前编辑中的配置（与 exportConfig() 同形状） */
  let state = loadInitialState();
  let dirty = false;

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  function loadInitialState() {
    const stored = loadStoredConfig();
    if (stored && stored.config) {
      const r = applyConfig(stored.config);
      if (r.ok) return exportConfig();        // 已导入的本地配置
    }
    return exportConfig();                    // 内置默认
  }

  /* 把工作态序列化成可回灌的 JSON 对象（不依赖运行时变量） */
  function serialize() {
    return {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString().slice(0, 10),
      source: '在线编辑器',
      categories: state.categories,
      benchmarks: state.benchmarks,
      benchmarkLogic: state.benchmarkLogic,
      plans: state.plans,
      painWords: state.painWords,
      courseLock: state.courseLock,
      copy: {
        welcome: state.copy.welcome,
        tips: state.copy.tips,
        disclaimer: state.copy.disclaimer
      }
    };
  }

  /* ---------- 路径读写（data-bind） ---------- */
  function getByPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function setByPath(obj, path, val) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) return;
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = val;
  }

  /* ---------- 渲染 ---------- */
  function renderAll() {
    renderBench();
    renderLogic();
    renderPlans();
    renderPain();
    renderCourse();
    renderCopy();
    refreshPreview();
  }

  function renderBench() {
    const html = state.categories.map((cat) => `
      <div class="ed-card">
        <h4>${esc(cat)}</h4>
        ${CONV_STEPS.map((s) => {
          const rng = (state.benchmarks[cat] && state.benchmarks[cat][s.key]) || [0, 100];
          return `
          <div class="ed-row">
            <label class="ed-label">${esc(s.label)}</label>
            <input class="ed-num" type="number" step="0.1" min="0" max="100"
                   data-bind="benchmarks.${cat}.${s.key}.0" value="${num(rng[0], 0)}">
            <span class="ed-dash">–</span>
            <input class="ed-num" type="number" step="0.1" min="0" max="100"
                   data-bind="benchmarks.${cat}.${s.key}.1" value="${num(rng[1], 100)}">
            <span class="ed-unit">%</span>
          </div>`;
        }).join('')}
      </div>`).join('');
    document.getElementById('ed-bench').innerHTML = html;
  }

  function renderLogic() {
    const html = state.categories.map((cat) => `
      <div class="ed-row ed-row-col">
        <label class="ed-label">${esc(cat)}</label>
        <textarea class="ed-ta" data-bind="benchmarkLogic.${cat}">${esc(state.benchmarkLogic[cat] || '')}</textarea>
      </div>`).join('');
    document.getElementById('ed-logic').innerHTML = html;
  }

  function renderPlans() {
    const html = state.categories.map((cat) => {
      const arr = state.plans[cat] || [];
      return `
      <div class="ed-card">
        <h4>${esc(cat)}</h4>
        ${arr.map((p, i) => `
          <div class="ed-plan">
            <div class="ed-row">
              <label class="ed-label">方案 ${esc(p.key || (i + 1))}</label>
              <input class="ed-text" data-bind="plans.${cat}.${i}.name" value="${esc(p.name || '')}" placeholder="方案名">
              <label class="ed-cbx"><input type="checkbox" data-bind="plans.${cat}.${i}.best" ${p.best ? 'checked' : ''}> 最优解</label>
            </div>
            <div class="ed-row ed-row-3">
              <label class="ed-label">支付率%</label><input class="ed-num" type="number" step="0.1" data-bind="plans.${cat}.${i}.payRate" value="${num(p.payRate, 0)}">
              <label class="ed-label">GMV%</label><input class="ed-num" type="number" step="0.1" data-bind="plans.${cat}.${i}.gmv" value="${num(p.gmv, 0)}">
              <label class="ed-label">利润%</label><input class="ed-num" type="number" step="0.1" data-bind="plans.${cat}.${i}.profit" value="${num(p.profit, 0)}">
            </div>
            <div class="ed-row">
              <label class="ed-label">标签</label><input class="ed-text" data-bind="plans.${cat}.${i}.tag" value="${esc(p.tag || '')}" placeholder="如 ⭐最优">
              <label class="ed-label">附加</label><input class="ed-text" data-bind="plans.${cat}.${i}.extra" value="${esc(p.extra || '')}" placeholder="附加影响">
            </div>
            <div class="ed-row ed-row-col">
              <label class="ed-label">测算逻辑</label>
              <textarea class="ed-ta" data-bind="plans.${cat}.${i}.logic">${esc(p.logic || '')}</textarea>
            </div>
          </div>`).join('')}
      </div>`;
    }).join('');
    document.getElementById('ed-plans').innerHTML = html;
  }

  function painRows(step) {
    const arr = state.painWords[step] || [];
    return arr.map((w, i) => `
      <div class="ed-row ed-pain-row">
        <input class="ed-text" data-bind="painWords.${step}.${i}.0" value="${esc(w[0])}" placeholder="关键词">
        <input class="ed-num ed-weight" type="number" step="1" min="1" data-bind="painWords.${step}.${i}.1" value="${num(w[1], 1)}" placeholder="权重">
        <button class="btn btn-sm btn-warn ed-del" data-action="del-pain" data-step="${step}" data-idx="${i}">✕</button>
      </div>`).join('');
  }
  function renderPain() {
    const html = CONV_STEPS.map((s) => `
      <div class="ed-card">
        <h4>${esc(s.label)} <small>(${esc(s.key)})</small></h4>
        <div class="ed-pain-list" id="pain-${s.key}">${painRows(s.key)}</div>
        <button class="btn btn-sm ed-add" data-action="add-pain" data-step="${s.key}">+ 添加关键词</button>
      </div>`).join('');
    document.getElementById('ed-pain').innerHTML = html;
  }

  function renderCourse() {
    const html = `
      <div class="ed-card">
        <div class="ed-row">
          <label class="ed-label">锁定品类</label>
          <select class="ed-text" data-bind="courseLock.category">
            ${state.categories.map((c) => `<option value="${esc(c)}" ${c === state.courseLock.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
        <p class="ed-hint">六层漏斗固定数值（微课案例；可改，但「锁定」行为不变）：</p>
        ${FUNNEL_STAGES.map((st) => `
          <div class="ed-row">
            <label class="ed-label">${esc(st.label)}</label>
            <input class="ed-num" type="number" step="1" data-bind="courseLock.data.${st.key}" value="${num(state.courseLock.data[st.key], 0)}">
          </div>`).join('')}
      </div>`;
    document.getElementById('ed-course').innerHTML = html;
  }

  function renderCopy() {
    const c = state.copy;
    const tips = [
      ['enter', '输入提示'], ['dataReady', '数据就绪'], ['funnelDone', '漏斗生成后'],
      ['benchmarkDone', '基准对标后'], ['plansReady', '方案就绪'], ['simulateDone', '模拟完成后']
    ];
    const html = `
      <div class="ed-card">
        <div class="ed-row ed-row-col">
          <label class="ed-label">欢迎语</label>
          <textarea class="ed-ta" data-bind="copy.welcome">${esc(c.welcome || '')}</textarea>
        </div>
        ${tips.map(([k, lbl]) => `
          <div class="ed-row ed-row-col">
            <label class="ed-label">提示 · ${esc(lbl)}</label>
            <textarea class="ed-ta ed-ta-sm" data-bind="copy.tips.${k}">${esc((c.tips && c.tips[k]) || '')}</textarea>
          </div>`).join('')}
        <div class="ed-row ed-row-col">
          <label class="ed-label">免责声明</label>
          <textarea class="ed-ta" data-bind="copy.disclaimer">${esc(c.disclaimer || '')}</textarea>
        </div>
      </div>`;
    document.getElementById('ed-copy').innerHTML = html;
  }

  /* ---------- 事件 ---------- */
  function onField(e) {
    const el = e.target.closest('[data-bind]');
    if (!el) return;
    const path = el.getAttribute('data-bind');
    let val;
    if (el.type === 'checkbox') val = el.checked;
    else if (el.type === 'number') {
      const n = parseFloat(el.value);
      val = isFinite(n) ? n : 0;
    } else val = el.value;
    setByPath(state, path, val);
    dirty = true;
    schedulePreview();
  }

  function onClick(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const step = btn.getAttribute('data-step');
    if (action === 'add-pain') {
      if (!Array.isArray(state.painWords[step])) state.painWords[step] = [];
      state.painWords[step].push(['新关键词', 10]);
      document.getElementById('pain-' + step).innerHTML = painRows(step);
      dirty = true; schedulePreview();
    } else if (action === 'del-pain') {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      if (state.painWords[step]) state.painWords[step].splice(idx, 1);
      document.getElementById('pain-' + step).innerHTML = painRows(step);
      dirty = true; schedulePreview();
    }
  }

  document.addEventListener('input', onField);
  document.addEventListener('change', onField);   // checkbox / select
  document.addEventListener('click', onClick);

  /* ---------- 预览 / 校验 ---------- */
  let previewTimer = null;
  function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(refreshPreview, 400); }
  function refreshPreview() {
    const pre = document.getElementById('ed-json');
    if (!pre) return;
    try {
      const res = validateConfig(state);
      pre.textContent = JSON.stringify(serialize(), null, 2);
      pre.classList.toggle('invalid', !res.ok);
    } catch (e) {
      pre.textContent = '序列化失败：' + e.message;
      pre.classList.add('invalid');
    }
  }

  /* ---------- 动作 ---------- */
  function setStatus(msg, kind) {
    const el = document.getElementById('ed-status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'ed-status ' + (kind || '');
    clearTimeout(el._t);
    if (kind === 'ok' || kind === 'err') {
      el._t = setTimeout(() => { el.textContent = ''; el.className = 'ed-status'; }, 7000);
    }
  }

  function doSave() {
    const res = applyConfig(state);                // 校验 + 同步运行时
    if (!res.ok) { setStatus('保存失败：' + res.errors.join('；'), 'err'); return; }
    saveStoredConfig({ source: '在线编辑器·手动保存', fileName: 'editor' });
    dirty = false;
    let msg = '✅ 已保存到浏览器本地，打开主程序即生效';
    if (res.warnings.length) msg += '（' + res.warnings.length + ' 处已回退默认：' + res.warnings.join('；') + '）';
    setStatus(msg, 'ok');
  }

  function doExport() {
    const res = applyConfig(state);
    if (!res.ok) { setStatus('导出失败：' + res.errors.join('；'), 'err'); return; }
    const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'benchmark.json';
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus('⬇️ 已导出 benchmark.json（提交到仓库根目录即可用「一键更新」同步）', 'ok');
  }

  function doImport(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result);
        const cfg = (raw && raw.config) ? raw.config : raw;   // 兼容 {meta,config} 与裸配置
        const res = validateConfig(cfg);
        if (!res.ok) { setStatus('导入失败：' + res.errors.join('；'), 'err'); return; }
        applyConfig(cfg);
        state = exportConfig();
        renderAll();
        dirty = true;
        setStatus('✅ 已导入，记得点「保存」或「导出」', 'ok');
      } catch (e) {
        setStatus('JSON 解析失败：' + e.message, 'err');
      }
    };
    reader.readAsText(file);
  }

  function doReset() {
    resetToDefault();
    state = exportConfig();
    renderAll();
    dirty = true;
    setStatus('↺ 已载入内置默认（未保存，点「保存」才会覆盖本地）', 'ok');
  }

  function init() {
    renderAll();
    const stored = loadStoredConfig();
    setStatus(stored && stored.config ? '当前编辑：已导入的本地配置' : '当前编辑：内置默认（规格书 v1.0）', '');

    document.getElementById('ed-save').addEventListener('click', doSave);
    document.getElementById('ed-export').addEventListener('click', doExport);
    document.getElementById('ed-import').addEventListener('click', () => document.getElementById('ed-file').click());
    document.getElementById('ed-file').addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) doImport(f);
      e.target.value = '';
    });
    document.getElementById('ed-reset').addEventListener('click', doReset);

    window.addEventListener('beforeunload', (e) => {
      if (dirty) { e.preventDefault(); e.returnValue = ''; }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
