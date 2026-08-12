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
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
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
    ['ts-trend-wrap', 'ts-acc-wrap', 'ts-res-wrap', 'ts-cloud-wrap', 'ts-fc-wrap', 'ts-cmp-wrap',
      'ts-sta-wrap', 'ts-acf-wrap', 'ts-pacf-wrap', 'ts-decomp-wrap', 'ts-arima-wrap', 'ts-knowledge-wrap']
      .forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    state.built = { trend: false, acc: false, res: false, fc: false, cmp: false, sta: false, acf: false, decomp: false, arima: false, knowledge: false };
    state.methodAcc = null; state.recommend = null; state.forecast = null; state.arima = null;
    ['ts-trend', 'ts-accuracy', 'ts-residual', 'ts-forecast', 'ts-compare',
      'ts-stationarity', 'ts-acf', 'ts-decomp', 'ts-arima'].forEach(function (id) { $id(id).disabled = true; });
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
    $id('ts-stationarity').addEventListener('click', buildStationarity);
    $id('ts-acf').addEventListener('click', buildAcf);
    $id('ts-decomp').addEventListener('click', buildDecomp);
    $id('ts-arima').addEventListener('click', buildArima);
    $id('ts-knowledge').addEventListener('click', buildKnowledge);
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
    if (data.length >= 6) {
      ['ts-trend', 'ts-stationarity', 'ts-acf', 'ts-decomp', 'ts-arima'].forEach(function (id) { var b = $id(id); if (b) b.disabled = false; });
    }
    toast('已载入案例「' + state.caseName + '」共 ' + data.length + ' 期', 'info');
  }

  function applyInput() {
    var ta = $id('ts-input');
    var raw = ta.value.split(/[,\s]+/).map(parseFloat).filter(function (n) { return isFinite(n); });
    if (raw.length < 6) return toast('请至少输入 6 期有效数值', 'error');
    state.series = raw; state.hasData = true;
    state.built = { trend: false, acc: false, res: false, fc: false, cmp: false, knowledge: false };
    ['ts-trend-wrap', 'ts-acc-wrap', 'ts-res-wrap', 'ts-cloud-wrap', 'ts-fc-wrap', 'ts-cmp-wrap', 'ts-knowledge-wrap'].forEach(function (id) { var e = $id(id); if (e) e.innerHTML = ''; });
    ['ts-trend', 'ts-accuracy', 'ts-residual', 'ts-forecast', 'ts-compare'].forEach(function (id) { $id(id).disabled = true; });
    toast(TS_CONFIG.copy.tips.dataReady, 'info');
    ['ts-trend', 'ts-stationarity', 'ts-acf', 'ts-decomp', 'ts-arima'].forEach(function (id) { $id(id).disabled = false; });
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

  /* ---------- ⑧⑨⑩⑪ 深化：平稳性 / ACF·PACF / 季节分解 / ARIMA ---------- */
  function mean(a) { return a.reduce(function (x, y) { return x + y; }, 0) / (a.length || 1); }
  function diff(s, d) { var x = s.slice(); for (var k = 0; k < d; k++) { var y = []; for (var i = 1; i < x.length; i++) y.push(x[i] - x[i - 1]); x = y; } return x; }
  // ADF 风格平稳性：对 y_t 回归 y_{t-1}（带常数），返回系数 t 值
  function adfStat(s) {
    if (s.length < 4) return { t: 0, stationary: false, crit: TS_CONFIG.methods.arima.adfCritical };
    var ys = s.slice(1), xs = s.slice(0, -1), n = xs.length, sx = mean(xs), sy = mean(ys);
    var sxx = 0, sxy = 0; for (var i = 0; i < n; i++) { sxx += (xs[i] - sx) * (xs[i] - sx); sxy += (xs[i] - sx) * (ys[i] - sy); }
    var b = sxy / sxx, a = sy - b * sx;
    var resid = ys.map(function (v, i) { return v - (a + b * xs[i]); });
    var sse = resid.reduce(function (x, y) { return x + y * y; }, 0);
    var se = Math.sqrt(sse / (n - 2)) / Math.sqrt(sxx);
    var t = b / se, crit = TS_CONFIG.methods.arima.adfCritical;
    return { t: t, crit: crit, stationary: t < crit };
  }
  // 自相关函数 ACF(k)
  function acf(s, k) {
    var m = mean(s), n = s.length, den = 0;
    for (var i = 0; i < n; i++) den += (s[i] - m) * (s[i] - m);
    if (den === 0 || n - k <= 0) return 0;
    var num = 0; for (var i = 0; i < n - k; i++) num += (s[i] - m) * (s[i + k] - m);
    return num / den;
  }
  // 偏自相关 PACF：Durbin-Levinson
  function pacf(s, K) {
    var phi = [], v = acf(s, 0), out = [];
    for (var k = 1; k <= K; k++) {
      var num = acf(s, k); for (var j = 1; j < k; j++) num -= phi[j - 1] * acf(s, k - j);
      var den = v; for (var j = 1; j < k; j++) den -= phi[j - 1] * acf(s, k - j);
      var phikk = den !== 0 ? num / den : 0, nw = phi.slice(); nw.push(phikk);
      for (var j = 0; j < k - 1; j++) nw[j] = phi[j] - phikk * phi[k - 2 - j];
      phi = nw; v = v * (1 - phikk * phikk); out.push(Math.max(-1, Math.min(1, phikk)));
    }
    return out;
  }
  // AR(p) Yule-Walker 系数
  function arCoeffs(y, p) {
    if (p <= 0) return [];
    var r = []; for (var k = 0; k <= p; k++) r.push(acf(y, k));
    var phi = [], v = r[0];
    for (var k = 1; k <= p; k++) {
      var num = r[k]; for (var j = 1; j < k; j++) num -= phi[j - 1] * r[k - j];
      var den = v; for (var j = 1; j < k; j++) den -= phi[j - 1] * r[k - j];
      var phikk = den !== 0 ? num / den : 0, nw = phi.slice(); nw.push(phikk);
      for (var j = 0; j < k - 1; j++) nw[j] = phi[j] - phikk * phi[k - 2 - j];
      phi = nw; v = v * (1 - phikk * phikk);
    }
    return phi;
  }
  // 乘法季节分解：趋势=去季节平滑；季节=原始/趋势；残差=原始/(趋势×季节)
  function decompose(s, period) {
    var n = s.length, m = mean(s);
    var detr = s.map(function (v, i) { var lo = Math.max(0, i - Math.floor(period / 2)), hi = Math.min(n - 1, i + Math.floor(period / 2)), sum = 0, c = 0; for (var j = lo; j <= hi; j++) { sum += s[j]; c++; } return c ? v / (sum / c) : v; });
    var idx = new Array(period).fill(0), cnt = new Array(period).fill(0);
    for (var i = 0; i < n; i++) { var p = i % period; idx[p] += detr[i]; cnt[p]++; }
    var avg = idx.map(function (v, i) { return cnt[i] ? v / cnt[i] : 1; });
    var smean = avg.reduce(function (a, b) { return a + b; }, 0) / period;
    var season = avg.map(function (v) { return v / smean; });
    var seas = s.map(function (v, i) { return season[i % period]; });
    var trend = s.map(function (v, i) { return v / seas[i]; });
    var resid = s.map(function (v, i) { return v / (trend[i] * seas[i]); });
    return { trend: trend, season: seas, resid: resid };
  }
  // 简化 ARIMA 预测（教学版）：去季节 × 差分 ARMA × 季节还原
  function arimaForecast(s, p, d, q, period, h) {
    var n = s.length, m = mean(s);
    var detr = s.map(function (v, i) { var lo = Math.max(0, i - Math.floor(period / 2)), hi = Math.min(n - 1, i + Math.floor(period / 2)), sum = 0, c = 0; for (var j = lo; j <= hi; j++) { sum += s[j]; c++; } return c ? v / (sum / c) : v; });
    var idx = new Array(period).fill(0), cnt = new Array(period).fill(0);
    for (var i = 0; i < n; i++) { var pp = i % period; idx[pp] += detr[i]; cnt[pp]++; }
    var avg = idx.map(function (v, i) { return cnt[i] ? v / cnt[i] : 1; });
    var smean = avg.reduce(function (a, b) { return a + b; }, 0) / period;
    var season = avg.map(function (v) { return v / smean; });
    var seas = s.map(function (v, i) { return season[i % period]; });
    var deseason = s.map(function (v, i) { return v / seas[i]; });
    var y = diff(deseason, d);
    if (y.length < Math.max(p, 1) + 2) { var base = mean(y.length ? y : deseason); var o = []; for (var i = 0; i < h; i++) o.push(Math.round(base * season[(n + i) % period])); return o; }
    var phi = arCoeffs(y, p);
    var resid = y.map(function (v, i) { if (i < p) return 0; var est = 0; for (var j = 1; j <= p; j++) est += phi[j - 1] * y[i - j]; return v - est; });
    var yhat = y.slice(), rhat = resid.slice();
    for (var i = 0; i < h; i++) {
      var ix = yhat.length, ar = 0; for (var j = 1; j <= p; j++) ar += phi[j - 1] * yhat[ix - j];
      var ma = 0, w = 0; for (var j = 1; j <= q; j++) { if (rhat.length - j >= 0) { ma += rhat[rhat.length - j] / j; w += 1 / j; } }
      ma = w ? ma / w : 0; yhat.push(ar + ma); rhat.push(ma);
    }
    var fc = yhat.slice(y.length);
    for (var dd = 0; dd < d; dd++) { var inv = [], last = deseason[deseason.length - 1]; for (var i = fc.length - 1; i >= 0; i--) { last = fc[i] + last; inv.unshift(last); } fc = inv; }
    return fc.map(function (v, i) { return Math.round(v * season[(n + i) % period]); });
  }
  function buildStationarity() {
    if (!state.hasData) return toast('请先输入或载入序列', 'error');
    var s = state.series, st = adfStat(s), wrap = $id('ts-sta-wrap');
    wrap.innerHTML = '<div class="sta-box">' +
      '<div class="sta-row"><span>ADF 统计量 t</span><b>' + st.t.toFixed(2) + '</b></div>' +
      '<div class="sta-row"><span>临界值</span><b>' + st.crit + '</b></div>' +
      '<div class="sta-verdict ' + (st.stationary ? 'ok' : 'warn') + '">' + (st.stationary ? '✅ 序列平稳，可直接建模' : '⚠️ 存在单位根，建议先做 ' + TS_CONFIG.methods.arima.d + ' 阶差分') + '</div>' +
      '</div>';
    state.built.sta = true;
    toast(st.stationary ? '序列平稳' : '建议差分后建模', 'info');
  }
  function buildAcf() {
    if (!state.hasData) return toast('请先输入或载入序列', 'error');
    var s = state.series, K = Math.min(20, Math.floor(s.length / 2)), ac = [], pac = pacf(s, K);
    for (var k = 0; k <= K; k++) ac.push(acf(s, k));
    var conf = 1.96 / Math.sqrt(s.length);
    freshChart('ts-acf', 'ts-acf-wrap').setOption({
      tooltip: { trigger: 'axis' }, grid: { left: 44, right: 14, top: 20, bottom: 28 },
      xAxis: { type: 'category', data: ac.map(function (_, i) { return i; }), name: 'lag' },
      yAxis: { type: 'value', name: 'ACF' },
      series: [{ type: 'bar', data: ac.map(function (v) { return { value: +v.toFixed(3), itemStyle: { color: Math.abs(v) > conf ? '#5b6cff' : '#c7cce6' } }; }), barWidth: '60%' }]
    });
    freshChart('ts-pacf', 'ts-pacf-wrap').setOption({
      tooltip: { trigger: 'axis' }, grid: { left: 44, right: 14, top: 20, bottom: 28 },
      xAxis: { type: 'category', data: pac.map(function (_, i) { return i + 1; }), name: 'lag' },
      yAxis: { type: 'value', name: 'PACF' },
      series: [{ type: 'bar', data: pac.map(function (v) { return { value: +v.toFixed(3), itemStyle: { color: Math.abs(v) > conf ? '#e8833a' : '#c7cce6' } }; }), barWidth: '60%' }]
    });
    state.built.acf = true;
    toast('ACF/PACF 已绘制（阴影区外为显著）', 'info');
  }
  function buildDecomp() {
    if (!state.hasData) return toast('请先输入或载入序列', 'error');
    var s = state.series, period = TS_CONFIG.methods.seasonal.period, d = decompose(s, period), n = s.length, x = [];
    for (var i = 1; i <= n; i++) x.push(i);
    freshChart('ts-decomp', 'ts-decomp-wrap').setOption({
      tooltip: { trigger: 'axis' }, legend: { data: ['原始', '趋势', '季节', '残差'], top: 0 },
      grid: { left: 50, right: 14, top: 30, bottom: 26 },
      xAxis: { type: 'category', data: x, name: '期' },
      yAxis: { type: 'value', scale: true },
      series: [
        { name: '原始', type: 'line', data: s, showSymbol: false, lineStyle: { width: 1 } },
        { name: '趋势', type: 'line', data: d.trend.map(function (v) { return Math.round(v); }), showSymbol: false, lineStyle: { width: 2 } },
        { name: '季节', type: 'line', data: d.season.map(function (v) { return +v.toFixed(3); }), showSymbol: false, lineStyle: { width: 1, type: 'dashed' } },
        { name: '残差', type: 'line', data: d.resid.map(function (v) { return +v.toFixed(3); }), showSymbol: false, lineStyle: { width: 1, type: 'dotted' } }
      ]
    });
    state.built.decomp = true;
    toast('季节分解完成：原始 = 趋势 × 季节 × 残差', 'info');
  }
  function buildArima() {
    if (!state.hasData) return toast('请先输入或载入序列', 'error');
    var s = state.series, cfg = TS_CONFIG.methods.arima, h = 12, period = TS_CONFIG.methods.seasonal.period;
    var fcA = arimaForecast(s, cfg.p, cfg.d, cfg.q, period, h);
    var fcH = hwForecast(holtWintersFit(s, period), h);
    var n = s.length, xall = []; for (var i = 1; i <= n + h; i++) xall.push(i);
    var actual = s.concat(new Array(h).fill(null));
    var predA = new Array(n - 1).fill(null).concat([s[n - 1]]).concat(fcA);
    var predH = new Array(n - 1).fill(null).concat([s[n - 1]]).concat(fcH);
    freshChart('ts-arima', 'ts-arima-wrap').setOption({
      tooltip: { trigger: 'axis' }, legend: { data: ['实际', 'Holt-Winters', 'ARIMA'], top: 0 },
      grid: { left: 56, right: 14, top: 30, bottom: 26 },
      xAxis: { type: 'category', data: xall, name: '期' },
      yAxis: { type: 'value', scale: true },
      series: [
        { name: '实际', type: 'line', data: actual, showSymbol: false, itemStyle: { color: '#5b6cff' } },
        { name: 'Holt-Winters', type: 'line', data: predH, showSymbol: false, lineStyle: { width: 2 }, itemStyle: { color: '#7d5bd6' } },
        { name: 'ARIMA', type: 'line', data: predA, showSymbol: false, lineStyle: { width: 2, type: 'dashed' }, itemStyle: { color: '#1f9e6b' } }
      ]
    });
    state.arima = { forecast: fcA }; state.built.arima = true;
    toast('ARIMA(' + cfg.p + ',' + cfg.d + ',' + cfg.q + ') + 季节指数 vs Holt-Winters（教学简化）', 'info');
  }

  /* ---------- ⑫ 课堂知识点注解 ---------- */
  function buildKnowledge() {
    var list = (TS_CONFIG.knowledge || []).filter(function (k) { return k && k.title; });
    if (!list.length) return toast('暂无课堂知识点', 'warn');
    var html = list.map(function (k, i) {
      return '<div class="kp-card"><div class="kp-title">' + (i + 1) + '. ' + esc(k.title) + '</div><div class="kp-body">' + esc(k.body) + '</div></div>';
    }).join('');
    $id('ts-knowledge-wrap').innerHTML = html;
    state.built.knowledge = true;
    toast('已展开 ' + list.length + ' 条课堂知识点', 'ok');
  }

  /* ---------- 启动 ---------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initUI(); loadCase(); });
  else { initUI(); loadCase(); }
})();
