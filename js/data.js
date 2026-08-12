/* ============================================================
 * 小数 · 漏斗诊断助手 — 数据层
 * 全部数据来自《产品功能规格书 v1.0》(2026-08-10)
 *
 * 【重要】以下基准数据 / 方案 / 词云均为「可编辑参考数据」，
 * 已抽成配置对象，支持：
 *   1) 文件导入（JSON）
 *   2) 一键 URL 同步（适配 Cloudflare Pages 静态托管）
 *   3) 导出当前配置为 JSON 模板
 *   4) 恢复内置默认
 *   5) localStorage 持久化
 * 内置 DEFAULT_CONFIG 作为兜底；导入时按字段合并（缺省字段回退默认），
 * 因此可只更新部分数据（如仅改基准、不改方案）。
 * ============================================================ */

const SCHEMA_VERSION = '1.0';
const STORAGE_KEY = 'xiaoshu.config.v1';

/* ---------- 内置默认配置（规格书 v1.0，兜底用） ---------- */
const DEFAULT_CONFIG = {
  /* 五大品类（顺序即展示顺序） */
  categories: ['美妆护肤', '服饰鞋包', '食品饮料', '家电数码', '日用百货'],

  /* 六层漏斗节点定义（结构骨架，不随导入改变） */
  funnelStages: [
    { key: 'exposure', label: '曝光量' },
    { key: 'click',    label: '点击量' },
    { key: 'cart',     label: '加购量' },
    { key: 'order',    label: '下单量' },
    { key: 'pay',      label: '支付量' },
    { key: 'finish',   label: '完成交易' }
  ],

  /* 五段转化率定义：from -> to（结构骨架，不随导入改变） */
  convSteps: [
    { key: 'ctr',    from: 'exposure', to: 'click',  label: '曝光→点击' },
    { key: 'cart',   from: 'click',    to: 'cart',   label: '点击→加购' },
    { key: 'order',  from: 'cart',     to: 'order',  label: '加购→下单' },
    { key: 'pay',    from: 'order',    to: 'pay',    label: '下单→支付' },
    { key: 'finish', from: 'pay',      to: 'finish', label: '支付→完成' }
  ],

  /* 行业基准速查表（单位 %）
   * 每个品类给出五段转化率的 [下限, 上限]，下标顺序同 convSteps */
  benchmarks: {
    '美妆护肤': { ctr: [15, 25], cart: [20, 30], order: [40, 60], pay: [85, 95], finish: [90, 95] },
    '服饰鞋包': { ctr: [10, 18], cart: [15, 25], order: [35, 55], pay: [82, 92], finish: [80, 90] },
    '食品饮料': { ctr: [8, 15],  cart: [25, 40], order: [50, 70], pay: [90, 96], finish: [93, 97] },
    '家电数码': { ctr: [5, 10],  cart: [8, 18],  order: [30, 48], pay: [78, 90], finish: [85, 93] },
    '日用百货': { ctr: [8, 16],  cart: [20, 35], order: [45, 65], pay: [88, 94], finish: [90, 95] }
  },

  /* 基准设计依据（透明度说明） */
  benchmarkLogic: {
    '美妆护肤': '视觉驱动+冲动消费，CTR 和加购率高；客单中等，支付率中高；退货率低',
    '服饰鞋包': 'CTR 低于美妆，尺码/色差导致加购犹豫；退货率高（完成交易率最低）',
    '食品饮料': '客单最低+刚需，加购率和下单率最高；支付率接近天花板；退货率几乎为零',
    '家电数码': '高客单+长决策链，CTR 和加购率全品类最低；支付易犹豫（支付率最低）',
    '日用百货': '低客单+高频，全指标居中偏上，没有极端瓶颈'
  },

  /* 各品类智能方案推荐 + 模拟结果
   * payRate: 支付率预测(%)，gmv/profit: GMV/利润变动(%)，
   * tag: 方案标签，best: 是否最优解，extra: 附加影响说明，logic: 测算逻辑 */
  plans: {
    '美妆护肤': [
      { key: 'A', name: '满99包邮',      payRate: 85, gmv: 12,  profit: 15, extra: '成本受门槛控制', tag: '⭐最优',   best: true,
        logic: '美妆客单约39元，8元运费占比超20%，是支付环节最大摩擦点。满99包邮以门槛控制成本，既消除运费心理障碍，又通过提升客单覆盖利润。' },
      { key: 'B', name: '全场免邮',      payRate: 88, gmv: 18,  profit: -3, extra: '利润被运费吞噬', tag: '赔本赚吆喝', best: false,
        logic: '免邮消除支付阻力、GMV 提升明显，但运费全免直接吃掉利润，属短期冲量策略。' },
      { key: 'C', name: '送5元无门槛券', payRate: 80, gmv: 8,   profit: 5,  extra: '温和刺激',     tag: '效果一般', best: false,
        logic: '无门槛券降低下单门槛，对支付率提升有限，适合作为辅助手段。' },
      { key: 'D', name: '开通花呗分期',  payRate: 78, gmv: 3,   profit: 2,  extra: '高客单才显效', tag: '几乎无效', best: false,
        logic: '美妆客单偏低，分期对支付率的拉动极小，性价比低。' }
    ],
    '服饰鞋包': [
      { key: 'A', name: '赠送运费险',    payRate: 88, gmv: 10, profit: 6,  extra: '退货+3%，但用户敢下单', tag: '⭐最优',  best: true,
        logic: '服饰退货率拖低完成交易率，运费险降低「买错白花钱」的心理阻力，让用户更敢下单。' },
      { key: 'B', name: '尺码推荐AI',    payRate: 84, gmv: 8,  profit: 10, extra: '退货−5%',          tag: '高利润',  best: false,
        logic: 'AI 尺码推荐从源头减少因尺码不符导致的退货，利润保护最好。' },
      { key: 'C', name: '全场包邮',      payRate: 90, gmv: 15, profit: -2, extra: '—',               tag: '风险',    best: false,
        logic: '包邮推动支付率与 GMV，但叠加高退货率会放大亏损风险。' },
      { key: 'D', name: '首单9折',       payRate: 82, gmv: 5,  profit: 3,  extra: '—',               tag: '效果弱',  best: false,
        logic: '首单折扣拉新效果一般，对核心的支付犹豫改善有限。' }
    ],
    '食品饮料': [
      { key: 'A', name: '满59减10',     payRate: 93, gmv: 14, profit: 8,  extra: '客单+18%', tag: '⭐最优', best: true,
        logic: '食品支付率已达90%+（天花板高），核心矛盾是薄利，满减优先提客单而非单纯降价。' },
      { key: 'B', name: '第2件半价',    payRate: 91, gmv: 18, profit: 5,  extra: '客单+35%', tag: '冲GMV', best: false,
        logic: '第二件半价强力拉动件数与 GMV，适合清库存/做爆款。' },
      { key: 'C', name: '新人专享价',   payRate: 94, gmv: 6,  profit: 2,  extra: '拉新强',   tag: '拉新强', best: false,
        logic: '新人价用于拉新转化，对老客价值有限。' },
      { key: 'D', name: '限时秒杀',     payRate: 95, gmv: 10, profit: -1, extra: '客单-10%', tag: '赔本冲量', best: false,
        logic: '秒杀冲量但压低客单与利润，仅适合做流量入口。' }
    ],
    '家电数码': [
      { key: 'A', name: '3/6期免息',    payRate: 85, gmv: 15, profit: 12, extra: '下单→支付率+8%', tag: '⭐最优', best: true,
        logic: '支付率最低是核心瓶颈，分期免息直接降低高客单的支付心理门槛，是最精准的支付率提升方案。' },
      { key: 'B', name: '以旧换新补贴', payRate: 82, gmv: 10, profit: 5,  extra: '点击率+15%',    tag: '拉新强', best: false,
        logic: '以旧换新撬动换机需求、提升点击转化，适合拉新。' },
      { key: 'C', name: '延保服务赠送', payRate: 80, gmv: 8,  profit: 3,  extra: '—',            tag: '辅助',   best: false,
        logic: '延保提升信任与客单，对支付率拉动温和，属辅助手段。' },
      { key: 'D', name: '直降100元',    payRate: 87, gmv: 12, profit: -5, extra: '—',            tag: '伤利润', best: false,
        logic: '直降强力刺激支付，但高客单下直接让利伤利润。' }
    ],
    '日用百货': [
      { key: 'A', name: '满49减5',     payRate: 92, gmv: 12, profit: 10, extra: '客单+20%', tag: '⭐最优', best: true,
        logic: '支付率已高，核心提客单与件数；满减比单纯打折更能保护利润。' },
      { key: 'B', name: '3件8折',      payRate: 90, gmv: 20, profit: 6,  extra: '件数+50%', tag: '冲量',   best: false,
        logic: '多件折扣拉升单次购买件数与 GMV，适合高频复购品类。' },
      { key: 'C', name: '会员95折',    payRate: 93, gmv: 5,  profit: 3,  extra: '留存+30%', tag: '长期',   best: false,
        logic: '会员折扣提升长期留存，短期 GMV 拉动有限。' },
      { key: 'D', name: '组合装优惠',  payRate: 91, gmv: 15, profit: 12, extra: '—',        tag: '高利润', best: false,
        logic: '组合装提升客单与利润，是利润与销量兼顾的优选。' }
    ]
  },

  /* 微课固定案例 · 美妆护肤默认数据（硬编码锁定，可随导入更新） */
  courseLock: {
    category: '美妆护肤',
    data: { exposure: 100000, click: 30000, cart: 9000, order: 3600, pay: 2700, finish: 2484 }
  },

  /* 文案（欢迎 / 节点提示 / 免责），switchHint 为函数内置，不随 JSON 导入 */
  copy: {
    welcome: '你好，我是小数 🧠 一位漏斗诊断助手。请选择品类，然后输入六层漏斗数据，我来帮你做全链路转化分析～',
    tips: {
      enter: '请选择品类，然后输入六层漏斗数据～',
      dataReady: '数据已就绪，点击「生成漏斗图」查看全链路转化分析',
      funnelDone: '漏斗图已生成！红色高亮环节需要重点关注。点击「行业基准对标」查看对比',
      benchmarkDone: '你的支付转化率低于同品类基准，建议点击「智能推荐方案」获取优化建议',
      plansReady: '已收到 4 个方案，点击「一键模拟对比」，我帮你同时跑一遍',
      simulateDone: '四方案模拟完毕！绿色高亮为最优解，点击每个方案可查看详细测算逻辑'
    },
    disclaimer: '⚠️ 模拟预测基于历史数据与模型假设，仅供参考。不同品类基准不同，请务必同品类对比。'
  },

  /* 下钻诊断 · 痛点词云关键词（按转化率环节）
   * 每个环节给出若干「可能瓶颈原因」关键词，value 为权重（词云字号） */
  painWords: {
    ctr:    [['主图同质化', 30], ['标题不精准', 22], ['人群错配', 20], ['竞品截流', 16], ['首图无卖点', 15], ['投放时段差', 12], ['价格无优势', 11]],
    cart:   [['详情页信任弱', 28], ['尺码/规格不清', 24], ['评价负面', 20], ['凑单门槛高', 17], ['缺对比测评', 14], ['优惠不显性', 12]],
    order:  [['决策犹豫', 26], ['缺紧迫感', 22], ['库存焦虑', 18], ['客服缺位', 16], ['比价流失', 14], ['支付选项少', 12]],
    pay:    [['运费占比高', 30], ['支付摩擦', 24], ['客单超预算', 20], ['分期缺失', 17], ['临门放弃', 14], ['优惠难叠加', 12]],
    finish: [['尺码不符退货', 28], ['预期落差', 24], ['物流体验差', 19], ['售后响应慢', 16], ['冲动消退', 13], ['假货疑虑', 10]]
  }
};

/* ---------- 结构骨架常量（固定，不随导入改变） ---------- */
const FUNNEL_STAGES = DEFAULT_CONFIG.funnelStages;
const CONV_STEPS = DEFAULT_CONFIG.convSteps;
const CONV_KEYS = CONV_STEPS.map((s) => s.key);

/* ---------- 运行时数据（可被 applyConfig 覆盖） ---------- */
let CATEGORIES = DEFAULT_CONFIG.categories.slice();
let BENCHMARK = clone(DEFAULT_CONFIG.benchmarks);
let BENCHMARK_LOGIC = Object.assign({}, DEFAULT_CONFIG.benchmarkLogic);
let PLANS = clone(DEFAULT_CONFIG.plans);
let PAIN_WORDS = clone(DEFAULT_CONFIG.painWords);
let COURSE_LOCK = clone(DEFAULT_CONFIG.courseLock);
let COPY = {
  welcome: DEFAULT_CONFIG.copy.welcome,
  tips: Object.assign({}, DEFAULT_CONFIG.copy.tips),
  disclaimer: DEFAULT_CONFIG.copy.disclaimer,
  switchHint: (cat) => `基准已切换至【${cat}】，不同品类基准不可直接对比`
};

/* ---------- 工具：深拷贝（数据为 JSON 安全类型） ---------- */
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function isNum(x) { return typeof x === 'number' && isFinite(x); }
function isPlainObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }

/* ============================================================
 * 配置校验 / 合并 / 导出 / 应用 / 存储
 * ============================================================ */

/* 校验导入的原始对象，返回 { ok, errors[], warnings[], cfg }
 * 采用「宽容合并」策略：结构错误记为 error（拒绝），
 * 取值范围/缺字段等记为 warning（回退默认并继续）。 */
function validateConfig(raw) {
  const errors = [];
  const warnings = [];
  if (!isPlainObj(raw)) {
    return { ok: false, errors: ['根节点必须是 JSON 对象'], warnings };
  }
  const cfg = clone(DEFAULT_CONFIG);

  /* --- categories --- */
  if (raw.categories !== undefined) {
    if (!Array.isArray(raw.categories) || raw.categories.length === 0 ||
        !raw.categories.every((c) => typeof c === 'string' && c.trim())) {
      errors.push('categories 必须是非空字符串数组');
    } else {
      cfg.categories = raw.categories.map((c) => c.trim());
    }
  }

  /* --- benchmarks --- */
  if (raw.benchmarks !== undefined) {
    if (!isPlainObj(raw.benchmarks)) {
      errors.push('benchmarks 必须是对象（品类 -> 各环节 [下限,上限]）');
    } else {
      const cats = cfg.categories;
      const merged = {};
      cats.forEach((cat) => {
        const src = raw.benchmarks[cat];
        const def = DEFAULT_CONFIG.benchmarks[cat] || {};
        if (!src || !isPlainObj(src)) { merged[cat] = Object.assign({}, def); return; }
        const stepObj = {};
        CONV_KEYS.forEach((k) => {
          if (src[k] === undefined) { stepObj[k] = def[k] || [0, 100]; return; }
          const v = src[k];
          if (Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])) {
            if (v[0] > v[1]) { warnings.push(`基准「${cat}.${k}」下限>上限，已回退默认`); stepObj[k] = def[k] || [0, 100]; }
            else stepObj[k] = [v[0], v[1]];
          } else { warnings.push(`基准「${cat}.${k}」格式错误，已回退默认`); stepObj[k] = def[k] || [0, 100]; }
        });
        merged[cat] = stepObj;
      });
      cfg.benchmarks = merged;
    }
  }

  /* --- benchmarkLogic --- */
  if (raw.benchmarkLogic !== undefined && isPlainObj(raw.benchmarkLogic)) {
    cfg.benchmarkLogic = Object.assign({}, DEFAULT_CONFIG.benchmarkLogic, raw.benchmarkLogic);
  }

  /* --- plans --- */
  if (raw.plans !== undefined) {
    if (!isPlainObj(raw.plans)) {
      errors.push('plans 必须是对象（品类 -> 方案数组）');
    } else {
      const merged = {};
      cfg.categories.forEach((cat) => {
        const src = raw.plans[cat];
        if (!Array.isArray(src) || src.length === 0) { merged[cat] = DEFAULT_CONFIG.plans[cat] || []; return; }
        merged[cat] = src.map((p, i) => {
          if (!isPlainObj(p)) { warnings.push(`方案「${cat}[${i}]」格式错误，已跳过`); return null; }
          const def = (DEFAULT_CONFIG.plans[cat] || [])[i] || {};
          const out = {
            key: (typeof p.key === 'string' && p.key) ? p.key : (def.key || String.fromCharCode(65 + i)),
            name: typeof p.name === 'string' ? p.name : (def.name || `方案${p.key || i + 1}`),
            payRate: isNum(p.payRate) ? p.payRate : (def.payRate || 0),
            gmv: isNum(p.gmv) ? p.gmv : (def.gmv || 0),
            profit: isNum(p.profit) ? p.profit : (def.profit || 0),
            extra: typeof p.extra === 'string' ? p.extra : (def.extra || ''),
            tag: typeof p.tag === 'string' ? p.tag : (def.tag || ''),
            best: typeof p.best === 'boolean' ? p.best : (def.best || false),
            logic: typeof p.logic === 'string' ? p.logic : (def.logic || '')
          };
          return out;
        }).filter(Boolean);
        if (merged[cat].length === 0) merged[cat] = DEFAULT_CONFIG.plans[cat] || [];
      });
      cfg.plans = merged;
    }
  }

  /* --- painWords --- */
  if (raw.painWords !== undefined) {
    if (!isPlainObj(raw.painWords)) {
      errors.push('painWords 必须是对象（环节 -> [[词,权重],...]）');
    } else {
      const merged = {};
      CONV_KEYS.forEach((k) => {
        const src = raw.painWords[k];
        const def = DEFAULT_CONFIG.painWords[k] || [];
        if (!Array.isArray(src)) { merged[k] = def.slice(); return; }
        const arr = src
          .filter((w) => Array.isArray(w) && typeof w[0] === 'string' && isNum(w[1]))
          .map((w) => [w[0], w[1]]);
        merged[k] = arr.length ? arr : def.slice();
      });
      cfg.painWords = merged;
    }
  }

  /* --- courseLock --- */
  if (raw.courseLock !== undefined) {
    if (!isPlainObj(raw.courseLock) || typeof raw.courseLock.category !== 'string' ||
        !isPlainObj(raw.courseLock.data)) {
      warnings.push('courseLock 格式错误，已回退默认');
    } else {
      const data = {};
      FUNNEL_STAGES.forEach((s) => { data[s.key] = isNum(raw.courseLock.data[s.key]) ? raw.courseLock.data[s.key] : DEFAULT_CONFIG.courseLock.data[s.key]; });
      cfg.courseLock = { category: raw.courseLock.category, data };
    }
  }

  /* --- copy --- */
  if (raw.copy !== undefined && isPlainObj(raw.copy)) {
    if (typeof raw.copy.welcome === 'string') cfg.copy.welcome = raw.copy.welcome;
    if (isPlainObj(raw.copy.tips)) cfg.copy.tips = Object.assign({}, DEFAULT_CONFIG.copy.tips, raw.copy.tips);
    if (typeof raw.copy.disclaimer === 'string') cfg.copy.disclaimer = raw.copy.disclaimer;
  }

  return { ok: errors.length === 0, errors, warnings, cfg };
}

/* 应用配置：覆盖运行时变量（不覆盖结构骨架）。返回 { ok, errors, warnings } */
function applyConfig(raw) {
  const res = validateConfig(raw);
  if (!res.ok) return { ok: false, errors: res.errors, warnings: [] };
  const c = res.cfg;
  CATEGORIES = c.categories.slice();
  BENCHMARK = c.benchmarks;
  BENCHMARK_LOGIC = c.benchmarkLogic;
  PLANS = c.plans;
  PAIN_WORDS = c.painWords;
  COURSE_LOCK = c.courseLock;
  COPY.welcome = c.copy.welcome;
  COPY.tips = c.copy.tips;
  COPY.disclaimer = c.copy.disclaimer;
  return { ok: true, errors: [], warnings: res.warnings };
}

/* 恢复内置默认 */
function resetToDefault() {
  const res = applyConfig({});
  CATEGORIES = DEFAULT_CONFIG.categories.slice();
  BENCHMARK = clone(DEFAULT_CONFIG.benchmarks);
  BENCHMARK_LOGIC = Object.assign({}, DEFAULT_CONFIG.benchmarkLogic);
  PLANS = clone(DEFAULT_CONFIG.plans);
  PAIN_WORDS = clone(DEFAULT_CONFIG.painWords);
  COURSE_LOCK = clone(DEFAULT_CONFIG.courseLock);
  COPY.welcome = DEFAULT_CONFIG.copy.welcome;
  COPY.tips = Object.assign({}, DEFAULT_CONFIG.copy.tips);
  COPY.disclaimer = DEFAULT_CONFIG.copy.disclaimer;
  return res;
}

/* 导出当前运行配置为 JSON 对象（含元信息，可直接回灌） */
function exportConfig(meta = {}) {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: meta.updatedAt || new Date().toISOString().slice(0, 10),
    source: meta.source || '手动导出',
    categories: CATEGORIES,
    benchmarks: BENCHMARK,
    benchmarkLogic: BENCHMARK_LOGIC,
    plans: PLANS,
    painWords: PAIN_WORDS,
    courseLock: COURSE_LOCK,
    copy: { welcome: COPY.welcome, tips: COPY.tips, disclaimer: COPY.disclaimer }
  };
}

/* ---------- localStorage 持久化 ---------- */
function saveStoredConfig(meta) {
  try {
    const payload = { meta: Object.assign({ schemaVersion: SCHEMA_VERSION, savedAt: new Date().toISOString() }, meta), config: exportConfig(meta) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (e) { return false; }
}
function loadStoredConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.config) return null;
    return payload;
  } catch (e) { return null; }
}
function clearStoredConfig() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

/* ============================================================
 * 健康度判定 + 诊断（计算逻辑固定，不随导入改变）
 * ============================================================ */

/* 健康度判定规则
 * 超标(🟢)：本店值 ≥ 行业基准上限
 * 在基准内(🟡)：行业基准下限 ≤ 本店值 < 行业基准上限
 * 低于基准(🔴)：本店值 < 行业基准下限 */
function healthOf(value, range) {
  if (value >= range[1]) return 'good';   // 🟢 超标
  if (value >= range[0]) return 'mid';     // 🟡 在基准内
  return 'low';                            // 🔴 低于基准
}
const HEALTH_META = {
  good: { dot: '🟢', text: '超标（优于基准）' },
  mid:  { dot: '🟡', text: '在基准内' },
  low:  { dot: '🔴', text: '低于基准（需关注）' }
};

/* 环节诊断文案：依据本店转化率与基准区间生成 */
function diagnoseStep(stepKey, rate, range, category) {
  const h = healthOf(rate, range);
  const [low, up] = range;
  const gap = rate < low ? (low - rate) : 0;
  if (h === 'good') {
    return { health: h, text: `${stepKeyLabel(stepKey)}达标（${rate.toFixed(1)}% ≥ 基准上限 ${up}%），属优势环节，可复用经验。` };
  }
  if (h === 'mid') {
    return { health: h, text: `${stepKeyLabel(stepKey)}处于基准区间（${low}%–${up}%），${rate.toFixed(1)}% 尚有优化空间。` };
  }
  return {
    health: h,
    text: `${stepKeyLabel(stepKey)}低于基准（${rate.toFixed(1)}% < 下限 ${low}%，差 ${gap.toFixed(1)}pt），是当前最需关注的瓶颈，结合下方「痛点词云」定位原因。`
  };
}
function stepKeyLabel(k) {
  const m = { ctr: '点击转化', cart: '加购转化', order: '下单转化', pay: '支付转化', finish: '完成转化' };
  return m[k] || k;
}
