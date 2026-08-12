/* ============================================================
 * 电商各类指标 · 交互逻辑（课程工具基座版）
 * ------------------------------------------------------------
 * 6 步：
 *   ① 指标数据 ② 指标概览 ③ 转化漏斗 ④ 关键比率 ⑤ 雷达对标 ⑥ 误区词云
 * 计算：分组概览 / 漏斗逐级转化 / 关键比率 / 当前值 vs 基准雷达。
 * 图表用 ECharts（含 wordcloud 扩展）。
 * ============================================================ */
(function () {
  'use strict';

  function loadInitialConfig() {
    var stored = ENGINE.loadStored();
    var base = (stored && stored.config) ? stored.config : ENGINE.getDefaults();
    return ENGINE.validate(base).cfg;
  }
  var METRICS_CONFIG = loadInitialConfig();

  var state = {
    indicators: [], funnel: [], trends: [], months: [], hasData: false,
    built: { overview: false, funnel: false, ratio: false, radar: false, cloud: false, trend: false, gmv: false }
  };

  function $id(id) { return document.getElementById(id); }
  function fmtVal(v, unit) {
    if (unit === '元') return '¥' + Math.round(v).toLocaleString('zh-CN');
    if (unit === '人') return Math.round(v).toLocaleString('zh-CN') + ' 人';
    if (!unit || unit === '') {
      if (v !== 0 && Math.abs(v) < 1) return (v * 100).toFixed(1) + '%';
      return Math.round(v).toLocaleString('zh-CN');
    }
    return Math.round(v).toLocaleString('zh-CN') + ' ' + unit;
  }
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
    ['metrics-overview-wrap', 'metrics-funnel-wrap', 'metrics-ratio-wrap', 'metrics-radar-wrap', 'metrics-cloud-wrap', 'metrics-trend-wrap', 'metrics-gmv-wrap']
      .forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    state.built = { overview: false, funnel: false, ratio: false, radar: false, cloud: false, trend: false, gmv: false };
    state.indicators = []; state.funnel = []; state.trends = []; state.months = []; state.hasData = false;
    ['metrics-overview', 'metrics-funnel', 'metrics-ratio', 'metrics-radar', 'metrics-cloud', 'metrics-trend', 'metrics-gmv']
      .forEach(function (id) { $id(id).disabled = true; });
  }

  function worseWhenHigh(name) { return name === '退换货率'; }

  /* ---------- 数据 ---------- */
  function loadBuiltin() {
    var lines = METRICS_CONFIG.indicators.map(function (d) {
      return [d.name, d.category, d.value, d.unit, d.benchmark].join(',');
    });
    var ta = $id('metrics-input'); if (ta) ta.value = lines.join('\n');
    toast('已载入内置示例（' + METRICS_CONFIG.indicators.length + ' 项指标），点「应用数据」生效', 'info');
  }
  function applyInput() {
    var ta = $id('metrics-input');
    var lines = ta.value.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var list = [];
    for (var i = 0; i < lines.length; i++) {
      var p = lines[i].split(/[,，\t]+/).map(function (x) { return x.trim(); });
      if (p.length < 4) continue;
      var v = parseFloat(p[2]), bm = parseFloat(p[4]);
      if (!isFinite(v)) continue;
      list.push({ name: p[0] || ('指标' + (i + 1)), category: p[1] || '其他', value: v, unit: p[3] || '', benchmark: isFinite(bm) ? bm : v });
    }
    if (list.length < 2) return toast('请至少输入 2 项有效指标（名称,分类,当前值,单位,基准）', 'error');
    state.indicators = list;
    state.funnel = (METRICS_CONFIG.funnel || []).map(function (f) { return { step: f.step, value: f.value }; });
    state.trends = (METRICS_CONFIG.trends || []).map(function (t) {
      return { name: t.name, values: (t.values || '').split(/[,，\s]+/).map(parseFloat).filter(function (v) { return isFinite(v); }) };
    });
    state.months = (METRICS_CONFIG.months || '').split(/[,，\s]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    state.hasData = true;
    state.built = { overview: false, funnel: false, ratio: false, radar: false, cloud: false, trend: false, gmv: false };
    ['metrics-overview-wrap', 'metrics-funnel-wrap', 'metrics-ratio-wrap', 'metrics-radar-wrap', 'metrics-cloud-wrap', 'metrics-trend-wrap', 'metrics-gmv-wrap']
      .forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    ['metrics-overview', 'metrics-funnel', 'metrics-ratio', 'metrics-radar', 'metrics-cloud', 'metrics-trend', 'metrics-gmv']
      .forEach(function (id) { $id(id).disabled = true; });
    toast(METRICS_CONFIG.copy.tips.dataReady + '（共 ' + list.length + ' 项）', 'info');
    $id('metrics-overview').disabled = false; $id('metrics-funnel').disabled = false; $id('metrics-trend').disabled = false;
  }

  /* ---------- ② 指标概览 ---------- */
  function buildOverview() {
    if (!state.hasData) return toast('请先应用指标数据', 'error');
    var groups = {};
    state.indicators.forEach(function (d) { (groups[d.category] = groups[d.category] || []).push(d); });
    var colorOf = { '流量': '#5b6cff', '转化': '#1faa6b', '客单价': '#e0a300', '留存': '#2bb3c0', '营销': '#7d5bd6', '其他': '#9aa0c4' };
    var html = Object.keys(groups).map(function (cat) {
      var cards = groups[cat].map(function (d) {
        var better = worseWhenHigh(d.name) ? d.value <= d.benchmark : d.value >= d.benchmark;
        var delta = (0 < Math.abs(d.value) && Math.abs(d.value) < 1 && Math.abs(d.benchmark) < 1)
          ? ((d.value - d.benchmark) * 100).toFixed(1) + 'pp' : Math.round(d.value - d.benchmark).toLocaleString('zh-CN');
        var r = Math.max(d.benchmark, 1e-9);
        var pctCur = Math.max(2, Math.min(100, d.value / r * 50));
        var pctBm = 50;
        return '<div class="mk-card"><div class="mk-name">' + d.name + '</div>' +
          '<div class="mk-val">' + fmtVal(d.value, d.unit) + '</div>' +
          '<div class="mk-bar"><span class="mk-cur" style="width:' + pctCur + '%;background:' + (colorOf[cat] || '#5b6cff') + '"></span><span class="mk-bm" style="left:' + pctBm + '%"></span></div>' +
          '<div class="mk-meta"><span class="mk-bench">基准 ' + fmtVal(d.benchmark, d.unit) + '</span>' +
          '<span class="mk-delta ' + (better ? 'up' : 'down') + '">' + (better ? '▲' : '▼') + ' ' + delta + '</span></div></div>';
      }).join('');
      return '<div class="mk-group"><div class="mk-group-title" style="color:' + (colorOf[cat] || '#5b6cff') + '">' + cat + '</div><div class="mk-cards">' + cards + '</div></div>';
    }).join('');
    $id('metrics-overview-wrap').innerHTML = html;
    state.built.overview = true;
    toast(METRICS_CONFIG.copy.tips.overviewDone, 'ok');
    $id('metrics-ratio').disabled = false; $id('metrics-radar').disabled = false; $id('metrics-cloud').disabled = false;
  }

  /* ---------- ③ 转化漏斗 ---------- */
  function funnelVal(keyword) {
    for (var i = 0; i < state.funnel.length; i++) if (state.funnel[i].step.indexOf(keyword) >= 0) return state.funnel[i].value;
    return null;
  }
  function buildFunnel() {
    if (!state.funnel || state.funnel.length < 2) return toast('请先应用指标数据（含漏斗）', 'error');
    var data = state.funnel.map(function (f, i) {
      var rate = i === 0 ? 100 : (state.funnel[i - 1].value ? (f.value / state.funnel[i - 1].value * 100) : 0);
      return { name: f.step, value: f.value, rate: rate, abs: i === 0 ? 100 : (state.funnel[0].value ? f.value / state.funnel[0].value * 100 : 0) };
    });
    var chart = freshChart('metrics-funnel', 'metrics-funnel-wrap');
    chart.setOption({
      tooltip: { trigger: 'item', formatter: function (p) {
        var d = p.data; return d.name + '<br/>' + Math.round(d.value).toLocaleString('zh-CN') + ' 人<br/>占首环 ' + d.abs.toFixed(1) + '%' + (p.dataIndex > 0 ? '<br/>较上环 ' + d.rate.toFixed(1) + '%' : '');
      } },
      series: [{
        type: 'funnel', top: 16, bottom: 16, left: '8%', width: '84%', minSize: '24%',
        label: { formatter: function (p) { var d = p.data; return d.name + ' ' + Math.round(d.value).toLocaleString('zh-CN') + (p.dataIndex > 0 ? ' (' + d.rate.toFixed(0) + '%)' : ''); }, fontSize: 12 },
        data: data
      }]
    });
    state.built.funnel = true;
    toast(METRICS_CONFIG.copy.tips.funnelDone, 'info');
  }

  /* ---------- ④ 关键比率 ---------- */
  function buildRatio() {
    if (!state.hasData) return toast('请先应用指标数据', 'error');
    var uv = funnelVal('访客') || (state.funnel[0] && state.funnel[0].value) || 0;
    var cart = funnelVal('加购'); var order = funnelVal('下单'); var pay = funnelVal('支付');
    function ind(name) { for (var i = 0; i < state.indicators.length; i++) if (state.indicators[i].name === name) return state.indicators[i]; return null; }
    var gmv = ind('GMV'); var repurchase = ind('复购率');
    var rows = [];
    function row(name, cur, bm, unit, goodHigh) {
      var better = (goodHigh === false) ? cur <= bm : cur >= bm;
      var curS = (unit === '%') ? (cur * 100).toFixed(1) + '%' : Math.round(cur).toLocaleString('zh-CN');
      var bmS = (bm == null) ? '—' : (unit === '%' ? (bm * 100).toFixed(1) + '%' : Math.round(bm).toLocaleString('zh-CN'));
      rows.push('<tr class="' + (better ? 'rk-ok' : 'rk-no') + '"><td>' + name + '</td><td>' + curS + '</td><td>' + bmS + '</td><td>' + (better ? '达标' : '偏低') + '</td></tr>');
    }
    if (cart != null && uv) row('加购率（加购/UV）', cart / uv, ind('加购率') && ind('加购率').benchmark, '%', true);
    if (pay != null && uv) row('支付转化率（支付/UV）', pay / uv, ind('支付转化率') && ind('支付转化率').benchmark, '%', true);
    if (pay != null && order) row('下单支付率（支付/下单）', pay / order, null, '%', true);
    if (gmv && pay) row('客单价（GMV/支付）', gmv.value / pay, ind('客单价') && ind('客单价').benchmark, '元', true);
    if (repurchase) row('复购率', repurchase.value, repurchase.benchmark, '%', true);
    $id('metrics-ratio-wrap').innerHTML =
      '<div class="mk-table"><table><thead><tr><th>关键比率</th><th>计算值</th><th>基准值</th><th>评价</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
    state.built.ratio = true;
    toast(METRICS_CONFIG.copy.tips.ratioDone, 'ok');
  }

  /* ---------- ⑤ 雷达对标 ---------- */
  function buildRadar() {
    if (!state.hasData) return toast('请先应用指标数据', 'error');
    var names = state.indicators.map(function (d) { return d.name; });
    var cur = [], bm = [], mx = [];
    state.indicators.forEach(function (d) {
      var m = Math.max(Math.abs(d.value), Math.abs(d.benchmark), 1e-9);
      mx.push(m); cur.push(d.value / m); bm.push(d.benchmark / m);
    });
    var indicator = names.map(function (n, i) { return { name: n, max: 1 }; });
    var chart = freshChart('metrics-radar', 'metrics-radar-wrap');
    chart.setOption({
      tooltip: { show: true },
      legend: { data: ['当前值', '行业基准'], top: 0 },
      radar: { indicator: indicator, radius: '62%', center: ['50%', '56%'], splitNumber: 4,
        axisName: { fontSize: 10 }, splitArea: { areaStyle: { color: ['#fafbff', '#f2f4fb'] } } },
      series: [{ type: 'radar', data: [
        { value: cur, name: '当前值', itemStyle: { color: '#5b6cff' }, areaStyle: { opacity: 0.18 } },
        { value: bm, name: '行业基准', itemStyle: { color: '#9aa0c4' }, lineStyle: { type: 'dashed' } }
      ] }]
    });
    state.built.radar = true;
    toast(METRICS_CONFIG.copy.tips.radarDone, 'info');
  }

  /* ---------- ⑦ 指标趋势与同环比 ---------- */
  function trendByName(n) { for (var i = 0; i < state.trends.length; i++) if (state.trends[i].name === n) return state.trends[i].values; return null; }
  function isRateName(n) { return n.indexOf('率') >= 0; }
  function fmtTrendVal(name, v) {
    if (isRateName(name)) return (v * 100).toFixed(2) + '%';
    if (name === 'GMV(派生)') return '¥' + Math.round(v).toLocaleString('zh-CN');
    if (name === '访客数 UV') return Math.round(v).toLocaleString('zh-CN') + ' 人';
    if (name === '客单价') return '¥' + Math.round(v).toLocaleString('zh-CN');
    if (Math.abs(v) >= 1000 || v === 0) return Math.round(v).toLocaleString('zh-CN');
    return (Math.round(v * 100) / 100).toLocaleString('zh-CN');
  }
  function buildTrend() {
    if (!state.trends || !state.trends.length) return toast('请先应用指标数据（含趋势）', 'error');
    var months = state.months.length ? state.months : state.trends[0].values.map(function (_, i) { return 'M' + (i + 1); });
    var uv = trendByName('访客数 UV'), cvr = trendByName('支付转化率'), aov = trendByName('客单价');
    var gmv = (uv && cvr && aov && uv.length === cvr.length && cvr.length === aov.length)
      ? uv.map(function (v, i) { return +(v * cvr[i] * aov[i]).toFixed(0); }) : null;
    var series = state.trends.slice();
    if (gmv) series = series.concat([{ name: 'GMV(派生)', values: gmv }]);
    var palette = ['#5b6cff', '#1faa6b', '#e0a300', '#2bb3c0', '#e5484d', '#7d5bd6', '#3a7bd5', '#1faa6b'];
    var lineSeries = series.map(function (s, idx) {
      var base = s.values[0] || 1;
      return {
        name: s.name, type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
        lineStyle: { width: s.name === 'GMV(派生)' ? 3 : 1.6 },
        itemStyle: { color: palette[idx % palette.length] },
        data: s.values.map(function (v) { return +((v / base) * 100).toFixed(1); })
      };
    });
    var wrap = $id('metrics-trend-wrap');
    wrap.innerHTML = '<div class="metrics-chart" id="metrics-trend-chart"></div>';
    var chart = freshChart('metrics-trend', 'metrics-trend-chart');
    chart.setOption({
      tooltip: { trigger: 'axis', formatter: function (ps) {
        var lines = [ps[0].axisValue];
        ps.forEach(function (p) {
          var raw = series[p.seriesIndex].values[p.dataIndex];
          lines.push(p.marker + p.seriesName + '：' + fmtTrendVal(series[p.seriesIndex].name, raw) + '（指数 ' + p.data + '）');
        });
        return lines.join('<br/>');
      } },
      legend: { type: 'scroll', top: 0, textStyle: { fontSize: 11 } },
      grid: { left: 44, right: 16, top: 40, bottom: 28 },
      xAxis: { type: 'category', data: months, axisLabel: { fontSize: 10, interval: 0, rotate: months.length > 8 ? 38 : 0 } },
      yAxis: { type: 'value', name: '指数(首月=100)', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10 } },
      series: lineSeries
    });
    var rows = series.map(function (s) {
      var v = s.values, n = v.length;
      var last = v[n - 1], prev = v[n - 2], first = v[0];
      var hb = prev ? last / prev - 1 : 0;
      var cum = first ? last / first - 1 : 0;
      var lowBetter = (s.name === '退换货率');
      var rate = isRateName(s.name);
      var f = function (x) { return rate ? (x * 100).toFixed(1) + '%' : Math.round(x).toLocaleString('zh-CN'); };
      var hbCls = ((hb >= 0) === !lowBetter) ? 'rk-ok' : 'rk-no';
      var cumCls = ((cum >= 0) === !lowBetter) ? 'rk-ok' : 'rk-no';
      var pp = function (x) { return (Math.abs(x) * 100).toFixed(1) + 'pp'; };
      var pc = function (x) { return (x * 100).toFixed(1) + '%'; };
      return '<tr><td>' + s.name + '</td><td>' + f(last) + '</td>' +
        '<td class="' + hbCls + '">' + (hb >= 0 ? '▲' : '▼') + ' ' + (rate ? pp(hb) : pc(hb)) + '</td>' +
        '<td class="' + cumCls + '">' + (cum >= 0 ? '▲' : '▼') + ' ' + (rate ? pp(cum) : pc(cum)) + '</td></tr>';
    }).join('');
    wrap.insertAdjacentHTML('beforeend',
      '<div class="mk-table"><table><thead><tr><th>指标 / ' + (months[months.length - 1] || '最新') + '</th><th>最新值</th><th>环比</th><th>累计增长</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="mk-note">指数=各月值÷首月×100，便于跨量纲比较走势；「率」类环比/累计以百分点(pp)计；退换货率走低为优。</p></div>');
    state.built.trend = true;
    toast(METRICS_CONFIG.copy.tips.trendDone, 'ok');
    $id('metrics-gmv').disabled = false;
  }

  /* ---------- ⑧ GMV 拆解 ---------- */
  function buildGmv() {
    if (!state.trends || !state.trends.length) return toast('请先应用指标数据（含趋势）', 'error');
    var uv = trendByName('访客数 UV'), cvr = trendByName('支付转化率'), aov = trendByName('客单价');
    if (!uv || !cvr || !aov) return toast('趋势中缺少 访客 / 支付转化率 / 客单价，无法拆解 GMV', 'error');
    var n = uv.length, last = n - 1;
    var g0 = uv[0] * cvr[0] * aov[0], g12 = uv[last] * cvr[last] * aov[last];
    var gUV = uv[last] / uv[0] - 1, gCVR = cvr[last] / cvr[0] - 1, gAOV = aov[last] / aov[0] - 1, gGMV = g12 / g0 - 1;
    var wrap = $id('metrics-gmv-wrap');
    wrap.innerHTML = '<div class="gmv-formula">GMV = 访客 × 支付转化率 × 客单价</div>' +
      '<div class="gmv-cards">' +
        '<div class="gmv-card"><div class="gmv-c-k">12月 访客</div><div class="gmv-c-v">' + Math.round(uv[last]).toLocaleString('zh-CN') + ' 人</div></div>' +
        '<div class="gmv-card"><div class="gmv-c-k">12月 支付转化率</div><div class="gmv-c-v">' + (cvr[last] * 100).toFixed(2) + '%</div></div>' +
        '<div class="gmv-card"><div class="gmv-c-k">12月 客单价</div><div class="gmv-c-v">¥' + Math.round(aov[last]).toLocaleString('zh-CN') + '</div></div>' +
        '<div class="gmv-card gmv-card-em"><div class="gmv-c-k">12月 GMV</div><div class="gmv-c-v">¥' + Math.round(g12).toLocaleString('zh-CN') + '</div></div>' +
      '</div>' +
      '<div class="metrics-chart" id="metrics-gmv-chart"></div>' +
      '<p class="mk-note">GMV 累计增长 ' + (gGMV * 100).toFixed(1) + '%，近似等于 访客(' + (gUV * 100).toFixed(1) + '%) + 支付转化率(' + (gCVR * 100).toFixed(1) + '%) + 客单价(' + (gAOV * 100).toFixed(1) + '%) 三者累计增长之和（对数可加性，交互项极小）。</p>';
    var chart = freshChart('metrics-gmv', 'metrics-gmv-chart');
    chart.setOption({
      tooltip: { trigger: 'axis', formatter: function (ps) { var p = ps[0]; return p.name + '：' + p.value.toFixed(1) + '%'; } },
      grid: { left: 64, right: 20, top: 24, bottom: 28 },
      xAxis: { type: 'category', data: ['访客 UV', '支付转化率', '客单价', 'GMV(累计)'], axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', name: '累计增长%', nameTextStyle: { fontSize: 10 }, axisLabel: { fontSize: 10, formatter: '{value}%' } },
      series: [{ type: 'bar', barWidth: '52%', data: [
        { value: +(gUV * 100).toFixed(1), itemStyle: { color: '#5b6cff' } },
        { value: +(gCVR * 100).toFixed(1), itemStyle: { color: '#1faa6b' } },
        { value: +(gAOV * 100).toFixed(1), itemStyle: { color: '#e0a300' } },
        { value: +(gGMV * 100).toFixed(1), itemStyle: { color: '#e5484d' } }
      ], label: { show: true, position: 'top', formatter: '{c}%', fontSize: 11 } }]
    });
    state.built.gmv = true;
    toast(METRICS_CONFIG.copy.tips.gmvDone, 'ok');
  }

  /* ---------- ⑥ 误区词云 ---------- */
  function buildCloud() {
    if (!METRICS_CONFIG.pitfalls || !METRICS_CONFIG.pitfalls.length) return toast('无误区词云数据', 'warn');
    var data = METRICS_CONFIG.pitfalls.map(function (p) { return { name: p[0], value: p[1] }; });
    var chart = freshChart('metrics-cloud', 'metrics-cloud-wrap');
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

  /* ---------- UI ---------- */
  function setWelcome() { var w = $id('metrics-welcome'); if (w) w.textContent = METRICS_CONFIG.copy.welcome; }
  function setDisclaimer() { var d = $id('metrics-disclaimer'); if (d) d.textContent = METRICS_CONFIG.copy.disclaimer; }
  function initUI() {
    setWelcome(); setDisclaimer();
    $id('metrics-apply').addEventListener('click', applyInput);
    $id('metrics-load').addEventListener('click', loadBuiltin);
    $id('metrics-overview').addEventListener('click', buildOverview);
    $id('metrics-funnel').addEventListener('click', buildFunnel);
    $id('metrics-ratio').addEventListener('click', buildRatio);
    $id('metrics-radar').addEventListener('click', buildRadar);
    $id('metrics-trend').addEventListener('click', buildTrend);
    $id('metrics-gmv').addEventListener('click', buildGmv);
    $id('metrics-cloud').addEventListener('click', buildCloud);
    window.addEventListener('resize', function () { Object.keys(charts).forEach(function (id) { if (charts[id]) charts[id].resize(); }); });
    CourseKit.mountDataManager({
      engine: ENGINE,
      getConfig: function () { return METRICS_CONFIG; },
      onApply: function (cfg) { METRICS_CONFIG = cfg; setWelcome(); setDisclaimer(); resetAnalysis(); },
      defaultUrl: './metrics-config.json', editorUrl: 'metrics-editor.html', downloadName: 'metrics-config.json',
      ids: { srcBadge: 'src-badge', btnExport: 'btn-export', btnImport: 'btn-import', fileImport: 'file-import', btnReset: 'btn-reset-config', updateUrl: 'update-url', btnFetch: 'btn-fetch-update', note: 'dm-note' }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initUI(); });
  else initUI();
})();
