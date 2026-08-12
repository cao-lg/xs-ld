/* ============================================================
 * 小数 · 漏斗诊断助手 — 交互逻辑（纯前端，图表使用 ECharts）
 * ============================================================ */

/* ---------- 全局状态 ---------- */
const state = {
  category: CATEGORIES[0],
  data: { exposure: null, click: null, cart: null, order: null, pay: null, finish: null },
  funnelBuilt: false,
  benchmarkBuilt: false,
  drillBuilt: false,
  plansBuilt: false,
  simulated: false,
  locked: false   // 微课案例是否锁定
};

/* ---------- 工具函数 ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'));
const pct = (n, d) => (d > 0 ? (n / d) * 100 : 0);
const clampPct = (v) => Math.max(0, Math.min(100, v));
const hdot = (h) => `<span class="hdot ${h}" title="${HEALTH_META[h].text}"></span>`;

/* 健康度配色（ECharts / CSS 共用）*/
const HEALTH_COLOR = { good: '#1f9e6b', mid: '#d99a00', low: '#e5484d', neutral: '#6a7bff' };

/* ECharts 实例登记，便于 resize / dispose */
const charts = {};
function registerChart(id, chart) { charts[id] = chart; return chart; }
function disposeChart(id) {
  if (charts[id]) { charts[id].dispose(); delete charts[id]; }
}

function toast(msg, type = 'info') {
  const box = $('#toast');
  box.textContent = msg;
  box.className = `toast show ${type}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (box.className = 'toast'), 2600);
}

/* 读取输入并做基础校验 */
function readInputs() {
  const d = {};
  let ok = true;
  FUNNEL_STAGES.forEach((s) => {
    const v = parseFloat($(`#in-${s.key}`).value);
    d[s.key] = isNaN(v) ? null : v;
    if (isNaN(v)) ok = false;
  });
  return { d, ok };
}

/* 检测是否为微课锁定案例（美妆 + 默认数据完全一致） */
function detectLock(d) {
  if (state.category !== COURSE_LOCK.category) return false;
  return FUNNEL_STAGES.every((s) => d[s.key] === COURSE_LOCK.data[s.key]);
}

/* 填充微课默认数据 */
function fillCourseData() {
  FUNNEL_STAGES.forEach((s) => {
    $(`#in-${s.key}`).value = COURSE_LOCK.data[s.key];
  });
  state.category = COURSE_LOCK.category;
  setCategoryUI(COURSE_LOCK.category);
  toast('已载入微课案例默认数据（美妆护肤）', 'info');
}

/* ---------- 品类切换 ---------- */
function setCategoryUI(cat) {
  $$('.cat-chip').forEach((c) => c.classList.toggle('active', c.dataset.cat === cat));
  $('#bench-logic').textContent = BENCHMARK_LOGIC[cat] || '';
}

function onSelectCategory(cat) {
  if (cat === state.category) return;
  state.category = cat;
  setCategoryUI(cat);
  resetDownstream('soft');
  toast(COPY.switchHint(cat), 'warn');
}

/* 重置下游结果 */
function resetDownstream(mode) {
  state.funnelBuilt = state.benchmarkBuilt = state.drillBuilt = state.plansBuilt = state.simulated = false;
  state.locked = false;
  ['funnel', 'bench', 'drill'].forEach(disposeChart);
  $('#funnel-wrap').innerHTML = '';
  $('#benchmark-wrap').innerHTML = '';
  $('#drill-wrap').innerHTML = '';
  $('#plans-wrap').innerHTML = '';
  $('#compare-wrap').innerHTML = '';
  $('#lock-badge').classList.remove('show');
  if (mode === 'soft') {
    $('#btn-bench').disabled = true;
    $('#btn-plans').disabled = true;
    $('#btn-compare').disabled = true;
  }
}

/* ---------- 1. 生成漏斗图（ECharts 漏斗 + 数据明细表） ---------- */
function buildFunnel() {
  const { d, ok } = readInputs();
  if (!ok) return toast('请完整填写六层漏斗数据', 'error');

  for (let i = 1; i < FUNNEL_STAGES.length; i++) {
    const prev = d[FUNNEL_STAGES[i - 1].key];
    const cur = d[FUNNEL_STAGES[i].key];
    if (cur > prev) return toast(`「${FUNNEL_STAGES[i].label}」不应大于「${FUNNEL_STAGES[i - 1].label}」`, 'error');
  }

  state.data = d;
  state.locked = detectLock(d);
  state.funnelBuilt = true;

  const max = d.exposure;
  const range = BENCHMARK[state.category];

  const rates = {};
  CONV_STEPS.forEach((s) => (rates[s.key] = pct(d[s.to], d[s.from])));

  // 数据明细表：量级占比 + 转化率 + 流失率
  let rows = '';
  FUNNEL_STAGES.forEach((st, i) => {
    const v = d[st.key];
    const share = pct(v, max);
    let convCell, dropCell = '';
    if (i > 0) {
      const step = CONV_STEPS[i - 1];
      const r = rates[step.key];
      const h = healthOf(r, range[step.key]);
      const drop = 100 - pct(v, d[FUNNEL_STAGES[i - 1].key]);
      convCell = `<span class="fc-chip ${h}">${hdot(h)} ${r.toFixed(1)}%</span>`;
      dropCell = `<span class="fc-drop">流失 ${drop.toFixed(1)}%</span>`;
    } else {
      convCell = `<span class="fc-chip neutral">入口 100%</span>`;
    }
    const alert = i > 0 && healthOf(rates[CONV_STEPS[i - 1].key], range[CONV_STEPS[i - 1].key]) === 'low';
    rows += `<div class="fc-row${alert ? ' alert' : ''}">
        <div class="fc-name">${st.label}</div>
        <div class="fc-val">${fmt(v)}</div>
        <div class="fc-share">占曝光 ${share.toFixed(1)}%</div>
        <div class="fc-conv">${convCell}${dropCell}</div>
      </div>`;
  });

  $('#funnel-wrap').innerHTML = `
    <div id="funnel-chart" class="echart-box"></div>
    <div class="funnel-caption">各环节宽度按量级等比收缩 · <b style="color:#1f9e6b">绿</b>=超标 / <b style="color:#d99a00">黄</b>=基准内 / <b style="color:#e5484d">红</b>=低于基准</div>
    <div class="funnel-table">${rows}</div>`;

  // ECharts 漏斗
  renderFunnelChart(d, rates);

  const overall = pct(d.finish, d.exposure);
  $('#funnel-overall').textContent = `整体转化率（曝光→完成）：${overall.toFixed(2)}%`;

  $('#btn-bench').disabled = false;
  $('#btn-plans').disabled = false;

  if (state.locked) {
    $('#lock-badge').classList.add('show');
    toast('✦ 微课案例已锁定：方案与模拟结果硬编码固定', 'info');
  } else {
    toast(COPY.tips.funnelDone, 'info');
  }
}

function renderFunnelChart(d, rates) {
  const el = document.getElementById('funnel-chart');
  if (!el || typeof echarts === 'undefined') return;
  let chart = echarts.getInstanceByDom(el);
  if (!chart) chart = registerChart('funnel', echarts.init(el));

  const range = BENCHMARK[state.category];
  const data = FUNNEL_STAGES.map((st, i) => {
    const color = i < FUNNEL_STAGES.length - 1
      ? HEALTH_COLOR[healthOf(rates[CONV_STEPS[i].key], range[CONV_STEPS[i].key])]
      : HEALTH_COLOR.neutral;
    return { name: st.label, value: d[st.key], itemStyle: { color } };
  });

  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${p.name}<br/>${fmt(p.value)} 人（占曝光 ${(p.value / d.exposure * 100).toFixed(1)}%）`
    },
    series: [{
      type: 'funnel',
      top: 8, bottom: 8, left: '6%', width: '88%',
      min: 0, max: d.exposure, minSize: '10%', maxSize: '100%',
      sort: 'none', gap: 2,
      label: {
        show: true, position: 'inside', color: '#fff', fontSize: 12,
        formatter: (p) => `${p.name}  ${fmt(p.value)}`
      },
      labelLine: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      emphasis: { label: { fontSize: 13, fontWeight: 'bold' } },
      data
    }]
  }, true);
}

/* ---------- 2. 行业基准对标（含「漏斗图对比」可视化） ---------- */
function buildBenchmark() {
  if (!state.funnelBuilt) return toast('请先生成漏斗图', 'error');
  const range = BENCHMARK[state.category];
  const rates = {};
  CONV_STEPS.forEach((s) => (rates[s.key] = pct(state.data[s.to], state.data[s.from])));

  // 对标表
  let rows = '';
  CONV_STEPS.forEach((s) => {
    const r = rates[s.key];
    const h = healthOf(r, range[s.key]);
    const low = range[s.key][0], up = range[s.key][1];
    const diff = r - (r >= up ? up : low);
    const diffTxt = (r >= up ? '+' : '') + diff.toFixed(1) + 'pt';
    rows += `<tr class="${h}">
        <td class="c-step">${s.label}</td>
        <td class="c-val">${r.toFixed(1)}%</td>
        <td class="c-range">${low}%–${up}%</td>
        <td class="c-health">${hdot(h)}<span>${HEALTH_META[h].text}</span></td>
        <td class="c-diff">${diffTxt}</td>
      </tr>`;
  });

  $('#benchmark-wrap').innerHTML = `
    <div class="card-title">📊 行业基准对标 · <b>${state.category}</b></div>
    <div id="bench-chart" class="echart-box echart-box--sm"></div>
    <p class="bench-note-title">本店各环节转化率 vs 行业基准区间（浅紫带）</p>
    <table class="bench-table">
      <thead><tr><th>转化环节</th><th>本店</th><th>行业基准</th><th>健康度</th><th>偏差</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="bench-note">
      ${hdot('good')} 超标（≥上限）
      ${hdot('mid')} 在基准内
      ${hdot('low')} 低于基准（<下限）。
      ${COPY.switchHint(state.category)}。
    </p>`;

  renderBenchChart(range, rates);

  state.benchmarkBuilt = true;
  $('#btn-compare').disabled = false;
  toast(COPY.tips.benchmarkDone, 'info');
}

/* 漏斗图对比：你的转化率柱状 vs 行业基准区间带 */
function renderBenchChart(range, rates) {
  const el = document.getElementById('bench-chart');
  if (!el || typeof echarts === 'undefined') return;
  let chart = echarts.getInstanceByDom(el);
  if (!chart) chart = registerChart('bench', echarts.init(el));

  const cats = CONV_STEPS.map((s) => s.label);
  const yourArr = CONV_STEPS.map((s) => ({
    value: +rates[s.key].toFixed(1),
    itemStyle: { color: HEALTH_COLOR[healthOf(rates[s.key], range[s.key])] }
  }));
  const markAreaData = CONV_STEPS.map((s, i) => [
    { xAxis: i, yAxis: range[s.key][0] },
    { xAxis: i, yAxis: range[s.key][1] }
  ]);

  chart.setOption({
    grid: { left: 38, right: 14, top: 30, bottom: 46 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => v + '%' },
    legend: {
      data: ['行业基准区间', '你的转化率'],
      top: 0, textStyle: { fontSize: 11, color: '#6b7090' }, itemWidth: 14, itemHeight: 8
    },
    xAxis: {
      type: 'category', data: cats,
      axisLabel: { fontSize: 10, color: '#6b7090', interval: 0, rotate: 18 },
      axisLine: { lineStyle: { color: '#dcdfee' } }
    },
    yAxis: {
      type: 'value', max: 100,
      axisLabel: { fontSize: 10, color: '#9aa0b5', formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#eef0f6' } }
    },
    series: [
      {
        name: '你的转化率', type: 'bar', barWidth: 22, data: yourArr,
        label: { show: true, position: 'top', fontSize: 10, color: '#3a3f5c', formatter: (p) => p.value + '%' },
        markArea: {
          silent: true, itemStyle: { color: 'rgba(106,123,255,.14)' },
          data: markAreaData,
          label: { show: false }
        }
      },
      {
        name: '行业基准区间', type: 'bar', barWidth: 0, data: CONV_STEPS.map(() => 0),
        itemStyle: { color: 'rgba(106,123,255,.14)' },
        tooltip: { show: false }
      }
    ]
  }, true);
}

/* ---------- 3. 下钻诊断 · 痛点词云 ---------- */
function buildDrill() {
  if (!state.funnelBuilt) return toast('请先生成漏斗图', 'error');
  const range = BENCHMARK[state.category];
  const rates = {};
  CONV_STEPS.forEach((s) => (rates[s.key] = pct(state.data[s.to], state.data[s.from])));

  // 诊断卡片（全环节）
  const cards = CONV_STEPS.map((s) => {
    const dg = diagnoseStep(s.key, rates[s.key], range[s.key], state.category);
    return `<div class="drill-card ${dg.health}">
        <div class="drill-top">
          <span class="drill-step">${s.label}</span>
          <span class="drill-rate">${rates[s.key].toFixed(1)}%</span>
        </div>
        <div class="drill-h">${hdot(dg.health)} ${HEALTH_META[dg.health].text}</div>
        <p class="drill-text">${dg.text}</p>
      </div>`;
  }).join('');

  // 最弱环节（基准下限以下且缺口最大；否则取转化率最低）
  let weakest = CONV_STEPS[0];
  let worstGap = -Infinity;
  CONV_STEPS.forEach((s) => {
    const h = healthOf(rates[s.key], range[s.key]);
    const gap = h === 'low' ? (range[s.key][0] - rates[s.key]) : (h === 'mid' ? 0 : 1);
    if (gap > worstGap) { worstGap = gap; weakest = s; }
  });
  const weakWords = (PAIN_WORDS[weakest.key] || []).map(([name, value]) => ({ name, value }));

  $('#drill-wrap').innerHTML = `
    <div class="card-title">🔍 下钻诊断 · 重点环节：<b>${weakest.label}</b></div>
    <div class="drill-cards">${cards}</div>
    <div class="drill-cloud-title">「${weakest.label}」可能瓶颈 · 痛点词云</div>
    <div id="drill-chart" class="echart-box echart-box--cloud"></div>`;

  renderWordCloud(weakWords);

  state.drillBuilt = true;
  toast('下钻完成：点击上方卡片查看环节诊断，词云定位瓶颈原因', 'info');
}

function renderWordCloud(words) {
  const el = document.getElementById('drill-chart');
  if (!el || typeof echarts === 'undefined') return;
  let chart = echarts.getInstanceByDom(el);
  if (!chart) chart = registerChart('drill', echarts.init(el));

  const colors = ['#6a7bff', '#e5484d', '#d99a00', '#1f9e6b', '#8a5cf6', '#2bb6c4', '#ef7d57'];
  chart.setOption({
    tooltip: { show: true, formatter: (p) => `${p.name}（权重 ${p.value}）` },
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      left: 'center', top: 'center', width: '96%', height: '92%',
      sizeRange: [14, 40], rotationRange: [0, 0], gridSize: 8,
      drawOutOfBound: false,
      textStyle: { color: () => colors[Math.floor(Math.random() * colors.length)] },
      emphasis: { textStyle: { fontWeight: 'bold' } },
      data: words
    }]
  }, true);
}

/* ---------- 4. 智能推荐方案 ---------- */
function buildPlans() {
  if (!state.funnelBuilt) return toast('请先生成漏斗图', 'error');
  const plans = PLANS[state.category];

  let cards = '';
  plans.forEach((p) => {
    const bestCls = p.best ? ' best' : '';
    const sign = (n) => (n >= 0 ? '+' : '');
    cards += `<div class="plan-card${bestCls}" data-key="${p.key}">
        <div class="plan-head">
          <span class="plan-key">${p.key}</span>
          <span class="plan-name">${p.name}</span>
          ${p.best ? '<span class="plan-star">⭐ 最优</span>' : ''}
        </div>
        <div class="plan-metrics">
          <div class="pm"><span class="pm-l">支付率预测</span><span class="pm-v">${p.payRate}%</span></div>
          <div class="pm"><span class="pm-l">GMV变动</span><span class="pm-v ${p.gmv >= 0 ? 'up' : 'down'}">${sign(p.gmv)}${p.gmv}%</span></div>
          <div class="pm"><span class="pm-l">利润变动</span><span class="pm-v ${p.profit >= 0 ? 'up' : 'down'}">${sign(p.profit)}${p.profit}%</span></div>
        </div>
        <div class="plan-tag">${p.tag}</div>
        ${p.extra ? `<div class="plan-extra">${p.extra}</div>` : ''}
        <details class="plan-logic"><summary>测算逻辑</summary><p>${p.logic}</p></details>
      </div>`;
  });

  $('#plans-wrap').innerHTML = `
    <div class="card-title">💡 智能推荐方案 · <b>${state.category}</b>${state.locked ? '（已锁定）' : ''}</div>
    <div class="plan-grid">${cards}</div>`;

  state.plansBuilt = true;
  $('#btn-compare').disabled = false;
  toast(COPY.tips.plansReady, 'info');
}

/* ---------- 5. 一键模拟对比 ---------- */
function simulate() {
  if (!state.plansBuilt) return toast('请先获取智能推荐方案', 'error');
  const plans = PLANS[state.category];

  let bestKey = plans.find((p) => p.best)?.key || plans[0].key;

  let cards = '';
  plans.forEach((p) => {
    const isBest = p.key === bestKey;
    const sign = (n) => (n >= 0 ? '+' : '');
    cards += `<div class="cmp-card${isBest ? ' best' : ''}">
        <div class="cmp-head">
          <span class="cmp-key">${p.key}</span>
          <span class="cmp-name">${p.name}</span>
        </div>
        <div class="cmp-pay">支付率 <b>${p.payRate}%</b></div>
        <div class="cmp-row"><span>GMV</span><b class="${p.gmv >= 0 ? 'up' : 'down'}">${sign(p.gmv)}${p.gmv}%</b></div>
        <div class="cmp-row"><span>利润</span><b class="${p.profit >= 0 ? 'up' : 'down'}">${sign(p.profit)}${p.profit}%</b></div>
        <div class="cmp-tag">${p.tag}</div>
        ${isBest ? '<div class="cmp-best-flag">✅ 最优解</div>' : ''}
        <details class="plan-logic"><summary>测算逻辑</summary><p>${p.logic}</p></details>
      </div>`;
  });

  $('#compare-wrap').innerHTML = `
    <div class="card-title">🆚 四方案模拟对比 · <b>${state.category}</b></div>
    <div class="cmp-grid">${cards}</div>`;

  state.simulated = true;
  toast(COPY.tips.simulateDone, 'info');
}

/* ---------- 数据管理（导入 / 导出 / 一键更新 / 恢复默认） ---------- */

/* 重建品类 chips（导入后品类可能变化） */
function renderCategoryChips() {
  const chipWrap = $('#cat-chips');
  chipWrap.innerHTML = CATEGORIES.map(
    (c) => `<button class="cat-chip" data-cat="${c}">${c}</button>`
  ).join('');
}

/* 配置变化后的统一收尾：重建 chips、校正当前品类、清空失效结果、刷新状态徽标 */
function afterConfigChange() {
  renderCategoryChips();
  if (!CATEGORIES.includes(state.category)) state.category = CATEGORIES[0];
  setCategoryUI(state.category);
  resetDownstream('soft'); // 基准/方案变了，旧的下游结果失效
  updateDataSourceBadge();
}

/* 应用一份导入的原始配置，并持久化 */
function applyImportedConfig(raw, meta) {
  const res = applyConfig(raw);
  if (!res.ok) {
    toast('导入失败：' + res.errors.join('；'), 'error');
    return false;
  }
  saveStoredConfig(meta);
  afterConfigChange();
  let msg = '✅ 已导入并更新基准 / 方案数据';
  if (res.warnings.length) msg += `（${res.warnings.length} 处格式异常已回退默认）`;
  toast(msg, 'info');
  return true;
}

/* 导出当前配置为 benchmark.json 文件下载 */
function exportCurrent() {
  const data = exportConfig({ source: '手动导出', updatedAt: new Date().toISOString().slice(0, 10) });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'benchmark.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已导出 benchmark.json（可编辑后回传或部署到 Pages）', 'info');
}

/* 从本地文件导入 */
function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(reader.result);
      applyImportedConfig(raw, {
        source: '文件导入', fileName: file.name, updatedAt: new Date().toISOString().slice(0, 10)
      });
    } catch (e) {
      toast('JSON 解析失败：' + e.message, 'error');
    }
  };
  reader.readAsText(file);
}

/* 一键从 URL 拉取最新基准（适配 Cloudflare Pages 静态托管） */
async function fetchAndApply(url) {
  if (!url) return toast('请填写更新地址', 'error');
  toast('正在从 ' + url + ' 拉取最新基准…', 'info');
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    applyImportedConfig(raw, { source: '一键更新', url, updatedAt: new Date().toISOString().slice(0, 10) });
  } catch (e) {
    toast('更新失败：' + e.message + '（检查地址是否正确、文件是否允许跨域）', 'error');
  }
}

/* 恢复内置默认 */
function resetConfig() {
  resetToDefault();
  clearStoredConfig();
  afterConfigChange();
  toast('已恢复内置默认（规格书 v1.0）', 'info');
}

/* 刷新数据源状态徽标与说明文字 */
function updateDataSourceBadge() {
  const badge = $('#src-badge');
  const note = $('#dm-note');
  const stored = loadStoredConfig();
  if (stored && stored.meta) {
    const m = stored.meta;
    const label = m.fileName ? '已导入 · ' + m.fileName : '已导入';
    badge.textContent = label;
    badge.classList.add('imported');
    note.textContent = `数据来源：已导入（${m.source || ''}，更新于 ${m.updatedAt || m.savedAt || '—'}）。点「恢复内置默认」可还原规格书 v1.0 数据。`;
  } else {
    badge.textContent = '内置默认';
    badge.classList.remove('imported');
    note.textContent = '数据来源：内置默认（规格书 v1.0）。部署到 Cloudflare Pages 后，把修改后的 benchmark.json 提交到仓库根目录，点「一键更新」即可同步。';
  }
}

/* ---------- 初始化 ---------- */
function init() {
  // 载入持久化的外部配置（如有），失败则清除
  const stored = loadStoredConfig();
  if (stored) {
    const r = applyConfig(stored.config);
    if (!r.ok) clearStoredConfig();
  }
  if (!CATEGORIES.includes(state.category)) state.category = CATEGORIES[0];

  renderCategoryChips();
  $('#cat-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-chip');
    if (btn) onSelectCategory(btn.dataset.cat);
  });

  setCategoryUI(state.category);
  updateDataSourceBadge();

  $('#btn-bench').disabled = true;
  $('#btn-plans').disabled = true;
  $('#btn-compare').disabled = true;

  $('#btn-funnel').addEventListener('click', buildFunnel);
  $('#btn-bench').addEventListener('click', buildBenchmark);
  $('#btn-drill').addEventListener('click', buildDrill);
  $('#btn-plans').addEventListener('click', buildPlans);
  $('#btn-compare').addEventListener('click', simulate);
  $('#btn-course').addEventListener('click', fillCourseData);
  $('#btn-reset').addEventListener('click', () => {
    FUNNEL_STAGES.forEach((s) => ($(`#in-${s.key}`).value = ''));
    resetDownstream('soft');
    toast('已清空，请重新输入数据', 'info');
  });

  // 数据管理：导出 / 导入文件 / 一键更新 / 恢复默认
  $('#btn-export').addEventListener('click', exportCurrent);
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) importFromFile(f);
    e.target.value = '';
  });
  $('#btn-reset-config').addEventListener('click', resetConfig);
  $('#btn-fetch-update').addEventListener('click', () => fetchAndApply($('#update-url').value.trim()));

  $('#welcome').textContent = COPY.welcome;
  $('#disclaimer').textContent = COPY.disclaimer;

  // ECharts 自适应
  window.addEventListener('resize', () => {
    Object.values(charts).forEach((c) => c && c.resize());
  });
}

document.addEventListener('DOMContentLoaded', init);
