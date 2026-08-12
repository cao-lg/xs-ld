/* ============================================================
 * ABC / 帕累托分析 · 交互逻辑（课程工具基座版）
 * ------------------------------------------------------------
 * 5 步：
 *   ① 商品数据 ② 排序与累计 ③ 帕累托图 ④ ABC 分类汇总 ⑤ 误区词云
 * 计算：降序排序 → 累计占比 → 按 A≤80% / B≤95% 划分类别 → 帕累托图 + 汇总。
 * 图表用 ECharts（含 wordcloud 扩展）。
 * ============================================================ */
(function () {
  'use strict';

  function loadInitialConfig() {
    var stored = ENGINE.loadStored();
    var base = (stored && stored.config) ? stored.config : ENGINE.getDefaults();
    return ENGINE.validate(base).cfg;
  }
  var ABC_CONFIG = loadInitialConfig();

  var state = {
    items: [],
    hasData: false,
    rows: null,
    built: { sorted: false, pareto: false, summary: false, cloud: false, knowledge: false }
  };

  function $id(id) { return document.getElementById(id); }
  function fmt(n) { return (n == null ? '—' : Number(Math.round(n)).toLocaleString('zh-CN')); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toast(msg, type) {
    var box = $id('toast'); if (!box) return;
    box.textContent = msg; box.className = 'toast show ' + (type || '');
    clearTimeout(toast._t); toast._t = setTimeout(function () { box.className = 'toast'; }, 2600);
  }
  var charts = {};
  function registerChart(id, chart) { charts[id] = chart; return chart; }
  function disposeChart(id) { if (charts[id]) { charts[id].dispose(); delete charts[id]; } }
  function freshChart(id, domId) { disposeChart(id); return registerChart(id, echarts.init($id(domId))); }
  function resetAnalysis() {
    Object.keys(charts).forEach(disposeChart);
    ['abc-table-wrap', 'abc-pareto-wrap', 'abc-summary-wrap', 'abc-cloud-wrap', 'abc-knowledge-wrap']
      .forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    state.built = { sorted: false, pareto: false, summary: false, cloud: false, knowledge: false };
    state.rows = null;
    ['abc-sort', 'abc-pareto', 'abc-summary', 'abc-cloud'].forEach(function (id) { $id(id).disabled = true; });
  }

  /* ---------- 计算：排序 + 累计 + 分类 ---------- */
  function computeRows() {
    var a = (ABC_CONFIG.thresholds && ABC_CONFIG.thresholds.a) || 80;
    var b = (ABC_CONFIG.thresholds && ABC_CONFIG.thresholds.b) || 95;
    var sorted = state.items.slice().sort(function (x, y) { return y.revenue - x.revenue; });
    var total = sorted.reduce(function (s, x) { return s + x.revenue; }, 0) || 1;
    var cum = 0;
    var rows = sorted.map(function (x, i) {
      cum += x.revenue;
      var pct = cum / total * 100;
      var cls = pct <= a ? 'A' : (pct <= b ? 'B' : 'C');
      return { rank: i + 1, name: x.name, revenue: x.revenue, cumPct: pct, cls: cls };
    });
    return { rows: rows, total: total, a: a, b: b };
  }
  var CLS_COLOR = { A: '#5b6cff', B: '#e0a300', C: '#b0b4c8' };

  /* ---------- UI ---------- */
  function setWelcome() { var w = $id('abc-welcome'); if (w) w.textContent = ABC_CONFIG.copy.welcome; }
  function setDisclaimer() { var d = $id('abc-disclaimer'); if (d) d.textContent = ABC_CONFIG.copy.disclaimer; }

  function initUI() {
    setWelcome(); setDisclaimer();
    $id('abc-apply').addEventListener('click', applyInput);
    $id('abc-load').addEventListener('click', loadBuiltin);
    $id('abc-sort').addEventListener('click', buildSorted);
    $id('abc-pareto').addEventListener('click', buildPareto);
    $id('abc-summary').addEventListener('click', buildSummary);
    $id('abc-cloud').addEventListener('click', buildCloud);
    $id('abc-knowledge').addEventListener('click', buildKnowledge);
    window.addEventListener('resize', function () { Object.keys(charts).forEach(function (id) { if (charts[id]) charts[id].resize(); }); });
    CourseKit.mountDataManager({
      engine: ENGINE,
      getConfig: function () { return ABC_CONFIG; },
      onApply: function (cfg) { ABC_CONFIG = cfg; setWelcome(); setDisclaimer(); resetAnalysis(); },
      defaultUrl: './abc-config.json', editorUrl: 'abc-editor.html', downloadName: 'abc-config.json',
      ids: { srcBadge: 'src-badge', btnExport: 'btn-export', btnImport: 'btn-import', fileImport: 'file-import', btnReset: 'btn-reset-config', updateUrl: 'update-url', btnFetch: 'btn-fetch-update', note: 'dm-note' }
    });
  }

  function loadBuiltin() {
    var data = ABC_CONFIG.items.map(function (x) { return [x.name, x.revenue]; });
    var ta = $id('abc-input'); if (ta) ta.value = data.map(function (r) { return r.join(','); }).join('\n');
    toast('已载入内置示例（' + data.length + ' 个商品），点「应用数据」生效', 'info');
  }

  function applyInput() {
    var ta = $id('abc-input');
    var lines = ta.value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var list = [];
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split(/[,，\t]+/).map(function (x) { return x.trim(); });
      if (parts.length < 2) continue;
      var rev = parseFloat(parts[1]);
      if (!isFinite(rev) || rev < 0) continue;
      list.push({ name: parts[0] || ('商品' + (i + 1)), revenue: rev });
    }
    if (list.length < 2) return toast('请至少输入 2 个有效商品（商品名,销售额）', 'error');
    state.items = list; state.hasData = true;
    state.built = { sorted: false, pareto: false, summary: false, cloud: false, knowledge: false };
    ['abc-table-wrap', 'abc-pareto-wrap', 'abc-summary-wrap', 'abc-cloud-wrap', 'abc-knowledge-wrap'].forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    ['abc-sort', 'abc-pareto', 'abc-summary', 'abc-cloud'].forEach(function (id) { $id(id).disabled = true; });
    toast(ABC_CONFIG.copy.tips.dataReady + '（共 ' + list.length + ' 个）', 'info');
    $id('abc-sort').disabled = false;
  }

  /* ---------- ② 排序与累计 ---------- */
  function buildSorted() {
    if (!state.hasData) return toast('请先应用商品数据', 'error');
    var res = computeRows();
    state.rows = res.rows; state.built.sorted = true;
    var rows = res.rows.map(function (r) {
      return '<tr><td>' + r.rank + '</td><td>' + r.name + '</td><td>' + fmt(r.revenue) +
        '</td><td>' + r.cumPct.toFixed(1) + '%</td><td class="abc-cls cls-' + r.cls + '">' + r.cls + '</td></tr>';
    }).join('');
    $id('abc-table-wrap').innerHTML =
      '<div class="abc-table"><table><thead><tr><th>排名</th><th>商品</th><th>销售额</th><th>累计占比</th><th>类别</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
    toast(ABC_CONFIG.copy.tips.sorted, 'ok');
    $id('abc-pareto').disabled = false;
  }

  /* ---------- ③ 帕累托图（柱=销售额，折线=累计占比，颜色=A/B/C） ---------- */
  function buildPareto() {
    if (!state.rows) return toast('请先完成排序与累计', 'error');
    var rows = state.rows;
    var names = rows.map(function (r) { return r.name; });
    var bar = rows.map(function (r) { return { value: r.revenue, itemStyle: { color: CLS_COLOR[r.cls] } }; });
    var line = rows.map(function (r) { return +r.cumPct.toFixed(2); });
    var a = ABC_CONFIG.thresholds.a, b = ABC_CONFIG.thresholds.b;
    var lastA = rows.filter(function (r) { return r.cls === 'A'; }).length - 1;
    var lastB = rows.filter(function (r) { return r.cls === 'B'; }).length - 1 + (lastA + 1);
    var chart = freshChart('abc-pareto', 'abc-pareto-wrap');
    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['销售额', '累计占比'], top: 0 },
      grid: { left: 60, right: 50, top: 36, bottom: 60 },
      xAxis: { type: 'category', data: names, axisLabel: { interval: 0, rotate: 40, fontSize: 10 } },
      yAxis: [
        { type: 'value', name: '销售额', axisLabel: { formatter: function (v) { return '¥' + (v / 1000) + 'k'; } } },
        { type: 'value', name: '累计%', max: 100, axisLabel: { formatter: '{value}%' } }
      ],
      series: [
        { name: '销售额', type: 'bar', data: bar, barWidth: '58%',
          markArea: { silent: true, itemStyle: { opacity: 0.08 },
            data: [
              [{ xAxis: 0, itemStyle: { color: CLS_COLOR.A } }, { xAxis: Math.max(0, lastA) }],
              [{ xAxis: Math.max(0, lastA) + 0.5, itemStyle: { color: CLS_COLOR.B } }, { xAxis: Math.max(0, lastB) }],
              [{ xAxis: Math.max(0, lastB) + 0.5, itemStyle: { color: CLS_COLOR.C } }, { xAxis: rows.length - 1 }]
            ] } },
        { name: '累计占比', type: 'line', yAxisIndex: 1, data: line, symbolSize: 6,
          itemStyle: { color: '#1f2440' }, lineStyle: { width: 2 },
          markLine: { silent: true, symbol: 'none', data: [
            { yAxis: a, lineStyle: { color: CLS_COLOR.A, type: 'dashed' }, label: { formatter: 'A ' + a + '%' } },
            { yAxis: b, lineStyle: { color: CLS_COLOR.B, type: 'dashed' }, label: { formatter: 'B ' + b + '%' } }
          ] } }
      ]
    });
    state.built.pareto = true;
    toast(ABC_CONFIG.copy.tips.done, 'info');
    $id('abc-summary').disabled = false;
  }

  /* ---------- ④ ABC 分类汇总 ---------- */
  function buildSummary() {
    if (!state.rows) return toast('请先完成排序与累计', 'error');
    var total = state.rows.reduce(function (s, r) { return s + r.revenue; }, 0) || 1;
    var agg = { A: { n: 0, rev: 0 }, B: { n: 0, rev: 0 }, C: { n: 0, rev: 0 } };
    state.rows.forEach(function (r) { agg[r.cls].n += 1; agg[r.cls].rev += r.revenue; });
    var rows = ['A', 'B', 'C'].map(function (c) {
      var o = agg[c];
      return '<tr><td class="abc-cls cls-' + c + '">' + c + '</td><td>' + o.n + '</td><td>' +
        (state.rows.length ? (o.n / state.rows.length * 100).toFixed(1) + '%' : '0%') + '</td><td>' + fmt(o.rev) +
        '</td><td>' + (o.rev / total * 100).toFixed(1) + '%</td></tr>';
    }).join('');
    $id('abc-summary-wrap').innerHTML =
      '<div class="abc-table"><table><thead><tr><th>类别</th><th>商品数</th><th>数量占比</th><th>销售额</th><th>金额占比</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
    state.built.summary = true;
    toast(ABC_CONFIG.copy.tips.classified, 'ok');
    $id('abc-cloud').disabled = false;
  }

  /* ---------- ⑤ 误区词云 ---------- */
  function buildCloud() {
    if (!ABC_CONFIG.pitfalls || !ABC_CONFIG.pitfalls.length) return toast('无误区词云数据', 'warn');
    var data = ABC_CONFIG.pitfalls.map(function (p) { return { name: p[0], value: p[1] }; });
    var chart = freshChart('abc-cloud', 'abc-cloud-wrap');
    chart.setOption({
      tooltip: { show: true },
      series: [{
        type: 'wordCloud', sizeRange: [14, 46], rotationRange: [-30, 30], gridSize: 8,
        shape: 'circle', width: '100%', height: '100%',
        textStyle: { color: function () { var c = ['#5b6cff', '#1faa6b', '#e0a300', '#2bb3c0', '#e5484d', '#7d5bd6']; return c[Math.floor(Math.random() * c.length)]; } },
        data: data
      }]
    });
    state.built.cloud = true;
    toast('常见误区已生成', 'info');
  }

  /* ---------- ⑥ 课堂知识点注解 ---------- */
  function buildKnowledge() {
    var list = (ABC_CONFIG.knowledge || []).filter(function (k) { return k && k.title; });
    if (!list.length) return toast('暂无课堂知识点', 'warn');
    var html = list.map(function (k, i) {
      return '<div class="kp-card"><div class="kp-title">' + (i + 1) + '. ' + esc(k.title) + '</div><div class="kp-body">' + esc(k.body) + '</div></div>';
    }).join('');
    $id('abc-knowledge-wrap').innerHTML = html;
    state.built.knowledge = true;
    toast('已展开 ' + list.length + ' 条课堂知识点', 'ok');
  }

  /* ---------- 启动 ---------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initUI(); });
  else initUI();
})();
