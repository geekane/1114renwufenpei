import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Spin, Alert, Card, Button, Row, Col, Statistic } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { analyzeLocationPotential } from './amapApi';

const CrowdPortraitPage = () => {
  const { storeId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    const performAnalysis = async () => {
      if (!storeId) {
        setError('未提供门店ID');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        // 在真实场景中，这里会有一个fetch调用来获取地址
        // const storeInfo = await fetch(`/api/store-detail/${storeId}`).then(res => res.json());
        // const address = storeInfo.detailed_address;
        const mockAddress = "成都东原时光道"; // 暂时使用一个硬编码地址
        
        const result = await analyzeLocationPotential(mockAddress);
        setAnalysisResult(result);
      } catch (err) {
        setError('人群画像分析失败，请稍后重试。');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    performAnalysis();
  }, [storeId]);

  const renderContent = () => {
    if (loading) {
      return <Spin tip="正在生成人群画像分析报告..." size="large" />;
    }
    if (error) {
      return <Alert message="错误" description={error} type="error" showIcon />;
    }
    if (!analysisResult) {
      return <Alert message="没有可用的分析数据" type="info" showIcon />;
    }

    // 简易仪表盘UI
    return (
      <Card>
        <Row gutter={[16, 24]}>
          <Col span={24}>
            <Statistic title="综合评估得分" value={analysisResult.totalScore} precision={2} suffix="分" />
          </Col>
          <Col span={8}>
            <Statistic title="评级" value={analysisResult.rating} />
          </Col>
          <Col span={16}>
            <Statistic title="一句话建议" value={analysisResult.recommendation} />
          </Col>
          {Object.entries(analysisResult.details).map(([name, detail]) => (
            <Col span={6} key={name}>
              <Statistic
                title={`${name} (${detail.count}个)`}
                value={detail.score.toFixed(1)}
                suffix="分"
                valueStyle={{ color: detail.score > 0 ? '#3f8600' : '#cf1322' }}
              />
            </Col>
          ))}
        </Row>
      </Card>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Link to={`/gantt/${storeId}`}>
              <Button icon={<ArrowLeftOutlined />} type="text" />
            </Link>
            <span style={{ marginLeft: '10px' }}>点位人群画像分析</span>
          </div>
        }
        extra={analysisResult ? `分析地址: ${analysisResult.address}`: ''}
      >
        {renderContent()}
      </Card>
    </div>
  );
};

export default CrowdPortraitPage;