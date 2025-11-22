import React, { useState, useContext } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { AuthContext } from './AuthContext'; // We will create this next
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
    const [loading, setLoading] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const onFinish = (values) => {
        setLoading(true);
        try {
            // The login logic is now inside the AuthContext
            const success = login(values.username, values.password);
            if (success) {
                message.success('登录成功!');
                navigate('/'); // Redirect to the main page after login
            } else {
                message.error('用户名或密码错误!');
            }
        } catch (error) {
            message.error('登录时发生错误');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
            <Card title="内部系统登录" style={{ width: 350 }}>
                <Form
                    name="normal_login"
                    initialValues={{ remember: true }}
                    onFinish={onFinish}
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: '请输入用户名!' }]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="用户名" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: '请输入密码!' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="密码" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} style={{ width: '100%' }}>
                            登 录
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default LoginPage;