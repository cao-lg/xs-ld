# 商数数据分析与应用基础 · 课程工具系列（H5 纯前端版）

> 《商数数据分析与应用基础》课程的**纯前端教学工具系列**，每个工具是一个独立的 H5 单页应用，共用一套「课程工具基座 (`kit/`)」。  
> 全部逻辑在前端完成，**无后端、零费用**，可直接部署到 Cloudflare Pages 免费版。

`index.html` 是**课程工具系列主页**（导航到各工具）；每个工具是独立的 H5 单页。

当前已包含：

| 工具 | 入口 | 编辑器 | 配置模板 | 说明 |
|---|---|---|---|---|
| ① 漏斗诊断助手 · 小数 | `funnel.html` | `editor.html` | `benchmark.json` | 六层漏斗 → 行业基准对标 → 智能方案 → 多方案模拟 |
| ② 时间序列分析 · 小数 | `timeseries.html` | `ts-editor.html` | `ts-config.json` | 移动平均 / 指数平滑 / Holt-Winters 季节分解 / 精度对标 / 残差诊断 / 多步预测 / 平稳性·ACF·季节分解·ARIMA |
| ③ RFM 客户分群 · 小数 | `rfm.html` | `rfm-editor.html` | `rfm-config.json` | R/F/M 五分位打分 → 8 类客户群（2³ 全组合）→ 散点 / 规模 / 价值对比 |
| ④ ABC / 帕累托分析 · 小数 | `abc.html` | `abc-editor.html` | `abc-config.json` | 按销售额降序 → 累计占比 → A(≤80%)/B(≤95%)/C 分类 → 帕累托图 + 汇总 |
| ⑤ 购物篮关联分析 · 小数 | `basket.html` | `basket-editor.html` | `basket-config.json` | 支持度 / 置信度 / 提升度 → 强关联规则发现（散点 + 列表） |
| ⑥ 电商各类指标 · 小数 | `metrics.html` | `metrics-editor.html` | `metrics-config.json` | 流量/转化/客单价/留存/营销 概览 → 转化漏斗 → 关键比率 → 雷达对标 → 12月趋势与同环比 → GMV 拆解 |

---

## 目录

- [项目文件](#项目文件)
- [本地预览](#本地预览)
- [部署到 Cloudflare Pages](#部署到-cloudflare-pages)
- [课程工具基座 kit/](#课程工具基座-kit)
- [工具一：漏斗诊断助手](#工具一漏斗诊断助手)
- [工具二：时间序列分析](#工具二时间序列分析)
- [工具三：RFM 客户分群](#工具三rfm-客户分群)
- [工具四：ABC / 帕累托分析](#工具四abc--帕累托分析)
- [工具五：购物篮关联分析](#工具五购物篮关联分析)
- [工具六：电商各类指标](#工具六电商各类指标)
- [如何更新参考数据](#如何更新参考数据)
- [如何新增一个工具](#如何新增一个工具)
- [注意事项](#注意事项)

---

## 项目文件

```
/workspace
├── index.html                 # 课程工具系列主页（导航到各工具）
├── funnel.html                # 工具① 入口（漏斗诊断助手）
├── editor.html                # 工具① 基准数据在线编辑器
├── timeseries.html            # 工具② 入口（时间序列分析）
├── ts-editor.html             # 工具② 配置在线编辑器
├── rfm.html                   # 工具③ 入口（RFM 客户分群）
├── rfm-editor.html            # 工具③ 在线编辑器
├── abc.html                   # 工具④ 入口（ABC / 帕累托分析）
├── abc-editor.html            # 工具④ 在线编辑器
├── basket.html                # 工具⑤ 入口（购物篮关联分析）
├── basket-editor.html         # 工具⑤ 在线编辑器
├── metrics.html               # 工具⑥ 入口（电商各类指标）
├── metrics-editor.html        # 工具⑥ 在线编辑器
├── benchmark.json             # 工具① 可编辑参考数据模板
├── ts-config.json             # 工具② 可编辑配置模板
├── rfm-config.json            # 工具③ 可编辑配置模板
├── abc-config.json            # 工具④ 可编辑配置模板
├── basket-config.json         # 工具⑤ 可编辑配置模板
├── metrics-config.json        # 工具⑥ 可编辑配置模板
├── xiaoshu.html               # 工具① 单文件自包含版（全部内联，可离线打开）
├── css/style.css              # 移动端优先样式（主程序 + 编辑器共用）
├── css/home.css               # 主页 / 工具卡片导航样式
├── css/editor.css             # 旧编辑器样式（已被 kit/kit.css 取代，保留兼容）
├── js/
│   ├── data.js                # 工具① 漏斗数据层（品类基准/方案/词云/文案 + 配置引擎）
│   ├── app.js                 # 工具① 交互逻辑（漏斗/对比/词云/方案/模拟）
│   ├── funnel-editor.js       # 工具① 编辑器薄 glue（声明挂载点）
│   ├── ts-config.js           # 工具② 时间序列配置层（案例生成/方法/精度/误区/文案）
│   ├── ts-app.js              # 工具② 交互逻辑（MA/ES/HW/MAPE/残差/预测/深化）
│   ├── ts-editor.js           # 工具② 编辑器薄 glue
│   ├── rfm-config.js          # 工具③ RFM 配置层（客户生成/分群/文案）
│   ├── rfm-app.js             # 工具③ 交互逻辑（评分/分群/散点/规模/价值）
│   ├── rfm-editor.js          # 工具③ 编辑器薄 glue
│   ├── abc-config.js          # 工具④ ABC 配置层（商品生成/阈值/文案）
│   ├── abc-app.js             # 工具④ 交互逻辑（排序/累计/帕累托/汇总）
│   ├── abc-editor.js          # 工具④ 编辑器薄 glue
│   ├── basket-config.js       # 工具⑤ 购物篮配置层（交易生成/阈值/文案）
│   ├── basket-app.js          # 工具⑤ 交互逻辑（频次/支持度·置信度·提升度/规则散点/列表）
│   ├── basket-editor.js       # 工具⑤ 编辑器薄 glue
│   ├── metrics-config.js      # 工具⑥ 电商指标配置层（漏斗/指标/文案）
│   ├── metrics-app.js         # 工具⑥ 交互逻辑（概览/漏斗/比率/雷达对标）
│   └── metrics-editor.js      # 工具⑥ 编辑器薄 glue
├── kit/                       # 课程工具基座（六工具共用）
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
#   课程工具主页：    http://localhost:8099/index.html
#   漏斗诊断助手：    http://localhost:8099/funnel.html
#   时间序列分析：    http://localhost:8099/timeseries.html
#   RFM 客户分群：    http://localhost:8099/rfm.html
#   ABC / 帕累托分析： http://localhost:8099/abc.html
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

四个工具**不重复造轮子**：配置解析、在线编辑、数据管理三块逻辑被抽成基座，放在 `kit/`，由各自配置层（漏斗 `js/data.js`、时间序列 `js/ts-config.js`、RFM `js/rfm-config.js`、ABC `js/abc-config.js`）通过少量声明接入。

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
| ⑫ 课堂知识点注解 | 8 张核心概念卡片（四大成分 / 移动平均 vs 指数平滑 / ADF / 差分 / ACF·PACF / ARIMA / Holt-Winters / 预测区间），课堂讲解时展开对照 | 配置驱动，可在线编辑 |

> **教学亮点**：直观对比「窗口过大滞后」「α 过小迟钝」「忽略季节突变」「过度拟合噪声」「训练/测试集混淆」「外推过远失效」六大常见误区（词云权重可视化）。
>
> **深化（⑧–⑪）**：在 7 步基础上新增平稳性检验（ADF 风格 t 统计量）、自相关 ACF / 偏自相关 PACF（95% 置信带）、乘法季节分解（趋势/季节/残差三线）、以及 ARIMA 预测（去季节化 × 差分 × ARMA × 季节还原），与 Holt-Winters 对比。
>
> **课堂知识点注解**：另设「课堂知识点注解」面板，梳理 8 张核心概念卡片（序列四大成分、移动平均与指数平滑差异、平稳性 ADF、差分阶 d、ACF/PACF 读法、ARIMA 参数、Holt-Winters 分解、预测区间与外延风险），可在课堂讲解时一键展开对照。

---

## 工具三：RFM 客户分群

入口 `rfm.html`。输入客户清单（姓名 / 最近消费天数 R / 消费频次 F / 消费金额 M），依次完成 6 步分析。

### 功能对照

| 步骤 | 功能 | 方法 |
|---|---|---|
| ① 客户数据 | 粘贴或载入内置示例客户（30 位，确定性生成） | — |
| ② RFM 评分 | 对 R/F/M 各按五分位打 1–5 分（R 越小越优，F/M 越大越优） | 分位等分（档数可配置） |
| ③ 客户分群散点 | 频次 × 金额散点，按 8 类客户群着色，点大小随「最近程度」变化 | ECharts scatter |
| ④ 分群规模 | 各客户群客户数柱状图 | ECharts bar |
| ⑤ 分群价值 | 各客户群总金额 + 客均金额（双轴） | ECharts bar + line |
| ⑥ 误区词云 | RFM 常见误区可视化 | ECharts wordcloud |
| ⑦ 课堂知识点注解 | 8 张核心概念卡片（R/F/M 维度 / 五分位打分 / R 反向指标 / 8 类由来 / 重要价值 / 重要挽留 / 潜力·发展·新客·挽留 / 运营闭环），课堂讲解时展开对照 | 配置驱动，可在线编辑 |

**8 类客户群（R/F/M 各取 高≥4 / 低≤3 的 2³ 全组合，互斥且必覆盖）**

| R | F | M | 分群 | 运营建议 |
|---|---|---|---|---|
| 高 | 高 | 高 | 重要价值客户 | 优先维系 |
| 低 | 高 | 高 | 重要挽留客户 | 重点挽回 |
| 高 | 低 | 高 | 重要发展客户 | 提升复购频次 |
| 低 | 低 | 高 | 一般保持客户 | 常规维系 |
| 高 | 高 | 低 | 潜力价值客户 | 提升客单价 |
| 低 | 高 | 低 | 一般发展客户 | 培育 |
| 高 | 低 | 低 | 新客培育客户 | 培育期 |
| 低 | 低 | 低 | 一般挽留客户 | 关注维护成本 |

> **教学亮点**：直观对比「只看金额忽略频次」「R/F/M 权重一刀切」「阈值生搬硬套」「样本量太小失真」「忽视流失预警」「分群后无运营动作」六大常见误区。
>
> **课堂知识点注解**：另设「课堂知识点注解」面板，梳理 8 张核心概念卡片（R/F/M 三维度含义、为何五分位打分、R 的反向性、8 类客户群来源、重要价值/重要挽留运营策略、分群后须有运营动作），可在课堂讲解时一键展开对照。

---

## 工具四：ABC / 帕累托分析

入口 `abc.html`。输入商品清单（名称 / 销售额），依次完成 5 步分析。

### 功能对照

| 步骤 | 功能 | 方法 |
|---|---|---|
| ① 商品数据 | 粘贴或载入内置示例商品（20 个，长尾分布） | — |
| ② 排序与累计 | 按销售额降序，计算累计占比并预分类 | 降序 + 累计求和 |
| ③ 帕累托图 | 柱（销售额，按 A/B/C 着色）+ 累计占比折线 + A/B 分界带与阈值线 | ECharts bar + line + markArea/markLine |
| ④ ABC 分类汇总 | 每类商品数 / 数量占比 / 销售额 / 金额占比 | 聚合统计 |
| ⑤ 误区词云 | ABC 常见误区可视化 | ECharts wordcloud |

**分类规则**：累计占比 ≤ `thresholds.a`(默认 80%) 为 A 类，≤ `thresholds.b`(默认 95%) 为 B 类，其余为 C 类。阈值可在编辑器或配置模板中调整。

> **教学亮点**：直观对比「只看销售额忽略利润」「阈值生搬 80/20」「忽视 C 类潜在爆款」「用数量代替金额」「分类后无差异运营」「样本期太短失真」六大常见误区。

---

## 工具五：购物篮关联分析

入口 `basket.html`。输入交易数据（每行一笔交易，商品逗号分隔），依次完成 6 步分析。

### 功能对照

| 步骤 | 功能 | 方法 |
|---|---|---|
| ① 交易数据 | 粘贴或载入内置示例交易（24 笔，含经典尿布↔啤酒关联） | — |
| ② 单品/双品频次 | 单品支持度 Top 与双品共现支持度 Top | 支持度 = 含该组合的交易数 ÷ 总交易数 |
| ③ 关联规则 | 由双品组合生成 A→B / B→A 规则，按阈值过滤 | 支持度 / 置信度 / 提升度 |
| ④ 规则散点 | 支持度 × 置信度，气泡大小=提升度，按强度分色 | ECharts scatter |
| ⑤ 强关联规则列表 | 规则按提升度排序，标注关联强度 | 表格 |
| ⑥ 误区词云 | 关联分析常见误区可视化 | ECharts wordcloud |

**核心公式**：`支持度(A∪B) = 共现笔数 / 总笔数`；`置信度(A→B) = 支持度(A∪B) / 支持度(A)`；`提升度(A→B) = 置信度(A→B) / 支持度(B)`。提升度 > 1 为正相关，= 1 为独立，< 1 为负相关。

> **教学亮点**：直观对比「混淆相关与因果」「只看置信度忽略支持度」「低频项产生假强规则」「样本量太小不可靠」「提升度=1 误当无关」「规则方向≠业务方向」等误区。

---

## 工具六：电商各类指标

入口 `metrics.html`。输入运营指标快照（每行：指标名,分类,当前值,单位,行业基准），依次完成 6 步分析；转化漏斗取自配置。

### 功能对照

| 步骤 | 功能 | 方法 |
|---|---|---|
| ① 指标数据 | 粘贴或载入内置示例指标（8 项，自洽月度快照） | — |
| ② 指标概览 | 按 流量/转化/客单价/留存/营销 分组，对比基准并标差异 | HTML 卡片 + 对比条 |
| ③ 转化漏斗 | 访客 → 加购 → 下单 → 支付，标注逐级转化率 | ECharts funnel |
| ④ 关键比率 | 加购率 / 支付转化率 / 客单价 / 复购率 | 由漏斗与指标计算 |
| ⑤ 雷达对标 | 当前值 vs 行业基准（按各自量纲归一） | ECharts radar |
| ⑥ 误区词云 | 指标解读常见误区可视化 | ECharts wordcloud |
| ⑦ 指标趋势与同环比 | 各指标 12 个月走势（首月=100 归一化多线）+ 最新值 / 环比 / 累计增长表 | ECharts line + table |
| ⑧ GMV 拆解 | GMV = 访客 × 支付转化率 × 客单价，展示 12 月三因子与 GMV 累计增长（对数可加性） | ECharts bar + 公式卡 |

> **教学亮点**：直观对比「把 PV 当 UV」「转化率分母用错」「客单价与笔单价混淆」「复购率口径不一」「只看单点不看趋势」「GMV 含未付/退款」「优惠券拉高客单价假象」「漏斗各级分母混乱」「同环比基数选错」「用环比代替同比误导季节」「增长率忽略交互项」等误区。趋势与同环比强调「率」类指标以百分点(pp)计、退换货率走低为优；GMV 拆解点出累计增长率（对数）≈ 访客 + 支付转化率 + 客单价 三者累计增长率之和。

---

## 如何更新参考数据

所有工具的参考数据均已抽成配置，无需改代码即可保持更新。每个工具支持四种方式：

### 方式 A：一键更新（推荐，适合 Cloudflare Pages）

1. 修改对应模板文件（漏斗 `benchmark.json` / 时间序列 `ts-config.json` / RFM `rfm-config.json` / ABC `abc-config.json` / 电商指标 `metrics-config.json`）。
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
- **时间序列**：进入主程序 → 展开「🛠️ 配置数据管理」→ 点 **🖊️ 在线编辑**（或访问 `ts-editor.html`）。六个区块（案例序列 / 方法参数 / 精度阈值 / 误区词云 / 课堂知识点 / 文案）均为可视化表单。
- **RFM**：进入主程序 → 展开「🛠️ 配置数据管理」→ 点 **🖊️ 在线编辑**（或访问 `rfm-editor.html`）。六个区块（客户清单 / 打分参数 / 8 类标签 / 误区词云 / 课堂知识点 / 文案）均为可视化表单。

操作：
1. **💾 保存（本地）**：写入浏览器 `localStorage`，与主程序共用同一存储，**打开主程序即生效**（无需改文件）。
2. **⬇️ 导出 JSON**：下载对应模板文件，提交仓库根目录后，所有人用主程序「一键更新」即可同步。
3. **⬆️ 导入 JSON**：载入之前导出的文件或同事的配置继续编辑。
4. **↺ 默认**：一键载入内置默认（未保存不会覆盖本地）。
5. 底部「👁️ 预览 / 校验 JSON」实时显示当前配置，格式异常会标红。

> 编辑器与主程序共用同一存储键（漏斗 `xiaoshu.config.v1` / 时间序列 `ts.config.v1` / RFM `rfm.config.v1` / ABC `abc.config.v1` / 电商指标 `metrics.config.v1`），「在编辑器保存」等同于「在主程序导入同一份配置」，二者随时互通。

### 方式 D：恢复内置默认

点击 **↺ 恢复内置默认**，清空 `localStorage` 中的外部配置并回退到内置默认数据。

> **JSON 说明**：导入支持部分更新。缺失/非法字段自动回退内置默认并提示；根节点非对象或关键结构非法则拒绝导入。

---

## 如何新增一个工具

以「在 `kit/` 基座上新增一个课程工具」为例，标准步骤：

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
7. **RFM 分群**：R/F/M 按五分位打分（档数 `scoring.levels` 可配置，默认 5）；分群为 R/F/M 各取高(≥4)/低(≤3) 的 2³ 全组合，互斥且必覆盖；当客户量很小时某些群可能为空（属正常）。
8. **ABC 分类**：累计占比阈值 `thresholds.a`(默认 80%) / `thresholds.b`(默认 95%) 为经验值，可结合品类特性调整；分类基于历史销售额，未考虑利润与周转，结论仅供参考。
9. **免费额度**：Cloudflare Pages 免费版包含无限请求、每月 500 次构建（Git 连接）、100 GB 带宽，静态站点完全够用。

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

*版本：4.1（课程工具系列 · 6 工具）| 更新：2026-08-12 | 基座：kit/ 通用配置引擎 + 在线编辑器 + 数据管理面板*
