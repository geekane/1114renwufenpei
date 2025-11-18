export const projects = [
  {
    id: 101,
    name: '光谷店筹建项目',
    description: '武汉光谷核心商圈新店筹备',
  },
];

export const locations = [
  { id: 1, city: '武汉', location: '光谷世界城', score: 92, payback_period: 18, status: '筹备中', project_id: 101 },
  { id: 2, city: '武汉', location: '江汉路步行街', score: 88, payback_period: 24, status: '待定', project_id: null },
  { id: 3, city: '武汉', location: '街道口未来城', score: 85, payback_period: 22, status: '待定', project_id: null },
  { id: 4, city: '北京', location: '三里屯太古里', score: 95, payback_period: 30, status: '待定', project_id: null },
];

export const INITIAL_RECORDS = [
    {"id":1,"title":"设计阶段","start":"2025-10-01","end":"2025-10-04","progress":100,"sub":null,"avatar":null},
    {"id":2,"title":"筹划","start":"2025-10-02","end":"2025-10-04","progress":100,"sub":null,"avatar":null},
    {"id":3,"title":"需求分析","start":"2025-10-03","end":"2025-10-05","progress":70,"sub":null,"avatar":null},
    {"id":4,"title":"开发阶段","start":"2025-10-04","end":"2025-10-12","progress":0,"sub":null,"avatar":null},
    {"id":5,"title":"前端开发","start":"2025-10-04","end":"2025-10-10","progress":0,"sub":null,"avatar":null},
    {"id":6,"title":"后端开发","start":"2025-10-05","end":"2025-10-12","progress":0,"sub":null,"avatar":null},
    {"id":7,"title":"测试阶段","start":"2025-10-13","end":"2025-10-15","progress":0,"sub":null,"avatar":null}
];
