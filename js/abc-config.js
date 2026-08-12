/* ============================================================
 * ABC / 帕累托分析 · 配置层（课程工具基座版）
 * ------------------------------------------------------------
 * 与漏斗 / 时间序列 / RFM 同构：数据形状由 ABC_DEFAULTS 提供，
 * 字段融合规则由 ABC_SCHEMA 声明，校验/合并/导入导出/localStorage
 * 全部委托 kit/config.js 的泛型引擎。复用基准数据管理 / 在线编辑器。
 *
 * 设计：
 *   - items      : 商品清单（名称 / 销售额）
 *   - thresholds : 累计占比分界（A ≤ 80%，B ≤ 95%，其余为 C）
 *   - copy       : 欢迎语 / 分步提示 / 免责声明
 *   - pitfalls   : 常见误区词云（词 + 权重）
 * ============================================================ */

const ABC_SCHEMA_VERSION = '1.0';
const ABC_STORAGE_KEY = 'abc.config.v1';

/* ---------- 确定性生成教学示例商品（20 个，长尾分布，无随机） ---------- */
function abcRandom(seed) {
  var s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}
function genItems() {
  var rnd = abcRandom(99173);
  var names = ['连衣裙', '运动鞋', '保温杯', '蓝牙耳机', '精华液', '零食大礼包', '儿童绘本',
    '电动牙刷', '瑜伽垫', '充电宝', '收纳箱', '咖啡豆', '面膜', '文具套装',
    '宠物粮', '厨具三件套', '帽子', '数据线', '香薰', '袜子'];
  var arr = [];
  for (var i = 0; i < names.length; i++) {
    var u = rnd();
    var rev = Math.round(200 + Math.pow(u, 2.4) * 9800); // 200–10000，长尾
    arr.push({ name: names[i], revenue: rev });
  }
  return arr;
}

/* ---------- 内置默认配置 ---------- */
const ABC_DEFAULTS = {
  items: genItems(),
  thresholds: { a: 80, b: 95 },
  copy: {
    welcome: '你好，我是小数 📊 一位 ABC / 帕累托分析助手。把商品按销售额从大到小排，看累计占比——少数商品贡献大部分业绩（约 80%），据此把商品分成 A/B/C 三类，帮你把精力放在关键少数上。',
    tips: {
      enter: '可载入内置示例商品，或在下方粘贴你自己的商品数据（格式：商品名,销售额）',
      dataReady: '商品数据已就绪，点击「排序与累计」按销售额降序并算累计占比',
      sorted: '排序完成！累计占比已算出，下一步按 A≤80% / B≤95% 划分类别',
      done: '帕累托图已生成：柱为各类商品销售额，折线为累计占比，颜色区分 A/B/C',
      classified: '分类汇总完成，可看每类的商品数与金额占比'
    },
    disclaimer: '⚠️ ABC 分类比例（80/95）是经验阈值，可结合品类特性调整；分类仅基于历史销售额，未考虑利润、周转与战略意义，结论仅供参考。'
  },
  pitfalls: [
    ['只看销售额忽略利润', 30], ['阈值生搬 80/20', 24], ['忽视 C 类潜在爆款', 18],
    ['用数量代替金额', 16], ['分类后无差异运营', 14], ['样本期太短失真', 12]
  ]
};

/* ---------- 配置 Schema ---------- */
const ABC_SCHEMA = {
  schemaVersion: ABC_SCHEMA_VERSION,
  fields: [
    { path: 'items', kind: 'list', item: { kind: 'object', addable: true, deletable: true, fields: [
      { sub: 'name', type: 'string', label: '商品名' },
      { sub: 'revenue', type: 'number', label: '销售额' }
    ] }, warn: '商品数据' },
    { path: 'thresholds', kind: 'object', fields: [
      { sub: 'a', type: 'number', label: 'A 类累计占比上限(%)' },
      { sub: 'b', type: 'number', label: 'B 类累计占比上限(%)' }
    ] },
    { path: 'copy', kind: 'object', fields: [
      { sub: 'welcome', type: 'text', label: '欢迎语' },
      { sub: 'tips', type: 'object', fields: [
        { sub: 'enter', type: 'text' }, { sub: 'dataReady', type: 'text' }, { sub: 'sorted', type: 'text' },
        { sub: 'done', type: 'text' }, { sub: 'classified', type: 'text' }
      ] },
      { sub: 'disclaimer', type: 'text', label: '免责声明' }
    ] },
    { path: 'pitfalls', kind: 'list', item: { kind: 'pair' }, warn: '误区词云' }
  ]
};

/* ---------- 通用配置引擎（基座） ---------- */
var CourseKit = window.CourseKit;
var ENGINE = CourseKit.makeConfigEngine({ schema: ABC_SCHEMA, defaults: ABC_DEFAULTS, storageKey: ABC_STORAGE_KEY });
