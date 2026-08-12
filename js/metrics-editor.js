/* ============================================================
 * 电商各类指标 · 在线编辑器入口（课程工具基座版）
 * ------------------------------------------------------------
 * 薄 glue：把本工具的 schema / 引擎交给通用编辑器 kit/editor.js。
 * ============================================================ */
(function () {
  'use strict';
  if (typeof CourseKit === 'undefined' || !CourseKit.mountEditor) {
    console.error('CourseKit 未加载，无法挂载电商指标编辑器');
    return;
  }
  CourseKit.mountEditor({
    schema: METRICS_SCHEMA,
    engine: ENGINE,
    mounts: {
      funnel: 'ed-funnel',
      indicators: 'ed-indicators',
      months: 'ed-months',
      trends: 'ed-trends',
      copy: 'ed-copy',
      pitfalls: 'ed-pitfalls'
    },
    downloadName: 'metrics-config.json'
  });
})();
