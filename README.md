# WMU Journal Tags · 温医大期刊分类标签

> 为 Zotero 文献条目自动标注《温州医科大学科技类共识期刊目录（T系列、Q系列）》的分类：
> 写入 `WMU:T1`、`WMU:Q1`、`WMU:综述` 等标签，并提供列表内彩色徽章列。

[![Zotero 10](https://img.shields.io/badge/Zotero-10.x-CC2936?logo=zotero&logoColor=white)](https://www.zotero.org)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/virchow-zhang/wmu-journal-tags?color=green)](https://github.com/virchow-zhang/wmu-journal-tags/releases)

- **全离线**：内置 2026 版目录全部 **2965 本**期刊数据，不联网、免 API 密钥、不上传任何数据
- **自动打标**：新条目入库约 2 秒后自动识别期刊并写入标签
- **批量更新**：支持选中条目 / 整个分类（含子分类）/ 整个文库，带进度窗口与统计
- **列表列徽章**：条目列表可开启「期刊分类」列，彩色徽章 + 按等级排序
- **安全幂等**：标签带独立前缀，重复运行无副作用；更新时只清理自己写入的旧分类标签，绝不触碰其他标签

## 安装

1. 打开 [Releases](https://github.com/virchow-zhang/wmu-journal-tags/releases) 下载最新 `wmu-journal-tags.xpi`
2. Zotero → 工具 → 插件 → 右上角齿轮 → **Install Add-on From File…**，选择该 xpi
3. 重启 Zotero

> 系统要求：Zotero 10（`strict_min_version: 10.0`，`strict_max_version: 10.*`）。

## 标签规则

| 目录分类               | 写入标签（默认前缀 `WMU:`）             |
| ---------------------- | --------------------------------------- |
| T1                     | `WMU:T1`                                |
| T2(A) / T2(B)          | `WMU:T2(A)` / `WMU:T2(B)`               |
| T3(A) / T3(B)          | `WMU:T3(A)` / `WMU:T3(B)`               |
| 综述类（条目自带级别） | 级别标签 + `WMU:综述`（可在首选项关闭） |
| Q1 / Q2                | `WMU:Q1` / `WMU:Q2`                     |

- 标签以**手动标签**写入，可在 Zotero 左侧标签栏筛选，也可随时手动删除、配色。
- 批量更新会**自动移除**本插件此前写入、但已不符当前目录的旧级别标签（仅匹配 `WMU:` 前缀 + 合法级别名，绝不触碰你的其他标签）。

## 使用

- **自动**：新条目入库后约 2 秒自动识别期刊、写入标签（可在设置中关闭）。
- **手动 / 批量**：
  - 选中条目 → 右键 →「更新期刊分类标签（选中条目）」
  - 右键分类 →「更新期刊分类标签（整个分类，含子分类）」
  - 工具菜单 →「更新期刊分类标签（整个文库）」
- **列表列**：在条目列表的任意列标题上右键 → 勾选「**期刊分类**」：
  - 彩色徽章：`T1` 红 · `T2(A)/T2(B)` 橙 · `T3(A)/T3(B)` 蓝 · `Q1` 绿 · `Q2` 青；综述类附灰色「综述」徽章
  - 点击列标题按 `T1 → T2(A) → T2(B) → T3(A) → T3(B) → Q1 → Q2` 排序

### 设置（编辑 → 设置 → WMU 期刊分类标签）

| 项                       | 默认   | 说明                           |
| ------------------------ | ------ | ------------------------------ |
| 新条目入库时自动打标签   | 开     | 关闭后仅手动更新               |
| 标签前缀                 | `WMU:` | 可改为任意前缀（影响清理范围） |
| 综述类期刊另加"综述"标签 | 开     | 关闭后综述类只写级别标签       |

## 匹配策略

按优先级依次尝试，匹配以**准确优先、宁缺勿错**为原则：

1. **ISSN 精确匹配**：解析条目 ISSN 字段中所有刊号（含 mod-11 校验位验证），命中即匹配；
   目录中的刊号可能是印刷 ISSN 或早期 ISSN，此时由刊名兜底。
2. **刊名归一化精确匹配**：忽略大小写、标点、`&`/and、变音符、所有格撇号、书名号、开头的 `THE`。
3. **标题词子集 + 前缀决胜**：如条目刊名 `Space Weather` 命中目录全称
   `SPACE WEATHER-THE INTERNATIONAL JOURNAL OF RESEARCH AND APPLICATIONS`；
   多个候选时要求词序列为前缀且唯一。

**已知限制**（均为保证准确率的有意设计）：

- 缩写刊名不展开：条目仅有 `EJSO`、`BMJ` 且无 ISSN 时不会匹配；
- 单字刊名不走词子集匹配（避免 `Brain` 误配到 `BRAIN BEHAVIOR AND IMMUNITY`）；
- 条目刊名带目录外后缀词时不匹配（`Science Advances` 不会匹配到 `SCIENCE`）；
- 未匹配的条目不打标签；未匹配刊名会输出到调试日志（帮助 → 调试输出日志）。

## 数据来源与质量校验

数据来自 **温医大科〔2026〕10号**《温州医科大学科技类共识期刊目录（T系列、Q系列）》，
经自动化管线提取并验证后内置：

| 校验项                                           | 结果                                           |
| ------------------------------------------------ | ---------------------------------------------- |
| 条目总数 / 各分类数量                            | 2965 条，与文件声明完全一致                    |
| T1 / T2(A) / T2(B) / T3(A) / T3(B)               | 6 / 28 / 48 / 57 / 128                         |
| 综述类 / Q1 / Q2                                 | 73（T2(B)×26、T3(A)×14、T3(B)×33）/ 882 / 1743 |
| ISSN mod-11 校验位                               | 2965 / 2965 通过                               |
| Crossref 全量刊名核对                            | 95.9% 直接一致                                 |
| 存疑项人工复核（NLM / ISSN Portal / 出版社官网） | 132 条全部定性，**0 处提取错误**               |

复核细节：多数"差异"为 NLM 全称与出版社简称之别（如 `JAMA-JOURNAL OF THE AMERICAN
MEDICAL ASSOCIATION` ↔ `JAMA`）、期刊改名（`PIER` → `Electromagnetic Waves`）或印刷/电子刊号
并存；另有 1 例上游数据错误（`Biocybernetics and Biomedical Engineering` 被 Crossref 误标）
已通过 NLM 证实目录数据正确。

### 目录换版流程

1. 取得新版目录 PDF，用配套提取脚本产出 `catalog.json`（结构：`{name, issn, category, isReview}`）
2. 同步并重新构建：

   ```bash
   node tools/sync-data.mjs path/to/catalog.json   # 生成 src/data/catalog.ts
   npm run build                                   # 产出 .scaffold/build/wmu-journal-tags.xpi
   ```

3. 用户更新插件后，对存量文献执行一次批量更新即可自动清理旧级别标签、写入新级别。

## 常见问题

**为什么有些文献没有标签？**
可能原因：期刊不在目录内；条目没有 ISSN 且刊名无法精确匹配；缩写刊名或歧义标题被保守拒绝。
可手动补全条目的 ISSN / 刊名字段后重新更新。

**会污染我已有的标签吗？**
不会。插件只增删 `WMU:` 前缀 + 合法级别名（`T1|T2(A)|T2(B)|T3(A)|T3(B)|Q1|Q2|综述`）的标签；
非本插件标签（包括同为 `WMU:` 前缀的其他名称）一律不动。修改前缀后，旧前缀标签需手动清理。

**Q1 论文的"视同 T3(B)"和旧目录"就高认定"在哪里体现？**
这两条是目录补充说明中的人工申报规则，涉及获奖/项目/引用等条件，插件不做自动升级：
Q1 论文仍标注 `WMU:Q1`，申报时按学校政策执行。

**支持 Zotero 7 / 8 / 9 吗？**
本插件仅面向 Zotero 10 构建与测试（使用 Zotero 8+ 的 `MenuManager`、10 的 FTL 注册机制）。

**数据会联网更新吗？**
不会。插件不发起任何网络请求；目录换版通过发布新版本插件完成。

## 开发

```bash
npm install
npm run build          # 构建 + TypeScript 类型检查
npm run lint:check     # prettier + eslint
npm run test:unit      # 匹配引擎单元测试（Node 原生运行，13 项）
```

- `npm run start`：开发模式（热重载，需要本地 Zotero 10 与 `.env` 配置，见 `.env.example`）
- `npm run release`：交互式发布（自动更新版本、打 tag；配合 `.github/workflows` 在 CI 构建并上传 Release 资产）
- `powershell -File tools/e2e-test.ps1`：真实 Zotero 10 端到端测试（隔离 profile，通过本地连接器端点
  创建条目并验证自动打标；已验证 T1 / T2(A) / 综述 / 仅刊名匹配 / 未匹配 5 个场景）

### 目录结构

```
src/modules/matcher.ts      纯匹配引擎（无 Zotero 依赖，可独立单测）
src/modules/tagger.ts       标签计算 / 写入 / 清理
src/modules/engine.ts       批量更新（选中 / 分类 / 文库）+ 进度窗口
src/modules/notifier.ts     新条目自动打标（去抖、批量）
src/modules/menu.ts         右键与工具菜单（Zotero MenuManager）
src/modules/column.ts       「期刊分类」列表列（ItemTreeManager.registerColumn）
src/data/catalog.ts         生成的内置目录数据（2965 条，勿手改）
addon/                      插件清单、首选项页、中英语言文件
tools/sync-data.mjs         目录数据生成脚本（catalog.json → catalog.ts）
tools/e2e-test.ps1          端到端测试脚本（隔离 Zotero profile）
test/matcher.unit.ts        匹配引擎单元测试
```

## 许可证与致谢

- 本插件基于 [windingwind/zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
  （AGPL-3.0）开发，采用 **AGPL-3.0-or-later** 许可，详见 [LICENSE](LICENSE)。
- 依赖 [zotero-plugin-toolkit](https://github.com/windingwind/zotero-plugin-toolkit) 与
  [zotero-types](https://github.com/windingwind/zotero-types)。
- 期刊目录数据来源：温州医科大学《温州医科大学科技类共识期刊目录（T系列、Q系列）》
  （温医大科〔2026〕10号），版权归校方所有，本仓库仅作技术转换，最终认定以学校文件为准。

---

## English

**WMU Journal Tags** is a Zotero 10 plugin that tags items with the journal classification
from the Wenzhou Medical University consensus journal catalog (T/Q series, 2965 journals,
fully offline). It supports automatic tagging of newly added items, one-click batch updates
for selected items / collections / whole library, and an optional colored "WMU Class" column
in the item list. Matching is ISSN-first with normalized-title fallback and conservative
ambiguity rejection. Licensed under AGPL-3.0-or-later.
