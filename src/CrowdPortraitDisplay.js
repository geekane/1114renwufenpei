import React from 'react';
import { Card, Row, Col, Statistic } from 'antd';

const CrowdPortraitDisplay = ({ result }) => {
  if (!result) {
    return null;
  }

  return (
    <Card>
      <Row gutter={[16, 24]}>
        <Col span={24}>
          <Statistic title="综合评估得分" value={result.totalScore} precision={2} suffix="分" />
        </Col>
        <Col span={8}>
          <Statistic title="评级" value={result.rating} />
        </Col>
        <Col span={16}>
          <Statistic title="一句话建议" value={result.recommendation} />
        </Col>
        {Object.entries(result.details).map(([name, detail]) => (
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

export default CrowdPortraitDisplay;