/* ============================================================
 * RFM 客户分群 · 在线编辑器入口（课程工具基座版）
 * ------------------------------------------------------------
 * 薄 glue：把本工具的 schema / 引擎交给通用编辑器 kit/editor.js。
 * 依赖（按 rfm-editor.html 加载顺序）：kit/config.js → kit/editor.js → js/rfm-config.js
 * ============================================================ */
(function () {
  'use strict';
  if (typeof CourseKit === 'undefined' || !CourseKit.mountEditor) {
    console.error('CourseKit 未加载，无法挂载 RFM 编辑器');
    return;
  }
  CourseKit.mountEditor({
    schema: RFM_SCHEMA,
    engine: ENGINE,
    mounts: {
      customers: 'ed-customers',
      scoring: 'ed-scoring',
      segments: 'ed-segments',
      copy: 'ed-copy',
      pitfalls: 'ed-pitfalls'
    },
    downloadName: 'rfm-config.json'
  });
})();
