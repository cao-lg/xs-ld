/* ============================================================
 * RFM 客户分群 · 配置层（课程工具基座版）
 * ------------------------------------------------------------
 * 与漏斗 / 时间序列同构：数据形状由 RFM_DEFAULTS 提供，
 * 字段融合规则由 RFM_SCHEMA 声明，校验/合并/导入导出/localStorage
 * 全部委托 kit/config.js 的泛型引擎。复用基准数据管理 / 在线编辑器。
 *
 * 设计：
 *   - customers : 客户清单（姓名 / 最近消费天数 R / 消费频次 F / 消费金额 M）
 *   - scoring   : 分位档数（默认 5，即五分位打分 1–5）
 *   - segments  : 8 类标准客户群标签 / 配色 / 说明（分群规则由 app 计算）
 *   - copy      : 欢迎语 / 分步提示 / 免责声明
 *   - pitfalls  : 常见误区词云（词 + 权重）
 * ============================================================ */

const RFM_SCHEMA_VERSION = '1.0';
const RFM_STORAGE_KEY = 'rfm.config.v1';

/* ---------- 确定性生成教学示例客户（30 位，无随机） ---------- */
function rfmRandom(seed) {
  var s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
function genCustomers() {
  var rnd = rfmRandom(20240810);
  var surnames = ['张', '王', '李', '赵', '陈', '刘', '杨', '黄', '周', '吴',
    '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗',
    '郑', '梁', '谢', '宋', '唐', '许', '韩', '冯', '邓', '曹'];
  var givens = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋',
    '勇', '艳', '杰', '娟', '涛', '明', '超', '霞', '平', '刚',
    '桂英', '建华', '志强', '秀兰', '海燕', '文', '倩', '鹏', '梅', '宇'];
  var arr = [];
  for (var i = 0; i < 30; i++) {
    var recency = Math.round(1 + rnd() * 119);      // 1–120 天
    var frequency = Math.round(1 + rnd() * 39);      // 1–40 次
    var monetary = Math.round(80 + rnd() * 7920);    // ¥80–¥8000
    arr.push({ name: surnames[i] + givens[i], recency: recency, frequency: frequency, monetary: monetary });
  }
  return arr;
}

/* ---------- 内置默认配置 ---------- */
const RFM_DEFAULTS = {
  customers: genCustomers(),
  scoring: { levels: 5 },
  segments: [
    { label: '重要价值客户', color: '#5b6cff', desc: 'R高 F高 M高：最近购买、频次与金额都高，最优质客户，优先维系' },
    { label: '重要挽留客户', color: '#e0a300', desc: 'R低 F高 M高：高价值但近期流失，重点挽回对象' },
    { label: '重要发展客户', color: '#2bb3c0', desc: 'R高 F低 M高：近期活跃、金额高但频次低，提升复购频次' },
    { label: '一般保持客户', color: '#9aa0c4', desc: 'R低 F低 M高：金额尚可、其余偏弱，常规维系' },
    { label: '潜力价值客户', color: '#1faa6b', desc: 'R高 F高 M低：活跃高频但客单低，提升客单价' },
    { label: '一般发展客户', color: '#c0c4d8', desc: 'R低 F高 M低：频次高但近期冷、客单低，培育期' },
    { label: '新客培育客户', color: '#7d5bd6', desc: 'R高 F低 M低：新近但各项浅，处于培育阶段' },
    { label: '一般挽留客户', color: '#b0b4c8', desc: 'R低 F低 M低：全面低迷，关注维护成本' }
  ],
  /* 课堂知识点注解：可在课堂讲解时展开对照的概念卡片（title + body） */
  knowledge: [
    { title: 'R / F / M 三个维度', body: 'R（Recency 最近一次消费）：客户多久没买了，越小=越近期=越活跃，是流失预警最灵敏的信号。\nF（Frequency 消费频次）：一段时间买了几次，反映忠诚度与黏性。\nM（Monetary 消费金额）：累计花了多少，直接贡献营收。' },
    { title: '为什么要五分位打分', body: '原始 R/F/M 量纲不同（天 / 次 / 元），不能直接相加。\n按各自分位（本工具五分位 1–5）标准化后，才能横向组合成客户群。' },
    { title: 'R 是反向指标', body: 'R 越大说明越久没来（越危险），所以打分要"反向"：R 天数越大分越低。\nF、M 越大分越高。五分位切分时注意方向。' },
    { title: '8 类客户群怎么来的', body: '把每个维度按"高(≥4分) / 低(≤3分)"二分，2×2×2 = 8 种组合，互斥且覆盖全部客户，对应 8 类标准客户群。' },
    { title: '重要价值客户（R高F高M高）', body: '最近买过、常买、花得多，最优质客户。\n策略：VIP 维系、专属权益、防流失；投入产出比最高。' },
    { title: '重要挽留客户（R低F高M高）', body: '以前花得多、常买，但最近没来——高价值却濒临流失。\n策略：重点挽回，召回券 / 关怀触达，先唤醒再转化。' },
    { title: '潜力 / 发展 / 新客 / 挽留', body: '潜力价值（高频低客单→提客单价）；重要发展（高客单低频→提复购）；\n新客培育（刚来全浅→培育）；一般挽留（全低→控成本）。每类打法不同。' },
    { title: '分群之后要有运营动作', body: '分群不是终点。要给每类客户配差异化触达（权益 / 召回 / 培育 / 控本），\n并用复购率、留存率验证效果，形成"分群→运营→复盘"闭环。' }
  ],
  copy: {
    welcome: '你好，我是小数 👥 一位 RFM 客户分群助手。RFM 用「最近一次消费 R、消费频次 F、消费金额 M」给客户打分，再聚成 8 类，帮你定位谁该重点维护、谁该挽回。',
    tips: {
      enter: '可载入内置示例客户，或在下方粘贴你自己的客户数据（格式：姓名,最近天数,频次,金额）',
      dataReady: '客户数据已就绪，点击「RFM 评分」按五分位给每位客户打 1–5 分',
      scored: '评分完成！R/F/M 各 1–5 分（5 最优）。下一步按规则聚成 8 类客户群',
      segmented: '分群完成，下方按价值与规模展示了 8 类客户群',
      scaleDone: '分群规模已统计，柱形颜色对应各客户群',
      valueDone: '分群价值已统计，可对比各群的金额贡献'
    },
    disclaimer: '⚠️ RFM 分群基于历史交易，仅反映过去行为；分位阈值与分群规则可结合业务调整，结论仅供参考。'
  },
  pitfalls: [
    ['只看金额忽略频次', 28], ['R/F/M 权重一刀切', 24], ['阈值生搬硬套', 20],
    ['样本量太小失真', 16], ['忽视流失预警', 14], ['分群后无运营动作', 12]
  ]
};

/* ---------- 配置 Schema ---------- */
const RFM_SCHEMA = {
  schemaVersion: RFM_SCHEMA_VERSION,
  fields: [
    { path: 'customers', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'name', type: 'string', label: '客户名' },
      { sub: 'recency', type: 'number', label: 'R 最近天数(越小越近)' },
      { sub: 'frequency', type: 'number', label: 'F 消费频次' },
      { sub: 'monetary', type: 'number', label: 'M 消费金额' }
    ] }, warn: '客户数据' },
    { path: 'scoring', kind: 'object', fields: [
      { sub: 'levels', type: 'number', label: '分位档数(默认5)' }
    ] },
    { path: 'segments', kind: 'list', item: { kind: 'object', fields: [
      { sub: 'label', type: 'string', label: '分群名' },
      { sub: 'color', type: 'string', label: '配色' },
      { sub: 'desc', type: 'text', label: '说明' }
    ] } },
    { path: 'knowledge', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'title', type: 'string', label: '知识点' },
      { sub: 'body', type: 'text', label: '注解' }
    ] }, warn: '课堂知识点' },
    { path: 'copy', kind: 'object', fields: [
      { sub: 'welcome', type: 'text', label: '欢迎语' },
      { sub: 'tips', type: 'object', fields: [
        { sub: 'enter', type: 'text' }, { sub: 'dataReady', type: 'text' }, { sub: 'scored', type: 'text' },
        { sub: 'segmented', type: 'text' }, { sub: 'scaleDone', type: 'text' }, { sub: 'valueDone', type: 'text' }
      ] },
      { sub: 'disclaimer', type: 'text', label: '免责声明' }
    ] },
    { path: 'pitfalls', kind: 'list', item: { kind: 'pair' }, warn: '误区词云' }
  ]
};

/* ---------- 通用配置引擎（基座） ---------- */
var CourseKit = window.CourseKit;
var ENGINE = CourseKit.makeConfigEngine({ schema: RFM_SCHEMA, defaults: RFM_DEFAULTS, storageKey: RFM_STORAGE_KEY });
