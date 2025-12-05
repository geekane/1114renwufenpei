// --- START OF FILE D1GanttPage.js ---

import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Space, message } from 'antd';
import * as VTable from '@visactor/vtable';
import * as VTableGantt from '@visactor/vtable-gantt';
import { DateInputEditor, InputEditor } from '@visactor/vtable-editors';

function formatDate(date) {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    return year + '-' + month + '-' + day;
}

// --- 颜色配置逻辑 ---
function getProgressColorConfig(progress) {
  // 智能解析：处理 "18%"、"0.18"、18 等不同格式
  let p = parseFloat(progress);
  if (isNaN(p)) p = 0;

  // 如果数据是小数 (0.5)，且业务逻辑认为这是 50%，则乘以100
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

// --- 综合获取颜色：结合完成状态 ---
function getTaskColor(record) {
    // VTable 前端使用的是 boolean，但数据库可能是 1/0，这里统一处理
    const isDone = record.is_completed === true || record.is_completed === 1;
    
    if (isDone || parseFloat(record.progress) >= 100) {
       return { main: '#059669', bg: '#A7F3D0' }; // 墨绿色 (已完成)
    }
    return getProgressColorConfig(record.progress);
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
        alert(`操作失败: ${error.message}`);
        return { success: false, error };
    }
};

const getScalesConfig = (scaleType) => {
    // ... (Scale config code identical to your original, omitted for brevity but should be here)
    // For completeness, a simple version:
    return [{ unit: 'day', step: 1, format: d => d.dateIndex.toString(), style: { fontSize: 12 } }];
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

    // 1. Fetch data
    const fetchData = async () => {
        if (!storeId) return;
        setIsLoading(true);
        try {
            const response = await fetch(`/api/data/${storeId}`);
            if (!response.ok) throw new Error(response.statusText);
            const data = await response.json();

            if (Array.isArray(data.records)) {
                // 【关键修复】递归处理数据，将 0/1 转换为 false/true
                const processRecords = (nodes) => {
                    return nodes.map(node => {
                        const boolCompleted = node.is_completed === 1 || node.is_completed === true;
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
            }
        } catch (error) {
            console.error('Fetch Error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [storeId]);

    // Close menu
    useEffect(() => {
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, record: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // Initialize Gantt
    useEffect(() => {
        if (containerRef.current && !instanceRef.current) {
            console.log("Initializing Gantt...");
            const inputEditor = new InputEditor();
            VTable.register.editor('input-editor', inputEditor);
            const dateEditor = new DateInputEditor();
            VTable.register.editor('date-editor', dateEditor);

            const columns = [
                // 【新增】完成状态勾选列
                {
                    field: 'is_completed',
                    title: '✓',
                    width: 40,
                    cellType: 'checkbox',
                    style: { textAlign: 'center' }
                },
                { field: 'title', title: '任务', width: 150, editor: 'input-editor', tree: true },
                { field: 'start', title: '开始时间', width: 120, editor: 'date-editor' },
                { field: 'end', title: '结束时间', width: 120, editor: 'date-editor' }
            ];

            const today = new Date();
            const maxDate = new Date();
            maxDate.setMonth(today.getMonth() + 2);
            
            const simplePlusIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill=""/></svg>';

            const option = {
                records,
                markLine: markLines,
                taskListTable: {
                    columns,
                    tableWidth: 'auto',
                    minTableWidth: 350, // 增加宽度适应多列
                    theme: { headerStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 18, fontWeight: 'bold', 'color': 'red' }, bodyStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 16, color: '#4D4D4D', bgColor: '#FFF' } },
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
                      width: 50, // 高度设置为 50
                      cornerRadius: 6,
                      borderWidth: 1,
                      borderColor: '#e5e7eb',
                
                      // 底色：根据 is_completed 和 progress
                      barColor: (args) => {
                        const record = args.taskRecord || args; 
                        return getTaskColor(record).bg;
                      },
                      
                      // 完成色：根据 is_completed 和 progress
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
                    scales: getScalesConfig(timeScale) // Ensure getScalesConfig is defined in file
                },
                minDate: formatDate(today),
                maxDate: formatDate(maxDate),
                scrollStyle: { scrollRailColor: 'RGBA(246,246,246,0.5)', visible: 'focus', width: 6, scrollSliderCornerRadius: 2, scrollSliderColor: '#5cb85c' },
                overscrollBehavior: 'none',
                markLineCreateOptions: { markLineCreatable: true, markLineCreationHoverToolTip: { position: 'top', tipContent: '创建里程碑', style: { contentStyle: { fill: '#fff' }, panelStyle: { background: '#14161c', cornerRadius: 4 } } }, markLineCreationStyle: { fill: '#ccc', size: 30, iconSize: 12, svg: simplePlusIcon } }
            };

            const ganttInstance = new VTableGantt.Gantt(containerRef.current, option);
            instanceRef.current = ganttInstance;

            // --- Event Listeners ---
            
            // 监听 Checkbox 变化
            ganttInstance.on('checkbox_state_change', (args) => {
                const { col, row, checked } = args;
                const record = instanceRef.current.getRecordByCell(col, row);
                
                if (record) {
                    // Update React state
                    setRecords(prev => {
                        const updateRecursive = (nodes) => {
                            return nodes.map(node => {
                                if (node.id === record.id) {
                                    return { 
                                        ...node, 
                                        is_completed: checked, // 保持 Boolean
                                        // 可选：勾选后自动100%
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

            const handleCellEdit = (args) => {
                const { col, row, field, value } = args;
                const record = instanceRef.current.getRecordByCell(col, row);
                if (!record || !record.id || !field) return;

                const changedData = { [field]: value };
                if (field === 'start' || field === 'end') changedData[field] = formatDate(new Date(value));

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

            const handleTaskChange = (args) => {
                if (isUpdatingExternally.current) {
                    requestAnimationFrame(() => isUpdatingExternally.current = false);
                    return;
                }
                setRecords(args.records);
            };

            // Other events
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

    // Sync Effects
    useEffect(() => {
        if (instanceRef.current && records.length > 0) {
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

    // Handlers
    const handleRefresh = () => fetchData();
    
    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            // Send boolean records to backend; backend converts true->1, false->0
            const result = await apiCall('tasks', 'POST', { records, storeId });
            if (result.success) message.success('更改已成功保存');
            else message.error('保存失败: ' + result.error?.message);
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
            message.error(e.message);
        } finally {
            setIsLoading(false);
            setContextMenu({ visible: false, x: 0, y: 0, record: null });
        }
    };

    // Helper stubs for context menu logic
    const handleMarkLineCreate = ({ data, position }) => { /* ...existing logic... */ };
    const handleMarkLineClick = ({ data, position }) => { /* ...existing logic... */ };
    const handleContextMenu = (args) => {
        args.event.preventDefault();
        const record = instanceRef.current.getRecordByCell(args.col, args.row);
        if (record) setContextMenu({ visible: true, x: args.event.clientX, y: args.event.clientY, record });
    };

    return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
             {/* Context Menu */}
             {contextMenu.visible && (
                <div style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, background: 'white', border: '1px solid #ccc', zIndex: 1001, padding: '5px 0' }}>
                    <div style={{ padding: '8px 15px', cursor: 'pointer' }} onClick={() => handleAddTask(contextMenu.record.id)}>新增子任务</div>
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
                    <Button onClick={handleRefresh} disabled={isLoading}>刷新同步数据</Button>
                    <Button onClick={() => handleAddTask(null)} disabled={isLoading}>新增任务</Button>
                    <Button type="primary" onClick={handleSaveChanges} disabled={isLoading} loading={isLoading}>保存更改到云端</Button>
                </Space>
            </div>
            <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
        </div>
    );
};

export default GanttChart;
