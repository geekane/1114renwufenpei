# 网吧项目管理系统

## 项目概述

本项目是一个基于 React 的网吧项目管理系统，旨在提供门店详情展示和甘特图任务管理功能。用户可以查看所有门店的详细信息，并通过超链接进入特定门店的甘特图页面，对门店的筹备和运营任务进行可视化管理和跟踪。

系统后端基于 Cloudflare Workers 和 D1 数据库，提供高性能、低延迟的 API 服务。

## 功能特性

*   **门店详情列表**：展示所有网吧门店的关键信息，包括地理位置、面积、租金、回本周期等。
*   **门店甘特图**：为每个门店提供独立的甘特图，可视化展示任务的开始时间、结束时间、进度和里程碑。
*   **任务管理**：
    *   在甘特图中创建、编辑任务（任务名称、开始/结束日期）。
    *   拖拽任务条调整任务的开始/结束时间。
    *   通过单元格编辑直接修改任务信息。
*   **里程碑管理**：在甘特图中创建和编辑里程碑，标记重要节点。
*   **数据刷新**：支持手动刷新数据，确保前端展示与后端数据同步。
*   **响应式布局**：前端界面在不同设备上提供良好的用户体验。
*   **Cloudflare D1 集成**：数据存储于 Cloudflare D1 数据库，提供边缘计算的优势。

## 技术栈

*   **前端**：
    *   React 18
    *   React Router V6
    *   Ant Design (UI 组件库)
    *   VisActor VTable & VTable-Gantt (甘特图组件)
*   **后端**：
    *   Cloudflare Workers (无服务器函数)
    *   Cloudflare D1 (SQLite 兼容的无服务器数据库)
*   **开发工具**：
    *   `create-react-app`
    *   `wrangler` (Cloudflare 开发工具)

## 安装与部署

### 1. 前端项目设置

1.  **克隆仓库**：
    ```bash
    git clone <您的仓库地址>
    cd 1114renwufenpei
    ```
2.  **安装依赖**：
    ```bash
    npm install
    ```
3.  **运行开发服务器**：
    ```bash
    npm start
    ```
    应用将在 `http://localhost:3000` 启动。

### 2. Cloudflare Workers 和 D1 数据库设置

本项目依赖于 Cloudflare Workers 和 D1 数据库来提供后端 API 服务。

1.  **安装 Wrangler**：
    如果您尚未安装 `wrangler`，请先安装：
    ```bash
    npm install -g wrangler
    ```
2.  **登录 Cloudflare**：
    ```bash
    wrangler login
    ```
    按照提示完成认证。
3.  **创建 D1 数据库**：
    在您的 Cloudflare 账户中创建一个 D1 数据库。假设您将其命名为 `project_db`：
    ```bash
    wrangler d1 create project_db
    ```
    创建成功后，您会得到一个 `database_id`。
4.  **配置 `wrangler.toml`**：
    在项目根目录下的 `wrangler.toml` 文件中，添加或修改 D1 绑定配置，将 `database_id` 替换为您的实际 ID。
    ```toml
    # wrangler.toml
    name = "my-worker" # 您的 Worker 名称
    main = "functions/api/[[path]].js"
    compatibility_date = "2023-11-20" # 请根据实际情况调整

    [[d1_databases]]
    binding = "DB" # 环境变量名称，在 Workers 中通过 env.DB 访问
    database_name = "project_db" # 您创建的 D1 数据库名称
    database_id = "<您的 database_id>" # 替换为您的实际 database_id
    ```
5.  **部署 Workers**：
    ```bash
    wrangler deploy
    ```
    这将部署您的 Workers 函数到 Cloudflare。

### 3. D1 数据库表结构和模拟数据导入

完成 Workers 部署后，您需要初始化 D1 数据库的表结构并导入模拟数据。

1.  **执行 SQL 命令**：
    使用 Cloudflare D1 控制台或 `wrangler d1 execute` 命令执行以下 SQL 语句。

    ```sql
    -- 1. 删除旧表（如果存在），以便重新创建
    DROP TABLE IF EXISTS store_details;
    DROP TABLE IF EXISTS gantt_tasks;
    DROP TABLE IF EXISTS gantt_marklines;

    -- 2. 创建门店详情表 (store_details)
    -- 添加 store_id 作为主键
    CREATE TABLE store_details (
      store_id TEXT PRIMARY KEY,
      sort_order INTEGER,
      store_name TEXT NOT NULL,
      district TEXT,
      building_area TEXT,
      usable_area TEXT,
      rent TEXT,
      rent_free_period TEXT,
      property_fee TEXT,
      electricity_fee TEXT,
      water_fee TEXT,
      payment_method TEXT,
      rent_increase TEXT,
      contract_years TEXT,
      properties TEXT,
      startup_costs TEXT,
      progress TEXT,
      roi_period TEXT
    );

    -- 3. 创建甘特图任务表 (gantt_tasks)
    -- 添加 store_id 并设置复合主键
    CREATE TABLE gantt_tasks (
      id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      title TEXT,
      start TEXT,
      end TEXT,
      progress REAL,
      sub TEXT, -- Storing sub-tasks as JSON string
      avatar TEXT,
      PRIMARY KEY (id, store_id)
    );

    -- 4. 创建甘特图里程碑表 (gantt_marklines)
    -- 添加 store_id 并设置复合主键
    CREATE TABLE gantt_marklines (
      date TEXT NOT NULL,
      store_id TEXT NOT NULL,
      content TEXT,
      style TEXT, -- Storing style objects as JSON string
      contentStyle TEXT, -- Storing style objects as JSON string
      PRIMARY KEY (date, store_id)
    );

    -- 5. 为 `store_details` 表插入两个门店的详情
    INSERT INTO store_details (store_id, sort_order, store_name, district, building_area, usable_area, rent, rent_free_period, property_fee, electricity_fee, water_fee, payment_method, rent_increase, contract_years, properties, startup_costs, progress, roi_period) VALUES
    ('wuhou', 1, '武侯总店', '武侯区', '300㎡', '280㎡', '30000元/月', '1个月', '5元/㎡', '1.2元/度', '5元/吨', '押一付三', '每年5%', '5年', '临街、新店', '50万', '设计阶段完成，准备进场施工', '24个月'),
    ('chunxi', 2, '春熙路旗舰店', '锦江区', '500㎡', '450㎡', '80000元/月', '2个月', '8元/㎡', '1.1元/度', '5元/吨', '押二付六', '每年3%', '8年', '商场、核心地段', '120万', '已签约，等待商场审批', '36个月');

    -- 6. 为 "武侯总店" (store_id='wuhou') 插入甘特图任务数据
    INSERT INTO gantt_tasks (id, store_id, title, start, end, progress, avatar) VALUES
    ('task-wuhou-1', 'wuhou', '设计出图', '2025-10-01', '2025-10-05', 100, 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/avatar/0.png'),
    ('task-wuhou-2', 'wuhou', '消防报备', '2025-10-03', '2025-10-08', 80, 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/avatar/1.png'),
    ('task-wuhou-3', 'wuhou', '硬装施工', '2025-10-09', '2025-10-25', 20, 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/avatar/2.png'),
    ('task-wuhou-4', 'wuhou', '网络布线', '2025-10-15', '2025-10-20', 10, 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/avatar/3.png');

    -- 7. 为 "春熙路旗舰店" (store_id='chunxi') 插入甘特图任务数据
    INSERT INTO gantt_tasks (id, store_id, title, start, end, progress, avatar) VALUES
    ('task-chunxi-1', 'chunxi', '商场设计审批', '2025-10-02', '2025-10-10', 90, 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/avatar/4.png'),
    ('task-chunxi-2', 'chunxi', '施工队招标', '2025-10-05', '2025-10-15', 50, 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/avatar/5.png'),
    ('task-chunxi-3', 'chunxi', '物料采购', '2025-10-12', '2025-10-22', 30, 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/gantt/avatar/6.png');

    -- 8. 为 "武侯总店" (store_id='wuhou') 插入一个里程碑
    INSERT INTO gantt_marklines (date, store_id, content, style, contentStyle) VALUES
    ('2025-10-15', 'wuhou', '硬装过半', '{}', '{"color":"#fff"}');
    ```

    您可以使用以下 `wrangler` 命令来执行 SQL 文件（假设您将上述 SQL 保存为 `schema.sql`）：
    ```bash
    wrangler d1 execute project_db --file=./schema.sql --local
    # 如果是生产环境数据库，去掉 --local
    ```
    或者直接在 Cloudflare 控制台的 D1 页面中执行。

## API 接口说明

本项目后端通过 Cloudflare Workers 提供了以下 API 接口：

*   **`GET /api/store-details`**
    *   **描述**：获取所有门店的详细信息列表。
    *   **返回**：`{ storeDetails: [...] }`
*   **`GET /api/data/:storeId`**
    *   **描述**：获取特定门店 (`:storeId`) 的甘特图任务和里程碑数据。
    *   **参数**：`storeId` (URL 参数) - 门店的唯一标识符。
    *   **返回**：`{ records: [...], markLines: [...] }`
*   **`POST /api/task`**
    *   **描述**：更新特定门店的单个甘特图任务。
    *   **请求体**：`{ id: string, changedData: { [field: string]: any }, storeId: string }`
    *   **返回**：`{ success: boolean }`
*   **`POST /api/markline`**
    *   **描述**：创建或更新特定门店的里程碑。如果里程碑已存在（通过 `date` 和 `store_id` 确定），则更新；否则创建。
    *   **请求体**：`{ date: string, content: string, style?: object, contentStyle?: object, store_id: string }`
    *   **返回**：`{ success: boolean }`

## 项目结构

```
.
├── public/                     # 静态文件
├── src/
│   ├── App.js                  # 主应用组件，路由配置
│   ├── D1GanttPage.js          # 特定门店的甘特图页面组件
│   ├── GanttChart.js           # 甘特图核心组件
│   ├── mockData.js             # 模拟数据 (部分已废弃，改为 D1)
│   └── ...                     # 其他前端文件
├── functions/
│   └── api/
│       └── [[path]].js         # Cloudflare Workers API 路由处理
├── .gitignore
├── package.json
├── wrangler.toml               # Cloudflare Workers 和 D1 配置
└── README.md                   # 项目说明
```

## 注意事项

*   **D1 数据库**：请确保您的 Cloudflare D1 数据库已正确创建并绑定到 Workers。
*   **数据一致性**：前端与 D1 数据库通过 API 进行数据同步。在开发过程中，请确保 Workers 正常运行。
*   **错误处理**：前端和后端都包含了基本的错误处理和提示。
