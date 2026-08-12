/* ============================================================
 * CourseKit · 通用数据管理面板 (kit/datamgr.js)
 * ------------------------------------------------------------
 * 提供导出 / 导入 / 一键更新 / 恢复默认 / 在线编辑 统一的面板逻辑，
 * 复用 kit/config.js 的配置引擎。漏斗、时间序列等工具共用同一套。
 *
 * API:
 *   CourseKit.mountDataManager({
 *     engine,                  // kit 配置引擎
 *     getConfig,               // () => 当前生效配置对象（用于导出）
 *     onApply,                 // (cfg) => void 应用新配置后回调（重渲染主程序）
 *     defaultUrl,              // 一键更新默认地址（默认 ./config.json）
 *     editorUrl,               // 在线编辑器地址
 *     downloadName,            // 导出文件名
 *     ids: {                   // 面板中各元素 id（与 funnel 面板一致）
 *       srcBadge, btnExport, btnImport, fileImport, btnReset,
 *       updateUrl, btnFetch, note
 *     }
 *   })
 * ============================================================ */
(function (root) {
  'use strict';
  var CourseKit = (root.CourseKit = root.CourseKit || {});

  function mountDataManager(opts) {
    var engine = opts.engine;
    var schema = engine.schema;
    var getConfig = opts.getConfig || function () { return engine.getDefaults(); };
    var onApply = opts.onApply || function () {};
    var defaultUrl = opts.defaultUrl || './config.json';
    var editorUrl = opts.editorUrl || 'editor.html';
    var downloadName = opts.downloadName || 'config.json';
    var ids = opts.ids || {};

    function $(id) { return (typeof document === 'undefined') ? null : document.getElementById(id); }
    function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return undefined; } }

    function serialize() {
      var cfg = getConfig();
      var out = { schemaVersion: (schema.schemaVersion || '1.0'), updatedAt: new Date().toISOString().slice(0, 10), source: '数据管理导出' };
      schema.fields.forEach(function (f) { out[f.path] = clone(cfg[f.path]); });
      return out;
    }

    function refreshBadge(text) { var el = $(ids.srcBadge); if (el) el.textContent = text; }
    function setNote(msg, kind) {
      var el = $(ids.note);
      if (el) { el.textContent = msg; el.className = 'dm-note' + (kind ? (' ' + kind) : ''); }
    }
    function applyAndStore(raw, label) {
      var res = engine.validate(raw);
      if (!res.ok) { setNote('应用失败：' + res.errors.join('；'), 'err'); return; }
      engine.saveStored({ source: label }, res.cfg);
      onApply(res.cfg);
      refreshBadge(label);
      setNote('✅ ' + label + '，已生效', 'ok');
    }

    function doExport() {
      var blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(a.href);
      setNote('⬇️ 已导出配置 JSON（提交仓库根目录即可用「一键更新」同步）', 'ok');
    }
    function doImport(file) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var raw = JSON.parse(r.result);
          var cfg = (raw && raw.config) ? raw.config : raw;
          applyAndStore(cfg, '已导入的本地配置');
        } catch (e) { setNote('JSON 解析失败：' + e.message, 'err'); }
      };
      r.readAsText(file);
    }
    function doReset() {
      var res = engine.validate({});
      engine.clearStored();
      onApply(res.cfg);
      refreshBadge('内置默认');
      setNote('↺ 已恢复内置默认', 'ok');
    }
    function doFetch() {
      var url = ($(ids.updateUrl) || {}).value || defaultUrl;
      fetch(url).then(function (r) { return r.json(); }).then(function (raw) {
        var cfg = (raw && raw.config) ? raw.config : raw;
        applyAndStore(cfg, '已更新（一键更新）');
      }).catch(function (e) { setNote('一键更新失败：' + e.message + '（请确认地址可访问且为 JSON）', 'err'); });
    }

    function init() {
      var stored = engine.loadStored();
      refreshBadge(stored && stored.config ? '已导入的本地配置' : '内置默认');
      var ex = $(ids.btnExport), im = $(ids.btnImport), fi = $(ids.fileImport), re = $(ids.btnReset), fe = $(ids.btnFetch);
      if (ex) ex.addEventListener('click', doExport);
      if (im) im.addEventListener('click', function () { if (fi) fi.click(); });
      if (fi) fi.addEventListener('change', function (e) { var f = e.target.files[0]; if (f) doImport(f); e.target.value = ''; });
      if (re) re.addEventListener('click', doReset);
      if (fe) fe.addEventListener('click', doFetch);
    }

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
      else init();
    }
    return { serialize: serialize, doExport: doExport, doImport: doImport, doReset: doReset, doFetch: doFetch };
  }

  CourseKit.mountDataManager = mountDataManager;
  if (typeof module !== 'undefined' && module.exports) module.exports = { mountDataManager: mountDataManager };
})(typeof window !== 'undefined' ? window : globalThis);
