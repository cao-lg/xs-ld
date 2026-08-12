/* ============================================================
 * 时间序列分析 · 交互逻辑（课程工具基座版）
 * ------------------------------------------------------------
 * 7 步对齐漏斗工具：
 *   ① 选择案例/序列 ② 输入序列 ③ 趋势提取(MA) ④ 方法精度对标
 *   ⑤ 残差诊断·误区词云 ⑥ 推荐方法+预测 ⑦ 多方法预测对比
 * 计算：移动平均 / 一次指数平滑 / Holt-Winters 乘法季节分解 /
 *       MAPE 精度 / 残差异常检测 / 多步预测。图表用 ECharts。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 当前生效配置（从 localStorage 或默认初始化） ---------- */
  function loadInitialConfig() {
    var stored = ENGINE.loadStored();
    var base = (stored && stored.config) ? stored.config : ENGINE.getDefaults();
    return ENGINE.validate(base).cfg;
  }
  var TS_CONFIG = loadInitialConfig();

  /* ---------- 全局状态 ---------- */
  var state = {
    caseName: TS_CONFIG.cases[0],
    series: [],
    hasData: false,
    methodAcc: null,
    recommend: null,
    forecast: null,
    built: { trend: false, acc: false, res: false, fc: false, cmp: false }
  };

  /* ---------- 工具 ---------- */
  function $(sel) { return document.querySelector(sel); }
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
  /* 重新初始化某容器：先销毁旧实例，避免对已挂载 canvas 的 DOM 重复 init */
  function freshChart(id, domId) { disposeChart(id); return registerChart(id, echarts.init($id(domId))); }
  /* 切换案例 / 重新载入配置时：清空所有图表、重置分析状态与后续步骤按钮 */
  function resetAnalysis() {
    Object.keys(charts).forEach(disposeChart);
    ['ts-trend-wrap', 'ts-acc-wrap', 'ts-res-wrap', 'ts-cloud-wrap', 'ts-fc-wrap', 'ts-cmp-wrap']
      .forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    state.built = { trend: false, acc: false, res: false, fc: false, cmp: false };
    state.methodAcc = null; state.recommend = null; state.forecast = null;
    ['ts-trend', 'ts-accuracy', 'ts-residual', 'ts-forecast', 'ts-compare'].forEach(function (id) { $id(id).disabled = true; });
  }

  var ACC_COLOR = { good: '#1f9e6b', mid: '#d99a00', low: '#e5484d' };
  function mapeLevel(m, bench) { if (m <= bench.good) return 'good'; if (m <= bench.mid) return 'mid'; return 'low'; }

  /* ============================================================
   * 计算
   * ============================================================ */
  function movingAverage(s, k) {
    var out = s.map(function () { return null; });
    for (var i = k - 1; i < s.length; i++) {
      var sum = 0; for (var j = 0; j < k; j++) sum += s[i - j];
      out[i] = sum / k;
    }
    return out;
  }
  function expSmoothing(s, alpha) {
    var out = [s[0]];
    for (var i = 1; i < s.length; i++) out[i] = alpha * s[i] + (1 - alpha) * out[i - 1];
    return out;
  }
  function seasonalIndices(s, period) {
    if (period <= 1) return [1];
    var half = Math.floor(period / 2);
    var detr = s.map(function (v, i) {
      var lo = Math.max(0, i - half), hi = Math.min(s.length - 1, i + half), sum = 0, c = 0;
      for (var j = lo; j <= hi; j++) { sum += s[j]; c++; }
      return c ? v / (sum / c) : v;
    });
    var idx = new Array(period).fill(0), cnt = new Array(period).fill(0);
    for (var i = 0; i < s.length; i++) { var p = i % period; idx[p] += detr[i]; cnt[p]++; }
    var avg = idx.map(function (v, i) { return cnt[i] ? v / cnt[i] : 1; });
    var mean = avg.reduce(function (a, b) { return a + b; }, 0) / period;
    return avg.map(function (v) { return v / mean; });
  }
  function deseasonalize(s, period, idx) { return s.map(function (v, i) { return v / idx[i % period]; }); }
  function linearFit(d) {
    var n = d.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) { sx += i; sy += d[i]; sxx += i * i; sxy += i * d[i]; }
    var b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    var a = (sy - b * sx) / n;
    return { a: a, b: b };
  }
  function holtWintersFit(s, period) {
    var idx = seasonalIndices(s, period);
    var d = deseasonalize(s, period, idx);
    var fit = linearFit(d);
    var fitted = s.map(function (v, i) { return (fit.a + fit.b * i) * idx[i % period]; });
    return { idx: idx, a: fit.a, b: fit.b, n: s.length, fitted: fitted };
  }
  function hwForecast(model, h) {
    var out = [];
    for (var i = model.n; i < model.n + h; i++) out.push(Math.round((model.a + model.b * i) * model.idx[i % model.idx.length]));
    return out;
  }
  function mae(a, b) {
    var s = 0, c = 0;
    for (var i = 0; i < a.length; i++) { if (a[i] == null || b[i] == null) continue; s += Math.abs(a[i] - b[i]); c++; }
    return c ? s / c : 0;
  }
  function mape(a, b) {
    var s = 0, c = 0;
    for (var i = 0; i < a.length; i++) { if (a[i] == null || b[i] == null || a[i] === 0) continue; s += Math.abs(a[i] - b[i]) / Math.abs(a[i]); c++; }
    return c ? (s / c) * 100 : 0;
  }
  function fittedOf(s, method) {
    var m = TS_CONFIG.methods;
    if (method.indexOf('移动平均') >= 0) return movingAverage(s, m.movingAverage.recommend);
    if (method.indexOf('指数平滑') >= 0) return expSmoothing(s, m.expSmoothing.recommend);
    return holtWintersFit(s, m.seasonal.period).fitted;
  }
  function residualStd(s, method) {
    var f = fittedOf(s, method);
    var r = s.map(function (v, i) { return f[i] == null ? null : v - f[i]; }).filter(function (v) { return v != null; });
    var mean = r.reduce(function (a, b) { return a + b; }, 0) / (r.length || 1);
    return Math.sqrt(r.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (r.length || 1));
  }
  function anomalyMask(resid, k) {
    var vals = resid.filter(function (v) { return v != null; });
    var mean = vals.reduce(function (a, b) { return a + b; }, 0) / (vals.length || 1);
    var std = Math.sqrt(vals.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (vals.length || 1));
    return resid.map(function (v) { return v != null && Math.abs(v) > k * std; });
  }

  /* ============================================================
   * 初始化 UI
   * ============================================================ */
  function renderCaseSelect() {
    var sel = $id('ts-case'); if (!sel) return;
    sel.innerHTML = TS_CONFIG.cases.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
    sel.value = state.caseName;
  }
  function setWelcome() { var w = $id('ts-welcome'); if (w) w.textContent = TS_CONFIG.copy.welcome; }
  function setDisclaimer() { var d = $id('ts-disclaimer'); if (d) d.textContent = TS_CONFIG.copy.disclaimer; }

  function initUI() {
    setWelcome(); setDisclaimer(); renderCaseSelect();
    $id('ts-case').addEventListener('change', function (e) { state.caseName = e.target.value; resetAnalysis(); loadCase(); });
    $id('ts-apply').addEventListener('click', applyInput);
    $id('ts-trend').addEventListener('click', buildTrend);
    $id('ts-accuracy').addEventListener('click', buildAccuracy);
    $id('ts-residual').addEventListener('click', buildResidual);
    $id('ts-forecast').addEventListener('click', buildForecast);
    $id('ts-compare').addEventListener('click', buildCompare);
    window.addEventListener('resize', function () { Object.keys(charts).forEach(function (id) { if (charts[id]) charts[id].resize(); }); });
    CourseKit.mountDataManager({
      engine: ENGINE,
      getConfig: function () { return TS_CONFIG; },
      onApply: function (cfg) { TS_CONFIG = cfg; state.caseName = cfg.cases[0]; renderCaseSelect(); setWelcome(); setDisclaimer(); resetAnalysis(); loadCase(); },
      defaultUrl: './ts-config.json', editorUrl: 'ts-editor.html', downloadName: 'ts-config.json',
      ids: { srcBadge: 'src-badge', btnExport: 'btn-export', btnImport: 'btn-import', fileImport: 'file-import', btnReset: 'btn-reset-config', updateUrl: 'update-url', btnFetch: 'btn-fetch-update', note: 'dm-note' }
    });
  }

  function loadCase() {
    var data = TS_CONFIG.caseData[state.caseName] || [];
    var ta = $id('ts-input'); if (ta) ta.value = data.join(', ');
    state.series = data.slice();
    state.hasData = data.length > 0;
    if (data.length >= 6) { var t = $id('ts-trend'); if (t) t.disabled = false; }
    toast('已载入案例「' + state.caseName + '」共 ' + data.length + ' 期', 'info');
  }

  function applyInput() {
    var ta = $id('ts-input');
    var raw = ta.value.split(/[,\s]+/).map(parseFloat).filter(function (n) { return isFinite(n); });
    if (raw.length < 6) return toast('请至少输入 6 期有效数值', 'error');
    state.series = raw; state.hasData = true;
    state.built = { trend: false, acc: false, res: false, fc: false, cmp: false };
    ['ts-trend-wrap', 'ts-acc-wrap', 'ts-res-wrap', 'ts-cloud-wrap', 'ts-fc-wrap', 'ts-cmp-wrap'].forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    ['ts-trend', 'ts-accuracy', 'ts-residual', 'ts-forecast', 'ts-compare'].forEach(function (id) { $id(id).disabled = true; });
    toast(TS_CONFIG.copy.tips.dataReady, 'info');
    $id('ts-trend').disabled = false;
  }

  /* ---------- ③ 趋势提取（移动平均） ---------- */
  function buildTrend() {
    if (!state.hasData) return toast('请先输入或载入序列', 'error');
    var s = state.series, k = TS_CONFIG.methods.movingAverage.recommend;
    var ma = movingAverage(s, k);
    var chart = freshChart('ts-trend', 'ts-trend-wrap');
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['原始序列', '移动平均 MA(' + k + ')'], top: 0 },
      grid: { left: 50, right: 16, top: 36, bottom: 30 },
      xAxis: { type: 'category', data: s.map(function (_, i) { return i + 1; }), name: '期' },
      yAxis: { type: 'value', scale: true },
      series: [
        { name: '原始序列', type: 'line', data: s, showSymbol: false, lineStyle: { width: 1.5 }, itemStyle: { color: '#5b6cff' } },
        { name: '移动平均 MA(' + k + ')', type: 'line', data: ma.map(function (v) { return v == null ? null : Math.round(v * 100) / 100; }), showSymbol: false, lineStyle: { width: 2, type: 'dashed' }, itemStyle: { color: '#e8833a' } }
      ]
    });
    state.built.trend = true;
    $id('ts-accuracy').disabled = false;
    toast(TS_CONFIG.copy.tips.trendDone, 'warn');
  }

  /* ---------- ④ 方法精度对标 ---------- */
  function buildAccuracy() {
    var s = state.series, m = TS_CONFIG.methods;
    var ma = movingAverage(s, m.movingAverage.recommend);
    var es = expSmoothing(s, m.expSmoothing.recommend);
    var hw = holtWintersFit(s, m.seasonal.period).fitted;
    var acc = {
      ['移动平均(k=' + m.movingAverage.recommend + ')']: mape(s, ma),
      ['指数平滑(α=' + m.expSmoothing.recommend + ')']: mape(s, es),
      'Holt-Winters': mape(s, hw)
    };
    state.methodAcc = acc;
    var bench = TS_CONFIG.accuracyBenchmark.mape;
    var names = Object.keys(acc);
    var data = names.map(function (n) {
      return { name: n, value: Math.round(acc[n] * 10) / 10, itemStyle: { color: ACC_COLOR[mapeLevel(acc[n], bench)] } };
    });
    var chart = freshChart('ts-acc', 'ts-acc-wrap');
    chart.setOption({
      tooltip: { trigger: 'axis', formatter: function (p) { return p[0].name + '<br/>MAPE: ' + p[0].value + '%'; } },
      grid: { left: 50, right: 16, top: 20, bottom: 50 },
      xAxis: { type: 'category', data: names, axisLabel: { interval: 0, rotate: 18 } },
      yAxis: { type: 'value', name: 'MAPE %', axisLabel: { formatter: '{value}%' } },
      series: [{ type: 'bar', data: data, barWidth: '46%', label: { show: true, position: 'top', formatter: '{c}%' } }]
    });
    state.built.acc = true;
    $id('ts-residual').disabled = false;
    toast(TS_CONFIG.copy.tips.accuracyDone, 'warn');
  }

  /* ---------- ⑤ 残差诊断 + 误区词云 ---------- */
  function buildResidual() {
    var s = state.series;
    var best = Object.keys(state.methodAcc).reduce(function (a, b) { return state.methodAcc[a] <= state.methodAcc[b] ? a : b; });
    state.recommend = best;
    var fitted = fittedOf(s, best);
    var resid = s.map(function (v, i) { return fitted[i] == null ? null : Math.round((v - fitted[i]) * 100) / 100; });
    var mask = anomalyMask(resid, 2);
    var chart = freshChart('ts-res', 'ts-res-wrap');
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 16, top: 20, bottom: 30 },
      xAxis: { type: 'category', data: resid.map(function (_, i) { return i + 1; }), name: '期' },
      yAxis: { type: 'value', name: '残差' },
      series: [{
        type: 'bar',
        data: resid.map(function (v, i) { return { value: v, itemStyle: { color: mask[i] ? '#e5484d' : '#9aa6c8' } }; })
      }]
    });
    // 词云
    var cloud = freshChart('ts-cloud', 'ts-cloud-wrap');
    cloud.setOption({
      tooltip: { show: false },
      series: [{
        type: 'wordCloud', sizeRange: [14, 46], rotationRange: [-30, 30], gridSize: 8,
        shape: 'circle', width: '100%', height: '100%',
        textStyle: { color: function () { return ['#5b6cff', '#e8833a', '#1f9e6b', '#e5484d', '#7d5bd6'][Math.floor(Math.random() * 5)]; } },
        data: TS_CONFIG.pitfalls.map(function (w) { return { name: w[0], value: w[1] }; })
      }]
    });
    state.built.res = true;
    $id('ts-forecast').disabled = false;
    toast('残差已诊断，最优方法：' + best, 'warn');
  }

  /* ---------- ⑥ 推荐方法 + 预测 ---------- */
  function buildForecast() {
    var s = state.series, m = TS_CONFIG.methods, h = 12, period = m.seasonal.period, best = state.recommend;
    var fc;
    if (best.indexOf('移动平均') >= 0) { var last = s.slice(-m.movingAverage.recommend); var v = last.reduce(function (a, b) { return a + b; }, 0) / last.length; fc = new Array(h).fill(Math.round(v)); }
    else if (best.indexOf('指数平滑') >= 0) { var es = expSmoothing(s, m.expSmoothing.recommend); fc = new Array(h).fill(Math.round(es[es.length - 1])); }
    else { fc = hwForecast(holtWintersFit(s, period), h); }
    var sd = residualStd(s, best);
    var lower = fc.map(function (v) { return Math.round(v - 1.96 * sd); });
    var upper = fc.map(function (v) { return Math.round(v + 1.96 * sd); });
    var n = s.length;
    var xall = []; for (var i = 1; i <= n + h; i++) xall.push(i);
    var actual = s.concat(new Array(h).fill(null));
    var pred = new Array(n - 1).fill(null).concat([s[n - 1]]).concat(fc);
    var lo = new Array(n - 1).fill(null).concat([s[n - 1]]).concat(lower);
    var up = new Array(n - 1).fill(null).concat([s[n - 1]]).concat(upper);
    var chart = freshChart('ts-fc', 'ts-fc-wrap');
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['实际', '预测', '95% 区间'], top: 0 },
      grid: { left: 56, right: 16, top: 36, bottom: 30 },
      xAxis: { type: 'category', data: xall, name: '期' },
      yAxis: { type: 'value', scale: true },
      series: [
        { name: '实际', type: 'line', data: actual, showSymbol: false, itemStyle: { color: '#5b6cff' } },
        { name: '预测', type: 'line', data: pred, showSymbol: false, lineStyle: { width: 2.5 }, itemStyle: { color: '#1f9e6b' } },
        { name: '95% 区间', type: 'line', data: up, showSymbol: false, lineStyle: { opacity: 0.3 }, areaStyle: { color: 'rgba(31,158,107,0.12)' }, itemStyle: { color: '#1f9e6b' }, stack: 'band' },
        { name: '95% 区间', type: 'line', data: lo, showSymbol: false, lineStyle: { opacity: 0 }, stack: 'band', itemStyle: { color: '#1f9e6b' }, tooltip: { show: false } }
      ]
    });
    state.forecast = { fc: fc, lower: lower, upper: upper };
    state.built.fc = true;
    $id('ts-compare').disabled = false;
    toast(TS_CONFIG.copy.tips.forecastReady + '（推荐：' + best + '）', 'warn');
  }

  /* ---------- ⑦ 多方法预测对比 ---------- */
  function buildCompare() {
    var s = state.series, m = TS_CONFIG.methods, h = 12, period = m.seasonal.period, n = s.length;
    var maLast = s.slice(-m.movingAverage.recommend).reduce(function (a, b) { return a + b; }, 0) / m.movingAverage.recommend;
    var maFc = new Array(h).fill(Math.round(maLast));
    var esLast = expSmoothing(s, m.expSmoothing.recommend); var esFc = new Array(h).fill(Math.round(esLast[esLast.length - 1]));
    var hwFc = hwForecast(holtWintersFit(s, period), h);
    var best = state.recommend;
    function line(name, arr, color, width) {
      return { name: name, type: 'line', data: new Array(n - 1).fill(null).concat([s[n - 1]]).concat(arr), showSymbol: false, lineStyle: { width: width, opacity: name === best ? 1 : 0.5 }, itemStyle: { color: color } };
    }
    var xall = []; for (var i = 1; i <= n + h; i++) xall.push(i);
    var chart = freshChart('ts-cmp', 'ts-cmp-wrap');
    chart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['实际', '移动平均', '指数平滑', 'Holt-Winters'], top: 0 },
      grid: { left: 56, right: 16, top: 36, bottom: 30 },
      xAxis: { type: 'category', data: xall, name: '期' },
      yAxis: { type: 'value', scale: true },
      series: [
        { name: '实际', type: 'line', data: s.concat(new Array(h).fill(null)), showSymbol: false, itemStyle: { color: '#5b6cff' } },
        line('移动平均', maFc, '#e8833a', 2),
        line('指数平滑', esFc, '#7d5bd6', 2),
        line('Holt-Winters', hwFc, '#1f9e6b', best.indexOf('Holt') >= 0 ? 3.5 : 2)
      ]
    });
    state.built.cmp = true;
    toast(TS_CONFIG.copy.tips.compareDone, 'ok');
  }

  /* ---------- 启动 ---------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initUI(); loadCase(); });
  else { initUI(); loadCase(); }
})();
