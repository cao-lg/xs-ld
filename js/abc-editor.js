/* ============================================================
 * ABC / 帕累托分析 · 在线编辑器入口（课程工具基座版）
 * ------------------------------------------------------------
 * 薄 glue：把本工具的 schema / 引擎交给通用编辑器 kit/editor.js。
 * 依赖（按 abc-editor.html 加载顺序）：kit/config.js → kit/editor.js → js/abc-config.js
 * ============================================================ */
(function () {
  'use strict';
  if (typeof CourseKit === 'undefined' || !CourseKit.mountEditor) {
    console.error('CourseKit 未加载，无法挂载 ABC 编辑器');
    return;
  }
  CourseKit.mountEditor({
    schema: ABC_SCHEMA,
    engine: ENGINE,
    mounts: {
      items: 'ed-items',
      thresholds: 'ed-thresholds',
      copy: 'ed-copy',
      pitfalls: 'ed-pitfalls',
      knowledge: 'ed-knowledge'
    },
    downloadName: 'abc-config.json'
  });
})();
