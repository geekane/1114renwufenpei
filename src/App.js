import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { Layout, Menu, Card, Select, Button, Typography, List, Tag } from 'antd';
import 'antd/dist/reset.css'; // Ant Design 样式重置
import { users, projects, tasks } from './mockData';
import GanttChart from './GanttChart';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;

// 主仪表盘，显示“我的任务”
const Dashboard = ({ userId }) => {
  const currentUser = users.find(u => u.id === userId);
  const myTasks = tasks.filter(t => t.assignee_id === userId);
  
  return (
    <Card title={`欢迎回来，${currentUser.name}！这是你所有的任务`}>
      <List
        itemLayout="horizontal"
        dataSource={myTasks}
        renderItem={task => {
          const project = projects.find(p => p.id === task.project_id);
          return (
            <List.Item>
              <List.Item.Meta
                title={<Link to={`/projects/${task.project_id}`}>{task.name}</Link>}
                description={`所属项目: ${project.name} | 截止日期: ${task.end}`}
              />
              <div>
                {task.progress === 100 ? <Tag color="success">已完成</Tag> : <Tag color="processing">进行中 {task.progress}%</Tag>}
              </div>
            </List.Item>
          );
        }}
      />
    </Card>
  );
};

// 项目详情页，包含甘特图
const ProjectPage = () => {
  const { projectId } = useParams();
  const project = projects.find(p => p.id === parseInt(projectId));
  const projectTasks = tasks.filter(t => t.project_id === parseInt(projectId));
  
  return (
    <div>
      <Title level={2}>{project.name}</Title>
      <Text type="secondary">{project.description}</Text>
      <div style={{ marginTop: 24 }}>
        <GanttChart tasks={projectTasks} />
      </div>
    </div>
  );
};

// 应用主布局
function App() {
  const navigate = useNavigate();
  const [currentProject, setCurrentProject] = useState(projects[0].id);
  const [currentUserId, setCurrentUserId] = useState(users[0].id); // User state

  // Handle project switching
  const handleProjectChange = (value) => {
    setCurrentProject(value);
    navigate(`/projects/${value}`);
  };

  // Handle user switching
  const handleUserChange = (value) => {
    setCurrentUserId(value);
    // Navigate to dashboard to reflect the change
    navigate('/');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', lineHeight: '32px', color: 'white', borderRadius: '4px' }}>
          网吧项目管理
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          items={[
            {
              key: 'dashboard',
              label: <Link to="/">我的任务</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div>
                <Text>切换项目：</Text>
                <Select value={currentProject} onChange={handleProjectChange} style={{ width: 200 }}>
                {projects.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
                </Select>
            </div>
            <div>
                <Text>切换用户：</Text>
                <Select value={currentUserId} onChange={handleUserChange} style={{ width: 120 }}>
                {users.map(u => <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>)}
                </Select>
            </div>
          </div>
          <div>
             <Text>当前用户: {users.find(u => u.id === currentUserId).name}</Text>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
          <Routes>
            <Route path="/" element={<Dashboard userId={currentUserId} />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

// 路由包裹器
const AppWrapper = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;
