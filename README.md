# 漏斗诊断助手 · 小数（H5 纯前端版）

> 电商运营教学验证工具：输入六层漏斗数据 → 生成漏斗图 → 行业基准对标 → 智能推荐方案 → 四方案模拟对比。  
> 全部逻辑在前端完成，**无后端、零费用**，可直接部署到 Cloudflare Pages 免费版。

---

## 目录

- [项目文件](#项目文件)
- [本地预览](#本地预览)
- [部署到 Cloudflare Pages](#部署到-cloudflare-pages)
- [功能对照](#功能对照)
- [注意事项](#注意事项)

---

## 项目文件

```
/workspace
├── index.html                 # 入口页（H5 单页应用）
├── css/style.css              # 移动端优先样式
├── js/data.js                 # 五大品类基准数据 + 四方案推荐表 + 诊断词云数据
├── js/app.js                  # 交互逻辑：ECharts 漏斗、对比图、词云、方案、模拟
├── vendor/
│   ├── echarts.min.js         # ECharts 图表库（漏斗、对比柱状图）
│   └── echarts-wordcloud.min.js  # ECharts 词云扩展
├── benchmark.json             # 可编辑参考数据模板（基准/方案/词云/文案）
├── xiaoshu.html               # 单文件自包含版（全部内联，可离线打开）
└── README.md                  # 本说明
```

无需打包构建，所有资源都是静态文件。

---

## 本地预览

用任意静态服务器打开 `index.html` 即可，例如：

```bash
cd /workspace
python3 -m http.server 8099
# 浏览器访问 http://localhost:8099
```

或直接用 VS Code 的 Live Server、Node 的 `npx serve` 等。

---

## 部署到 Cloudflare Pages

Cloudflare Pages 免费版对纯静态站点完全够用，且**不需要 Workers/Functions**。

### 方式一：Git 仓库连接（推荐，可自动发布）

1. 在 GitHub / GitLab 创建仓库（如 `yourname/xiaoshu-h5`）。
2. 将本目录文件推送到仓库根目录：
   ```bash
   git init
   git add .
   git commit -m "init: 小数漏斗诊断助手 H5"
   git branch -M main
   git remote add origin https://github.com/yourname/xiaoshu-h5.git
   git push -u origin main
   ```
3. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Pages** → **Create a project** → **Connect to Git**。
4. 选择仓库，构建配置保持默认：
   - **Build command**:（留空，不构建）
   - **Build output directory**: `/`（根目录）
5. 保存并部署，Pages 会自动生成 `xxx.pages.dev` 链接。

### 方式二：本地上传（最快体验）

1. 登录 Cloudflare Dashboard → Pages → **Create a project** → **Upload assets**。
2. 把 `/workspace` 下的 `index.html`、`css/`、`js/` 直接拖拽上传。
3. 立即获得在线链接。

### 方式三：Wrangler CLI

```bash
# 安装 wrangler
npm install -g wrangler
# 登录 Cloudflare
wrangler login
# 部署当前目录
wrangler pages deploy . --project-name=xiaoshu-h5
```

---

## 功能对照

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

## 如何更新基准 / 方案 / 词云

所有参考数据均已抽成配置，无需改代码即可保持更新。

### 方式 A：一键更新（推荐，适合 Cloudflare Pages）

1. 修改根目录的 `benchmark.json`（包含品类、基准、方案、词云、微课案例、文案）。
2. 把修改后的 `benchmark.json` 提交到仓库（或覆盖到 Pages 根目录）。
3. 打开网页，展开「基准数据管理」，点击 **🔄 一键更新**（默认读取 `./benchmark.json`）。
4. 数据会立即生效并持久化到浏览器 `localStorage`，刷新后仍保留。

### 方式 B：导入 JSON 文件（适合单文件版 / 离线）

1. 在网页内点击 **⬇️ 导出当前 JSON**，获得一份当前配置模板。
2. 用编辑器修改后保存为 `.json`。
3. 点击 **⬆️ 导入 JSON 文件** 选择该文件，即可热更新。

### 方式 C：恢复内置默认

点击 **↺ 恢复内置默认**，将清空 `localStorage` 中的外部配置并回退到规格书 v1.0 内置数据。

> **JSON 说明**：导入 JSON 支持部分更新。如果某个字段缺失或格式错误，会自动回退内置默认值并弹出提示；如果根节点不是对象或关键结构非法，则会拒绝导入。

---

## 注意事项

1. **无后端，数据不上传**：所有计算都在浏览器本地完成，适合教学和课堂演示，无需担心数据隐私。
2. **品类切换**：切换品类后会清空已生成的漏斗/基准/方案结果，并提示「不同品类基准不可直接对比」。
3. **输入校验**：要求六层数据完整且后段数值不大于前段，否则将给出明确提示。
4. **微课锁定**：当品类为「美妆护肤」且数据完全等于默认案例时，方案与模拟结果会显示「已锁定」标签；该案例数据可通过 `benchmark.json` 更新，但锁定行为不变。
5. **免费额度**：Cloudflare Pages 免费版包含无限请求、每月 500 次构建（Git 连接）、100 GB 带宽，静态站点完全够用。

---

## 截图示例

- `screenshots/01-home.png`：首页 / 品类选择 / 数据输入
- `screenshots/funnel.png`：ECharts 漏斗图（红色高亮需关注环节）
- `screenshots/benchmark.png`：行业基准对标 + 漏斗图对比（柱状 vs 基准区间带）
- `screenshots/drill.png`：下钻诊断卡片 + 痛点词云
- `screenshots/plans.png`：四方案智能推荐
- `screenshots/compare.png`：四方案模拟对比（最优解高亮）
- `screenshots/data-mgr.png`：基准数据管理面板（导入 / 导出 / 一键更新 / 恢复默认）

---

*版本：1.0 | 日期：2026-08-10 | 规格来源：《小数_产品功能规格书》*
