/* ============================================================
 * CourseKit · 通用配置编辑器 (kit/editor.js)
 * ------------------------------------------------------------
 * schema 驱动：根据字段类型自动生成表单控件，零手写字段布局。
 * 复用 kit/config.js 的配置引擎做校验/保存/导入/导出。
 *
 * API:
 *   CourseKit.mountEditor({ schema, engine, mounts, downloadName })
 *     - schema / engine : 与 kit/config.js 配套
 *     - mounts          : { 字段path: 容器元素或 id }，每个分区由 HTML 提供壳（标题/导航），本函数只填控件
 *     - downloadName    : 导出文件名（默认 config.json）
 *   操作栏与预览使用约定 id（HTML 提供）：ed-save / ed-export / ed-import /
 *   ed-file / ed-reset / ed-status / ed-json（缺省则自动跳过绑定）
 *
 * 支持字段类型：matrix / map / groupedList / list / object / arrayItem（作维度，不渲染）
 * 单元格/子项类型：range / string / text / number / boolean / pair / object
 * 数据绑定：data-bind="a.b.0" 写入 state；data-action 处理增删
 * ============================================================ */
(function (root) {
  'use strict';
  var CourseKit = (root.CourseKit = root.CourseKit || {});

  function mountEditor(opts) {
    var schema = opts.schema;
    var engine = opts.engine;
    var mounts = opts.mounts || {};
    var downloadName = opts.downloadName || 'config.json';

    /* ---------- 工具 ---------- */
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
    function getByPath(obj, path) {
      return path.split('.').reduce(function (o, k) { return (o == null ? undefined : o[k]); }, obj);
    }
    function setByPath(obj, path, val) {
      var keys = path.split('.');
      var o = obj;
      for (var i = 0; i < keys.length - 1; i++) {
        if (o[keys[i]] == null) return;
        o = o[keys[i]];
      }
      o[keys[keys.length - 1]] = val;
    }
    function $(id) { return (typeof document === 'undefined') ? null : document.getElementById(id); }
    function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return undefined; } }

    /* 维度键/标签 */
    function dimKeysOf(dim, state) {
      if (Array.isArray(dim)) return dim.map(function (x) { return (typeof x === 'string') ? x : x.key; });
      if (dim && typeof dim === 'object' && typeof dim.ref === 'string') {
        var v = state[dim.ref]; return Array.isArray(v) ? v.slice() : [];
      }
      return [];
    }
    function dimLabel(dim, key) {
      if (Array.isArray(dim)) {
        var hit = dim.filter(function (x) { return (typeof x === 'string') ? x === key : x.key === key; })[0];
        if (hit && typeof hit === 'object' && hit.label) return hit.label;
      }
      return key;
    }

    /* ---------- 控件原语 ---------- */
    function leafControl(f, path, value, state) {
      if (f.control === 'select') {
        var opts = f.options || [];
        if (f.optionsRef && state && Array.isArray(state[f.optionsRef])) opts = state[f.optionsRef];
        return '<select class="ed-text" data-bind="' + path + '">' +
          opts.map(function (o) { return '<option value="' + esc(o) + '"' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
          '</select>';
      }
      if (f.type === 'boolean') {
        return '<label class="ed-cbx"><input type="checkbox" data-bind="' + path + '"' + (value ? ' checked' : '') + '> ' + esc(f.label || '') + '</label>';
      }
      if (f.type === 'text' && f.control !== 'input') {
        return '<textarea class="ed-ta" data-bind="' + path + '">' + esc(value || '') + '</textarea>';
      }
      if (f.type === 'number') {
        return '<input class="ed-num" type="number" step="' + (f.step || 0.1) + '" data-bind="' + path + '" value="' + num(value, 0) + '">';
      }
      if (f.type === 'numArray') {
        return '<textarea class="ed-ta ed-ta-sm" data-bind="' + path + '" data-numarray="1" placeholder="用逗号或空格分隔的数字">' + (Array.isArray(value) ? value.join(', ') : (value == null ? '' : value)) + '</textarea>';
      }
      return '<input class="ed-text" data-bind="' + path + '" value="' + esc(value == null ? '' : value) + '">';
    }

    function rangeControl(path, rng) {
      rng = rng || [0, 100];
      return '<input class="ed-num" type="number" step="0.1" min="0" max="100" data-bind="' + path + '.0" value="' + num(rng[0], 0) + '">' +
        '<span class="ed-dash">–</span>' +
        '<input class="ed-num" type="number" step="0.1" min="0" max="100" data-bind="' + path + '.1" value="' + num(rng[1], 100) + '">' +
        '<span class="ed-unit">%</span>';
    }

    function pairControl(path, pair) {
      pair = pair || ['', 1];
      return '<input class="ed-text" data-bind="' + path + '.0" value="' + esc(pair[0]) + '" placeholder="关键词">' +
        '<input class="ed-num ed-weight" type="number" step="1" min="1" data-bind="' + path + '.1" value="' + num(pair[1], 1) + '" placeholder="权重">' +
        '<button class="btn btn-sm btn-warn ed-del" data-action="del-pair" data-path="' + path.replace(/\.[0-9]+$/, '') + '" data-idx="' + path.split('.').pop() + '">✕</button>';
    }

    /* 渲染 object 子字段（递归，用于 courseLock/copy.tips/方案项） */
    function renderSubFields(fields, state, basePath) {
      return fields.map(function (f) {
        var path = basePath + f.sub;
        var value = getByPath(state, path);
        if (f.type === 'object') {
          return '<div class="ed-row ed-row-col"><label class="ed-label">' + esc(f.label || f.sub) + '</label>' +
            '<div class="ed-indent">' + renderSubFields(f.fields, state, path + '.') + '</div></div>';
        }
        return '<div class="ed-row"><label class="ed-label">' + esc(f.label || f.sub) + '</label>' + leafControl(f, path, value, state) + '</div>';
      }).join('');
    }

    function defaultItemValue(item, state) {
      if (item.kind === 'pair') return ['新关键词', 10];
      if (item.kind === 'object') {
        var o = {};
        item.fields.forEach(function (f) {
          if (f.type === 'boolean') o[f.sub] = false;
          else if (f.type === 'number') o[f.sub] = 0;
          else o[f.sub] = '';
        });
        return o;
      }
      return '';
    }

    /* ---------- 顶层字段渲染 ---------- */
    function renderMatrix(field, state) {
      var rows = dimKeysOf(field.dim1, state);
      var cols = field.dim2 || [];
      return rows.map(function (cat) {
        return '<div class="ed-card"><h4>' + esc(cat) + '</h4>' +
          cols.map(function (c) {
            var key = (typeof c === 'string') ? c : c.key;
            var label = (typeof c === 'string') ? key : (c.label || key);
            var rng = getByPath(state, field.path + '.' + cat + '.' + key) || [0, 100];
            return '<div class="ed-row"><label class="ed-label">' + esc(label) + '</label>' + rangeControl(field.path + '.' + cat + '.' + key, rng) + '</div>';
          }).join('') +
          '</div>';
      }).join('');
    }

    function renderMap(field, state) {
      var obj = getByPath(state, field.path) || {};
      return Object.keys(obj).map(function (k) {
        return '<div class="ed-row ed-row-col"><label class="ed-label">' + esc(k) + '</label>' +
          leafControl({ type: field.value, label: '' }, field.path + '.' + k, obj[k], state) + '</div>';
      }).join('');
    }

    function renderItems(item, state, basePath) {
      var arr = getByPath(state, basePath) || [];
      if (item.kind === 'pair') {
        return arr.map(function (p, i) {
          return '<div class="ed-row ed-pain-row">' + pairControl(basePath + '.' + i, p) + '</div>';
        }).join('');
      }
      if (item.kind === 'object') {
        return arr.map(function (it, i) {
          return '<div class="ed-plan">' + renderSubFields(item.fields, state, basePath + '.' + i + '.') +
            (item.deletable ? '<button class="btn btn-sm btn-warn ed-del" data-action="del-item" data-path="' + basePath + '" data-idx="' + i + '">✕ 删除此项</button>' : '') +
            '</div>';
        }).join('');
      }
      return '';
    }

    function renderGroupedList(field, state) {
      var keys = dimKeysOf(field.dim, state);
      return keys.map(function (k) {
        var label = dimLabel(field.dim, k);
        return '<div class="ed-card"><h4>' + esc(label) + ' <small>(' + esc(k) + ')</small></h4>' +
          '<div class="ed-list" data-list="' + field.path + '.' + k + '">' + renderItems(field.item, state, field.path + '.' + k) + '</div>' +
          (field.item.addable ? '<button class="btn btn-sm ed-add" data-action="add-item" data-path="' + field.path + '.' + k + '">+ 添加</button>' : '') +
          '</div>';
      }).join('');
    }

    function renderList(field, state) {
      return '<div class="ed-card"><div class="ed-list" data-list="' + field.path + '">' + renderItems(field.item, state, field.path) + '</div>' +
        (field.item.addable ? '<button class="btn btn-sm ed-add" data-action="add-item" data-path="' + field.path + '">+ 添加</button>' : '') + '</div>';
    }

    function renderObject(field, state) {
      return '<div class="ed-card">' + renderSubFields(field.fields, state, field.path + '.') + '</div>';
    }

    function renderFieldByKind(field, state) {
      switch (field.kind) {
        case 'matrix': return renderMatrix(field, state);
        case 'map': return renderMap(field, state);
        case 'groupedList': return renderGroupedList(field, state);
        case 'list': return renderList(field, state);
        case 'object': return renderObject(field, state);
        case 'arrayItem': return ''; // 维度，不在编辑器单独渲染
        default: return '';
      }
    }

    /* ---------- 状态 ---------- */
    var state = initState();
    var dirty = false;

    function initState() {
      var stored = engine.loadStored();
      var base = (stored && stored.config) ? stored.config : engine.getDefaults();
      var res = engine.validate(base);
      return res.cfg;
    }

    function renderAll() {
      schema.fields.forEach(function (f) {
        var box = mounts[f.path];
        var el = (typeof box === 'string') ? $(box) : box;
        if (!el) return;
        el.innerHTML = renderFieldByKind(f, state);
      });
      refreshPreview();
    }

    /* ---------- 事件 ---------- */
    function onField(e) {
      var el = e.target.closest ? e.target.closest('[data-bind]') : null;
      if (!el) return;
      var path = el.getAttribute('data-bind');
      var val;
      if (el.getAttribute('data-numarray') === '1') {
        val = el.value.split(/[,\s]+/).map(parseFloat).filter(function (n) { return isFinite(n); });
      } else if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number') { var n = parseFloat(el.value); val = isFinite(n) ? n : 0; }
      else val = el.value;
      setByPath(state, path, val);
      dirty = true;
      schedulePreview();
    }

    function onClick(e) {
      var btn = e.target.closest ? e.target.closest('[data-action]') : null;
      if (!btn) return;
      var action = btn.getAttribute('data-action');
      var path = btn.getAttribute('data-path');
      var idx = parseInt(btn.getAttribute('data-idx'), 10);
      var arr = getByPath(state, path);
      if (action === 'add-item' || action === 'add-pair') {
        if (!Array.isArray(arr)) { setByPath(state, path, []); arr = []; }
        arr.push(defaultItemValue({ kind: (action === 'add-pair' ? 'pair' : 'object') }, state));
        rerenderList(path);
        dirty = true; schedulePreview();
      } else if (action === 'del-item' || action === 'del-pair') {
        if (Array.isArray(arr) && !isNaN(idx)) {
          arr.splice(idx, 1);
          rerenderList(path);
          dirty = true; schedulePreview();
        }
      }
    }

    function rerenderList(path) {
      var box = document.querySelector('[data-list="' + path + '"]');
      if (!box) { renderAll(); return; }
      // 找到对应 field 重渲染该项列表
      var field = schema.fields.filter(function (f) { return f.path === path.split('.').slice(0, -1).join('.') || f.path === path; })[0];
      var item = field ? field.item : { kind: 'object', fields: [] };
      box.innerHTML = renderItems(item, state, path);
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('input', onField);
      document.addEventListener('change', onField);
      document.addEventListener('click', onClick);
    }

    /* ---------- 预览 / 校验 ---------- */
    var previewTimer = null;
    function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(refreshPreview, 400); }
    function serialize() {
      var out = { schemaVersion: (schema.schemaVersion || '1.0'), updatedAt: new Date().toISOString().slice(0, 10), source: '在线编辑器' };
      schema.fields.forEach(function (f) { out[f.path] = clone(getByPath(state, f.path)); });
      return out;
    }
    function refreshPreview() {
      var pre = $('ed-json');
      if (!pre) return;
      try {
        var res = engine.validate(serialize());
        pre.textContent = JSON.stringify(serialize(), null, 2);
        pre.classList.toggle('invalid', !res.ok);
      } catch (e) {
        pre.textContent = '序列化失败：' + e.message;
        pre.classList.add('invalid');
      }
    }

    /* ---------- 动作 ---------- */
    function setStatus(msg, kind) {
      var el = $('ed-status');
      if (!el) return;
      el.textContent = msg;
      el.className = 'ed-status ' + (kind || '');
      clearTimeout(el._t);
      if (kind === 'ok' || kind === 'err') { el._t = setTimeout(function () { el.textContent = ''; el.className = 'ed-status'; }, 7000); }
    }

    function doSave() {
      var res = engine.validate(serialize());
      if (!res.ok) { setStatus('保存失败：' + res.errors.join('；'), 'err'); return; }
      engine.saveStored({ source: '在线编辑器·手动保存', fileName: downloadName }, serialize());
      dirty = false;
      var msg = '✅ 已保存到浏览器本地，打开主程序即生效';
      if (res.warnings.length) msg += '（' + res.warnings.length + ' 处已回退默认）';
      setStatus(msg, 'ok');
    }

    function doExport() {
      var res = engine.validate(serialize());
      if (!res.ok) { setStatus('导出失败：' + res.errors.join('；'), 'err'); return; }
      var blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = downloadName;
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus('⬇️ 已导出 ' + downloadName + '（提交到仓库根目录即可用「一键更新」同步）', 'ok');
    }

    function doImport(file) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var raw = JSON.parse(reader.result);
          var cfg = (raw && raw.config) ? raw.config : raw;
          var res = engine.validate(cfg);
          if (!res.ok) { setStatus('导入失败：' + res.errors.join('；'), 'err'); return; }
          state = res.cfg;
          renderAll();
          dirty = true;
          setStatus('✅ 已导入，记得点「保存」或「导出」', 'ok');
        } catch (e) { setStatus('JSON 解析失败：' + e.message, 'err'); }
      };
      reader.readAsText(file);
    }

    function doReset() {
      var res = engine.validate({});
      state = res.cfg;
      renderAll();
      dirty = true;
      setStatus('↺ 已载入内置默认（未保存，点「保存」才会覆盖本地）', 'ok');
    }

    function bindActions() {
      var s = $('ed-save'), ex = $('ed-export'), im = $('ed-import'), fi = $('ed-file'), re = $('ed-reset');
      if (s) s.addEventListener('click', doSave);
      if (ex) ex.addEventListener('click', doExport);
      if (im) im.addEventListener('click', function () { if (fi) fi.click(); });
      if (fi) fi.addEventListener('change', function (e) { var f = e.target.files[0]; if (f) doImport(f); e.target.value = ''; });
      if (re) re.addEventListener('click', doReset);
    }

    function init() {
      renderAll();
      var stored = engine.loadStored();
      setStatus(stored && stored.config ? '当前编辑：已导入的本地配置' : '当前编辑：内置默认', '');
      bindActions();
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
      }
    }

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
      else init();
    }

    return { getState: function () { return state; }, renderAll: renderAll, serialize: serialize };
  }

  CourseKit.mountEditor = mountEditor;
  if (typeof module !== 'undefined' && module.exports) module.exports = { mountEditor: mountEditor };
})(typeof window !== 'undefined' ? window : globalThis);
