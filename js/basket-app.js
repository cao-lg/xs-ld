/* ============================================================
 * 购物篮关联分析 · 交互逻辑（课程工具基座版）
 * ------------------------------------------------------------
 * 6 步：
 *   ① 交易数据 ② 单品/双品频次 ③ 关联规则 ④ 规则散点 ⑤ 强规则列表 ⑥ 误区词云
 * 计算：支持度 / 置信度 / 提升度（基于二项组合，教学可解释）。
 * 图表用 ECharts（含 wordcloud 扩展）。
 * ============================================================ */
(function () {
  'use strict';

  function loadInitialConfig() {
    var stored = ENGINE.loadStored();
    var base = (stored && stored.config) ? stored.config : ENGINE.getDefaults();
    return ENGINE.validate(base).cfg;
  }
  var BASKET_CONFIG = loadInitialConfig();

  var state = {
    baskets: [], hasData: false,
    freq: null, rules: null,
    built: { freq: false, rules: false, scatter: false, list: false, cloud: false, knowledge: false }
  };

  function $sel(s) { return document.querySelector(s); }
  function $id(id) { return document.getElementById(id); }
  function pct(x) { return (x * 100).toFixed(1) + '%'; }
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
    ['basket-freq-wrap', 'basket-pair-wrap', 'basket-scatter-wrap', 'basket-list-wrap', 'basket-cloud-wrap', 'basket-knowledge-wrap']
      .forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    state.built = { freq: false, rules: false, scatter: false, list: false, cloud: false, knowledge: false };
    state.baskets = []; state.rules = null; state.freq = null; state.hasData = false;
    ['basket-freq', 'basket-rules', 'basket-scatter', 'basket-list', 'basket-cloud']
      .forEach(function (id) { $id(id).disabled = true; });
  }

  /* ---------- 解析 ---------- */
  function parseItems(str) {
    return (str || '').split(/[,，、\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function loadBuiltin() {
    var lines = BASKET_CONFIG.transactions.map(function (t) { return t.label + ',' + t.items; });
    var ta = $id('basket-input'); if (ta) ta.value = lines.join('\n');
    toast('已载入内置示例（' + BASKET_CONFIG.transactions.length + ' 笔交易），点「应用数据」生效', 'info');
  }
  function applyInput() {
    var ta = $id('basket-input');
    var lines = ta.value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var baskets = [];
    for (var i = 0; i < lines.length; i++) {
      var toks = parseItems(lines[i]);
      if (toks.length < 1) continue;
      var label = 'T' + String(i + 1).padStart(2, '0');
      var items = toks;
      // 若首 token 像编号（非商品，且后续还有商品），则作为 label
      if (toks.length >= 2 && /^(t\d+|单?\d+)$/i.test(toks[0])) { label = toks[0].toUpperCase(); items = toks.slice(1); }
      if (items.length < 1) continue;
      baskets.push({ label: label, items: items });
    }
    if (baskets.length < 2) return toast('请至少输入 2 笔有效交易（每行逗号分隔的商品）', 'error');
    state.baskets = baskets; state.hasData = true;
    state.built = { freq: false, rules: false, scatter: false, list: false, cloud: false, knowledge: false };
    ['basket-freq-wrap', 'basket-pair-wrap', 'basket-scatter-wrap', 'basket-list-wrap', 'basket-cloud-wrap', 'basket-knowledge-wrap']
      .forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    ['basket-freq', 'basket-rules', 'basket-scatter', 'basket-list', 'basket-cloud']
      .forEach(function (id) { $id(id).disabled = true; });
    toast(BASKET_CONFIG.copy.tips.dataReady + '（共 ' + baskets.length + ' 笔）', 'info');
    $id('basket-freq').disabled = false;
  }

  /* ---------- 频次统计 ---------- */
  function computeFreq() {
    var N = state.baskets.length;
    var itemCount = {}, pairCount = {};
    state.baskets.forEach(function (b) {
      var uniq = Array.from(new Set(b.items));
      uniq.forEach(function (it) { itemCount[it] = (itemCount[it] || 0) + 1; });
      for (var a = 0; a < uniq.length; a++) {
        for (var c = a + 1; c < uniq.length; c++) {
          var key = [uniq[a], uniq[c]].sort().join('|');
          pairCount[key] = (pairCount[key] || 0) + 1;
        }
      }
    });
    return { N: N, itemCount: itemCount, pairCount: pairCount };
  }

  function buildFreq() {
    if (!state.hasData) return toast('请先应用交易数据', 'error');
    var f = computeFreq(); state.freq = f; state.built.freq = true;
    var items = Object.keys(f.itemCount).map(function (k) { return { name: k, count: f.itemCount[k], sup: f.itemCount[k] / f.N }; })
      .sort(function (x, y) { return y.count - x.count; }).slice(0, 12);
    var chart1 = freshChart('basket-freq', 'basket-freq-wrap');
    chart1.setOption({
      tooltip: { trigger: 'axis', formatter: function (ps) { var p = ps[0]; return p.name + '<br/>出现 ' + p.value + ' 笔 · 支持度 ' + pct(p.value / f.N); } },
      grid: { left: 56, right: 16, top: 16, bottom: 56 },
      xAxis: { type: 'category', data: items.map(function (x) { return x.name; }), axisLabel: { interval: 0, rotate: 38, fontSize: 11 } },
      yAxis: { type: 'value', name: '出现笔数', minInterval: 1 },
      series: [{ type: 'bar', data: items.map(function (x) { return x.count; }), barWidth: '52%', itemStyle: { color: '#5b6cff' }, label: { show: true, position: 'top' } }]
    });
    var pairs = Object.keys(f.pairCount).map(function (k) {
      var p = k.split('|'); return { name: p[0] + ' + ' + p[1], count: f.pairCount[k], sup: f.pairCount[k] / f.N };
    }).sort(function (x, y) { return y.count - x.count; }).slice(0, 12);
    var chart2 = freshChart('basket-pair', 'basket-pair-wrap');
    chart2.setOption({
      tooltip: { trigger: 'axis', formatter: function (ps) { var p = ps[0]; return p.name + '<br/>共现 ' + p.value + ' 笔 · 支持度 ' + pct(p.value / f.N); } },
      grid: { left: 56, right: 16, top: 16, bottom: 74 },
      xAxis: { type: 'category', data: pairs.map(function (x) { return x.name; }), axisLabel: { interval: 0, rotate: 40, fontSize: 10 } },
      yAxis: { type: 'value', name: '共现笔数', minInterval: 1 },
      series: [{ type: 'bar', data: pairs.map(function (x) { return x.count; }), barWidth: '52%', itemStyle: { color: '#1faa6b' }, label: { show: true, position: 'top' } }]
    });
    toast(BASKET_CONFIG.copy.tips.freqDone, 'ok');
    $id('basket-rules').disabled = false;
  }

  /* ---------- 关联规则 ---------- */
  function strengthLabel(lift) {
    if (lift >= 1.5) return '强关联';
    if (lift > 1) return '弱正关联';
    if (lift < 1) return '负相关';
    return '近似独立';
  }
  function computeRules() {
    var f = state.freq || computeFreq();
    var th = BASKET_CONFIG.thresholds;
    var rules = [];
    Object.keys(f.pairCount).forEach(function (key) {
      var pr = key.split('|');
      var a = pr[0], b = pr[1];
      var supAB = f.pairCount[key] / f.N;
      var supA = f.itemCount[a] / f.N, supB = f.itemCount[b] / f.N;
      if (supA <= 0 || supB <= 0) return;
      var confAB = supAB / supA, confBA = supAB / supB;
      var liftAB = confAB / supB, liftBA = confBA / supA;
      if (supAB >= th.minSupport && confAB >= th.minConfidence && liftAB >= th.minLift)
        rules.push({ ant: a, con: b, support: supAB, confidence: confAB, lift: liftAB });
      if (supAB >= th.minSupport && confBA >= th.minConfidence && liftBA >= th.minLift)
        rules.push({ ant: b, con: a, support: supAB, confidence: confBA, lift: liftBA });
    });
    rules.sort(function (x, y) { return y.lift - x.lift; });
    return rules;
  }
  function buildRules() {
    if (!state.hasData) return toast('请先应用交易数据', 'error');
    if (!state.freq) state.freq = computeFreq();
    state.rules = computeRules(); state.built.rules = true;
    toast(BASKET_CONFIG.copy.tips.rulesDone + '（命中 ' + state.rules.length + ' 条规则）', 'ok');
    $id('basket-scatter').disabled = false;
    $id('basket-list').disabled = false;
    $id('basket-cloud').disabled = false;
  }

  /* ---------- ④ 规则散点 ---------- */
  function buildScatter() {
    if (!state.rules) return toast('请先生成关联规则', 'error');
    var strong = [], weak = [], neg = [];
    state.rules.forEach(function (r) {
      var pt = { value: [r.support, r.confidence, r.lift], name: r.ant + '→' + r.con };
      if (r.lift >= 1.5) strong.push(pt); else if (r.lift > 1) weak.push(pt); else neg.push(pt);
    });
    function mk(name, data, color) {
      return { name: name, type: 'scatter', data: data, symbolSize: function (v) { return Math.max(8, Math.min(40, 8 + v[2] * 10)); },
        itemStyle: { color: color, opacity: 0.82 } };
    }
    var chart = freshChart('basket-scatter', 'basket-scatter-wrap');
    chart.setOption({
      tooltip: { trigger: 'item', formatter: function (p) { var v = p.data.value; return p.data.name + '<br/>支持度 ' + pct(v[0]) + '<br/>置信度 ' + pct(v[1]) + '<br/>提升度 ' + v[2].toFixed(2); } },
      legend: { top: 0, data: ['强关联', '弱正关联', '负相关'] },
      grid: { left: 56, right: 16, top: 36, bottom: 44 },
      xAxis: { type: 'value', name: '支持度', axisLabel: { formatter: function (v) { return (v * 100).toFixed(0) + '%'; } } },
      yAxis: { type: 'value', name: '置信度', axisLabel: { formatter: function (v) { return (v * 100).toFixed(0) + '%'; } } },
      series: [mk('强关联', strong, '#5b6cff'), mk('弱正关联', weak, '#1faa6b'), mk('负相关', neg, '#e5484d')]
    });
    state.built.scatter = true;
    toast(BASKET_CONFIG.copy.tips.scatterDone, 'info');
  }

  /* ---------- ⑤ 强关联规则列表 ---------- */
  function buildList() {
    if (!state.rules) return toast('请先生成关联规则', 'error');
    var rows = state.rules.map(function (r) {
      var cls = r.lift >= 1.5 ? 'rk-strong' : (r.lift > 1 ? 'rk-weak' : 'rk-neg');
      return '<tr class="' + cls + '"><td>' + r.ant + ' → ' + r.con + '</td><td>' + pct(r.support) + '</td><td>' + pct(r.confidence) +
        '</td><td>' + r.lift.toFixed(2) + '</td><td>' + strengthLabel(r.lift) + '</td></tr>';
    }).join('');
    $id('basket-list-wrap').innerHTML =
      '<div class="basket-table"><table><thead><tr><th>规则</th><th>支持度</th><th>置信度</th><th>提升度</th><th>关联强度</th></tr></thead><tbody>' +
      rows + '</tbody></table></div>';
    state.built.list = true;
    toast(BASKET_CONFIG.copy.tips.listDone, 'ok');
  }

  /* ---------- ⑥ 误区词云 ---------- */
  function buildCloud() {
    if (!BASKET_CONFIG.pitfalls || !BASKET_CONFIG.pitfalls.length) return toast('无误区词云数据', 'warn');
    var data = BASKET_CONFIG.pitfalls.map(function (p) { return { name: p[0], value: p[1] }; });
    var chart = freshChart('basket-cloud', 'basket-cloud-wrap');
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

  /* ---------- ⑦ 课堂知识点注解 ---------- */
  function buildKnowledge() {
    var list = (BASKET_CONFIG.knowledge || []).filter(function (k) { return k && k.title; });
    if (!list.length) return toast('暂无课堂知识点', 'warn');
    var html = list.map(function (k, i) {
      return '<div class="kp-card"><div class="kp-title">' + (i + 1) + '. ' + esc(k.title) + '</div><div class="kp-body">' + esc(k.body) + '</div></div>';
    }).join('');
    $id('basket-knowledge-wrap').innerHTML = html;
    state.built.knowledge = true;
    toast('已展开 ' + list.length + ' 条课堂知识点', 'ok');
  }

  /* ---------- UI ---------- */
  function setWelcome() { var w = $id('basket-welcome'); if (w) w.textContent = BASKET_CONFIG.copy.welcome; }
  function setDisclaimer() { var d = $id('basket-disclaimer'); if (d) d.textContent = BASKET_CONFIG.copy.disclaimer; }
  function initUI() {
    setWelcome(); setDisclaimer();
    $id('basket-apply').addEventListener('click', applyInput);
    $id('basket-load').addEventListener('click', loadBuiltin);
    $id('basket-freq').addEventListener('click', buildFreq);
    $id('basket-rules').addEventListener('click', buildRules);
    $id('basket-scatter').addEventListener('click', buildScatter);
    $id('basket-list').addEventListener('click', buildList);
    $id('basket-cloud').addEventListener('click', buildCloud);
    $id('basket-knowledge').addEventListener('click', buildKnowledge);
    window.addEventListener('resize', function () { Object.keys(charts).forEach(function (id) { if (charts[id]) charts[id].resize(); }); });
    CourseKit.mountDataManager({
      engine: ENGINE,
      getConfig: function () { return BASKET_CONFIG; },
      onApply: function (cfg) { BASKET_CONFIG = cfg; setWelcome(); setDisclaimer(); resetAnalysis(); },
      defaultUrl: './basket-config.json', editorUrl: 'basket-editor.html', downloadName: 'basket-config.json',
      ids: { srcBadge: 'src-badge', btnExport: 'btn-export', btnImport: 'btn-import', fileImport: 'file-import', btnReset: 'btn-reset-config', updateUrl: 'update-url', btnFetch: 'btn-fetch-update', note: 'dm-note' }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initUI(); });
  else initUI();
})();
