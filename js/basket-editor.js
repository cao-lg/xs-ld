/* ============================================================
 * 购物篮关联分析 · 在线编辑器入口（课程工具基座版）
 * ------------------------------------------------------------
 * 薄 glue：把本工具的 schema / 引擎交给通用编辑器 kit/editor.js。
 * ============================================================ */
(function () {
  'use strict';
  if (typeof CourseKit === 'undefined' || !CourseKit.mountEditor) {
    console.error('CourseKit 未加载，无法挂载购物篮编辑器');
    return;
  }
  CourseKit.mountEditor({
    schema: BASKET_SCHEMA,
    engine: ENGINE,
    mounts: {
      transactions: 'ed-transactions',
      thresholds: 'ed-thresholds',
      copy: 'ed-copy',
      pitfalls: 'ed-pitfalls',
      knowledge: 'ed-knowledge'
    },
    downloadName: 'basket-config.json'
  });
})();
