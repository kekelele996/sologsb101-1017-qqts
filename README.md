# 玻璃吹制工序与退火窑编排台（sologsb101-1017）

面向玻璃工作室的窑务排产员：把每件作品的取料、吹制、塑形、开模、收口逐道工序排定，
分配退火窑位与温度曲线，出炉检验并归档；窑位冲突时禁止提交，不合格自动生成返工提示。

**纯前端单页应用**：无后端、无数据库服务、无 API 调用，数据全部保存在浏览器本地（IndexedDB），
容器完全无状态、不挂载任何数据卷。

---

## 一、Docker 一键启动（推荐）

```bash
cp .env.example .env && docker compose up -d --build
```

启动后访问：**http://localhost:22817**

常用命令：

```bash
docker compose ps                  # 查看容器状态
docker compose logs -f frontend    # 查看 nginx 日志
docker compose down                # 停止并移除容器
docker compose up -d --build       # 改完代码后重新构建
```

> 端口可通过 `.env` 里的 `FRONTEND_PORT` 覆盖；容器名与镜像名前缀由 `COMPOSE_PROJECT_NAME` 控制。
> `docker-compose.yml` 顶层已写 `name: gbglassblow` 兜底，因此在任意目录名（含中文）下
> `docker compose config --quiet` 都不会报错。

---

## 二、技术栈

| 分层 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | Vue 3 | `<script setup>` 组合式 API |
| 语言 | TypeScript 5 | `strict` 模式，`vue-tsc --noEmit` 零错误 |
| UI 组件库 | Element Plus 2 | 表格、表单、弹窗、日期时间选择、进度条、消息提示 |
| 图标 | @element-plus/icons-vue | 入口统一全局注册 |
| 构建 | Vite 6 | 开发端口与宿主端口一致（22817） |
| 路由 | Vue Router 4 | `createWebHistory` + 路由懒加载 |
| 状态管理 | Pinia 2 | setup store，跨页状态集中在 store，页面只读 store |
| 本地持久化 | Dexie 4（IndexedDB） | 库名 `gbglassblow`，v3 为取料计量补字段并回填，v1 → v2 为 Piece 增加 craft 索引 |
| 容器 | node:20-alpine → nginx:alpine | 多阶段构建，`chmod -R a+rX` 规避静态资源 403 |

---

## 三、目录结构

```
sologsb101-1017/
├── README.md
├── docker-compose.yml          # name: gbglassblow，不写 version 字段
├── .env / .env.example         # COMPOSE_PROJECT_NAME / FRONTEND_PORT
├── .gitignore
└── frontend/
    ├── Dockerfile              # 多阶段：node:20-alpine 构建 → nginx:alpine 托管
    ├── nginx.conf              # try_files $uri $uri/ /index.html; + gzip
    ├── .dockerignore
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    ├── public/favicon.svg
    └── src/
        ├── main.ts             # 入口：Pinia + Router + Element Plus + 初始化数据库
        ├── App.vue             # 外壳：顶部导航 + 当前作品上下文 + 页脚
        ├── env.d.ts
        ├── styles/main.css
        ├── types/              # furnace.ts batch.ts piece.ts step.ts anneal.ts inspect.ts
        ├── stores/             # furnaceStore.ts pieceStore.ts annealStore.ts
        ├── components/common/  # StageTag.vue FilterBar.vue StatBadge.vue EmptyPanel.vue
        ├── hooks/              # useStepProgress.ts useIdbTable.ts
        ├── pages/              # 5 个模块页面
        ├── router/index.ts     # 路由表 + ROUTES 常量
        └── utils/              # thermal.ts db.ts export.ts seed.ts id.ts
```

---

## 四、路由与功能模块

| 路由 | 页面文件 | 功能 |
| --- | --- | --- |
| `/furnaces` | `pages/FurnaceList.vue` | 窑炉与料液台账：新建/编辑/引用保护删除窑炉、登记料液批次（初始量/剩余量/已用量）、手工盘点取料、低于阈值高亮提示补料 |
| `/pieces` | `pages/PieceList.vue` | 作品登记与设计尺寸录入：按工艺与状态筛选、设计尺寸比例校验、显示工序完成度、当前道次与取料扣减情况 |
| `/pieces/:id/steps` | `pages/StepDetail.vue` | 吹制工序逐道记录：拖拽排序、回填温度/时长/操作人、推进工序状态、前序未完成阻断进入退火排位 |
| `/annealing` | `pages/AnnealingBoard.vue` | 退火窑位分配与曲线编排：窑位占用表、**窑位冲突时禁用提交**、状态流转、出炉回写作品状态 |
| `/export` | `pages/ExportView.vue` | 出炉检验登记（不合格生成返工提示）+ JSON 结构版本查看与导入导出 + 窑务 CSV 汇总 |

`/` 重定向到 `/furnaces`，未匹配路径统一回落到 `/furnaces`。
**层级路由支持直接深链**：把 `http://localhost:22817/pieces/piece-morning-vase/steps` 直接粘贴到地址栏即可打开；
若 id 查不到，页面会给出「作品不存在或已被删除」的友好空态与返回入口，不会白屏。

---

## 五、数据存储说明

* **持久化方案**：IndexedDB，通过 Dexie 封装（`src/utils/db.ts`）。
* **数据库名**：`gbglassblow`。
* **数据结构版本**：`DB_SCHEMA_VERSION = 3`
  * `db.version(1)`：建立全部表与 `[pieceId+seq]` 复合索引；
  * `db.version(2)`：**为 `Piece` 增加 `craft` 索引并回填默认值**，同时补齐其余索引与字段：
    * `.upgrade()` 中逐行回填 `revision` / `createdAt` / `updatedAt`；
    * `pieces.craft` 缺失时回填 `吹制`，`pieces.state` 缺失时回填 `设计中`；
    * `steps.state` 缺失时按历史记录视为 `已完成`，避免升级后被误判为待办；
    * `anneals` 补齐 `outAt` 与 `curveSeg`，`inspects` 补齐 `defectNote`。
  * `db.version(3)`：**料液与取料计量**（索引不变，仅补字段）：
    * `batches.initialKg` 登记初始量，缺失时以当前 `remainKg` 为基准回填（已用量 = 初始量 − 剩余量）；
    * `steps.gatherKg`（取料实际取料量）/ `steps.consumedBatchId` / `steps.consumedKg`（扣减快照）回填；
    * 历史已完成取料工序标为「未计量」（`consumedKg = 0`），**不追溯扣减批次剩余量**。
* **表结构**：

  | 表 | 主键 | 主要索引 |
  | --- | --- | --- |
  | `furnaces` | id | code, type, state, fuelType, createdAt, updatedAt |
  | `batches` | id | furnaceId, colorCode, meltDate, remainKg |
  | `pieces` | id | batchId, state, artist, **craft**, name |
  | `steps` | id | pieceId, **[pieceId+seq]**, seq, state, name |
  | `anneals` | id | pieceId, kilnSlot, state, inAt, curveSeg |
  | `inspects` | id | pieceId, date, result, inspector |

* **首屏演示数据**：`initDatabase()` 在打开数据库后检测 `furnaces` 表是否为空，为空则调用 `utils/seed.ts` 播种，
  幂等且只执行一次。播种链路为 **窑炉 → 料液批次 → 作品 → 吹制工序 → 退火 → 出炉检验** 三层互相引用：
  * 3 台窑炉（KILN-01 熔化炉 / KILN-02 坩埚炉 / AN-01 退火窑）；
  * 4 批料液（含 `A-207` 剩余 41.9 kg，故意低于 60 kg 补料阈值用于验证高亮与提醒；初始量与已扣减取料量对齐）；
  * 5 件作品（覆盖四种状态与三种工艺）、17 道吹制工序（已完成的取料工序带实际取料量与扣减快照，
    晨雾花器的取料为「进行中」且已填 6.2 kg，可直接演示推进扣减 G-101）；
  * 4 条退火记录（窑位 A1/A2/A3/B1 互不冲突，覆盖已出炉 / 退火中 / 待入窑）；
  * 3 条出炉检验（含一条「裂纹」不合格 + 一条返工后复检合格）。
  * 固定 id 如 `piece-morning-vase`、`piece-frost-bottle` 可直接用于深链验证。
* **其他本地数据**：`localStorage` 仅保存「最近选中的作品 id」这一界面偏好，不存业务数据。
* 删除窑炉会级联清理其料液批次，删除作品会级联清理其工序、退火与检验记录（均在同一 Dexie 事务内完成）；
  但**批次仍被作品引用时，删除批次或其上级窑炉会被拒绝**，避免作品挂空批次后取料无料可扣。

---

## 六、本地开发

```bash
cd frontend
npm install
npm run dev          # http://localhost:22817
```

其他命令：

```bash
npm run build        # vue-tsc --noEmit && vite build（零错误）
npm run typecheck    # 仅做 TypeScript 类型检查
npm run preview      # 预览 dist 产物
```

---

## 七、核心业务规则（`src/utils/thermal.ts`）

* **退火曲线时长换算**
  * 升温：20 ℃ → 560 ℃，按 120 ℃/h；
  * 保温：560 ℃ 恒温，每 5 mm 壁厚保温 1.2 小时（壁厚越大保温越久）；
  * 缓冷：560 ℃ → 60 ℃，按 40 ℃/h。
  三段合计即该作品的**理论退火时长**，壁厚直接决定总时长。
* **窑位占用判重**：同一窑位的时间窗 `[入窑, 出炉]` 重叠即判定冲突；未出炉时以「入窑 + 该曲线段理论时长」作为临时出炉时间参与判重。
  **冲突时提交按钮禁用**并给出冲突的既有记录说明。
* **温度单位换算**：℃ ↔ ℉（`cToF` / `fToC`）。
* **工序温度校验**：不得超过所选窑炉的 `maxTempC`，且应落在工艺适宜区间（吹制 900–1200 ℃ / 铸造 800–1150 ℃ / 热塑 700–1000 ℃）附近。
* **设计尺寸校验**：壁厚需 ≥ 1.5 mm 且小于设计高度的 1/8，否则给出成型与退火难度提示。
* **前序阻断**：任一前序工序未推进到「已完成」，`/pieces/:id/steps` 的「进入退火排位」会给出明确阻断原因。
* **状态回写**：退火状态推进到「已出炉」即把作品状态回写为「已退火」；登记出炉检验后回写为「已检验」；
  判定不合格时生成返工提示，**原始工序记录完整保留**。
* **取料扣减（作品 ↔ 料液批次联动，v3）**：
  * 作品登记时必须挂一个料液批次；**只有把「取料」工序推进到「已完成」的那一刻**，才在同一事务内
    按该作品所挂批次扣减剩余量，并把批次 id 与扣减量快照到工序上（作品事后改挂批次不影响历史账）。
  * **每件用多少料由操作工在取料工序里填实际取料量，照填的数扣**；表单提供「按设计估算」预填
    （成品按外径 ≈ 设计高度/2 的空心回转体、壁厚决定壳体体积，玻璃密度 2500 kg/m³，加固定料头与
    工艺挑料倍数），仅作参考、可改。
  * **拦截规则**：作品没挂批次（或批次已删）、取料量没填、批次剩余量不足，三种情况都会拦下「取料」完成，
    不会扣到零——账必须和作品对得上；料液台账页的手工取料是不绑定作品的盘点调整，保留「不足扣到 0」语义。
  * 回退已完成取料、改取料量或删除该工序，会自动把料退回扣减时记录的原批次，杜绝重复扣/漏退。
  * 剩余量低于 60 kg 时批次行高亮、顶部汇总与应用外壳同步给出补料提醒；CSV 增加「取料批次色号 / 实际取料量」列。
