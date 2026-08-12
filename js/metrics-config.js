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
  /* 指标五大类：配色 + 教学说明（与 indicators 的 category 字段一一对应，驱动「按分类学习」标签页） */
  categories: [
    { name: '流量', color: '#5b6cff', desc: '店铺被多少人「看见」并「进入」。是后续所有转化的入口——没有流量，一切归零。重点看 UV/PV 区分、访客质量、免费/付费来源结构。' },
    { name: '转化', color: '#1faa6b', desc: '访客「从看到 → 加购 → 下单 → 付款」的效率。同样流量下，转化率决定产出。重点看加购率、支付转化率、下单支付率，注意分母口径统一。' },
    { name: '客单价', color: '#e0a300', desc: '每笔订单 / 每位顾客的平均贡献。反映商品组合、连带率与促销策略。重点看客单价、GMV（= 访客 × 支付转化率 × 客单价）。' },
    { name: '留存', color: '#2bb3c0', desc: '顾客「再来与忠诚」的健康度。留存比拉新更便宜，是口碑与复购的晴雨表。重点看复购率（越高越好）、退换货率（越低越好）。' },
    { name: '营销', color: '#7d5bd6', desc: '投入产出效率。判断花钱买来的流量是否划算、能否规模化。重点看营销 ROI（产出/投入）、获客成本 CAC。' }
  ],
  /* 12 个月趋势（1月..12月）；values 为逗号分隔的月度数值，与 indicators 的「当前值」一致（12月=最新） */
  months: '1月,2月,3月,4月,5月,6月,7月,8月,9月,10月,11月,12月',
  trends: [
    { name: '访客数 UV', values: '98000,101000,104000,99000,106000,110000,112000,108000,115000,117000,118000,120000' },
    { name: '加购率', values: '0.170,0.175,0.180,0.172,0.185,0.190,0.192,0.188,0.195,0.198,0.199,0.200' },
    { name: '支付转化率', values: '0.0280,0.0290,0.0300,0.0285,0.0310,0.0320,0.0325,0.0318,0.0328,0.0330,0.0332,0.0333' },
    { name: '客单价', values: '145,148,150,146,152,155,156,153,158,159,159.5,160' },
    { name: '复购率', values: '0.220,0.225,0.230,0.222,0.235,0.240,0.242,0.238,0.245,0.250,0.255,0.260' },
    { name: '退换货率', values: '0.062,0.060,0.058,0.061,0.057,0.055,0.054,0.056,0.053,0.052,0.051,0.050' },
    { name: '营销 ROI', values: '2.6,2.7,2.75,2.65,2.85,2.95,3.0,2.9,3.05,3.1,3.15,3.2' }
  ],
  copy: {
    welcome: '你好，我是小数 📐 一位电商指标分析助手。我帮你按 流量 / 转化 / 客单价 / 留存 / 营销 五大类梳理运营指标：可点「指标概览」里的分类标签逐类学习（每类带教学说明），画转化漏斗、算关键比率、看 12 个月趋势与同环比、拆解 GMV，并与行业基准做雷达对标。',
    tips: {
      enter: '可在下方粘贴你的运营快照（每行：指标名, 分类, 当前值, 单位, 行业基准），或先点「载入内置示例」',
      dataReady: '指标数据已就绪，点击「指标概览」选择分类标签逐类查看',
      overviewDone: '指标概览完成，已按 流量 / 转化 / 客单价 / 留存 / 营销 分组，并标出与基准的差异',
      funnelDone: '转化漏斗完成，各环节的逐级转化率已标注',
      ratioDone: '关键比率已计算：加购率 / 支付转化率 / 客单价 / 复购率',
      radarDone: '雷达对标完成，当前值 vs 行业基准（按各自量纲归一）',
      trendDone: '趋势完成：各指标 12 个月走势（首月=100）与同环比已列出，可见「复购率/退换货率」走低为优',
      gmvDone: 'GMV 拆解完成：GMV = 访客 × 支付转化率 × 客单价，累计增长≈三者对数增长之和'
    },
    disclaimer: '⚠️ 指标口径须前后一致；转化率分母、客单价定义、复购率口径、GMV 是否含未付/退款等易混淆，请对照教学要点核对。'
  },
  pitfalls: [
    ['把 PV 当 UV', 28], ['转化率分母用错', 26], ['客单价与笔单价混淆', 22],
    ['复购率口径不一', 20], ['只看单点不看趋势', 16], ['GMV 含未付/退款', 14],
    ['优惠券拉高客单价假象', 14], ['漏斗各级分母混乱', 12], ['同环比基数选错', 13],
    ['用环比代替同比误导季节', 12], ['增长率忽略交互项', 11]
  ],
  knowledge: [
    { title: '指标口径先对齐，再谈数值', body: '同一指标在不同店铺定义可能不同：GMV 是否含退款/未付、复购率按人还是按单、客单价含不含运费。上课第一件事是统一口径，否则后面的对比与同环比全部失真。' },
    { title: 'PV 与 UV 不是一回事', body: 'PV 是页面浏览次数（同一人可多次）；UV 是去重独立访客。看「规模」用 UV，看「热度」用 PV，PV/UV 反映人均浏览深度。把 PV 当 UV 会高估流量。' },
    { title: '转化率分母要统一', body: '加购率 = 加购 / UV；支付转化率 = 支付 / UV；下单支付率 = 支付 / 下单。混用分母（如拿 PV 当分母、或拿下单当加购的分母）会严重失真。先定分母，再算率。' },
    { title: '客单价 ≠ 笔单价', body: '客单价通常按「人 / 订单」平均，笔单价按「笔」。满减凑单、连带推荐会拉高客单价，但不一定健康——要结合复购率一起看。' },
    { title: '复购率口径要固定', body: '可定义为「下过单的人中再次下单的比例」，也可定义为「订单中复购订单占比」。先做趋势就要固定口径，否则同比无意义。复购率越高越好。' },
    { title: '退换货率要双向看', body: '退换货率越低越好，但异常低也可能意味着售后门槛高、差评被压制。要结合复购率一起判断真实体验，单看一个指标会误判。' },
    { title: 'GMV 是乘积不是加法', body: 'GMV = 访客 × 支付转化率 × 客单价。累计增长（对数）≈ 三因子累计增长之和；要提升 GMV，先找准最弱的一环集中发力，而不是平均用力。' },
    { title: '同环比别混用', body: '同比（vs 去年同月）看剔除季节后的真实增长；环比（vs 上月）看短期走势。用环比代替同比会掩盖季节波动，基数选错则直接误导方向。' }
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
    { path: 'categories', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'name', type: 'string', label: '分类名（须与运营指标的分类一致）' },
      { sub: 'color', type: 'string', label: '配色（十六进制）' },
      { sub: 'desc', type: 'text', label: '教学说明（该类别衡量什么、重点看什么）' }
    ] }, warn: '指标五大类' },
    { path: 'months', type: 'string', label: '月份标签（逗号分隔，12 个）' },
    { path: 'trends', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'name', type: 'string', label: '指标名（须与运营指标一致）' },
      { sub: 'values', type: 'text', label: '月度数值（逗号分隔，12 个，对应月份顺序）' }
    ] }, warn: '12 个月趋势' },
    { path: 'copy', kind: 'object', fields: [
      { sub: 'welcome', type: 'text', label: '欢迎语' },
      { sub: 'tips', type: 'object', fields: [
        { sub: 'enter', type: 'text' }, { sub: 'dataReady', type: 'text' }, { sub: 'overviewDone', type: 'text' },
        { sub: 'funnelDone', type: 'text' }, { sub: 'ratioDone', type: 'text' }, { sub: 'radarDone', type: 'text' }
      ] },
      { sub: 'disclaimer', type: 'text', label: '免责声明' }
    ] },
    { path: 'pitfalls', kind: 'list', item: { kind: 'pair' }, warn: '误区词云' },
    { path: 'knowledge', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'title', type: 'string', label: '知识点标题' },
      { sub: 'body', type: 'text', label: '知识点正文' }
    ] }, warn: '课堂知识点' }
  ]
};

/* ---------- 通用配置引擎（基座） ---------- */
var CourseKit = window.CourseKit;
var ENGINE = CourseKit.makeConfigEngine({ schema: METRICS_SCHEMA, defaults: METRICS_DEFAULTS, storageKey: METRICS_STORAGE_KEY });
