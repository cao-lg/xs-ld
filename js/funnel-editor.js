/* ============================================================
 * 漏斗 · 在线编辑器入口（课程工具基座版）
 * ------------------------------------------------------------
 * 薄 glue：把本工具的 schema / 引擎交给通用编辑器 kit/editor.js。
 * 字段布局、保存/导出/导入/预览全部由基座负责，本文件只声明挂载点。
 * 依赖（按 editor.html 加载顺序）：kit/config.js → kit/editor.js → js/data.js
 * ============================================================ */
(function () {
  'use strict';
  if (typeof CourseKit === 'undefined' || !CourseKit.mountEditor) {
    console.error('CourseKit 未加载，无法挂载编辑器');
    return;
  }
  CourseKit.mountEditor({
    schema: FUNNEL_SCHEMA,
    engine: ENGINE,
    mounts: {
      benchmarks: 'ed-bench',
      benchmarkLogic: 'ed-logic',
      plans: 'ed-plans',
      painWords: 'ed-pain',
      courseLock: 'ed-course',
      copy: 'ed-copy'
    },
    downloadName: 'benchmark.json'
  });
})();
