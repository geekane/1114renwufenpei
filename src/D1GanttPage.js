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

// 1. 根据进度返回基础颜色配置
function getProgressColorConfig(progress) {
  // 智能解析：处理 "18%"、"0.18"、18 等不同格式
  let p = parseFloat(progress);
  if (isNaN(p)) p = 0;

  // 假设：如果数据是 0-1 之间的小数(如 0.5)，且业务逻辑认为这是 50%，则乘以100
  // 如果你的业务允许 0.5% 这种极小进度，请移除此判断
  if (p > 0 && p <= 1) {
      p = p * 100;
  }

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

// 2. 综合获取颜色：结合“是否勾选完成”的状态
function getTaskColor(record) {
    // 数据库可能存的是 1/0，前端可能是 true/false，这里做宽容判断
    const isDone = record.is_completed === true || record.is_completed === 1;
    
    if (isDone || parseFloat(record.progress) >= 100) {
       return { main: '#059669', bg: '#A7F3D0' }; // 墨绿色 (已完成)
    }
    return getProgressColorConfig(record.progress);
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

const getChineseWeekday = (date) => {
    const day = new Date(date).getDay();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `周${weekdays[day]}`;
};

const getScalesConfig = (scaleType) => {
    switch (scaleType) {
        case 'week':
            return [
                { unit: 'month', step: 1, format: (c) => `${c.startDate.getFullYear()}年 ${c.startDate.getMonth() + 1}月`, style: { textStick: true, fontSize: 14, fontWeight: 'bold', color: '#333' } },
                { unit: 'week', step: 1, format: (c) => `第${c.dateIndex}周`, style: { fontSize: 12, color: '#666' } }
            ];
        case 'month':
            return [
                { unit: 'year', step: 1, format: (c) => `${c.startDate.getFullYear()}年`, style: { textStick: true, fontSize: 16, fontWeight: 'bold', color: '#333' } },
                { unit: 'month', step: 1, format: (c) => `${c.startDate.getMonth() + 1}月`, style: { fontSize: 14, color: '#555' } }
            ];
        case 'day':
        default:
            return [
                { unit: 'month', step: 1, format: (c) => `${c.startDate.getFullYear()}年 ${c.startDate.getMonth() + 1}月`, style: { textStick: true, fontSize: 14, fontWeight: 'bold', color: '#333', textAlign: 'center' } },
                { unit: 'day', step: 1, format: (date) => `${date.dateIndex}\n${getChineseWeekday(date.startDate)}`, style: { textAlign: 'center', lineHeight: 20, fontSize: 12 } }
            ];
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
    const [timeScale, setTimeScale] = useState('day');
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
                // 【核心修复】将后端返回的 0/1 转换为 false/true
                const processRecords = (nodes) => {
                    return nodes.map(node => {
                        const boolCompleted = node.is_completed === 1 || node.is_completed === true;
                        // 递归处理子节点
                        const children = node.children ? processRecords(node.children) : undefined;
                        
                        return {
                            ...node,
                            is_completed: boolCompleted, // 强制转为 Boolean
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

            const columns = [
                // 【新增】完成状态勾选列 (Checkbox)
                {
                    field: 'is_completed',
                    title: '✓',
                    width: 40,
                    cellType: 'checkbox',
                    style: { textAlign: 'center' }
                },
                { field: 'title', title: '任务', width: 200, editor: 'input-editor', tree: true },
                { field: 'start', title: '开始时间', width: 100, editor: 'date-editor' },
                { field: 'end', title: '结束时间', width: 100, editor: 'date-editor' }
            ];

            const simplePlusIcon = '<svg viewBox="0 0 24 24" ...><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill=""/></svg>';
            const today = new Date();
            const maxDate = new Date();
            maxDate.setMonth(today.getMonth() + 2);

            const option = {
                records: [], // 初始为空，由 useEffect 同步
                markLine: [],
                taskListTable: {
                    columns,
                    tableWidth: 'auto',
                    minTableWidth: 350,
                    theme: { 
                        headerStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 18, fontWeight: 'bold', 'color': 'red' }, 
                        bodyStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 16, color: '#4D4D4D', bgColor: '#FFF' } 
                    },
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
                    labelTextStyle: { fontFamily: 'Arial, sans-serif', fontSize: 14, textAlign: 'left', color: '#24292f' },
                    barStyle: {
                      width: 50, // 【修改】高度加大
                      cornerRadius: 6,
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                
                      // 【修改】动态底色
                      barColor: (args) => {
                        const record = args.taskRecord || args; 
                        return getTaskColor(record).bg;
                      },
                      
                      // 【修改】动态完成色
                      completedBarColor: (args) => {
                        const record = args.taskRecord || args;
                        return getTaskColor(record).main;
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
                markLineCreateOptions: { markLineCreatable: true, markLineCreationHoverToolTip: { position: 'top', tipContent: '创建里程碑', style: { contentStyle: { fill: '#fff' }, panelStyle: { background: '#14161c', cornerRadius: 4 } } }, markLineCreationStyle: { fill: '#ccc', size: 30, iconSize: 12, svg: simplePlusIcon } }
            };

            const ganttInstance = new VTableGantt.Gantt(containerRef.current, option);
            instanceRef.current = ganttInstance;

            // --- 事件监听 ---

            // 1. 监听 Checkbox 勾选
            ganttInstance.on('checkbox_state_change', (args) => {
                const { col, row, checked } = args;
                const record = instanceRef.current.getRecordByCell(col, row);
                
                if (record) {
                    console.log(`Checkbox changed for task ${record.id}: ${checked}`);
                    // 递归更新 State
                    setRecords(prev => {
                        const updateRecursive = (nodes) => {
                            return nodes.map(node => {
                                if (node.id === record.id) {
                                    return { 
                                        ...node, 
                                        is_completed: checked, // 保持 Boolean
                                        progress: checked ? 100 : node.progress // 勾选自动100%
                                    };
                                }
                                if (node.children) {
                                    return { ...node, children: updateRecursive(node.children) };
                                }
                                return node;
                            });
                        };
                        return updateRecursive(prev);
                    });
                }
            });

            // 2. 监听单元格编辑
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

            // 3. 监听任务条拖拽/调整
            const handleTaskChange = (args) => {
                if (isUpdatingExternally.current) {
                    requestAnimationFrame(() => isUpdatingExternally.current = false);
                    return;
                }
                // VTable 返回的是更新后的 flat 或 tree 结构，这里直接更新状态
                setRecords(args.records);
            };
            
            // 4. 里程碑交互
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

            // 5. 右键菜单
            const handleContextMenu = (args) => {
                args.event.preventDefault();
                const record = instanceRef.current.getRecordByCell(args.col, args.row);
                if (record) {
                    setContextMenu({ visible: true, x: args.event.clientX, y: args.event.clientY, record: record });
                }
            };

            ganttInstance.on('click_markline_create', handleMarkLineCreate);
            ganttInstance.on('click_markline_content', handleMarkLineClick);
            ganttInstance.on('change_task', handleTaskChange);
            ganttInstance.on('after_edit_cell', handleCellEdit); 
            ganttInstance.on('contextmenu_cell', handleContextMenu);
        }

        return () => {
            if (instanceRef.current) {
                console.log("Releasing Gantt Instance.");
                instanceRef.current.release();
                instanceRef.current = null;
            }
        };
    }, []); // Only run once on mount

    // --- 同步 State 到 Gantt ---

    useEffect(() => {
        if (instanceRef.current) {
            instanceRef.current.setRecords(records);
        }
    }, [records]);

    useEffect(() => {
        if (instanceRef.current && markLines) {
            instanceRef.current.updateMarkLine(markLines);
        }
    }, [markLines]);

    useEffect(() => {
        if (instanceRef.current) {
            instanceRef.current.updateScales(getScalesConfig(timeScale));
        }
    }, [timeScale]);


    // --- 按钮操作 ---

    const handleRefresh = () => fetchData();

    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            console.log("Saving records:", records);
            const result = await apiCall('tasks', 'POST', { records, storeId });
            if (result.success) {
                message.success('更改已成功保存');
            } else {
                message.error('保存失败: ' + (result.error?.message || '未知错误'));
            }
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
            if (contextMenu.visible) setContextMenu({ visible: false, x: 0, y: 0, record: null });
        }
    };

    return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* 右键菜单 DOM */}
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
            
            {/* 顶部工具栏 */}
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
                    <Button type="primary" onClick={handleSaveChanges} disabled={isLoading} loading={isLoading}>
                        {isLoading ? '正在保存...' : '保存更改到云端'}
                    </Button>
                </Space>
            </div>
            
            {/* 甘特图容器 */}
            <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
        </div>
    );
};

export default GanttChart;
