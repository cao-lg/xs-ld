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
  ],
  knowledge: [
    { title: '关联分析解决什么问题', body: '从交易数据中发现「买了 A 的人常买 B」的搭配规律，用于组合陈列、捆绑推荐、交叉销售，而不是预测单个商品的销量。' },
    { title: '支持度（Support）', body: '某组合出现的频率 = 含该组合的交易数 ÷ 总交易数。衡量规则的代表性与样本量；支持度太低说明出现太少、结论不稳，不宜据此做决策。' },
    { title: '置信度（Confidence）', body: '条件概率：买了前项 A 的交易中，也买后项 B 的比例 = P(A∩B) ÷ P(A)。衡量规则「可信程度」，但不反映 A、B 是否本来就更常见。' },
    { title: '提升度（Lift）是关键', body: '衡量 A 与 B 是否「真的有关」：Lift = 置信度 ÷ P(B)。Lift>1 正相关（比随机更可能一起买），=1 近似独立，<1 负相关。判断规则价值要看它，而非只看置信度。' },
    { title: '尿布与啤酒的经典案例', body: '相传超市发现尿布与啤酒常被同购（新手爸爸买尿布时顺手带啤酒），据此做相邻陈列。教学示例复现了「尿布↔啤酒」的强关联，lift≈2.18。' },
    { title: '关联不等于因果', body: '规则只揭示共现，不说明 A 导致 B。可能是同一人群、同一场景使然。落地前要结合业务理解，避免把相关性当因果。' },
    { title: '阈值怎么设', body: '最小支持度过滤低频噪声，最小置信度保证可信，最小提升度卡住正向关联（≥1）。阈值过低冒出大量弱规则，过高会漏掉真规则。' },
    { title: '常见误区清单', body: '只看置信度忽略支持度、把提升度=1 当成无关、低频项产生假强规则、样本太小不可靠、规则方向（A→B 或 B→A）未必等于业务可执行的动作。' }
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
    { path: 'pitfalls', kind: 'list', item: { kind: 'pair' }, warn: '误区词云' },
    { path: 'knowledge', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'title', type: 'string', label: '知识点标题' },
      { sub: 'body', type: 'text', label: '注解内容' }
    ] }, warn: '课堂知识点' }
  ]
};

/* ---------- 通用配置引擎（基座） ---------- */
var CourseKit = window.CourseKit;
var ENGINE = CourseKit.makeConfigEngine({ schema: BASKET_SCHEMA, defaults: BASKET_DEFAULTS, storageKey: BASKET_STORAGE_KEY });
