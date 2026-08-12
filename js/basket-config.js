/* ============================================================
 * 购物篮关联分析 · 配置层（课程工具基座版）
 * ------------------------------------------------------------
 * 与漏斗 / 时间序列 / RFM / ABC 同构：数据形状由 BASKET_DEFAULTS 提供，
 * 字段融合规则由 BASKET_SCHEMA 声明，校验/合并/导入导出/localStorage
 * 全部委托 kit/config.js 的泛型引擎。复用基准数据管理 / 在线编辑器。
 *
 * 设计：
 *   - transactions : 交易清单（编号 + 购买商品，逗号分隔）
 *   - thresholds   : 关联规则阈值（最小支持度 / 最小置信度 / 最小提升度）
 *   - copy         : 欢迎语 / 分步提示 / 免责声明
 *   - pitfalls     : 常见误区词云（词 + 权重）
 * ============================================================ */

const BASKET_SCHEMA_VERSION = '1.0';
const BASKET_STORAGE_KEY = 'basket.config.v1';

/* ---------- 内置默认配置（确定性教学交易，含经典尿布↔啤酒关联） ---------- */
const BASKET_DEFAULTS = {
  transactions: [
    { label: 'T01', items: '牛奶,面包,鸡蛋' },
    { label: 'T02', items: '尿布,啤酒,薯片' },
    { label: 'T03', items: '牛奶,面包,咖啡' },
    { label: 'T04', items: '尿布,啤酒,可乐' },
    { label: 'T05', items: '苹果,鸡蛋,牛奶' },
    { label: 'T06', items: '尿布,啤酒,纸巾' },
    { label: 'T07', items: '面包,咖啡,牛奶' },
    { label: 'T08', items: '啤酒,尿布,薯片,可乐' },
    { label: 'T09', items: '鸡蛋,苹果' },
    { label: 'T10', items: '牛奶,面包' },
    { label: 'T11', items: '尿布,啤酒' },
    { label: 'T12', items: '咖啡,牛奶,面包' },
    { label: 'T13', items: '纸巾,尿布,啤酒' },
    { label: 'T14', items: '鸡蛋,牛奶,苹果' },
    { label: 'T15', items: '薯片,啤酒,尿布' },
    { label: 'T16', items: '面包,牛奶,咖啡,鸡蛋' },
    { label: 'T17', items: '尿布,啤酒,可乐' },
    { label: 'T18', items: '苹果,鸡蛋' },
    { label: 'T19', items: '牛奶,面包,尿布,啤酒' },
    { label: 'T20', items: '咖啡,牛奶' },
    { label: 'T21', items: '纸巾,鸡蛋,苹果' },
    { label: 'T22', items: '尿布,啤酒,薯片' },
    { label: 'T23', items: '面包,牛奶,鸡蛋' },
    { label: 'T24', items: '啤酒,尿布,可乐,纸巾' }
  ],
  thresholds: { minSupport: 0.1, minConfidence: 0.3, minLift: 1.0 },
  copy: {
    welcome: '你好，我是小数 🛒 一位购物篮关联分析助手。我用「支持度 / 置信度 / 提升度」从交易数据里发现「买了 A 的人常买 B」的搭配规律，帮门店做组合陈列与捆绑推荐。',
    tips: {
      enter: '每行一笔交易：编号, 商品1, 商品2, …（商品用逗号分隔）。可先点「载入内置示例」',
      dataReady: '交易数据已就绪，点击「频次统计」看单品与双品支持度',
      freqDone: '频次统计完成！支持度 = 出现该组合的交易数 ÷ 总交易数',
      rulesDone: '关联规则已生成（按阈值过滤）。提升度 > 1 表示正相关，< 1 表示负相关，= 1 表示独立',
      scatterDone: '散点图：横轴支持度、纵轴置信度、气泡大小=提升度。右上方+大气泡=高价值规则',
      listDone: '强关联规则已按提升度排序，便于直接落地到营销动作'
    },
    disclaimer: '⚠️ 关联规则只揭示共现关系，不等于因果；低频项的强规则可能不稳定，请结合业务与样本量判断。'
  },
  pitfalls: [
    ['混淆相关与因果', 30], ['只看置信度忽略支持度', 26], ['低频项产生假强规则', 20],
    ['样本量太小不可靠', 18], ['提升度=1 误当无关', 15], ['规则方向≠业务方向', 14],
    ['阈值设错漏掉真规则', 12]
  ]
};

/* ---------- 配置 Schema ---------- */
const BASKET_SCHEMA = {
  schemaVersion: BASKET_SCHEMA_VERSION,
  fields: [
    { path: 'transactions', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'label', type: 'string', label: '交易编号' },
      { sub: 'items', type: 'string', label: '购买商品(逗号分隔)' }
    ] }, warn: '交易数据' },
    { path: 'thresholds', kind: 'object', fields: [
      { sub: 'minSupport', type: 'number', label: '最小支持度(0–1)' },
      { sub: 'minConfidence', type: 'number', label: '最小置信度(0–1)' },
      { sub: 'minLift', type: 'number', label: '最小提升度(≥1 才有正向关联)' }
    ] },
    { path: 'copy', kind: 'object', fields: [
      { sub: 'welcome', type: 'text', label: '欢迎语' },
      { sub: 'tips', type: 'object', fields: [
        { sub: 'enter', type: 'text' }, { sub: 'dataReady', type: 'text' }, { sub: 'freqDone', type: 'text' },
        { sub: 'rulesDone', type: 'text' }, { sub: 'scatterDone', type: 'text' }, { sub: 'listDone', type: 'text' }
      ] },
      { sub: 'disclaimer', type: 'text', label: '免责声明' }
    ] },
    { path: 'pitfalls', kind: 'list', item: { kind: 'pair' }, warn: '误区词云' }
  ]
};

/* ---------- 通用配置引擎（基座） ---------- */
var CourseKit = window.CourseKit;
var ENGINE = CourseKit.makeConfigEngine({ schema: BASKET_SCHEMA, defaults: BASKET_DEFAULTS, storageKey: BASKET_STORAGE_KEY });
