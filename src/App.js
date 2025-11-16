import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';
import { Layout, Menu, Card, Table, Tag, Button, Space, Typography } from 'antd';
import { MenuUnfoldOutlined, MenuFoldOutlined } from '@ant-design/icons';
import { projects, locations } from './mockData';
import GanttChart from './GanttChart';
import './Responsive.css';

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
      <Table columns={columns} dataSource={locations} rowKey="id" scroll={{ x: 'max-content' }} />
    </Card>
  );
};

// --- Project Detail Page (with ViewMode switcher) ---
// 这个组件内的 div 保持简单，不需要特殊样式
const ProjectPage = () => {
  const { projectId } = useParams();
  const project = projects.find(p => p.id === parseInt(projectId));
  
  if (!project) {
    return <h2>项目未找到！</h2>;
  }

  return (
    <div>
      <Title level={2}>{project.name}</Title>
      <p>{project.description}</p>
      
      <div style={{ marginTop: 24, height: '600px', width: '100%' }}>
        <GanttChart />
      </div>
    </div>
  );
};

// --- Main App Layout ---
function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
        breakpoint="lg"
        collapsedWidth="0"
      >
        <div style={{ height: '32px', margin: '16px', background: 'rgba(255, 255, 255, 0.2)', textAlign: 'center', lineHeight: '32px', color: 'white', borderRadius: '4px' }}>
          {collapsed ? 'SaaS' : '网吧项目管理'}
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
        <Header style={{ background: '#fff', padding: 0, display: 'flex', alignItems: 'center' }}>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
            })}
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>SaaS PM Demo</div>
        </Header>
        
        {/* --- 唯一的修改点在这里 --- */}
        <Content style={{
          margin: '24px 16px',
          padding: 24,
          background: '#fff',
          overflowX: 'auto' // 关键：允许内容区域在内容过宽时出现水平滚动条
        }}>
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
