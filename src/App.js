import React, { useState, useEffect, useContext, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams } from 'react-router-dom';
import { Layout, Menu, Card, Table, Tag, Button, Space, Typography, Spin, Alert, Upload, message, Form, Input } from 'antd';
import { MenuUnfoldOutlined, MenuFoldOutlined, UploadOutlined, PaperClipOutlined, FileTextOutlined, ShopOutlined, BarsOutlined } from '@ant-design/icons';
import { projects, locations } from './mockData';
import GanttChart from './GanttChart';
import D1GanttPage from './D1GanttPage'; // Import the new page
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

const EditableContext = React.createContext(null);

const EditableRow = ({ index, ...props }) => {
  const [form] = Form.useForm();
  return (
    <Form form={form} component={false}>
      <EditableContext.Provider value={form}>
        <tr {...props} />
      </EditableContext.Provider>
    </Form>
  );
};

const EditableCell = ({
  title,
  editable,
  children,
  dataIndex,
  record,
  handleSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef(null);
  const form = useContext(EditableContext);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const toggleEdit = () => {
    setEditing(!editing);
    form.setFieldsValue({
      [dataIndex]: record[dataIndex],
    });
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      toggleEdit();
      handleSave({ ...record, ...values });
    } catch (errInfo) {
      console.log('Save failed:', errInfo);
    }
  };

  let childNode = children;

  if (editable) {
    childNode = editing ? (
      <Form.Item
        style={{
          margin: 0,
        }}
        name={dataIndex}
        rules={[
          {
            required: true,
            message: `${title} is required.`,
          },
        ]}
      >
        <Input ref={inputRef} onPressEnter={save} onBlur={save} />
      </Form.Item>
    ) : (
      <div
        className="editable-cell-value-wrap"
        style={{
          paddingRight: 24,
        }}
        onClick={toggleEdit}
      >
        {children}
      </div>
    );
  }

  return <td {...restProps}>{childNode}</td>;
};


 // --- New Store Details Page (已修改) ---
 const StoreDetailsPage = () => {
   const [storeDetails, setStoreDetails] = useState([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState(null);
 
   const fetchData = async () => {
     console.log("Attempting to fetch store details from API...");
     setLoading(true);
     setError(null);
     try {
       const response = await fetch('/api/store-details');
       if (!response.ok) {
         throw new Error(`Network response was not ok: ${response.statusText}`);
       }
       const data = await response.json();
       console.log("SUCCESS: Loaded store details from API.", data);
 
       if (Array.isArray(data.storeDetails)) {
         setStoreDetails(data.storeDetails.map(item => ({ ...item, key: item.store_id })));
       } else {
         console.error("ERROR: API response for storeDetails is not an array.", data);
         setError("数据格式错误");
       }
     } catch (error) {
       console.error('ERROR: Failed to fetch or parse store details from API.', error);
       setError('数据加载失败，请检查网络或联系管理员！');
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     fetchData();
   }, []);
 
   const handleRefresh = () => {
     console.log("User clicked refresh button. Fetching store details again...");
     fetchData();
   };

   const handleSave = async (row) => {
    const newData = [...storeDetails];
    const index = newData.findIndex((item) => row.key === item.key);
    if (index > -1) {
      const item = newData[index];
      newData.splice(index, 1, { ...item, ...row });
      setStoreDetails(newData);

      try {
        const response = await fetch(`/api/store-detail/${row.store_id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(row),
        });
        if (!response.ok) {
          throw new Error('Failed to save data');
        }
        message.success('保存成功');
      } catch (err) {
        message.error('保存失败');
        // rollback
        newData.splice(index, 1, item);
        setStoreDetails(newData);
      }
    }
   };

   // 上传组件的配置 (模拟，不真实上传)
   const uploadProps = {
    name: 'file',
    multiple: true, // 允许上传多个文件
    showUploadList: false, // 表格里不显示默认的上传列表，以免撑大表格
    beforeUpload: (file) => {
        // 拦截上传，返回 false 阻止自动 POST 请求
        message.success(`${file.name} 已添加到上传队列 (模拟)`);
        return false; 
    },
   };
 
   const defaultColumns = [
    {
        title: '序号',
        dataIndex: 'sort_order',
        key: 'sort_order',
        width: 60,
        fixed: 'left',
        align: 'center',
        render: (text, record, index) => <b>{index + 1}</b>
    },
    {
        title: '门店名称',
        dataIndex: 'store_name',
        key: 'store_name',
        width: 120,
        fixed: 'left',
        render: (text, record) => (
          <Link to={`/gantt/${record.store_id}`} style={{ fontWeight: 'bold' }}>
            {text}
          </Link>
        ),
        editable: true,
    },
    {
      title: '资料操作',
      key: 'upload_action',
      width: 100,
      fixed: 'left',
      render: (_, record) => (
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} size="small" type="dashed">上传</Button>
        </Upload>
      ),
    },
    {
        title: '已存文档',
        dataIndex: 'related_documents',
        key: 'related_documents',
        width: 200,
        render: (_, record, index) => {
            if (index % 2 === 0) {
                return (
                    <Space direction="vertical" size={0}>
                        <Tag icon={<FileTextOutlined />} color="blue">租赁合同.pdf</Tag>
                        <Tag icon={<PaperClipOutlined />} color="geekblue">现场照片.jpg</Tag>
                    </Space>
                )
            }
            return <span style={{color: '#ccc'}}>暂无</span>
        }
    },
     { title: '所处区域', dataIndex: 'district', key: 'district', width: 100, editable: true },
     { title: '建筑面积', dataIndex: 'building_area', key: 'building_area', width: 100, editable: true },
     { title: '套内面积', dataIndex: 'usable_area', key: 'usable_area', width: 100, editable: true },
     { title: '租金', dataIndex: 'rent', key: 'rent', width: 100, editable: true },
     { title: '免租期', dataIndex: 'rent_free_period', key: 'rent_free_period', width: 100, editable: true },
     { title: '物业费', dataIndex: 'property_fee', key: 'property_fee', width: 80, editable: true },
     { title: '电费', dataIndex: 'electricity_fee', key: 'electricity_fee', width: 80, editable: true },
     { title: '水费', dataIndex: 'water_fee', key: 'water_fee', width: 80, editable: true },
     { title: '付款方式', dataIndex: 'payment_method', key: 'payment_method', width: 100, editable: true },
     { title: '租金递增', dataIndex: 'rent_increase', key: 'rent_increase', width: 120, editable: true },
     { title: '合同年限', dataIndex: 'contract_years', key: 'contract_years', width: 100, editable: true },
     { title: '门店属性', dataIndex: 'properties', key: 'properties', width: 150, editable: true },
     { title: '开办杂费', dataIndex: 'startup_costs', key: 'startup_costs', width: 150, editable: true },
     { title: '筹开进度', dataIndex: 'progress', key: 'progress', width: 200, ellipsis: true, editable: true },
     { title: '回本周期', dataIndex: 'roi_period', key: 'roi_period', width: 100, editable: true },
   ];

    const components = {
      body: {
        row: EditableRow,
        cell: EditableCell,
      },
    };

    const columns = defaultColumns.map((col) => {
      if (!col.editable) {
        return col;
      }
      return {
        ...col,
        onCell: (record) => ({
          record,
          editable: col.editable,
          dataIndex: col.dataIndex,
          title: col.title,
          handleSave,
        }),
      };
    });
 
   return (
     <Card
       title="门店详情列表"
       extra={
         <Space>
            <Button type="primary" disabled>批量导出</Button>
            <Button onClick={handleRefresh} disabled={loading} loading={loading}>
            {loading ? '刷新中' : '刷新数据'}
            </Button>
         </Space>
       }
     >
       {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
       <Spin spinning={loading}>
         <Table
           components={components}
           rowClassName={() => 'editable-row'}
           bordered
           dataSource={storeDetails}
           columns={columns}
           rowKey="key"
           scroll={{ x: 2000 }}
           pagination={{ defaultPageSize: 10 }}
           size="middle"
         />
       </Spin>
     </Card>
   );
 };

// --- Project Detail Page (with ViewMode switcher) ---
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
  const [stores, setStores] = useState([]);

  useEffect(() => {
    // Fetch store list for the menu
    const fetchStores = async () => {
      try {
        const response = await fetch('/api/store-details');
        const data = await response.json();
        if (Array.isArray(data.storeDetails)) {
          setStores(data.storeDetails);
        }
      } catch (error) {
        console.error("Failed to fetch stores for menu:", error);
      }
    };
    fetchStores();
  }, []);

  const menuItems = [
    {
      key: 'store-management',
      icon: <ShopOutlined />,
      label: '门店管理',
      children: [
        {
          key: 'store-details',
          icon: <BarsOutlined />,
          label: <Link to="/store-details">全部门店详情</Link>,
        },
        ...stores.map(store => ({
          key: store.store_id,
          label: <Link to={`/gantt/${store.store_id}`}>{store.store_name}</Link>,
        })),
      ],
    },
  ];

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
          defaultOpenKeys={['store-management']}
          defaultSelectedKeys={['store-details']}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: 0, display: 'flex', alignItems: 'center' }}>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
            })}
            <div style={{ fontSize: '18px', fontWeight: 'bold', marginLeft: '10px' }}>内部工作联通系统</div>
        </Header>
        
        {/* --- Content Area --- */}
        <Content style={{
          margin: '24px 16px',
          padding: 24,
          background: '#fff',
          overflowX: 'auto' 
        }}>
          <Routes>
            <Route path="/store-details" element={<StoreDetailsPage />} />
            <Route path="/" element={<LocationSelectionPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
            <Route path="/gantt/:storeId" element={<D1GanttPage />} />
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
    <div id="live-demo-additional-container" style={{ position: 'fixed', top: 0, left: 0, zIndex: 10000 }} />
  </Router>
);

export default AppWrapper;
