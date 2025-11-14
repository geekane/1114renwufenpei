export const users = [
  { id: 1, name: '张三', email: 'zhangsan@example.com' },
  { id: 2, name: '李四', email: 'lisi@example.com' },
  { id: 3, name: '王五', email: 'wangwu@example.com' },
];

export const projects = [
  { id: 101, name: '光谷店筹建项目', description: '武汉光谷核心商圈新店筹备' },
  { id: 102, name: '街道口店升级改造', description: '对现有街道口老店进行硬件和装修升级' },
];

export const tasks = [
  // --- 光谷店筹建项目 ---
  {
    id: 'task1',
    project_id: 101,
    name: '市场调研与选址',
    assignee_id: 1,
    start: '2025-10-01',
    end: '2025-10-10', // 实际10天
    planned_start: '2025-10-01',
    planned_end: '2025-10-15', // 计划15天 (提前完成)
    progress: 1,
  },
  {
    id: 'task2',
    project_id: 101,
    name: '租赁合同签订',
    assignee_id: 2,
    start: '2025-10-16',
    end: '2025-10-30', // 实际15天
    planned_start: '2025-10-16',
    planned_end: '2025-10-25', // 计划10天 (超时完成)
    progress: 1,
    dependencies: 'task1'
  },
  {
    id: 'task3',
    project_id: 101,
    name: '装修设计与审批',
    assignee_id: 3,
    start: '2025-11-01',
    end: '2025-11-20',
    planned_start: '2025-11-01',
    planned_end: '2025-11-20', // (按计划进行中)
    progress: 0.7,
    dependencies: 'task2'
  },
  {
    id: 'task4',
    project_id: 101,
    name: '装修施工',
    assignee_id: 1,
    start: '2025-11-21',
    end: '2025-12-30',
    planned_start: '2025-11-21',
    planned_end: '2025-12-30',
    progress: 0,
    dependencies: 'task3'
  },
  // --- 街道口店升级改造 ---
  {
    id: 'task5',
    project_id: 102,
    name: '升级方案设计',
    assignee_id: 3,
    start: '2025-10-05',
    end: '2025-10-15',
    planned_start: '2025-10-05',
    planned_end: '2025-10-15', // (按时完成)
    progress: 1,
  },
  {
    id: 'task6',
    project_id: 102,
    name: '硬件采购 (进行中)',
    assignee_id: 2,
    start: '2025-10-16',
    end: '2025-11-05',
    planned_start: '2025-10-16',
    planned_end: '2025-10-30', // (已超时)
    progress: 0.5,
    dependencies: 'task5'
  },
    {
    id: 'task7',
    project_id: 102,
    name: '闭店施工与硬件更换',
    assignee_id: 1,
    start: '2025-11-06',
    end: '2025-11-20',
    planned_start: '2025-11-01',
    planned_end: '2025-11-15',
    progress: 0,
    dependencies: 'task6'
  },
];