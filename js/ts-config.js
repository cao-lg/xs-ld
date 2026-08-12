/* ============================================================
 * 时间序列分析 · 配置层（课程工具基座版）
 * ------------------------------------------------------------
 * 与漏斗 data.js 完全同构：数据形状由 TS_DEFAULTS 提供，
 * 字段融合规则由 TS_SCHEMA 声明，校验/合并/导入导出/localStorage
 * 全部委托 kit/config.js 的泛型引擎。复用基准数据管理 / 在线编辑器。
 * ============================================================ */

const TS_SCHEMA_VERSION = '1.0';
const TS_STORAGE_KEY = 'ts.config.v1';

/* ---------- 确定性生成教学案例序列（趋势 + 季节 + 噪声，无随机） ---------- */
function genMonthly(n) {
  const a = [];
  for (let i = 0; i < n; i++) {
    const trend = 1000 + i * 18;
    const season = 1 + 0.28 * Math.sin((2 * Math.PI * (i % 12)) / 12 - Math.PI / 2);
    const noise = 1 + 0.05 * Math.sin(i * 2.3);
    a.push(Math.max(0, Math.round(trend * season * noise)));
  }
  return a;
}
function genDaily(n) {
  const a = [];
  for (let i = 0; i < n; i++) {
    const base = 500;
    const weekend = (i % 7 === 5 || i % 7 === 6) ? 1.4 : 1.0;
    const noise = 1 + 0.06 * Math.sin(i * 1.9);
    a.push(Math.round(base * weekend * noise));
  }
  return a;
}
function genWeekly(n) {
  const a = [];
  for (let i = 0; i < n; i++) {
    const trend = 8000 + i * 120;
    const season = 1 + 0.08 * Math.sin((2 * Math.PI * (i % 4)) / 4);
    const noise = 1 + 0.04 * Math.sin(i * 3.1);
    a.push(Math.round(trend * season * noise));
  }
  return a;
}

/* ---------- 内置默认配置 ---------- */
const TS_DEFAULTS = {
  cases: ['月度销售(带季节)', '日订单量', '周活跃用户'],
  caseData: {
    '月度销售(带季节)': genMonthly(36),
    '日订单量': genDaily(30),
    '周活跃用户': genWeekly(20)
  },
  methods: {
    movingAverage: { defaultWindows: [3, 5, 7], recommend: 5 },
    expSmoothing: { alphaRange: [0.1, 0.9], recommend: 0.3 },
    seasonal: { period: 12, type: 'multiplicative', label: 'Holt-Winters 乘法季节模型' },
    arima: { p: 1, d: 1, q: 1, P: 0, D: 1, Q: 1, adfCritical: -2.86 }
  },
  accuracyBenchmark: { mape: { good: 10, mid: 20 } },
  pitfalls: [
    ['窗口过大滞后', 30], ['α过小迟钝', 24], ['忽略季节突变', 20],
    ['过度拟合噪声', 18], ['训练/测试集混淆', 16], ['外推过远失效', 14]
  ],
  copy: {
    welcome: '你好，我是小数 📈 一位时间序列分析助手。选择案例或输入一段观测序列，我来帮你做趋势提取、方法精度对标、残差诊断与多步预测～',
    tips: {
      enter: '请选择预设案例，或在下方粘贴你自己的观测序列～',
      dataReady: '序列已就绪，点击「趋势提取」查看移动平均平滑效果',
      trendDone: '趋势线已生成！移动平均能抑制短期波动、凸显走势；窗口越大越平滑但越滞后',
      accuracyDone: '三种方法在留出样本上的精度已对比，绿色为更优方法',
      forecastReady: '已按推荐方法外推未来若干期，并给出预测区间',
      compareDone: '三种方法预测线并排展示，最优解已高亮，可对比其走势差异'
    },
    disclaimer: '⚠️ 预测基于历史规律与模型假设，仅供参考。时间序列受突发事件影响大，请谨慎外推。'
  }
};

/* ---------- 配置 Schema ---------- */
const TS_SCHEMA = {
  schemaVersion: TS_SCHEMA_VERSION,
  fields: [
    { path: 'cases', kind: 'arrayItem', item: 'string', require: 'nonEmpty', error: 'cases 必须是非空字符串数组' },
    { path: 'caseData', kind: 'map', dim: { ref: 'cases' }, value: 'numArray', warn: '案例数据' },
    { path: 'methods', kind: 'object', fields: [
      { sub: 'movingAverage', type: 'object', fields: [
        { sub: 'defaultWindows', type: 'numArray', label: '默认窗口' },
        { sub: 'recommend', type: 'number', label: '推荐窗口' }
      ] },
      { sub: 'expSmoothing', type: 'object', fields: [
        { sub: 'alphaRange', type: 'numArray', label: 'α范围' },
        { sub: 'recommend', type: 'number', label: '推荐α' }
      ] },
      { sub: 'seasonal', type: 'object', fields: [
        { sub: 'period', type: 'number', label: '季节周期' },
        { sub: 'type', type: 'string', label: '分解类型' }
      ] },
      { sub: 'arima', type: 'object', fields: [
        { sub: 'p', type: 'number', label: 'AR 阶 p' },
        { sub: 'd', type: 'number', label: '差分阶 d' },
        { sub: 'q', type: 'number', label: 'MA 阶 q' },
        { sub: 'P', type: 'number', label: '季节AR P' },
        { sub: 'D', type: 'number', label: '季节差分 D' },
        { sub: 'Q', type: 'number', label: '季节MA Q' },
        { sub: 'adfCritical', type: 'number', label: 'ADF临界值' }
      ] }
    ] },
    { path: 'accuracyBenchmark', kind: 'object', fields: [
      { sub: 'mape', type: 'object', fields: [
        { sub: 'good', type: 'number', label: '优(≤%,MAPE)' },
        { sub: 'mid', type: 'number', label: '中(≤%,MAPE)' }
      ] }
    ] },
    { path: 'pitfalls', kind: 'list', item: { kind: 'pair' }, warn: '误区词云' },
    { path: 'copy', kind: 'object', fields: [
      { sub: 'welcome', type: 'text', label: '欢迎语' },
      { sub: 'tips', type: 'object', fields: [
        { sub: 'enter', type: 'text' }, { sub: 'dataReady', type: 'text' }, { sub: 'trendDone', type: 'text' },
        { sub: 'accuracyDone', type: 'text' }, { sub: 'forecastReady', type: 'text' }, { sub: 'compareDone', type: 'text' }
      ] },
      { sub: 'disclaimer', type: 'text', label: '免责声明' }
    ] }
  ]
};

/* ---------- 通用配置引擎（基座） ---------- */
var CourseKit = window.CourseKit;
var ENGINE = CourseKit.makeConfigEngine({ schema: TS_SCHEMA, defaults: TS_DEFAULTS, storageKey: TS_STORAGE_KEY });
