// 项目定义保持不变
export const projects = [
  { id: 101, name: '光谷店筹建项目', description: '武汉光谷核心商圈新店筹备' },
  { id: 102, name: '街道口店升级改造', description: '对现有街道口老店进行硬件和装修升级' },
];

// 新的：网吧备选点位数据
export const locations = [
  { 
    id: 1, 
    city: '武汉', 
    location: '光谷世界城', 
    score: 95, 
    payback_period: 18, // months
    status: '项目进行中',
    project_id: 101 // 关联到光谷店项目
  },
  { 
    id: 2, 
    city: '武汉', 
    location: '街道口未来城', 
    score: 88, 
    payback_period: 24,
    status: '项目进行中',
    project_id: 102 // 关联到街道口店项目
  },
  { 
    id: 3, 
    city: '武汉', 
    location: '江汉路步行街', 
    score: 92, 
    payback_period: 20,
    status: '待评估',
    project_id: null
  },
  { 
    id: 4, 
    city: '武汉', 
    location: '中南路商圈', 
    score: 85, 
    payback_period: 28,
    status: '待评估',
    project_id: null
  },
  { 
    id: 5, 
    city: '北京', 
    location: '三里屯太古里', 
    score: 98, 
    payback_period: 16,
    status: '待评估',
    project_id: null
  },
  { 
    id: 6, 
    city: '上海', 
    location: '南京西路', 
    score: 97, 
    payback_period: 17,
    status: '待评估',
    project_id: null
  },
  { 
    id: 7, 
    city: '广州', 
    location: '天河城', 
    score: 90, 
    payback_period: 22,
    status: '待评估',
    project_id: null
  },
  { 
    id: 8, 
    city: '成都', 
    location: '春熙路', 
    score: 93, 
    payback_period: 19,
    status: '待评估',
    project_id: null
  },
  { 
    id: 9, 
    city: '杭州', 
    location: '湖滨银泰', 
    score: 91, 
    payback_period: 21,
    status: '待评估',
    project_id: null
  },
  { 
    id: 10, 
    city: '深圳', 
    location: '海岸城', 
    score: 94, 
    payback_period: 18,
    status: '待评估',
    project_id: null
  },
];

// 任务定义保持不变，用于甘特图页面
export const tasks = [
  // --- 光谷店筹建项目 ---
  {
    id: 'task1',
    project_id: 101,
    name: '市场调研与选址 (提前完成)',
    assignee_id: 1,
    start: '2025-10-01',
    end: '2025-10-10', // 实际10天
    planned_start: '2025-10-01',
    planned_end: '2025-10-15', // 计划15天
    progress: 100,
  },
  {
    id: 'task2',
    project_id: 101,
    name: '租赁合同签订 (超时完成)',
    assignee_id: 2,
    start: '2025-10-16',
    end: '2025-10-30', // 实际15天
    planned_start: '2025-10-16',
    planned_end: '2025-10-25', // 计划10天
    progress: 100,
    dependencies: 'task1'
  },
  {
    id: 'task3',
    project_id: 101,
    name: '装修设计与审批 (进行中)',
    assignee_id: 3,
    start: '2025-11-01',
    end: '2025-11-20',
    planned_start: '2025-11-01',
    planned_end: '2025-11-20',
    progress: 70,
    dependencies: 'task2'
  },
  // --- 街道口店升级改造 ---
  {
    id: 'task5',
    project_id: 102,
    name: '升级方案设计 (按时完成)',
    assignee_id: 3,
    start: '2025-10-05',
    end: '2025-10-15',
    planned_start: '2025-10-05',
    planned_end: '2025-10-15',
    progress: 100,
  },
  {
    id: 'task6',
    project_id: 102,
    name: '硬件采购 (进行中，已超时)',
    assignee_id: 2,
    start: '2025-10-16',
    end: '2025-11-05', // 实际结束日已超过计划
    planned_start: '2025-10-16',
    planned_end: '2025-10-30',
    progress: 50,
    dependencies: 'task5'
  },
];
