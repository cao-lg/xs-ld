/* ============================================================
 * 电商各类指标 · 配置层（课程工具基座版）
 * ------------------------------------------------------------
 * 与漏斗 / 时间序列 / RFM / ABC / 购物篮同构：数据形状由 METRICS_DEFAULTS 提供，
 * 字段融合规则由 METRICS_SCHEMA 声明，校验/合并/导入导出/localStorage
 * 全部委托 kit/config.js 的泛型引擎。复用基准数据管理 / 在线编辑器。
 *
 * 注意：funnel / indicators 作为顶层 list 字段（与 RFM 的 customers、
 * ABC 的 items 同构），便于通用编辑器按 object 列表渲染。
 *
 * 设计：
 *   - funnel     : 转化漏斗各环节（访客 → 加购 → 下单 → 支付）
 *   - indicators : 运营指标清单（名称 / 分类 / 当前值 / 单位 / 行业基准）
 *   - copy       : 欢迎语 / 分步提示 / 免责声明
 *   - pitfalls   : 常见误区词云（词 + 权重）
 * ============================================================ */

const METRICS_SCHEMA_VERSION = '1.0';
const METRICS_STORAGE_KEY = 'metrics.config.v1';

/* ---------- 内置默认配置（自洽的店铺月度快照） ---------- */
const METRICS_DEFAULTS = {
  funnel: [
    { step: '访客 UV', value: 120000 },
    { step: '加购', value: 24000 },
    { step: '下单', value: 10000 },
    { step: '支付', value: 4000 }
  ],
  indicators: [
    { name: '访客数 UV', category: '流量', value: 120000, unit: '人', benchmark: 100000 },
    { name: '加购率', category: '转化', value: 0.20, unit: '', benchmark: 0.18 },
    { name: '支付转化率', category: '转化', value: 0.0333, unit: '', benchmark: 0.030 },
    { name: '客单价', category: '客单价', value: 160, unit: '元', benchmark: 150 },
    { name: '复购率', category: '留存', value: 0.26, unit: '', benchmark: 0.30 },
    { name: '退换货率', category: '留存', value: 0.05, unit: '', benchmark: 0.06 },
    { name: '营销 ROI', category: '营销', value: 3.2, unit: '', benchmark: 2.5 },
    { name: 'GMV', category: '客单价', value: 640000, unit: '元', benchmark: 600000 }
  ],
  copy: {
    welcome: '你好，我是小数 📐 一位电商指标分析助手。我帮你梳理流量 / 转化 / 客单价 / 留存 / 营销 五大类运营指标，画转化漏斗、算关键比率、与行业基准做雷达对标。',
    tips: {
      enter: '可在下方粘贴你的运营快照（每行：指标名, 分类, 当前值, 单位, 行业基准），或先点「载入内置示例」',
      dataReady: '指标数据已就绪，点击「指标概览」按分类查看',
      overviewDone: '指标概览完成，已按 流量 / 转化 / 客单价 / 留存 / 营销 分组，并标出与基准的差异',
      funnelDone: '转化漏斗完成，各环节的逐级转化率已标注',
      ratioDone: '关键比率已计算：加购率 / 支付转化率 / 客单价 / 复购率',
      radarDone: '雷达对标完成，当前值 vs 行业基准（按各自量纲归一）'
    },
    disclaimer: '⚠️ 指标口径须前后一致；转化率分母、客单价定义、复购率口径等易混淆，请对照教学要点核对。'
  },
  pitfalls: [
    ['把 PV 当 UV', 28], ['转化率分母用错', 26], ['客单价与笔单价混淆', 22],
    ['复购率口径不一', 20], ['只看单点不看趋势', 16], ['GMV 含未付/退款', 14],
    ['优惠券拉高客单价假象', 14], ['漏斗各级分母混乱', 12]
  ]
};

/* ---------- 配置 Schema（funnel / indicators 为顶层 list） ---------- */
const METRICS_SCHEMA = {
  schemaVersion: METRICS_SCHEMA_VERSION,
  fields: [
    { path: 'funnel', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'step', type: 'string', label: '环节' },
      { sub: 'value', type: 'number', label: '人数/笔数' }
    ] }, warn: '转化漏斗' },
    { path: 'indicators', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'name', type: 'string', label: '指标名' },
      { sub: 'category', type: 'string', label: '分类' },
      { sub: 'value', type: 'number', label: '当前值' },
      { sub: 'unit', type: 'string', label: '单位' },
      { sub: 'benchmark', type: 'number', label: '行业基准' }
    ] }, warn: '运营指标' },
    { path: 'copy', kind: 'object', fields: [
      { sub: 'welcome', type: 'text', label: '欢迎语' },
      { sub: 'tips', type: 'object', fields: [
        { sub: 'enter', type: 'text' }, { sub: 'dataReady', type: 'text' }, { sub: 'overviewDone', type: 'text' },
        { sub: 'funnelDone', type: 'text' }, { sub: 'ratioDone', type: 'text' }, { sub: 'radarDone', type: 'text' }
      ] },
      { sub: 'disclaimer', type: 'text', label: '免责声明' }
    ] },
    { path: 'pitfalls', kind: 'list', item: { kind: 'pair' }, warn: '误区词云' }
  ]
};

/* ---------- 通用配置引擎（基座） ---------- */
var CourseKit = window.CourseKit;
var ENGINE = CourseKit.makeConfigEngine({ schema: METRICS_SCHEMA, defaults: METRICS_DEFAULTS, storageKey: METRICS_STORAGE_KEY });
