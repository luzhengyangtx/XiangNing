# 库存管理系统 - 产品需求文档 v1.1 (已实现功能)

| 文档版本 | 作者 | 更新日期 | 状态 |
|---------|------|---------|------|
| v1.1 | AI 辅助生成 | 2026-04-30 | 当前实现快照 |

> **说明**：本文档描述已实现的功能。后续开发中，您可修改本文档添加新需求，发送给我来实现。

---

## 1. 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16.2.4 (App Router) + React 19 + Tailwind CSS 4 |
| UI 组件 | shadcn/ui (base-nova 主题) + lucide-react 图标 |
| 后端 API | Next.js API Routes |
| 数据库 | SQLite + Prisma 7.8 (libsql adapter) |
| 认证 | JWT (jsonwebtoken + bcryptjs) 存储在 httpOnly Cookie |
| 验证 | zod |
| 通知 | sonner (toast) |

---

## 2. 已实现页面

### 2.1 登录页 (`/login`)
- 邮箱 + 密码登录表单
- JWT 签发后写入 httpOnly Cookie（24h 过期）
- 测试账号提示框
- 默认账号：`admin@inventory.local` / `admin123`（店长）、`staff@inventory.local` / `staff123`（店员）

### 2.2 库存看板 (`/`)
- 顶部统计卡片：总商品数、低库存商品数（库存 < 安全库存）、今日同步失败数
- 商品列表表格：
  - 列：勾选框 / 展开按钮 / SKU / 商品标题 / 分类（一级+二级 Badge）/ 原价 / 售价 / 库存（低于安全线红色高亮）/ 操作
  - 搜索：按商品标题或 SKU
  - 筛选：按一级分类下拉
  - 排序：点击列头切换升降序
- 单商品加减库存：行末 `+`/`-` 按钮（调用 `/api/inventory/adjust`，事务+操作日志）
- 批量调整库存：勾选多行 → 批量操作按钮 → 弹窗填写调整数量和原因
- 展开面板（Chevron 按钮）：显示北京编号、进价、重量、单位、各仓库库存明细（仓库名/数量/货架号）
- 刷新按钮

### 2.3 商品管理 (`/products`)
- 商品列表表格：勾选框 / SKU / 标题 / 分类 / 原价 / 售价 / 进价 / 库存 / 编辑按钮
- 搜索 + 分类筛选
- 新增商品：弹窗表单包含以下字段：
  - SKU*、北京编号、商品标题*、一级分类*、二级分类
  - 原价、售价、进价、耗材价格
  - 单位、重量(g)、安全库存
  - 线上规格、购买规格
  - 包装耗材、1688 链接
  - 京东礼定 SKU、商品主图（上传）、出库样图（上传）
- 编辑商品：同上弹窗，预填数据，SKU 不可修改
- 批量删除：勾选 → 确认弹窗 → 删除
- 创建商品时自动为所有仓库生成零库存记录

### 2.4 平台授权 (`/platforms`)
- 卡片网格展示 4 个平台：
  - 美团闪购（已连接）、饿了么零售（已连接）
  - 京东到家（未连接）、抖音小时达（未连接）
- 每张卡片：连接状态图标 + 名称 + 认证类型 + 状态 Badge
- 已连接平台：显示 Token 片段 + 过期时间 + 配置参数（价格浮动比例/库存比例/库存模式）
- 按钮：模拟 OAuth 授权（生成 mock token，30 天有效期）/ 解除绑定（清除 token 和商品映射）
- 操作写入操作日志

### 2.5 同步任务 (`/sync-tasks`)
- 顶部按钮：各已连接平台的"同步到{平台}"按钮（15% 模拟失败率）+ 刷新
- 任务列表（手风琴展开）：
  - 折叠态：任务类型 / 平台 Badge / 状态 Badge / 统计（N 项 · 失败 N）/ 时间 / "全部重试"按钮
  - 展开态：子表格列出每个商品的结果（商品名、SKU、成功/失败 Badge、错误码+描述）
- 失败错误码示例：`IMG_LINK_INVALID`（图片失效）、`SKU_DUPLICATE`（SKU 重复）、`PRICE_INVALID`（价格异常）、`NETWORK_TIMEOUT`（网络超时）
- 重试：全部重试（70% 成功率）/ 单条重试（100% 成功）
- 侧边栏同步任务图标带角标（每 30 秒轮询今日失败数）

### 2.6 系统设置 (`/settings`)
- **用户管理 Tab**（仅店长可见）：
  - 用户列表（姓名/邮箱/角色 Badge/创建时间）
  - 添加用户弹窗（姓名/邮箱/密码/角色选择 店员或店长）
  - 删除用户（不能删除自己）
- **操作日志 Tab**：
  - 按类型筛选（全部/商品/库存/平台/同步）
  - 表格列：时间 / 操作人 / 操作类型（着色 Badge）/ 详情（解析 JSON：库存变化量/原因/前后值）
  - 操作类型：创建商品、更新商品、删除商品、加库存、减库存、同步推送、同步拉取、平台授权、平台解绑
  - 声明"仅追加，不可删除或修改"
- **个人信息 Tab**：
  - 头像 + 姓名 + 邮箱 + 角色
  - 权限说明网格：
    - 店长：商品管理/库存管理/平台管理/用户管理/操作日志/系统配置（6 项全权限）
    - 店员：商品查看/库存操作（需审批）/同步查看（3 项受限权限）

---

## 3. 数据库模型

### 3.1 User（用户）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| name | String | 姓名 |
| email | String (unique) | 登录邮箱 |
| password | String | bcrypt 哈希 |
| role | String | owner（店长）/ staff（店员） |
| createdAt/updatedAt | DateTime | 时间戳 |

### 3.2 Product（商品）— 25 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| sku | String (unique) | 自用 SKU |
| title | String | 商品标题 |
| onlineSpec | String? | 线上规格 |
| beijingId | String? | 北京编号 |
| originalPrice | Float | 价格（原价） |
| discountPrice | Float | 折扣价格 |
| costPrice | Float | 进价 |
| weight | Float? | 重量(g) |
| categoryL1 | String | 一级分类 |
| categoryL2 | String? | 二级分类 |
| mainImage | String? | 商品主图 URL |
| shippingSampleImage | String? | 出库样图 URL |
| link | String? | 1688/货源链接 |
| purchaseSpec | String? | 购买规格 |
| jdSku | String? | 京东礼定 SKU |
| packagingMaterial | String? | 包装耗材 |
| packagingPrice | Float | 耗材价格 |
| description | String? | 备注 |
| unit | String | 单位（默认"个"） |
| safetyStock | Int | 安全库存警戒线 |
| createdAt/updatedAt | DateTime | 时间戳 |

关联：`warehouseStocks`（一对多 → WarehouseInventory）、`platformLinks`（一对多 → ProductPlatformLink）、`syncTaskItems`

### 3.3 Warehouse（仓库）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| name | String | 仓库名称（国贸/海淀/西二旗） |
| code | String (unique) | 仓库编码 |
| address | String? | 地址 |

### 3.4 WarehouseInventory（仓库库存）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| warehouseId | String | 关联仓库 |
| productId | String | 关联商品 |
| stock | Int | 正常库存 |
| unattendedStock | Int | 无人值守库存 |
| shelfId | String? | 货架编号 |
| damagedStock | Int | 货损库存 |

唯一约束：`[warehouseId, productId]`

### 3.5 Platform（平台）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| name | String | 美团闪购/饿了么零售/京东到家/抖音小时达 |
| code | String (unique) | meituan/eleme/jddj/douyin |
| status | String | connected/disconnected/expired |
| authType | String | oauth/apikey |
| authData | String? | JSON：token/refreshToken/expiresAt |
| config | String? | JSON：priceRatio/stockRatio/stockMode |

### 3.6 ProductPlatformLink（商品-平台映射）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| productId + platformId | String | 联合唯一 |
| platformSku | String? | 平台侧 SKU |
| syncStatus | String | pending/synced/failed |
| lastSyncAt | DateTime? | 最后同步时间 |

### 3.7 SyncTask（同步任务）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| platformId | String | 关联平台 |
| type | String | push_inventory/push_product/pull_product/order_decrease |
| status | String | pending/running/success/partial_fail/failed |
| totalCount / failCount | Int | 统计 |
| startedAt / finishedAt | DateTime? | 起止时间 |

### 3.8 SyncTaskItem（同步任务明细）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| taskId + productId | String | 关联 |
| status | String | pending/success/failed |
| errorCode | String? | 错误码 |
| errorMessage | String? | 错误描述 |

### 3.9 OperationLog（操作日志）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | String (cuid) | 主键 |
| userId | String? | 操作人 |
| action | String | 操作类型 |
| entityType | String | 实体类型（product/inventory/platform/sync_task/user） |
| entityId | String? | 实体 ID |
| detail | String? | JSON 变更详情 |
| createdAt | DateTime | 操作时间 |

**不可删除、不可修改（仅追加）。**

---

## 4. API 路由清单

### 4.1 认证
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/auth | 否 | 登录：验证邮箱密码，签发 JWT Cookie |
| GET | /api/auth | Cookie | 获取当前登录用户信息 |
| DELETE | /api/auth | Cookie | 登出：清除 Cookie |

### 4.2 库存
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/inventory | 否 | 看板数据：商品列表+仓库库存汇总+统计+分类列表 |
| POST | /api/inventory/adjust | 是 | 单商品库存调整（事务+日志） |
| POST | /api/inventory/batch-adjust | 是 | 批量库存调整 |

### 4.3 商品
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/products | 否 | 商品列表（含计算库存） |
| POST | /api/products | 是 | 创建商品（自动生成仓库零库存） |
| PUT | /api/products/[id] | 是 | 更新商品（含仓库库存 upsert） |
| DELETE | /api/products/[id] | 是 | 删除商品（级联删除关联数据） |

### 4.4 仓库
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/warehouses | 否 | 仓库列表（含库存明细） |

### 4.5 平台
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/platforms | 否 | 平台列表 |
| POST | /api/platforms/bind | 是 | 模拟 OAuth 授权绑定 |
| POST | /api/platforms/unbind | 是 | 解绑（清除 token + 删除映射） |

### 4.6 同步
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/sync-tasks | 否 | 同步任务列表（含明细） |
| POST | /api/sync-tasks/trigger | 是 | 触发同步（15% 模拟失败） |
| POST | /api/sync-tasks/retry | 是 | 重试失败项 |

### 4.7 模拟
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/simulate/order | 否 | 模拟美团订单自动减库存（随机 1-2 商品） |

### 4.8 日志
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/logs | 否 | 操作日志列表（可按 entityType 筛选） |

### 4.9 用户管理
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | /api/users | 店长 | 用户列表（不含密码） |
| POST | /api/users | 店长 | 创建用户（bcrypt 加密密码） |
| PUT | /api/users/[id] | 店长 | 更新用户 |
| DELETE | /api/users/[id] | 店长 | 删除用户（不能删除自己） |

### 4.10 上传
| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | /api/upload | 是 | 图片上传（保存到 public/uploads/） |

---

## 5. 种子数据

| 实体 | 数量 | 内容 |
|------|------|------|
| 用户 | 2 | 店长 + 店员 |
| 仓库 | 3 | 国贸（T201/T102 货架）、海淀（空库存）、西二旗（T202/T303 货架） |
| 商品 | 5 | 火影忍者花束、樱桃小丸子花束、库洛米、卡比公主、小海狸露比（皆为玩偶花束手办花束类） |
| 平台 | 4 | 美团（已连接）、饿了么（已连接）、京东（未连接）、抖音（未连接） |
| 平台映射 | 10 | 美团×5 + 饿了么×5 |
| 同步任务 | 1 | partial_fail（1 条失败：IMG_LINK_INVALID） |
| 操作日志 | 3 | 入库、平台授权、同步推送 |

---

## 6. 权限体系

| 功能 | 店长 (owner) | 店员 (staff) |
|------|-------------|-------------|
| 查看库存看板 | ✅ | ✅ |
| 搜索/筛选/排序 | ✅ | ✅ |
| 单商品加减库存 | ✅ | ✅ |
| 批量调整库存 | ✅ | ✅ |
| 查看商品信息 | ✅ | ✅ |
| 新增/编辑/删除商品 | ✅ | ❌ |
| 平台授权/解绑 | ✅ | ❌ |
| 触发同步/重试 | ✅ | ❌ |
| 查看同步任务 | ✅ | ✅ |
| 查看操作日志 | ✅ | ✅ |
| 添加/删除用户 | ✅ | ❌ |
| 修改系统配置 | ✅ | ❌ |

---

## 7. 待实现功能（后续版本）

> 以下为 PRD 原始规划的后续版本功能，可在本文档中勾选或添加新需求后发送给我实现。

### 7.1 第二版候选
- [ ] 接入更多平台（饿了么、京东到家）真实 API 对接
- [ ] 商品信息（主图、详情图）一键推送到平台
- [ ] Excel 批量导入商品
- [ ] 仓库管理 CRUD（当前为固定种子数据）
- [ ] 移动端适配（手机/平板）
- [ ] 商品图片压缩

### 7.2 第三版候选
- [ ] 多门店管理
- [ ] 盘点功能（锁定库存 → 修正差异 → 生成报告）
- [ ] 共享库存/独占库存策略
- [ ] 扫码枪入库
- [ ] 通知渠道（站内信/邮件/企业微信/钉钉）
- [ ] 数据看板与销售分析

### 7.3 待补充
- [ ] 单元测试 / E2E 测试
- [ ] CI/CD 配置
- [ ] Docker 部署配置

---

## 8. 本地运行

```bash
cd inventory-dashboard
npm install

# 配置环境变量
cat > .env << 'EOF'
DATABASE_URL="file:./prisma/dev.db"
JWT_SECRET="your-secret-here"
EOF

# 初始化数据库
npx prisma db push
npx tsx prisma/seed.ts

# 启动开发服务器
npm run dev
# → http://localhost:3000
```

---

> **使用方式**：修改本文档中的需求描述（特别是第 7 节），然后发送给我，我将根据新的需求实现功能。
