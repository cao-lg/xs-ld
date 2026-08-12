/* ============================================================
 * RFM 客户分群 · 交互逻辑（课程工具基座版）
 * ------------------------------------------------------------
 * 6 步：
 *   ① 客户数据 ② RFM 评分 ③ 客户分群散点 ④ 分群规模 ⑤ 分群价值 ⑥ 误区词云
 * 计算：五分位打分(R/F/M) → 8 类标准客户群映射 → 散点 / 规模 / 价值。
 * 图表用 ECharts（含 wordcloud 扩展）。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 当前生效配置（从 localStorage 或默认初始化） ---------- */
  function loadInitialConfig() {
    var stored = ENGINE.loadStored();
    var base = (stored && stored.config) ? stored.config : ENGINE.getDefaults();
    return ENGINE.validate(base).cfg;
  }
  var RFM_CONFIG = loadInitialConfig();

  /* ---------- 全局状态 ---------- */
  var state = {
    customers: [],
    hasData: false,
    scored: null,
    segCounts: null,
    built: { scores: false, scatter: false, scale: false, value: false, cloud: false }
  };

  /* ---------- 工具 ---------- */
  function $sel(s) { return document.querySelector(s); }
  function $id(id) { return document.getElementById(id); }
  function fmt(n) { return (n == null ? '—' : Number(Math.round(n)).toLocaleString('zh-CN')); }
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
    ['rfm-table-wrap', 'rfm-scatter-wrap', 'rfm-scale-wrap', 'rfm-value-wrap', 'rfm-cloud-wrap']
      .forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    state.built = { scores: false, scatter: false, scale: false, value: false, cloud: false };
    state.scored = null; state.segCounts = null;
    ['rfm-scores', 'rfm-scatter', 'rfm-scale', 'rfm-value', 'rfm-cloud'].forEach(function (id) { $id(id).disabled = true; });
  }

  /* ---------- 计算：评分与分群 ---------- */
  function scoreMetric(values, higherBetter, levels) {
    var n = values.length;
    var order = values.map(function (v, i) { return { v: v, i: i }; })
      .sort(function (a, b) { return a.v - b.v; });
    var scores = new Array(n);
    for (var s = 1; s <= levels; s++) {
      var lo = Math.floor((s - 1) * n / levels);
      var hi = Math.floor(s * n / levels);
      for (var k = lo; k < hi; k++) scores[order[k].i] = s;
    }
    if (scores[order[n - 1].i] == null) scores[order[n - 1].i] = levels;
    if (!higherBetter) return scores.map(function (x) { return levels - x + 1; });
    return scores;
  }
  /* 8 类标准客户群：R/F/M 各取 高(≥4)/低(≤3) 的 2³ 全组合，互斥且必覆盖 */
  function rfmSegment(r, f, m) {
    var Rh = r >= 4, Fh = f >= 4, Mh = m >= 4;
    if (Rh && Fh && Mh) return '重要价值客户';
    if (!Rh && Fh && Mh) return '重要挽留客户';
    if (Rh && !Fh && Mh) return '重要发展客户';
    if (!Rh && !Fh && Mh) return '一般保持客户';
    if (Rh && Fh && !Mh) return '潜力价值客户';
    if (!Rh && Fh && !Mh) return '一般发展客户';
    if (Rh && !Fh && !Mh) return '新客培育客户';
    return '一般挽留客户';
  }
  function computeScores() {
    var L = (RFM_CONFIG.scoring && RFM_CONFIG.scoring.levels) || 5;
    var R = state.customers.map(function (c) { return c.recency; });
    var F = state.customers.map(function (c) { return c.frequency; });
    var M = state.customers.map(function (c) { return c.monetary; });
    var rs = scoreMetric(R, false, L); // 越小越优
    var fs = scoreMetric(F, true, L);
    var ms = scoreMetric(M, true, L);
    var scored = state.customers.map(function (c, i) {
      var seg = rfmSegment(rs[i], fs[i], ms[i]);
      return { name: c.name, recency: c.recency, frequency: c.frequency, monetary: c.monetary,
        rs: rs[i], fs: fs[i], ms: ms[i], seg: seg };
    });
    var counts = {};
    RFM_CONFIG.segments.forEach(function (s) { counts[s.label] = 0; });
    scored.forEach(function (c) { counts[c.seg] = (counts[c.seg] || 0) + 1; });
    return { scored: scored, counts: counts };
  }

  /* ---------- UI 初始化 ---------- */
  function setWelcome() { var w = $id('rfm-welcome'); if (w) w.textContent = RFM_CONFIG.copy.welcome; }
  function setDisclaimer() { var d = $id('rfm-disclaimer'); if (d) d.textContent = RFM_CONFIG.copy.disclaimer; }

  function initUI() {
    setWelcome(); setDisclaimer();
    $id('rfm-apply').addEventListener('click', applyInput);
    $id('rfm-load').addEventListener('click', loadBuiltin);
    $id('rfm-scores').addEventListener('click', buildScores);
    $id('rfm-scatter').addEventListener('click', buildScatter);
    $id('rfm-scale').addEventListener('click', buildScale);
    $id('rfm-value').addEventListener('click', buildValue);
    $id('rfm-cloud').addEventListener('click', buildCloud);
    window.addEventListener('resize', function () { Object.keys(charts).forEach(function (id) { if (charts[id]) charts[id].resize(); }); });
    CourseKit.mountDataManager({
      engine: ENGINE,
      getConfig: function () { return RFM_CONFIG; },
      onApply: function (cfg) { RFM_CONFIG = cfg; setWelcome(); setDisclaimer(); resetAnalysis(); },
      defaultUrl: './rfm-config.json', editorUrl: 'rfm-editor.html', downloadName: 'rfm-config.json',
      ids: { srcBadge: 'src-badge', btnExport: 'btn-export', btnImport: 'btn-import', fileImport: 'file-import', btnReset: 'btn-reset-config', updateUrl: 'update-url', btnFetch: 'btn-fetch-update', note: 'dm-note' }
    });
  }

  function loadBuiltin() {
    var data = RFM_CONFIG.customers.map(function (c) { return [c.name, c.recency, c.frequency, c.monetary]; });
    var ta = $id('rfm-input'); if (ta) ta.value = data.map(function (r) { return r.join(','); }).join('\n');
    toast('已载入内置示例（' + data.length + ' 位客户），点「应用数据」生效', 'info');
  }

  function applyInput() {
    var ta = $id('rfm-input');
    var lines = ta.value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var list = [];
    for (var i = 0; i < lines.length; i++) {
      var parts = lines[i].split(/[,，\t]+/).map(function (x) { return x.trim(); });
      if (parts.length < 4) continue;
      var rec = parseFloat(parts[1]), fre = parseFloat(parts[2]), mon = parseFloat(parts[3]);
      if (!isFinite(rec) || !isFinite(fre) || !isFinite(mon)) continue;
      list.push({ name: parts[0] || ('客户' + (i + 1)), recency: rec, frequency: fre, monetary: mon });
    }
    if (list.length < 2) return toast('请至少输入 2 位有效客户（姓名,最近天数,频次,金额）', 'error');
    state.customers = list; state.hasData = true;
    state.built = { scores: false, scatter: false, scale: false, value: false, cloud: false };
    ['rfm-table-wrap', 'rfm-scatter-wrap', 'rfm-scale-wrap', 'rfm-value-wrap', 'rfm-cloud-wrap'].forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    ['rfm-scores', 'rfm-scatter', 'rfm-scale', 'rfm-value', 'rfm-cloud'].forEach(function (id) { $id(id).disabled = true; });
    toast(RFM_CONFIG.copy.tips.dataReady + '（共 ' + list.length + ' 位）', 'info');
    $id('rfm-scores').disabled = false;
  }

  /* ---------- ② RFM 评分 ---------- */
  function buildScores() {
    if (!state.hasData) return toast('请先应用客户数据', 'error');
    var res = computeScores();
    state.scored = res.scored; state.segCounts = res.counts; state.built.scores = true;
    var rows = res.scored.map(function (c) {
      return '<tr><td>' + c.name + '</td><td>' + c.recency + '</td><td>' + c.frequency + '</td><td>' + fmt(c.monetary) +
        '</td><td class="rfm-score">' + c.rs + '</td><td class="rfm-score">' + c.fs + '</td><td class="rfm-score">' + c.ms +
        '</td><td>' + c.seg + '</td></tr>';
    }).join('');
    $id('rfm-table-wrap').innerHTML =
      '<div class="rfm-table"><table><thead><tr><th>客户</th><th>R天</th><th>F次</th><th>M额</th><th>R分</th><th>F分</th><th>M分</th><th>分群</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
    toast(RFM_CONFIG.copy.tips.scored, 'ok');
    $id('rfm-scatter').disabled = false;
  }

  /* ---------- ③ 客户分群散点（F × M，颜色=分群） ---------- */
  function buildScatter() {
    if (!state.scored) return toast('请先完成 RFM 评分', 'error');
    var colorOf = {}; RFM_CONFIG.segments.forEach(function (s) { colorOf[s.label] = s.color; });
    var series = RFM_CONFIG.segments.map(function (s) {
      return {
        name: s.label, type: 'scatter',
        data: state.scored.filter(function (c) { return c.seg === s.label; }).map(function (c) {
          return { value: [c.frequency, c.monetary], name: c.name, seg: c.seg, rs: c.rs, fs: c.fs, ms: c.ms, rec: c.recency };
        }),
        symbolSize: function (val, params) { var r = params.data.rec; return 8 + Math.round((120 - r) / 120 * 18); },
        itemStyle: { color: colorOf[s.label], opacity: 0.85 }
      };
    });
    var chart = freshChart('rfm-scatter', 'rfm-scatter-wrap');
    chart.setOption({
      tooltip: { trigger: 'item', formatter: function (p) {
        var d = p.data; return d.name + '<br/>分群：<b>' + d.seg + '</b><br/>R=' + d.rs + ' F=' + d.fs + ' M=' + d.ms +
          '<br/>最近 ' + d.rec + ' 天 · 频次 ' + d.value[0] + ' · 金额 ¥' + fmt(d.value[1]);
      } },
      legend: { type: 'scroll', top: 0, textStyle: { fontSize: 11 } },
      grid: { left: 56, right: 16, top: 40, bottom: 40 },
      xAxis: { type: 'value', name: '消费频次 F', scale: true },
      yAxis: { type: 'value', name: '消费金额 M', scale: true },
      series: series
    });
    state.built.scatter = true;
    toast(RFM_CONFIG.copy.tips.segmented, 'info');
    $id('rfm-scale').disabled = false; $id('rfm-value').disabled = false;
  }

  /* ---------- ④ 分群规模（各群客户数） ---------- */
  function buildScale() {
    if (!state.segCounts) return toast('请先完成 RFM 评分', 'error');
    var labels = RFM_CONFIG.segments.map(function (s) { return s.label; });
    var colorOf = {}; RFM_CONFIG.segments.forEach(function (s) { colorOf[s.label] = s.color; });
    var data = labels.map(function (l) { return { value: state.segCounts[l] || 0, itemStyle: { color: colorOf[l] } }; });
    var chart = freshChart('rfm-scale', 'rfm-scale-wrap');
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 40, right: 16, top: 20, bottom: 70 },
      xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, rotate: 32, fontSize: 11 } },
      yAxis: { type: 'value', name: '客户数', minInterval: 1 },
      series: [{ type: 'bar', data: data, barWidth: '52%', label: { show: true, position: 'top' } }]
    });
    state.built.scale = true;
    toast(RFM_CONFIG.copy.tips.scaleDone, 'ok');
    $id('rfm-cloud').disabled = false;
  }

  /* ---------- ⑤ 分群价值（各群金额贡献） ---------- */
  function buildValue() {
    if (!state.scored) return toast('请先完成 RFM 评分', 'error');
    var labels = RFM_CONFIG.segments.map(function (s) { return s.label; });
    var colorOf = {}; RFM_CONFIG.segments.forEach(function (s) { colorOf[s.label] = s.color; });
    var total = {}, avg = {}, cnt = {};
    labels.forEach(function (l) { total[l] = 0; cnt[l] = 0; });
    state.scored.forEach(function (c) { total[c.seg] += c.monetary; cnt[c.seg] += 1; });
    labels.forEach(function (l) { avg[l] = cnt[l] ? total[l] / cnt[l] : 0; });
    var chart = freshChart('rfm-value', 'rfm-value-wrap');
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['总金额', '客均金额'], top: 0 },
      grid: { left: 56, right: 16, top: 36, bottom: 70 },
      xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, rotate: 32, fontSize: 11 } },
      yAxis: [
        { type: 'value', name: '总金额', axisLabel: { formatter: function (v) { return '¥' + (v / 1000) + 'k'; } } },
        { type: 'value', name: '客均', axisLabel: { formatter: function (v) { return '¥' + (v / 1000) + 'k'; } } }
      ],
      series: [
        { name: '总金额', type: 'bar', data: labels.map(function (l) { return { value: Math.round(total[l]), itemStyle: { color: colorOf[l] } }; }), barWidth: '52%', label: { show: true, position: 'top', formatter: function (p) { return '¥' + (p.value / 1000).toFixed(1) + 'k'; } } },
        { name: '客均金额', type: 'line', yAxisIndex: 1, data: labels.map(function (l) { return Math.round(avg[l]); }), itemStyle: { color: '#1f2440' }, symbolSize: 7 }
      ]
    });
    state.built.value = true;
    toast(RFM_CONFIG.copy.tips.valueDone, 'ok');
  }

  /* ---------- ⑥ 误区词云 ---------- */
  function buildCloud() {
    if (!RFM_CONFIG.pitfalls || !RFM_CONFIG.pitfalls.length) return toast('无误区词云数据', 'warn');
    var data = RFM_CONFIG.pitfalls.map(function (p) { return { name: p[0], value: p[1] }; });
    var chart = freshChart('rfm-cloud', 'rfm-cloud-wrap');
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

  /* ---------- 启动 ---------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initUI(); });
  else initUI();
})();
