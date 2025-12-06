// --- START OF FILE D1GanttPage.js ---

import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Space, message } from 'antd';
import * as VTable from '@visactor/vtable';
import * as VTableGantt from '@visactor/vtable-gantt';
import { DateInputEditor, InputEditor } from '@visactor/vtable-editors';

// --- 辅助函数 ---

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const day = ('0' + d.getDate()).slice(-2);
    return year + '-' + month + '-' + day;
}

// 里程碑弹窗逻辑
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
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'popup';
    Object.assign(popup.style, {
        top: `${position.top}px`,
        left: `${position.left}px`,
        position: 'absolute',
        zIndex: '1000',
        background: 'white',
        border: '1px solid #ccc',
        padding: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        pointerEvents: 'auto'
    });

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
        if (typeof callback === 'function') callback(inputValue);
    };
    container.appendChild(popup);
    popup.querySelector('.popup-input').focus();
}

// API请求封装
const apiCall = async (endpoint, method = 'POST', body) => {
    try {
        const response = await fetch(`/api/${endpoint}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.details || errorData.error || response.statusText);
        }
        return await response.json();
    } catch (error) {
        console.error(`API Error /api/${endpoint}:`, error);
        return { success: false, error };
    }
};

// --- 主组件 ---

const GanttChart = () => {
    const { storeId } = useParams();
    const containerRef = useRef(null);
    const instanceRef = useRef(null);
    const isUpdatingExternally = useRef(false);
    
    // State
    const [records, setRecords] = useState([]);
    const [markLines, setMarkLines] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, record: null });

    // 1. Fetch Data
    const fetchData = async () => {
        if (!storeId) return;
        setIsLoading(true);
        console.log(`Fetching data for store: ${storeId}`);
        try {
            const response = await fetch(`/api/data/${storeId}`);
            if (!response.ok) throw new Error(response.statusText);
            const data = await response.json();

            if (Array.isArray(data.records)) {
                // 将后端返回的 0/1 转换为 false/true，防止 VTable 崩溃
                const processRecords = (nodes) => {
                    return nodes.map(node => {
                        const boolCompleted = node.is_completed === 1 || node.is_completed === true;
                        const children = node.children ? processRecords(node.children) : undefined;
                        return {
                            ...node,
                            is_completed: boolCompleted, 
                            children: children
                        };
                    });
                };
                setRecords(processRecords(data.records));
            } else {
                setRecords([]);
            }

            if (Array.isArray(data.markLines)) {
                setMarkLines(data.markLines);
            } else {
                setMarkLines([]);
            }
        } catch (error) {
            console.error('Data Load Error:', error);
            message.error("数据加载失败");
        } finally {
            setIsLoading(false);
        }
    };

    // Initial Fetch
    useEffect(() => {
        fetchData();
    }, [storeId]);

    // Close Context Menu
    useEffect(() => {
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, record: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Initialize Gantt Instance
    useEffect(() => {
        if (containerRef.current && !instanceRef.current) {
            console.log("Initializing Gantt Instance...");
            
            // Register Editors
            const inputEditor = new InputEditor();
            VTable.register.editor('input-editor', inputEditor);
            const dateEditor = new DateInputEditor();
            VTable.register.editor('date-editor', dateEditor);

            // Columns 配置
            const columns = [
                {
                    field: 'is_completed',
                    title: '✓',
                    width: 40,
                    cellType: 'checkbox',
                    style: { textAlign: 'center' }
                },
                { field: 'title', title: '任务名称', width: 200, sort: true, tree: true, editor: 'input-editor' },
                { field: 'start', title: '开始日期', width: 100, sort: true, editor: 'date-editor' },
                { field: 'end', title: '结束日期', width: 100, sort: true, editor: 'date-editor' },
                {
                    field: 'progress',
                    title: '进度',
                    width: 80,
                    sort: true,
                    headerStyle: { borderColor: '#e1e4e8' },
                    style: { borderColor: '#e1e4e8', color: 'green' }
                }
            ];

            // 初始占位日期，稍后会根据数据自动更新
            const today = new Date();
            const initMaxDate = new Date();
            initMaxDate.setMonth(today.getMonth() + 1);

            const option = {
                records: [], 
                markLine: [],
                taskListTable: {
                    columns: columns,
                    tableWidth: 'auto',
                    minTableWidth: 350,
                    maxTableWidth: 800
                },
                tasksShowMode: 'tasks_separate',
                frame: {
                    verticalSplitLineMoveable: true,
                    outerFrameStyle: { borderLineWidth: 1, borderColor: '#e5e7eb', cornerRadius: 8 },
                    verticalSplitLine: { lineWidth: 2, lineColor: '#d1d5db' },
                    verticalSplitLineHighlight: { lineColor: '#3b82f6', lineWidth: 2 }
                },
                grid: { verticalLine: { lineWidth: 1, lineColor: '#f3f4f6' }, horizontalLine: { lineWidth: 1, lineColor: '#f3f4f6' } },
                headerRowHeight: 50,
                rowHeight: 35,
                taskBar: {
                    selectable: true,
                    startDateField: 'start',
                    endDateField: 'end',
                    progressField: 'progress',
                    labelText: '{title} ({progress}%)',
                    labelTextStyle: { fontFamily: 'Arial, sans-serif', fontSize: 12, textAlign: 'left', color: '#24292f' },
                    barStyle: {
                        width: 24,
                        barColor: '#3b82f6',
                        completedBarColor: '#10b981',
                        cornerRadius: 6,
                        borderWidth: 1,
                        borderColor: '#e5e7eb'
                    },
                    progressAdjustable: true
                },
                // --- 修复后的时间轴配置 (显示月/日) ---
                timelineHeader: {
                    verticalLine: {
                        lineWidth: 1,
                        lineColor: '#d1d5db'
                    },
                    horizontalLine: {
                        lineWidth: 1,
                        lineColor: '#d1d5db'
                    },
                    backgroundColor: '#f9fafb',
                    colWidth: 40,
                    scales: [
                        {
                            unit: 'month',
                            step: 1,
                            format(date) {
                                const d = date.startDate;
                                return `${d.getFullYear()}年${d.getMonth() + 1}月`;
                            },
                            style: {
                                fontSize: 14,
                                fontWeight: 'bold',
                                color: '#111827',
                                textAlign: 'left', // 靠左显示
                                textStick: true,   // 滚动吸顶，关键！
                                padding: [0, 10],
                                backgroundColor: '#f9fafb',
                                borderBottom: '1px solid #d1d5db' 
                            }
                        },
                        {
                            unit: 'day',
                            step: 1,
                            format(date) {
                                return date.dateIndex.toString();
                            },
                            style: {
                                fontSize: 12,
                                color: '#374151',
                                textAlign: 'center',
                                backgroundColor: '#f9fafb'
                            }
                        }
                    ]
                },
                minDate: formatDate(today),
                maxDate: formatDate(initMaxDate),
                rowSeriesNumber: { title: '#', width: 40, headerStyle: { bgColor: '#f9fafb', borderColor: '#d1d5db' }, style: { borderColor: '#d1d5db' } },
                scrollStyle: { visible: 'scrolling', width: 8, scrollRailColor: '#f3f4f6', scrollSliderColor: '#d1d5db' },
                overscrollBehavior: 'none'
            };

            const ganttInstance = new VTableGantt.Gantt(containerRef.current, option);
            instanceRef.current = ganttInstance;

            // --- 关键修复：直接监听内部表格 (taskListTableInstance) ---
            // 确保复选框状态能正确同步
            if (ganttInstance.taskListTableInstance) {
                ganttInstance.taskListTableInstance.on('checkbox_state_change', (args) => {
                    const { col, row, checked } = args;
                    // 从内部表格获取记录
                    const record = ganttInstance.taskListTableInstance.getRecordByCell(col, row);
                    
                    if (record) {
                        console.log(`[CHECKBOX EVENT] Task: ${record.title} (ID:${record.id}) -> ${checked}`);
                        
                        setRecords(prev => {
                            const updateRecursive = (nodes) => {
                                return nodes.map(node => {
                                    if (String(node.id) === String(record.id)) {
                                        return { 
                                            ...node, 
                                            is_completed: checked,
                                            progress: checked ? 100 : node.progress 
                                        };
                                    }
                                    if (node.children) return { ...node, children: updateRecursive(node.children) };
                                    return node;
                                });
                            };
                            return updateRecursive(prev);
                        });
                    }
                });
            }

            // Cell Edit
            const handleCellEdit = (args) => {
                const { col, row, field, value } = args;
                const record = instanceRef.current.getRecordByCell(col, row);
                if (!record || !record.id || !field) return;

                let formattedValue = value;
                if ((field === 'start' || field === 'end') && value) {
                    formattedValue = formatDate(new Date(value));
                }
                const changedData = { [field]: formattedValue };

                setRecords(currentRecords => {
                    const updateNode = (nodes) => {
                        return nodes.map(node => {
                            if (node.id === record.id) return { ...node, ...changedData };
                            if (node.children) return { ...node, children: updateNode(node.children) };
                            return node;
                        });
                    };
                    return updateNode(currentRecords);
                });
            };

            // Task Drag
            const handleTaskChange = (args) => {
                if (isUpdatingExternally.current) {
                    requestAnimationFrame(() => isUpdatingExternally.current = false);
                    return;
                }
                setRecords(args.records);
            };
            
            // Marklines
            const handleMarkLineCreate = ({ data, position }) => {
                createPopup({ date: data.startDate, content: '' }, position, async value => {
                  const newMarkLine = {
                    date: formatDate(data.startDate),
                    content: value || '新建里程碑',
                    store_id: storeId,
                    contentStyle: { color: '#fff' },
                    style: { lineWidth: 1, lineColor: 'red' }
                  };
                  const result = await apiCall('markline', 'POST', newMarkLine);
                  if (result.success) setMarkLines(prev => [...prev, newMarkLine]);
                });
            };
            const handleMarkLineClick = ({ data, position }) => {
                createPopup({ date: data.date, content: data.content }, position, async value => {
                  const updatedMarkLine = { ...data, content: value || data.content, store_id: storeId };
                  const result = await apiCall('markline', 'POST', updatedMarkLine);
                  if(result.success) {
                    setMarkLines(prev => prev.map(line => line.date === data.date ? { ...line, content: value } : line));
                  }
                });
            };

            // Context Menu
            const handleContextMenu = (args) => {
                args.event.preventDefault();
                const record = instanceRef.current.getRecordByCell(args.col, args.row);
                if (record) {
                    setContextMenu({ visible: true, x: args.event.clientX, y: args.event.clientY, record: record });
                }
            };

            // 监听外层事件
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

    // --- 同步 State 到 Gantt (自动计算最早/最晚日期) ---
    useEffect(() => {
        if (!instanceRef.current) return;

        // 1. 如果有数据，计算所有任务中最早的开始时间和最晚的结束时间
        if (records && records.length > 0) {
            let minTs = Infinity;
            let maxTs = -Infinity;

            const traverse = (nodes) => {
                nodes.forEach(node => {
                    // 检查开始时间
                    if (node.start) {
                        const s = new Date(node.start).getTime();
                        if (!isNaN(s) && s < minTs) minTs = s;
                    }
                    // 检查结束时间
                    if (node.end) {
                        const e = new Date(node.end).getTime();
                        if (!isNaN(e) && e > maxTs) maxTs = e;
                    }
                    // 递归检查子任务
                    if (node.children && node.children.length > 0) {
                        traverse(node.children);
                    }
                });
            };

            traverse(records);

            // 2. 如果找到了有效的日期范围，更新时间轴配置
            if (minTs !== Infinity && maxTs !== -Infinity) {
                // 前后各增加 3 天的缓冲，避免任务条紧贴着边缘
                const bufferTime = 3 * 24 * 60 * 60 * 1000; 
                
                const newMinDate = new Date(minTs - bufferTime);
                const newMaxDate = new Date(maxTs + bufferTime);

                instanceRef.current.updateOption({
                    minDate: formatDate(newMinDate),
                    maxDate: formatDate(newMaxDate)
                });
            }
        }

        // 3. 设置数据
        instanceRef.current.setRecords(records);
        
    }, [records]);

    useEffect(() => {
        if (instanceRef.current && markLines) instanceRef.current.updateMarkLine(markLines);
    }, [markLines]);

    // --- 按钮操作 ---
    const handleRefresh = () => fetchData();

    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            console.log("Saving records to cloud:", records); // 调试日志
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
        const newTask = {
            title: parentId ? "新子任务" : "新任务",
            start: formatDate(new Date()),
            end: formatDate(new Date(new Date().setDate(new Date().getDate() + 1))),
            progress: 0,
            parent_id: parentId,
            is_completed: 0
        };
        setIsLoading(true);
        try {
            const result = await apiCall('task/add', 'POST', { task: newTask, storeId });
            if (result.success) {
                message.success('任务添加成功');
                await fetchData(); 
            } else {
                message.error('添加失败');
            }
        } catch (e) {
            message.error('添加失败: ' + e.message);
        } finally {
            setIsLoading(false);
            setContextMenu({ visible: false, x: 0, y: 0, record: null });
        }
    };

    return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {contextMenu.visible && (
                <div 
                    style={{
                        position: 'absolute', top: contextMenu.y, left: contextMenu.x,
                        background: 'white', border: '1px solid #ccc', borderRadius: '4px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)', zIndex: 1001, padding: '5px 0'
                    }}
                >
                    <div style={{ padding: '8px 15px', cursor: 'pointer' }} onClick={() => handleAddTask(contextMenu.record.id)}>
                        新增子任务
                    </div>
                </div>
            )}
            
            <div style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Space>
                   <span style={{fontWeight:'bold'}}>项目排期表</span>
                </Space>
                <Space>
                    <Link to={`/crowd-portrait/${storeId}`}><Button>人群画像分析</Button></Link>
                    <Button onClick={handleRefresh} disabled={isLoading}>{isLoading ? '正在刷新...' : '刷新同步数据'}</Button>
                    <Button onClick={() => handleAddTask(null)} disabled={isLoading}>新增任务</Button>
                    <Button type="primary" onClick={handleSaveChanges} disabled={isLoading} loading={isLoading}>
                        {isLoading ? '正在保存...' : '保存更改到云端'}
                    </Button>
                </Space>
            </div>
            
            <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
        </div>
    );
};

export default GanttChart;
