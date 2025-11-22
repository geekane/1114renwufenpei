import React, { useState, useEffect, useRef } from 'react';
import { Input, Button } from 'antd';
import ReactECharts from 'echarts-for-react';
import './StandalonePortraitPage.css';
import './StandalonePortraitPage.css';

const StandalonePortraitPage = () => {
    const [apiKey, setApiKey] = useState('cfed97bf5c90224abbbb2ede4c008d0b');
    const [address, setAddress] = useState('成都东原时光道');
    const [radius, setRadius] = useState(800);
    const [logs, setLogs] = useState([{ time: 'SYSTEM', msg: '等待指令...', type: '' }]);
    const [loading, setLoading] = useState(false);

    // Chart options
    const [gaugeOption, setGaugeOption] = useState({});
    const [radarOption, setRadarOption] = useState({});
    const [barOption, setBarOption] = useState({});
    
    // UI display states
    const [grade, setGrade] = useState('--');
    const [suggestion, setSuggestion] = useState('输入地址开始分析...');
    const [gradeColor, setGradeColor] = useState('var(--text-main)');
    const [scores, setScores] = useState({ core: 0, biz: 0, comp: 0, cost: 0 });

    const logConsoleRef = useRef(null);

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
    
    const chartColors = {
        line: '#4cc9f0',
        area: 'rgba(76, 201, 240, 0.2)',
        grid: '#333',
        text: '#a3a3a3'
    };

    // Helper to add logs
    const addLog = (msg, type = '') => {
        const time = new Date().toLocaleTimeString([], { hour12: false });
        setLogs(prev => [...prev, { time, msg, type }]);
    };

    useEffect(() => {
        if (logConsoleRef.current) {
            logConsoleRef.current.scrollTop = logConsoleRef.current.scrollHeight;
        }
    }, [logs]);

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

    useEffect(() => {
        setGaugeOption(getInitialGaugeOption());
        setRadarOption(getInitialRadarOption());
        setBarOption(getInitialBarOption());
    }, []);

    const updateUI = (totalScore, newScores, poiData, infraScore = 20) => {
        let cleanScore = Math.max(0, totalScore);
        let gradeVal = "D", color = "#f87171", suggVal = "缺乏核心支撑，风险较高";
        
        if (newScores.risk > 15) { gradeVal = "F"; suggVal = "存在严重政策风险(学校)，一票否决"; color = "#f87171"; }
        else if (totalScore >= 150) { gradeVal = "S"; suggVal = "顶级商圈，客流充沛，强烈推荐"; color = "#4ade80"; }
        else if (totalScore >= 110) { gradeVal = "A"; suggVal = "核心区域，各项指标优秀"; color = "#4cc9f0"; }
        else if (totalScore >= 60) { gradeVal = "B"; suggVal = "潜力区域，存在一定短板"; color = "#facc15"; }

        setGrade(gradeVal);
        setSuggestion(suggVal);
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
    
    const runDemo = () => {
        setLoading(true);
        addLog("启动演示模式...", 'highlight');
        
        setTimeout(() => {
            const simScore = 88.5;
            const newScores = { core: 65, biz: 42, comp: 12, risk: 0, cost: 10 };
            const infraScore = 25;
            const poiData = Object.keys(CONFIG.positive).map(k => ({ name: k, count: Math.floor(Math.random() * 10) }));

            updateUI(simScore, newScores, poiData, infraScore);
            setLoading(false);
            addLog("演示分析完成", 'success');
        }, 1000);
    };

    const startAnalysis = async () => {
        if (!apiKey) { addLog("请填写API Key或使用演示模式", 'error'); return; }
        if (!address) { addLog("请填写地址", 'error'); return; }

        setLoading(true);
        addLog(`开始分析: ${address}`, 'highlight');

        try {
            const geoRes = await fetch(`https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${address}`);
            const geoData = await geoRes.json();
            if (geoData.status !== '1' || geoData.count === '0') throw new Error("地址无法解析");
            
            const location = geoData.geocodes[0].location;
            addLog(`定位成功: ${location}`);

            let totalScore = 0;
            const newScores = { core: 0, biz: 0, comp: 0, risk: 0, cost: 0 };
            const poiCounts = [];
            let infraScore = 0;

            const promises = Object.entries(CONFIG.positive).map(async ([name, config]) => {
                const searchRes = await fetch(`https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${location}&radius=${radius}&keywords=${name}&offset=20&page=1`);
                const searchData = await searchRes.json();
                let count = (searchData.status === '1') ? parseInt(searchData.count) : 0;
                
                let impact = 0;
                if (count > 0) {
                    let effective = config.saturation ? config.saturation * (1 - Math.exp(-count / config.saturation)) : count;
                    impact = effective * config.weight;
                }
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

            infraScore = 15;
            totalScore += infraScore;

            addLog("分析消费水平...");
            const foodRes = await fetch(`https://restapi.amap.com/v3/place/around?key=${apiKey}&location=${location}&radius=${radius}&types=050000&offset=20&show_fields=business`);
            const foodData = await foodRes.json();
            let avgCost = 30;
            if (foodData.pois && foodData.pois.length > 0) {
                let total = 0, num = 0;
                foodData.pois.forEach(p => {
                    if (p.biz_ext && p.biz_ext.cost) { total += parseFloat(p.biz_ext.cost); num++; }
                });
                if (num > 0) avgCost = total / num;
            }
            
            let costBonus = (avgCost <= 35) ? 20 : (avgCost <= 50 ? 10 : (avgCost <= 80 ? -5 : -15));
            newScores.cost = costBonus;
            totalScore += costBonus;

            updateUI(totalScore, newScores, poiCounts, infraScore);
            addLog(`分析完成，总分: ${totalScore.toFixed(1)}`, 'success');

        } catch (e) {
            addLog(e.message, 'error');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="dashboard-container">
            {loading && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p style={{ marginTop: '15px', fontSize: '12px', color: '#999' }}>DATAMINING...</p>
                </div>
            )}
            <header className="dashboard-header">
                <h1>点位猎人 <span>V11.1</span></h1>
                <div className="controls">
                    <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="高德 Key" style={{ width: 200 }} />
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="地址" style={{ width: 180 }} />
                    <Input type="number" value={radius} onChange={e => setRadius(parseInt(e.target.value))} placeholder="半径" style={{ width: 70 }} />
                    <Button type="primary" onClick={startAnalysis}>分析</Button>
                    <Button onClick={runDemo}>演示</Button>
                </div>
            </header>

            <div className="dashboard-grid">
                <div className="dashboard-card area-log">
                    <div className="card-title">运行日志 / LOGS</div>
                    <div className="log-window" ref={logConsoleRef}>
                        {logs.map((log, i) => (
                            <div key={i} className={`log-entry ${log.type}`}>
                                <span className="time">{log.time}</span>{log.msg}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="dashboard-card area-score">
                    <div className="score-wrapper">
                        <ReactECharts option={gaugeOption} style={{ width: 220, height: 220 }} />
                    </div>
                    <div className="info-wrapper">
                        <div className="card-title">评估结果 / RESULT</div>
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

                <div className="dashboard-card area-radar">
                    <div className="card-title">五维模型 / DIMENSIONS</div>
                    <ReactECharts option={radarOption} className="chart-box" style={{height: '100%'}} />
                </div>

                <div className="dashboard-card area-details">
                    <div className="card-title">业态分布 / DISTRIBUTION</div>
                    <ReactECharts option={barOption} className="chart-box" style={{height: '100%'}} />
                </div>
            </div>
        </div>
    );
};

export default StandalonePortraitPage;
