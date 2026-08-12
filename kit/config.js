/* ============================================================
 * CourseKit · 通用配置引擎 (kit/config.js)
 * ------------------------------------------------------------
 * 课程工具系列的可复用配置层。把"漏斗专用"的校验/合并逻辑
 * 抽象成 schema 驱动的通用引擎，供漏斗、时间序列等每个工具复用。
 *
 * API:
 *   CourseKit.makeConfigEngine({ schema, defaults, storageKey })
 *     → { validate, apply, loadStored, saveStored, clearStored, getDefaults }
 *
 * 设计原则：
 *   - 纯函数：validate/apply 只返回 { ok, errors, warnings, cfg }，
 *     不修改任何全局运行时变量（副作用由调用方负责，保证可复用）。
 *   - 宽容合并：缺字段静默回退默认；格式错误告警并回退默认；
 *     根节点非法直接拒绝（errors）。
 *   - schema 字段类型：
 *       arrayItem   : 字符串数组（可标记 require:'nonEmpty' 强制非空，否则拒绝）
 *       matrix      : 二维映射 dim1×dim2 → 单元格（如 benchmarks: 品类×环节→区间）
 *       groupedList : 按某维度分组的列表（如 plans: 品类→方案数组 / painWords: 环节→[词,权重]）
 *       list        : 普通列表（如 cases: 案例数组 / caseData 之外的扁平数组）
 *       map         : 按维度展开的键值映射（如 benchmarkLogic: 品类→说明）
 *       object      : 固定结构对象（如 courseLock / copy，支持嵌套 partial 合并）
 *     单元格/子项类型：string / text / number / boolean / range / pair / numArray / object
 *
 * 双环境：浏览器挂到 window.CourseKit；Node 下 module.exports（便于测试）。
 * ============================================================ */
(function (root) {
  'use strict';
  var CourseKit = (root.CourseKit = root.CourseKit || {});

  function makeConfigEngine(opts) {
    var schema = opts.schema || { fields: [] };
    var defaults = opts.defaults || {};
    var storageKey = opts.storageKey || 'coursekit.config';
    var fields = schema.fields || [];

    /* ---------- 基础工具 ---------- */
    function isNum(x) { return typeof x === 'number' && isFinite(x); }
    function isPlainObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
    function clone(o) { try { return JSON.parse(JSON.stringify(o)); } catch (e) { return undefined; } }

    /* 解析维度：返回维度键数组。支持 字符串数组 / {key,label} 对象数组 / 引用 {ref} */
    function resolveDim(dim, cfg) {
      if (Array.isArray(dim)) return dim.map(function (x) { return (typeof x === 'string') ? x : x.key; });
      if (dim && typeof dim === 'object' && typeof dim.ref === 'string') {
        var v = cfg[dim.ref];
        return Array.isArray(v) ? v.slice() : [];
      }
      return [];
    }

    /* 子项回退值：dflt 可为 常量 / 函数(i, defItem) / 缺省=defItem[sub] */
    function fallbackFor(f, i, defItem) {
      if (typeof f.dflt === 'function') return f.dflt(i, defItem);
      if (f.dflt !== undefined) return f.dflt;
      return defItem ? defItem[f.sub] : undefined;
    }

    /* 融合一个叶子值（string/text/number/boolean/numArray），无效则回退并发出可选告警 */
    function pickLeaf(f, sv, i, defItem, warnings) {
      if (f.type === 'numArray') {
        if (Array.isArray(sv) && sv.length > 0 && sv.every(isNum)) return sv.slice();
        if (f.warn && warnings) warnings.push(f.warn);
        return fallbackFor(f, i, defItem);
      }
      var ok =
        (f.type === 'number' && isNum(sv)) ||
        (f.type === 'boolean' && typeof sv === 'boolean') ||
        ((f.type === 'string' || f.type === 'text') && typeof sv === 'string');
      if (ok) return sv;
      if (f.warn && warnings) warnings.push(f.warn);
      return fallbackFor(f, i, defItem);
    }

    /* 融合一个嵌套对象（partial 合并，用于 copy.tips 等） */
    function mergeObjectRaw(srcObj, defObj, subFields, warnings) {
      var out = {};
      subFields.forEach(function (f) {
        var sv = srcObj[f.sub];
        var dv = defObj ? defObj[f.sub] : undefined;
        if (f.type === 'object') {
          out[f.sub] = isPlainObj(sv) ? mergeObjectRaw(sv, dv || {}, f.fields, warnings) : clone(dv || {});
        } else {
          var defItem = {};
          defItem[f.sub] = dv;
          out[f.sub] = pickLeaf(f, sv, -1, defItem, warnings);
        }
      });
      return out;
    }

    /* 融合一个列表项（object 子结构） */
    function mergeObjectItem(src, defItem, subFields, warnings) {
      if (!isPlainObj(src)) return null;
      var out = {};
      subFields.forEach(function (f) {
        if (f.type === 'object') {
          var sv = src[f.sub];
          var dv = defItem ? defItem[f.sub] : undefined;
          out[f.sub] = isPlainObj(sv) ? mergeObjectRaw(sv, dv || {}, f.fields, warnings) : clone(dv || {});
        } else {
          out[f.sub] = pickLeaf(f, src[f.sub], -1, defItem, warnings);
        }
      });
      return out;
    }

    /* ---------- 各字段类型的融合 ---------- */
    function mergeArrayItem(cfg, raw, field, errors, warnings) {
      var path = field.path, def = defaults[path];
      var sv = raw[path];
      if (sv === undefined) { cfg[path] = clone(def); return; }
      var allStr = Array.isArray(sv) && sv.length > 0 && sv.every(function (x) { return typeof x === 'string' && x.trim(); });
      if (!allStr) {
        if (field.require === 'nonEmpty') {
          errors.push(field.error || (path + ' 必须是非空字符串数组'));
          return; // 拒绝，不写 cfg（保持默认基底）
        }
        if (sv !== undefined) warnings.push((field.warn || path) + ' 格式错误，已回退默认');
        cfg[path] = clone(def);
        return;
      }
      cfg[path] = sv.map(function (x) { return x.trim(); });
    }

    function mergeMap(cfg, raw, field, errors, warnings) {
      var path = field.path, def = defaults[path] || {};
      var src = isPlainObj(raw[path]) ? raw[path] : {};
      var merged = {};
      if (field.mode === 'assign') {
        /* 合并式：键集 = 默认值键 ∪ 源键（不按维度强制展开，用于 benchmarkLogic 等） */
        Object.keys(def).forEach(function (k) { merged[k] = clone(def[k]); });
        Object.keys(src).forEach(function (k) {
          var sv = src[k];
          if (field.value === 'text') merged[k] = (typeof sv === 'string') ? sv : clone(def[k]);
          else if (field.value === 'number') merged[k] = isNum(sv) ? sv : clone(def[k]);
          else if (field.value === 'numArray') merged[k] = (Array.isArray(sv) && sv.every(isNum)) ? sv.slice() : clone(def[k]);
          else merged[k] = clone(def[k]);
        });
      } else {
        /* 维度展开式：按 dim（或 {ref}）逐键生成，源缺则回退默认 */
        var keys = resolveDim(field.dim, cfg);
        keys.forEach(function (k) {
          var dv = def[k];
          var sv = src[k];
          if (sv === undefined) { merged[k] = clone(dv); return; }
          if (field.value === 'text') merged[k] = (typeof sv === 'string') ? sv : clone(dv);
          else if (field.value === 'number') merged[k] = isNum(sv) ? sv : clone(dv);
          else if (field.value === 'numArray') merged[k] = (Array.isArray(sv) && sv.every(isNum)) ? sv.slice() : clone(dv);
          else merged[k] = clone(dv);
        });
      }
      cfg[path] = merged;
    }

    function mergeMatrix(cfg, raw, field, errors, warnings) {
      var path = field.path, def = defaults[path] || {};
      var rows = resolveDim(field.dim1, cfg);
      var cols = resolveDim(field.dim2, cfg);
      var src = isPlainObj(raw[path]) ? raw[path] : {};
      var merged = {};
      rows.forEach(function (r) {
        var srcRow = isPlainObj(src[r]) ? src[r] : {};
        var defRow = def[r] || {};
        var row = {};
        cols.forEach(function (c) {
          var dv = defRow[c] || (field.cell === 'range' ? [0, 100] : undefined);
          var sv = srcRow[c];
          if (sv === undefined) { row[c] = clone(dv); return; }
          if (field.cell === 'range') {
            if (Array.isArray(sv) && sv.length === 2 && isNum(sv[0]) && isNum(sv[1])) {
              if (sv[0] > sv[1]) { warnings.push((field.warn || path) + '「' + r + '.' + c + '」下限>上限，已回退默认'); row[c] = clone(dv); }
              else row[c] = [sv[0], sv[1]];
            } else { warnings.push((field.warn || path) + '「' + r + '.' + c + '」格式错误，已回退默认'); row[c] = clone(dv); }
          } else {
            row[c] = sv;
          }
        });
        merged[r] = row;
      });
      cfg[path] = merged;
    }

    /* 融合一个分组下的一组对象/对数组 */
    function mergeItemArray(src, defArr, item, warnings) {
      if (!Array.isArray(src) || src.length === 0) return clone(defArr);
      var out;
      if (item.kind === 'pair') {
        out = src.filter(function (w) {
          return Array.isArray(w) && typeof w[0] === 'string' && isNum(w[1]);
        }).map(function (w) { return [w[0], w[1]]; });
      } else if (item.kind === 'object') {
        out = src.map(function (p, i) {
          return mergeObjectItem(p, defArr[i], item.fields, warnings);
        }).filter(Boolean);
      } else {
        out = clone(defArr);
      }
      return out.length ? out : clone(defArr);
    }

    function mergeGroupedList(cfg, raw, field, errors, warnings) {
      var path = field.path, def = defaults[path] || {};
      var keys = resolveDim(field.dim, cfg);
      var src = isPlainObj(raw[path]) ? raw[path] : {};
      var merged = {};
      keys.forEach(function (k) {
        merged[k] = mergeItemArray(src[k], def[k] || [], field.item, warnings);
      });
      cfg[path] = merged;
    }

    function mergeList(cfg, raw, field, errors, warnings) {
      var path = field.path, def = defaults[path] || [];
      var sv = raw[path];
      if (sv === undefined || !Array.isArray(sv)) { cfg[path] = clone(def); return; }
      cfg[path] = mergeItemArray(sv, def, field.item, warnings);
    }

    function mergeObject(cfg, raw, field, errors, warnings) {
      var path = field.path, def = defaults[path];
      var sv = raw[path];
      if (sv === undefined || !isPlainObj(sv)) {
        cfg[path] = clone(def);
        if (sv !== undefined && field.warn) warnings.push(field.warn);
        return;
      }
      cfg[path] = mergeObjectRaw(sv, def || {}, field.fields, warnings);
    }

    function mergeField(cfg, raw, field, errors, warnings) {
      switch (field.kind) {
        case 'arrayItem': return mergeArrayItem(cfg, raw, field, errors, warnings);
        case 'map': return mergeMap(cfg, raw, field, errors, warnings);
        case 'matrix': return mergeMatrix(cfg, raw, field, errors, warnings);
        case 'groupedList': return mergeGroupedList(cfg, raw, field, errors, warnings);
        case 'list': return mergeList(cfg, raw, field, errors, warnings);
        case 'object': return mergeObject(cfg, raw, field, errors, warnings);
        default: return;
      }
    }

    /* ---------- 对外 API ---------- */
    function validate(raw) {
      var errors = [], warnings = [];
      if (!isPlainObj(raw)) return { ok: false, errors: ['根节点必须是 JSON 对象'], warnings: warnings };
      var cfg = clone(defaults);
      fields.forEach(function (f) { mergeField(cfg, raw, f, errors, warnings); });
      return { ok: errors.length === 0, errors: errors, warnings: warnings, cfg: cfg };
    }

    function apply(raw) {
      var res = validate(raw);
      if (!res.ok) return { ok: false, errors: res.errors, warnings: [], cfg: undefined };
      return { ok: true, errors: [], warnings: res.warnings, cfg: res.cfg };
    }

    function loadStored() {
      try {
        var raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(storageKey) : null;
        if (!raw) return null;
        var p = JSON.parse(raw);
        if (!p || !p.config) return null;
        return p;
      } catch (e) { return null; }
    }

    function saveStored(meta, cfg) {
      try {
        var payload = {
          meta: Object.assign(
            { schemaVersion: (schema.schemaVersion || '1.0'), savedAt: new Date().toISOString() },
            meta || {}
          ),
          config: cfg
        };
        if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(payload));
        return true;
      } catch (e) { return false; }
    }

    function clearStored() {
      try { if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey); } catch (e) {}
    }

    function getDefaults() { return clone(defaults); }

    return {
      validate: validate,
      apply: apply,
      loadStored: loadStored,
      saveStored: saveStored,
      clearStored: clearStored,
      getDefaults: getDefaults,
      schema: schema
    };
  }

  CourseKit.makeConfigEngine = makeConfigEngine;
  if (typeof module !== 'undefined' && module.exports) module.exports = { makeConfigEngine: makeConfigEngine };
})(typeof window !== 'undefined' ? window : globalThis);
