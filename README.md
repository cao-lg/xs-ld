# 商数数据分析与应用基础 · 课程工具系列（H5 纯前端版）

> 《商数数据分析与应用基础》课程的**纯前端教学工具系列**，每个工具是一个独立的 H5 单页应用，共用一套「课程工具基座 (`kit/`)」。  
> 全部逻辑在前端完成，**无后端、零费用**，可直接部署到 Cloudflare Pages 免费版。

当前已包含：

| 工具 | 入口 | 编辑器 | 配置模板 | 说明 |
|---|---|---|---|---|
| ① 漏斗诊断助手 · 小数 | `index.html` | `editor.html` | `benchmark.json` | 六层漏斗 → 行业基准对标 → 智能方案 → 多方案模拟 |
| ② 时间序列分析 · 小数 | `timeseries.html` | `ts-editor.html` | `ts-config.json` | 移动平均 / 指数平滑 / Holt-Winters 季节分解 / 精度对标 / 残差诊断 / 多步预测 |

---

## 目录

- [项目文件](#项目文件)
- [本地预览](#本地预览)
- [部署到 Cloudflare Pages](#部署到-cloudflare-pages)
- [课程工具基座 kit/](#课程工具基座-kit)
- [工具一：漏斗诊断助手](#工具一漏斗诊断助手)
- [工具二：时间序列分析](#工具二时间序列分析)
- [如何更新参考数据](#如何更新参考数据)
- [如何新增一个工具](#如何新增一个工具)
- [注意事项](#注意事项)

---

## 项目文件

```
/workspace
├── index.html                 # 工具① 入口（漏斗诊断助手）
├── editor.html                # 工具① 基准数据在线编辑器
├── timeseries.html            # 工具② 入口（时间序列分析）
├── ts-editor.html             # 工具② 配置在线编辑器
├── benchmark.json             # 工具① 可编辑参考数据模板
├── ts-config.json             # 工具② 可编辑配置模板
├── xiaoshu.html               # 工具① 单文件自包含版（全部内联，可离线打开）
├── css/style.css              # 移动端优先样式（主程序 + 编辑器共用）
├── css/editor.css             # 旧编辑器样式（已被 kit/kit.css 取代，保留兼容）
├── js/
│   ├── data.js                # 工具① 漏斗数据层（品类基准/方案/词云/文案 + 配置引擎）
│   ├── app.js                 # 工具① 交互逻辑（漏斗/对比/词云/方案/模拟）
│   ├── funnel-editor.js       # 工具① 编辑器薄 glue（声明挂载点）
│   ├── ts-config.js           # 工具② 时间序列配置层（案例生成/方法/精度/误区/文案）
│   └── ts-app.js              # 工具② 交互逻辑（MA/ES/HW/MAPE/残差/预测）
│   └── ts-editor.js           # 工具② 编辑器薄 glue
├── kit/                       # 课程工具基座（两工具共用）
│   ├── config.js              # 通用 schema 驱动配置引擎（校验/合并/导入导出/localStorage）
│   ├── editor.js              # 通用 schema 驱动在线编辑器（表单渲染/保存/导出/导入）
│   ├── datamgr.js             # 通用数据管理面板（导出/导入/一键更新/恢复默认/在线编辑）
│   └── kit.css                # 编辑器通用样式
├── vendor/
│   ├── echarts.min.js         # ECharts 图表库（漏斗/柱状/线/面积）
│   └── echarts-wordcloud.min.js  # ECharts 词云扩展
├── screenshots/               # 截图示例
└── README.md                  # 本说明
```

无需打包构建，所有资源都是静态文件。

---

## 本地预览

用任意静态服务器打开对应入口即可，例如：

```bash
cd /workspace
python3 -m http.server 8099
# 浏览器访问
#   漏斗诊断助手：  http://localhost:8099/index.html
#   时间序列分析：  http://localhost:8099/timeseries.html
```

或直接用 VS Code 的 Live Server、Node 的 `npx serve` 等。

---

## 部署到 Cloudflare Pages

Cloudflare Pages 免费版对纯静态站点完全够用，且**不需要 Workers/Functions**。

### 方式一：Git 仓库连接（推荐，可自动发布）

1. 在 GitHub / GitLab 创建仓库（如 `yourname/xs-ld`）。
2. 将本目录文件推送到仓库根目录：
   ```bash
   git init
   git add .
   git commit -m "init: 商数课程工具系列 H5"
   git branch -M main
   git remote add origin https://github.com/yourname/xs-ld.git
   git push -u origin main
   ```
3. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Pages** → **Create a project** → **Connect to Git**。
4. 选择仓库，构建配置保持默认：
   - **Build command**:（留空，不构建）
   - **Build output directory**: `/`（根目录）
5. 保存并部署，Pages 会自动生成 `xxx.pages.dev` 链接。

### 方式二：本地上传（最快体验）

1. 登录 Cloudflare Dashboard → Pages → **Create a project** → **Upload assets**。
2. 把 `/workspace` 下所有文件（含 `kit/`、`js/`、`css/`、`vendor/`）直接拖拽上传。
3. 立即获得在线链接。

### 方式三：Wrangler CLI

```bash
npm install -g wrangler
wrangler login
wrangler pages deploy . --project-name=xs-ld
```

---

## 课程工具基座 kit/

两个工具**不重复造轮子**：配置解析、在线编辑、数据管理三块逻辑被抽成基座，放在 `kit/`，由各自配置层（漏斗 `js/data.js`、时间序列 `js/ts-config.js`）通过少量声明接入。

| 文件 | 职责 | 关键 API |
|---|---|---|
| `kit/config.js` | **schema 驱动配置引擎**：字段校验、缺省合并、导入导出、`localStorage` 持久化 | `CourseKit.makeConfigEngine({schema, defaults, storageKey})` → `{validate, apply, loadStored, saveStored, clearStored, getDefaults, schema}` |
| `kit/editor.js` | **schema 驱动在线编辑器**：按字段类型自动生成表单，保存/导出/导入/实时 JSON 预览 | `CourseKit.mountEditor({schema, engine, mounts, downloadName})` |
| `kit/datamgr.js` | **通用数据管理面板**：导出/导入/一键更新/恢复默认/跳转在线编辑 | `CourseKit.mountDataManager({engine, getConfig, onApply, defaultUrl, editorUrl, downloadName, ids})` |
| `kit/kit.css` | 编辑器通用样式 | — |

**设计要点**

- **Schema 即配置契约**：每个工具在配置层声明 `SCHEMA`（字段 `path` / `kind` / `type` / 维度 `dim` 等），引擎据此校验与合并，编辑器据此渲染表单——无需为每个工具写一套表单代码。
- **零回归迁移**：漏斗工具的对外全局函数（`validateConfig` / `applyConfig` / `exportConfig` 等）保持不变，内部委托给 `kit/config.js` 的引擎，`app.js` 无需改动即可复用基座。
- **容错策略**：字段缺失 → 静默回退默认；字段非法 → 告警 + 回退；根节点非法 → 拒绝导入。

---

## 工具一：漏斗诊断助手

入口 `index.html`。输入六层漏斗数据 → 生成漏斗图 → 行业基准对标 → 智能推荐方案 → 四方案模拟对比。

### 功能对照

| 规格书章节 | 已实现功能 |
|---|---|
| 一、产品定位 | 输入数据 → 生成漏斗 → 基准对标 → 下钻诊断 + 词云 → 智能推荐 → 多方案模拟对比 |
| 二、欢迎词与交互开场 | 欢迎语 + 各节点操作提示（Toast） |
| 三、五大品类 + 行业基准 | 5 品类 chips、五段转化率基准区间、健康度 🟢🟡🔴 判定 |
| 四、智能方案 + 模拟 | 每品类 4 套方案，含支付率/GMV/利润/标签/测算逻辑；最优解绿色高亮 |
| 4.1 美妆护肤微课案例 | 默认数据 `[100000,30000,9000,3600,2700,2484]` 硬编码锁定，结果固定 |
| 参考数据导入更新 | 基准、方案、词云、文案均可通过 **JSON 导入 / URL 一键更新 / 导出模板** 动态更新，无需改代码；`localStorage` 持久化 |
| benchmark.json | 外部可编辑配置模板，缺省字段自动回退内置默认，支持 Cloudflare Pages 静态托管一键同步 |
| 五、界面设计 | 移动端 H5 卡片式布局，类 Streamlit 交互流程 |
| 六、交互约束 | 教师主导、不自动推进、品类切换提示、透明度测算逻辑、免责声明常驻 |
| 漏斗图（专业图表） | **ECharts 漏斗**：按转化率着色，保留量级明细表 |
| 漏斗图对比 | **ECharts 柱状 + 行业基准区间带**：本店转化率 vs 品类基准范围 |
| 下钻诊断 + 痛点词云 | 按环节生成诊断卡片，并对最弱环节展示 ECharts 痛点词云 |

---

## 工具二：时间序列分析

入口 `timeseries.html`。选择案例或粘贴自己的观测序列，依次完成 7 步分析。

### 功能对照

| 步骤 | 功能 | 方法 |
|---|---|---|
| ① 选择案例 / 序列 | 预设 3 个教学案例（月度销售带季节 / 日订单量 / 周活跃用户）或自定义输入 | — |
| ② 输入时间序列 | 逗号/空格分隔的数值序列，至少 6 期 | — |
| ③ 趋势提取 | 移动平均平滑，凸显走势、抑制短期波动 | 移动平均 MA(k)，k 可配置 |
| ④ 方法精度对标 | 三种方法在序列上的 MAPE 对比，绿/黄/红分级 | MAPE = mean(\|误差\|/真值) |
| ⑤ 残差诊断 · 误区词云 | 最优方法的残差柱状图（异常期红标）+ 常见误区词云 | 残差 = 实测 − 拟合；k·std 异常检测 |
| ⑥ 智能推荐方法 + 预测 | 按最低 MAPE 推荐最优方法，外推未来 12 期 + 95% 预测区间 | Holt-Winters 乘法季节分解 / 平推 / 指数平滑末值 |
| ⑦ 多方法预测对比 | 三种方法预测线并排，最优解高亮 | 多步外推 |

> **教学亮点**：直观对比「窗口过大滞后」「α 过小迟钝」「忽略季节突变」「过度拟合噪声」「训练/测试集混淆」「外推过远失效」六大常见误区（词云权重可视化）。

---

## 如何更新参考数据

所有工具的参考数据均已抽成配置，无需改代码即可保持更新。每个工具支持四种方式：

### 方式 A：一键更新（推荐，适合 Cloudflare Pages）

1. 修改对应模板文件（漏斗 `benchmark.json` / 时间序列 `ts-config.json`）。
2. 提交到仓库根目录（或覆盖到 Pages 根目录）。
3. 打开网页，展开「🛠️ 配置数据管理」，点击 **🔄 一键更新**（默认读取 `./benchmark.json` 或 `./ts-config.json`）。
4. 数据立即生效并持久化到浏览器 `localStorage`，刷新后仍保留。

### 方式 B：导入 JSON 文件（适合单文件版 / 离线）

1. 点击 **⬇️ 导出当前 JSON** 获得当前配置模板。
2. 用编辑器修改后保存为 `.json`。
3. 点击 **⬆️ 导入 JSON 文件** 选择该文件，即可热更新。

### 方式 C：在线可视化编辑（推荐，零门槛，不手改 JSON）

数据量较大时，手改 JSON 容易出错。打开对应编辑器用表单编辑：

- **漏斗**：进入主程序 → 展开「🛠️ 基准数据管理」→ 点 **🖊️ 在线编辑**（或访问 `editor.html`）。六个区块（行业基准 / 基准依据 / 智能方案 / 痛点词云 / 微课案例 / 文案）均为可视化表单，痛点词云支持「+ 添加关键词」增删。
- **时间序列**：进入主程序 → 展开「🛠️ 配置数据管理」→ 点 **🖊️ 在线编辑**（或访问 `ts-editor.html`）。五个区块（案例序列 / 方法参数 / 精度阈值 / 误区词云 / 文案）均为可视化表单。

操作：
1. **💾 保存（本地）**：写入浏览器 `localStorage`，与主程序共用同一存储，**打开主程序即生效**（无需改文件）。
2. **⬇️ 导出 JSON**：下载对应模板文件，提交仓库根目录后，所有人用主程序「一键更新」即可同步。
3. **⬆️ 导入 JSON**：载入之前导出的文件或同事的配置继续编辑。
4. **↺ 默认**：一键载入内置默认（未保存不会覆盖本地）。
5. 底部「👁️ 预览 / 校验 JSON」实时显示当前配置，格式异常会标红。

> 编辑器与主程序共用同一存储键（漏斗 `xiaoshu.config.v1` / 时间序列 `ts.config.v1`），「在编辑器保存」等同于「在主程序导入同一份配置」，二者随时互通。

### 方式 D：恢复内置默认

点击 **↺ 恢复内置默认**，清空 `localStorage` 中的外部配置并回退到内置默认数据。

> **JSON 说明**：导入支持部分更新。缺失/非法字段自动回退内置默认并提示；根节点非对象或关键结构非法则拒绝导入。

---

## 如何新增一个工具

以「在 `kit/` 基座上新增第三个课程工具」为例，标准步骤：

1. **配置层**（如 `js/xxx-config.js`）
   - 定义 `XXX_SCHEMA_VERSION` / `XXX_STORAGE_KEY`。
   - 写确定性默认数据 `XXX_DEFAULTS`（如需内置案例）。
   - 声明 `XXX_SCHEMA`：列出所有可编辑字段（`path` / `kind` / `type` / `dim` 等）。
   - 末尾调用 `CourseKit.makeConfigEngine({schema: XXX_SCHEMA, defaults: XXX_DEFAULTS, storageKey: XXX_STORAGE_KEY})` 得到 `ENGINE`。
   - 注意：`XXX_SCHEMA` / `ENGINE` 用 `const` / `var` 顶部声明；页面脚本依赖 `kit/config.js` 先加载。
2. **交互逻辑**（如 `js/xxx-app.js`）
   - `ENGINE.loadStored()` / `ENGINE.validate()` 取初始配置。
   - 各分析步骤用 ECharts 出图；按钮按依赖顺序解锁。
   - 启动时调用 `CourseKit.mountDataManager({...})` 接入通用数据管理面板。
3. **编辑器 glue**（如 `js/xxx-editor.js`，约 20 行）
   - 调用 `CourseKit.mountEditor({schema: XXX_SCHEMA, engine: ENGINE, mounts: {...}, downloadName: 'xxx-config.json'})`。
4. **入口页**（如 `xxx.html`）+ **编辑器页**（如 `xxx-editor.html`）
   - 脚本加载顺序固定：`vendor/echarts*` → `kit/config.js` → `kit/datamgr.js`/`kit/editor.js` → `js/xxx-config.js` → `js/xxx-app.js`/`js/xxx-editor.js`。
   - 数据管理面板元素 id 与 `mountDataManager` 的 `ids` 对应即可直接复用。
5. **配置模板**（如 `xxx-config.json`）
   - 由默认配置序列化导出，供「一键更新」开箱即用。
6. 在本文档「课程工具系列」表格与「功能对照」补充该工具说明。

> 字段类型参考（`kit/config.js` 支持）：维度 `arrayItem`；容器 `matrix` / `map` / `groupedList` / `list` / `object`；叶子 `string` / `text` / `number` / `boolean` / `range` / `pair` / `numArray`。

---

## 注意事项

1. **无后端，数据不上传**：所有计算都在浏览器本地完成，适合教学和课堂演示，无需担心数据隐私。
2. **漏斗品类切换**：切换品类后会清空已生成的漏斗/基准/方案结果，并提示「不同品类基准不可直接对比」。
3. **漏斗输入校验**：要求六层数据完整且后段数值不大于前段，否则给出明确提示。
4. **漏斗微课锁定**：当品类为「美妆护肤」且数据完全等于默认案例时，方案与模拟结果会显示「已锁定」标签；该案例数据可通过 `benchmark.json` 更新，但锁定行为不变。
5. **时间序列序列要求**：至少 6 期有效数值；Holt-Winters 需序列长度 ≥ 2 倍季节周期（默认 12）才能稳定分解季节。
6. **预测仅供参考**：基于历史规律与模型假设，受突发事件影响大，请谨慎外推（免责声明常驻）。
7. **免费额度**：Cloudflare Pages 免费版包含无限请求、每月 500 次构建（Git 连接）、100 GB 带宽，静态站点完全够用。

---

## 截图示例

- `screenshots/01-home.png`：漏斗首页 / 品类选择 / 数据输入
- `screenshots/funnel.png`：ECharts 漏斗图（红色高亮需关注环节）
- `screenshots/benchmark.png`：行业基准对标 + 漏斗图对比（柱状 vs 基准区间带）
- `screenshots/drill.png`：下钻诊断卡片 + 痛点词云
- `screenshots/plans.png`：四方案智能推荐
- `screenshots/compare.png`：四方案模拟对比（最优解高亮）
- `screenshots/editor.png`：基准数据在线编辑器（总览）
- `screenshots/editor-plans.png`：智能方案可视化编辑
- `screenshots/editor-pain.png`：痛点词云可视化编辑（支持增删）
- `screenshots/data-mgr.png`：基准数据管理面板（导入 / 导出 / 一键更新 / 恢复默认）

---

*版本：2.0（课程工具系列）| 更新：2026-08-12 | 基座：kit/ 通用配置引擎 + 在线编辑器 + 数据管理面板*
