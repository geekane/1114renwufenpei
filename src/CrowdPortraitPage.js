import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Spin, Alert, Card, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import './StandalonePortraitPage.css'; // Reuse the same cool CSS

const CrowdPortraitPage = () => {
    const { storeId } = useParams();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Chart options
    const [gaugeOption, setGaugeOption] = useState({});
    const [radarOption, setRadarOption] = useState({});
    const [barOption, setBarOption] = useState({});
    
    // UI display states
    const [grade, setGrade] = useState('--');
    const [suggestion, setSuggestion] = useState('加载中...');
    const [gradeColor, setGradeColor] = useState('var(--text-main)');
    const [scores, setScores] = useState({ core: 0, biz: 0, comp: 0, cost: 0 });
    const [address, setAddress] = useState('');

    const logConsoleRef = useRef(null);

    // Same config as the standalone page
    const CONFIG = {
        positive: {
            "商场购物": {weight: 2.5, category: "核心客群", saturation: 5},
            "大中专院校": {weight: 2.2, category: "核心客群", saturation: 5},
            "写字楼": {weight: 1.8, category: "核心客群", saturation: 20},
            "住宅小区": {weight: 1.5, category: "核心客群", saturation: 25},
            "青年公寓": {weight: 2.0, category: "协同业态", saturation: 15},
            "夜市美食": {weight: 1.8, category: "协同业态", saturation: 5},
            "电影院": {weight: 1.6, category: "协同业态", saturation: 5},
            "网咖竞对": {weight: -4.0, category: "直接竞争", is_negative: true},
            "中小学校": {weight: -10.0, category: "政策风险", is_negative: true},
        }
    };
    
    const chartColors = { line: '#4cc9f0', area: 'rgba(76, 201, 240, 0.2)' };

    // Add logs
    const addLog = (msg, type = '') => {
        const time = new Date().toLocaleTimeString([], { hour12: false });
        setLogs(prev => [...prev, { time, msg, type }]);
    };

    useEffect(() => {
        if (logConsoleRef.current) {
            logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight;
        }
    }, [logs]);

    const updateUI = (totalScore, newScores, poiData, infraScore = 20, sugg, finalGrade, color) => {
        let cleanScore = Math.max(0, totalScore);

        setGrade(finalGrade);
        setSuggestion(sugg);
        setGradeColor(color);
        setScores(newScores);

        setGaugeOption({
            series: [{ data: [{ value: cleanScore.toFixed(0) }], progress: { itemStyle: { color: color } } }]
        });
        const radarData = [
            Math.min(newScores.core, 100), Math.min(newScores.biz, 80), Math.min(infraScore, 80),
            Math.min(newScores.comp * 2, 80), Math.min(Math.max(newScores.cost + 30, 0), 60)
        ];
        setRadarOption({
            series: [{ type: 'radar', data: [{ value: radarData, name: '模型分析', areaStyle: { color: chartColors.area }, lineStyle: { color: chartColors.line } }] }]
        });
        setBarOption({
            xAxis: { data: poiData.map(i => i.name) },
            series: [{ data: poiData.map(i => i.count) }]
        });
    };
    
    const getGradeAndSuggestion = (totalScore, riskScore) => {
        let gradeVal = "D", color = "#f87171", suggVal = "缺乏核心支撑，风险较高";
        if (riskScore > 15) { gradeVal = "F"; suggVal = "存在严重政策风险(学校)，一票否决"; color = "#f87171"; }
        else if (totalScore >= 150) { gradeVal = "S"; suggVal = "顶级商圈，客流充沛，强烈推荐"; color = "#4ade80"; }
        else if (totalScore >= 110) { gradeVal = "A"; suggVal = "核心区域，各项指标优秀"; color = "#4cc9f0"; }
        else if (totalScore >= 60) { gradeVal = "B"; suggVal = "潜力区域，存在一定短板"; color = "#facc15"; }
        return { grade: gradeVal, suggestion: suggVal, color: color };
    };
    
    const runAnalysis = async (apiKey, targetAddress) => {
        addLog(`开始分析: ${targetAddress}`, 'highlight');
        setAddress(targetAddress);

        try {
            const geoRes = await fetch(`https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${targetAddress}`);
            const geoData = await geoRes.json();
            if (geoData.status !== '1' || geoData.count === '0') throw new Error("地址无法解析");
            
            const location = geoData.geocodes[0].location;
            addLog(`定位成功: ${location}`);

            let totalScore = 0;
            const newScores = { core: 0, biz: 0, comp: 0, risk: 0, cost: 0 };
            const poiCounts = [];
            let infraScore = 15; // Default infrastructure score

            const promises = Object.entries(CONFIG.positive).map(async ([name, config]) => {
                const searchRes = await fetch(`https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${location}&radius=${config.radius || 800}&keywords=${name}&offset=20&page=1`);
                const searchData = await searchRes.json();
                let count = (searchData.status === '1') ? parseInt(searchData.count) : 0;
                let impact = count > 0 ? (config.saturation ? config.saturation * (1 - Math.exp(-count / config.saturation)) : count) * config.weight : 0;
                return { name, config, count, impact };
            });

            const results = await Promise.all(promises);

            results.forEach(r => {
                if (r.config.is_negative) {
                    if (r.config.category === '直接竞争') newScores.comp += Math.abs(r.impact);
                    if (r.config.category === '政策风险') newScores.risk += Math.abs(r.impact);
                    totalScore -= Math.abs(r.impact);
                } else {
                    if (r.config.category === '核心客群') newScores.core += r.impact;
                    if (r.config.category === '协同业态') newScores.biz += r.impact;
                    totalScore += r.impact;
                }
                poiCounts.push({name: r.name, count: r.count});
                if (r.count > 0) addLog(`发现 ${r.name}: ${r.count}个`);
            });

            totalScore += infraScore;

            addLog("分析消费水平...");
            const foodRes = await fetch(`https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${location}&radius=800&types=050000&offset=20&show_fields=business`);
            const foodData = await foodRes.json();
            let avgCost = 30, num = 0, total = 0;
            if (foodData.pois && foodData.pois.length > 0) {
                foodData.pois.forEach(p => {
                    if (p.biz_ext && p.biz_ext.cost) { total += parseFloat(p.biz_ext.cost); num++; }
                });
                if (num > 0) avgCost = total / num;
            }
            let costBonus = (avgCost <= 35) ? 20 : (avgCost <= 50 ? 10 : (avgCost <= 80 ? -5 : -15));
            newScores.cost = costBonus;
            totalScore += costBonus;
            
            const { grade, suggestion, color } = getGradeAndSuggestion(totalScore, newScores.risk);
            
            const finalResult = {
                portrait_score: totalScore,
                portrait_rating: grade,
                portrait_recommendation: suggestion,
                portrait_details: { scores: newScores, poi: poiCounts, infra: infraScore }
            };

            updateUI(totalScore, newScores, poiCounts, infraScore, suggestion, grade, color);
            addLog(`分析完成，总分: ${totalScore.toFixed(1)}`, 'success');

            // Save to DB
            await fetch(`/api/portrait/${storeId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalResult)
            });
            addLog('分析结果已保存至数据库', 'highlight');

        } catch (e) {
            addLog(e.message, 'error');
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            if (!storeId) {
                setError("无效的门店ID");
                setLoading(false);
                return;
            }
            setLoading(true);
            addLog("正在获取门店报告...", "highlight");

            try {
                const res = await fetch(`/api/portrait/${storeId}`);
                if (res.ok) {
                    addLog("成功获取缓存报告", "success");
                    const data = await res.json();
                    const { scores, poi, infra } = data.portrait_details;
                    const { grade, suggestion, color } = getGradeAndSuggestion(data.portrait_score, scores.risk);
                    updateUI(data.portrait_score, scores, poi, infra, suggestion, grade, color);
                    setLoading(false);
                } else if (res.status === 404) {
                    addLog("未找到缓存报告，开始实时分析...", "highlight");
                    
                    const keyRes = await fetch('/api/amap-key');
                    if (!keyRes.ok) {
                        throw new Error("无法从后端获取API密钥，请检查服务器配置。");
                    }
                    const { apiKey } = await keyRes.json();

                    if (!apiKey) {
                        throw new Error("从后端获取的API密钥为空，请在Cloudflare Pages中设置AMAP_KEY环境变量。");
                    }

                    // This should be dynamic in a real scenario
                    const mockAddress = "成都卡密尔电竞馆";
                    setAddress(mockAddress);

                    runAnalysis(apiKey, mockAddress);
                } else {
                    throw new Error("获取报告时发生服务器错误");
                }
            } catch (e) {
                setError(e.message);
                addLog(e.message, 'error');
                setLoading(false);
            }
        };

        fetchData();
    }, [storeId]);
    
    // Initial chart options
    useEffect(() => {
        const initialRadar = getInitialRadarOption();
        setRadarOption(initialRadar);
        setGaugeOption(getInitialGaugeOption());
        setBarOption(getInitialBarOption());
    },[]);

    const getInitialGaugeOption = () => ({
        series: [{
            type: 'gauge', startAngle: 90, endAngle: -270, min: 0, max: 200,
            pointer: { show: false },
            progress: { show: true, overlap: false, roundCap: true, clip: false, itemStyle: { color: chartColors.line } },
            axisLine: { lineStyle: { width: 8, color: [[1, '#2a2a2a']] } },
            splitLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
            detail: { fontSize: 28, offsetCenter: [0, '0%'], valueAnimation: true, formatter: '{value}', color: '#fff', fontWeight: 'bold' },
            data: [{ value: 0 }]
        }]
    });

    const getInitialRadarOption = () => ({
        radar: {
            indicator: [
                { name: '核心客流', max: 100 }, { name: '商业协同', max: 80 }, { name: '基础设施', max: 80 },
                { name: '竞争环境', max: 80 }, { name: '消费匹配', max: 60 }
            ],
            radius: '65%', splitNumber: 4,
            axisName: { color: chartColors.text, fontSize: 11 },
            splitLine: { lineStyle: { color: '#2a2a2a' } },
            splitArea: { show: false }, axisLine: { lineStyle: { color: '#2a2a2a' } }
        },
        series: []
    });

    const getInitialBarOption = () => ({
        grid: { top: 10, bottom: 20, left: 30, right: 10 },
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.8)', borderColor: '#333', textStyle: {color: '#fff'} },
        xAxis: { type: 'category', data: [], axisLabel: { color: chartColors.text, fontSize: 10, interval:0 }, axisLine: { show: false }, axisTick: { show: false } },
        yAxis: { type: 'value', splitLine: { lineStyle: { color: '#2a2a2a', type: 'dashed' } }, axisLabel: { color: chartColors.text } },
        series: [{ type: 'bar', barWidth: '40%', itemStyle: { color: chartColors.line, borderRadius: [2, 2, 0, 0] }, data: [] }]
    });

    // This is the same UI structure as StandalonePortraitPage
    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1>门店画像报告: {storeId} <span>V11.2</span></h1>
                <div className="controls">
                    <Button type="primary" onClick={() => { /* re-running analysis can be implemented here */ }}>重新分析</Button>
                </div>
            </header>

            <Spin spinning={loading} size="large" fullscreen tip="正在生成报告..." />

            {!loading && (
                 <div className="dashboard-grid">
                    <div className="dashboard-card area-log">
                        <div className="card-title">分析日志</div>
                        <div className="log-window" ref={logConsoleRef}>
                            {logs.map((log, i) => (
                                <div key={i} className={`log-entry ${log.type}`}><span className="time">{log.time}</span>{log.msg}</div>
                            ))}
                        </div>
                    </div>
                    <div className="dashboard-card area-score">
                        <div className="score-wrapper"><ReactECharts option={gaugeOption} style={{ width: 220, height: 220 }} /></div>
                        <div className="info-wrapper">
                            <div className="card-title">评估结果</div>
                            <div><span className="grade-big" style={{ color: gradeColor }}>{grade}</span></div>
                            <div className="suggestion-box" style={{ borderLeftColor: gradeColor }}>{suggestion}</div>
                            <div style={{ marginTop: 20, width: '100%' }}>
                                <div className="score-item"><span className="label">核心客群</span><span className="val" style={{color:'var(--primary)'}}>{scores.core.toFixed(1)}</span></div>
                                <div className="score-item"><span className="label">商业协同</span><span className="val" style={{color:'var(--accent)'}}>{scores.biz.toFixed(1)}</span></div>
                                <div className="score-item"><span className="label">竞争压力</span><span className="val" style={{color:'var(--danger)'}}>{scores.comp.toFixed(1)}</span></div>
                                <div className="score-item"><span className="label">消费画像</span><span className="val" style={{color:'var(--warning)'}}>{scores.cost > 0 ? `+${scores.cost}` : scores.cost}</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="dashboard-card area-radar"><div className="card-title">五维模型</div><ReactECharts option={radarOption} style={{height: '100%'}} /></div>
                    <div className="dashboard-card area-details"><div className="card-title">业态分布</div><ReactECharts option={barOption} style={{height: '100%'}} /></div>
                </div>
            )}
            {error && <Alert message="错误" description={error} type="error" showIcon style={{marginTop: 20}}/>}
        </div>
    );
};

export default CrowdPortraitPage;