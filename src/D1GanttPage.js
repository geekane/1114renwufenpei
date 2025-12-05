import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Space, message } from 'antd'; // 引入 Ant Design 的 Button, Space 和 message 组件
import * as VTable from '@visactor/vtable';
import * as VTableGantt from '@visactor/vtable-gantt';
import { DateInputEditor, InputEditor } from '@visactor/vtable-editors';
// Data is now fetched from the API.

function formatDate(date) {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return year + '-' + month + '-' + day;
}

// 根据进度返回颜色配置
function getProgressColorConfig(progress) {
  // 1. 使用 parseFloat 解析，可以处理 "18%"、"18"、0.18 等情况
  let p = parseFloat(progress);
  
  if (isNaN(p)) p = 0;

  // 智能修正：如果进度是 0.8 这种小数，自动转为 80
  if (p <= 1 && p > 0) {
      p = p * 100;
  }
  
  // console.log(`[Debug] Task Progress: ${progress}, Parsed: ${p}`);

  if (p >= 100) {
    return { main: '#10b981', bg: '#d1fae5' }; // 绿色 (完成)
  } else if (p >= 60) {
    return { main: '#3b82f6', bg: '#dbeafe' }; // 蓝色 (良好)
  } else if (p >= 30) {
    return { main: '#f97316', bg: '#ffedd5' }; // 橙色 (进行中)
  } else {
    return { main: '#ef4444', bg: '#fee2e2' }; // 红色 (滞后/刚开始)
  }
}

function createPopup({ date, content }, position, callback) {
    let container = document.getElementById('live-demo-additional-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'live-demo-additional-container';
      container.style.position = 'absolute';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
    }
    
    const existingPopup = container.querySelector('.popup');
    if (existingPopup) {
        existingPopup.remove();
    }
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.style.top = `${position.top}px`;
    popup.style.left = `${position.left}px`;
    popup.style.position = 'absolute';
    popup.style.zIndex = '1000';
    popup.style.background = 'white';
    popup.style.border = '1px solid #ccc';
    popup.style.padding = '10px';
    popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
    popup.style.pointerEvents = 'auto';

    const dateString = typeof date === 'string' ? date : formatDate(date);
    popup.innerHTML = `
      <button class="close-btn" style="position: absolute; top: 5px; right: 5px; border: none; background: transparent; font-size: 1.2em; cursor: pointer;">&times;</button>
      <div style="margin-bottom: 5px;">日期：${dateString}</div>
      <input type="text" placeholder="输入内容" class="popup-input" value="${content || ''}" style="width: 150px; margin-bottom: 5px; padding: 5px;" />
      <button class="confirm-btn" style="padding: 5px 10px; cursor: pointer;">确定</button>
  `;
    popup.querySelector('.close-btn').onclick = () => popup.remove();
    popup.querySelector('.confirm-btn').onclick = () => {
        const inputValue = popup.querySelector('.popup-input').value;
        popup.remove();
        if (typeof callback === 'function') {
            callback(inputValue);
        }
    };
    container.appendChild(popup);
    popup.querySelector('.popup-input').focus();
}

// Helper for API calls to the backend
const apiCall = async (endpoint, method = 'POST', body) => {
    try {
        const response = await fetch(`/api/${endpoint}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || errorData.error || `Network response was not ok: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`ERROR: API call to /api/${endpoint} failed.`, error);
        alert(`操作失败: ${error.message}`);
        return { success: false, error };
    }
};

const getChineseWeekday = (date) => {
    const day = new Date(date).getDay();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${weekdays[day]}`;
};

const getScalesConfig = (scaleType) => {
    switch (scaleType) {
        case 'week':
            return [
                {
                    unit: 'month',
                    step: 1,
                    format: (context) => `${context.startDate.getFullYear()}年 ${context.startDate.getMonth() + 1}月`,
                    style: { textStick: true, fontSize: 14, fontWeight: 'bold', color: '#333' }
                },
                {
                    unit: 'week',
                    step: 1,
                    format: (context) => `第${context.dateIndex}周`,
                    style: { fontSize: 12, color: '#666' }
                }
            ];
        case 'month':
            return [
                {
                    unit: 'year',
                    step: 1,
                    format: (context) => `${context.startDate.getFullYear()}年`,
                    style: { textStick: true, fontSize: 16, fontWeight: 'bold', color: '#333' }
                },
                {
                    unit: 'month',
                    step: 1,
                    format: (context) => `${context.startDate.getMonth() + 1}月`,
                    style: { fontSize: 14, color: '#555' }
                }
            ];
        case 'day':
        default:
            return [
                {
                    unit: 'month',
                    step: 1,
                    format: (context) => `${context.startDate.getFullYear()}年 ${context.startDate.getMonth() + 1}月`,
                    style: { textStick: true, fontSize: 14, fontWeight: 'bold', color: '#333', textAlign: 'center' }
                },
                {
                    unit: 'day',
                    step: 1,
                    format: (date) => `${date.dateIndex}\n${getChineseWeekday(date.startDate)}`,
                    style: { textAlign: 'center', lineHeight: 20, fontSize: 12 }
                }
            ];
    }
};

const GanttChart = () => {
    const { storeId } = useParams();
    const containerRef = useRef(null);
    const instanceRef = useRef(null);
    const isUpdatingExternally = useRef(false);
    const [records, setRecords] = useState([]);
    const [markLines, setMarkLines] = useState([]);
    const [timeScale, setTimeScale] = useState('day');
    const [isLoading, setIsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, record: null });

    const fetchData = async () => {
        if (!storeId) return;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/data/${storeId}`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            setRecords(Array.isArray(data.records) ? data.records : []);
            setMarkLines(Array.isArray(data.markLines) ? data.markLines : []);
        } catch (error) {
            console.error('ERROR: Failed to fetch or parse data from API.', error);
            alert('数据加载失败，请检查网络或联系管理员！');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [storeId]);

    useEffect(() => {
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, record: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        if (containerRef.current && !instanceRef.current) {
            const inputEditor = new InputEditor();
            VTable.register.editor('input-editor', inputEditor);
            const dateEditor = new DateInputEditor();
            VTable.register.editor('date-editor', dateEditor);

            const columns = [
                { field: 'title', title: '任务', width: 150, editor: 'input-editor', tree: true },
                { field: 'start', title: '开始时间', width: 120, editor: 'date-editor' },
                { field: 'end', title: '结束时间', width: 120, editor: 'date-editor' }
            ];

            const today = new Date();
            const maxDate = new Date();
            maxDate.setMonth(today.getMonth() + 2);

            const option = {
                records,
                markLine: markLines,
                taskListTable: {
                    columns,
                    tableWidth: 'auto',
                    minTableWidth: 300,
                    theme: { headerStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 18, fontWeight: 'bold', color: 'red' }, bodyStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 16, color: '#4D4D4D', bgColor: '#FFF' } },
                    hierarchyIndent: 25,
                    hierarchyExpandLevel: 2,
                },
                frame: {
                  outerFrameStyle: { borderLineWidth: 0, borderColor: 'red', cornerRadius: 8 },
                  verticalSplitLine: { lineColor: '#d5d9ee', lineWidth: 2, visible: true },
                  verticalSplitLineHighlight: { lineColor: '#1677ff', lineWidth: 3, visible: true }
                },
                grid: { backgroundColor: '#f0f0fb', horizontalLine: { lineWidth: 2, lineColor: '#d5d9ee' } },
                headerRowHeight: 80,
                rowHeight: 80,
                taskBar: {
                    selectable: true,
                    startDateField: 'start',
                    endDateField: 'end',
                    progressField: 'progress',
                    labelText: '{title} ({progress}%)',
                    labelTextStyle: {
                      fontFamily: 'Arial, sans-serif',
                      fontSize: 14,
                      textAlign: 'left',
                      color: '#24292f'
                    },
                    barStyle: {
                      width: 50,
                      cornerRadius: 6,
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                      barColor: (args) => {
                        const record = args.taskRecord || args;
                        console.log(`[Debug BarColor] Task: ${record.title}`, {
                            rawProgress: record.progress,
                            type: typeof record.progress,
                            parsedColor: getProgressColorConfig(record.progress)
                        });
                        return getProgressColorConfig(record.progress).bg;
                      },
                      completedBarColor: (args) => {
                        const record = args.taskRecord || args;
                        return getProgressColorConfig(record.progress).main;
                      }
                    },
                    progressAdjustable: true
                },
                timelineHeader: {
                    backgroundColor: '#f0f0fb',
                    colWidth: 80,
                    scales: getScalesConfig(timeScale)
                },
                minDate: formatDate(today),
                maxDate: formatDate(maxDate),
                scrollStyle: { scrollRailColor: 'RGBA(246,246,246,0.5)', visible: 'focus', width: 6, scrollSliderCornerRadius: 2, scrollSliderColor: '#5cb85c' },
                overscrollBehavior: 'none',
            };

            const ganttInstance = new VTableGantt.Gantt(containerRef.current, option);
            instanceRef.current = ganttInstance;

            const handleCellEdit = (args) => {
                const { col, row, field, value } = args;
                const record = instanceRef.current.getRecordByCell(col, row);
                if (!record || !record.id || !field) return;
                const changedData = { [field]: (field === 'start' || field === 'end') ? formatDate(new Date(value)) : value };
                setRecords(currentRecords => {
                    const updateNode = (nodes) => nodes.map(node => {
                        if (node.id === record.id) return { ...node, ...changedData };
                        if (node.children) return { ...node, children: updateNode(node.children) };
                        return node;
                    });
                    return updateNode(currentRecords);
                });
            };
            
            const handleMarkLineCreate = ({ data, position }) => {
                createPopup({ date: data.startDate, content: '' }, position, async value => {
                  const newMarkLine = { date: formatDate(data.startDate), content: value || '新建里程碑', store_id: storeId, contentStyle: { color: '#fff' }, style: { lineWidth: 1, lineColor: 'red' } };
                  const result = await apiCall('markline', 'POST', newMarkLine);
                  if (result.success) setMarkLines(prev => [...prev, newMarkLine]);
                });
            };
      
            const handleMarkLineClick = ({ data, position }) => {
                createPopup({ date: data.date, content: data.content }, position, async value => {
                  const updatedMarkLine = { ...data, content: value || data.content, store_id: storeId };
                  const result = await apiCall('markline', 'POST', updatedMarkLine);
                  if(result.success) setMarkLines(prev => prev.map(line => line.date === data.date ? { ...line, content: value } : line));
                });
            };

            const handleTaskChange = (args) => {
                if (isUpdatingExternally.current) {
                    requestAnimationFrame(() => { isUpdatingExternally.current = false; });
                    return;
                }
                setRecords(args.records);
            };

            const handleContextMenu = (args) => {
                args.event.preventDefault();
                const record = instanceRef.current.getRecordByCell(args.col, args.row);
                if (record) setContextMenu({ visible: true, x: args.event.clientX, y: args.event.clientY, record: record });
            };
    
            ganttInstance.on('click_markline_create', handleMarkLineCreate);
            ganttInstance.on('click_markline_content', handleMarkLineClick);
            ganttInstance.on('change_task', handleTaskChange);
            ganttInstance.on('after_edit_cell', handleCellEdit);
            ganttInstance.on('contextmenu_cell', handleContextMenu);
        }

        return () => {
            if (instanceRef.current) {
                instanceRef.current.release();
                instanceRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (instanceRef.current) instanceRef.current.setRecords(records);
    }, [records]);

    useEffect(() => {
        if (instanceRef.current) instanceRef.current.updateMarkLine(markLines);
    }, [markLines]);

    useEffect(() => {
        if (instanceRef.current) instanceRef.current.updateScales(getScalesConfig(timeScale));
    }, [timeScale]);

    const handleRefresh = () => fetchData();

    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            const result = await apiCall('tasks', 'POST', { records, storeId });
            if (result.success) message.success('更改已成功保存');
            else message.error('保存失败: ' + (result.error?.message || '未知错误'));
        } catch (error) {
            message.error('保存失败: ' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTask = async (parentId = null) => {
        const newTask = { title: parentId ? "新子任务" : "新任务", start: formatDate(new Date()), end: formatDate(new Date(new Date().setDate(new Date().getDate() + 1))), progress: 0, parent_id: parentId };
        setIsLoading(true);
        try {
            const result = await apiCall('task/add', 'POST', { task: newTask, storeId });
            if (result.success) {
                message.success('任务添加成功');
                await fetchData();
            } else {
                message.error('添加失败: ' + (result.error || '未知错误'));
            }
        } catch (e) {
            message.error('添加失败: ' + e.message);
        } finally {
            setIsLoading(false);
            if (contextMenu.visible) setContextMenu({ visible: false, x: 0, y: 0, record: null });
        }
    };

    return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {contextMenu.visible && (
                <div style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, background: 'white', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.2)', zIndex: 1001, padding: '5px 0' }}>
                    <div style={{ padding: '8px 15px', cursor: 'pointer' }} onClick={() => handleAddTask(contextMenu.record.id)}>
                        新增子任务
                    </div>
                </div>
            )}
            <div style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                    <span>时间粒度：</span>
                    <Button type={timeScale === 'day' ? 'primary' : 'default'} onClick={() => setTimeScale('day')}>日</Button>
                    <Button type={timeScale === 'week' ? 'primary' : 'default'} onClick={() => setTimeScale('week')}>周</Button>
                    <Button type={timeScale === 'month' ? 'primary' : 'default'} onClick={() => setTimeScale('month')}>月</Button>
                </Space>
                <Space>
                    <Link to={`/crowd-portrait/${storeId}`}><Button>人群画像分析</Button></Link>
                    <Button onClick={handleRefresh} disabled={isLoading}>{isLoading ? '正在刷新...' : '刷新同步数据'}</Button>
                    <Button onClick={() => handleAddTask(null)} disabled={isLoading}>新增任务</Button>
                    <Button type="primary" onClick={handleSaveChanges} disabled={isLoading} loading={isLoading}>{isLoading ? '正在保存...' : '保存更改到云端'}</Button>
                </Space>
            </div>
            <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
        </div>
    );
};

export default GanttChart;
