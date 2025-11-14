import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';
import { Layout, Menu, Card, Table, Tag } from 'antd';
import 'antd/dist/reset.css';
import { projects, tasks, locations } from './mockData';
import GanttChart from './GanttChart';

import { Typography } from 'antd';
const { Header, Content, Sider } = Layout;
const { Title } = Typography;

// --- New Home Page: Location Selection ---
const LocationSelectionPage = () => {
  const columns = [
    { title: '城市', dataIndex: 'city', key: 'city' },
    { title: '位置', dataIndex: 'location', key: 'location' },
    { title: '综合评分', dataIndex: 'score', key: 'score', sorter: (a, b) => a.score - b.score },
    { title: '回本周期 (月)', dataIndex: 'payback_period', key: 'payback_period', sorter: (a, b) => a.payback_period - b.payback_period },
    {
      title: '状态',
      key: 'status',
      dataIndex: 'status',
      render: (status, record) => {
        if (record.project_id) {
          return (
            <Link to={`/projects/${record.project_id}`}>
              <Tag color="processing">{status}</Tag>
            </Link>
          );
        }
        return <Tag color="default">{status}</Tag>;
      },
    },
  ];

  return (
    <Card title="网吧新店选址评估">
      <Table columns={columns} dataSource={locations} rowKey="id" />
    </Card>
  );
};

// --- Project Detail Page (remains the same) ---
const ProjectPage = () => {
  const { projectId } = useParams();
  const project = projects.find(p => p.id === parseInt(projectId));
  const projectTasks = tasks.filter(t => t.project_id === parseInt(projectId));
  
  if (!project) {
    return <h2>项目未找到！</h2>;
  }

  return (
    <div>
      <Title level={2}>{project.name}</Title>
      <p>{project.description}</p>
      <div style={{ marginTop: 24 }}>
        <GanttChart tasks={projectTasks} />
      </div>
    </div>
  );
};

// --- Main App Layout ---
function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', lineHeight: '32px', color: 'white', borderRadius: '4px' }}>
          网吧项目管理
        </div>
        <Menu
          theme="dark"
          mode="inline"
          defaultSelectedKeys={['locations']}
          items={[
            {
              key: 'locations',
              label: <Link to="/">选点评估</Link>,
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>SaaS PM Demo</div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: '#fff' }}>
          <Routes>
            <Route path="/" element={<LocationSelectionPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}

// --- App Wrapper ---
const AppWrapper = () => (
  <Router>
    <App />
  </Router>
);

export default AppWrapper;
