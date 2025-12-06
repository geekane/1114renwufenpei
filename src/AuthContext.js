import React, { useEffect, useRef, useState, useMemo, useContext } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button, Space, message, DatePicker } from 'antd';
import dayjs from 'dayjs';
import * as VTable from '@visactor/vtable';
import * as VTableGantt from '@visactor/vtable-gantt';
import { DateInputEditor, InputEditor } from '@visactor/vtable-editors';
import { AuthContext } from './AuthContext';

const { RangePicker } = DatePicker;

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
    const isFirstRun = useRef(true);
    
    const { userRole } = useContext(AuthContext);
    const isReadOnly = userRole === 'readonly';
    
    console.log(`[DEBUG PERMISSION] Current Role: ${userRole}, IsReadOnly: ${isReadOnly}`);

    // State
    const [records, setRecords] = useState([]);
    const [markLines, setMarkLines] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, record: null });
    
    const [viewRange, setViewRange] = useState([
        dayjs(),
        dayjs().add(2, 'month')
    ]);

    // --- 1. 核心配置提取 (完整版) ---
    // 包含所有静态配置，确保 updateOption 时不会丢失任何样式
    // [DEBUG] 暂时移除 useMemo 以确保配置实时更新，并添加日志
    const baseOptions = {
        taskListTable: {
            columns: [
                {
                    field: 'is_completed',
                    title: '✓',
                    width: 40,
                    cellType: 'checkbox',
                    style: { textAlign: 'center' },
                    // 只读模式下禁用 checkbox (通过 cellType 控制或者 style，VTable 目前 checkbox 总是可点的，
                    // 但我们可以在事件回调中阻止更新)
                    editable: !isReadOnly
                },
                {
                    field: 'title',
                    title: '任务名称',
                    width: 180,
                    sort: true,
                    tree: true,
                    editor: isReadOnly ? undefined : 'input-editor', // 只读禁用编辑
                    style: {
                        color: (args) => {
                            const record = args.data;
                            let color = '#24292f';
                            if (record && !record.is_completed && record.end) {
                                const isOverdue = dayjs(record.end).isBefore(dayjs(), 'day');
                                if (isOverdue) {
                                    color = 'red';
                                }
                            }
                            return color;
                        },
                        fontWeight: (args) => {
                            const record = args.data;
                            if (record && !record.is_completed && record.end) {
                                if (dayjs(record.end).isBefore(dayjs(), 'day')) {
                                    return 'bold';
                                }
                            }
                            return 'normal';
                        }
                    }
                },
                { field: 'start', title: '开始日期', width: 110, sort: true, editor: isReadOnly ? undefined : 'date-editor' },
                { field: 'end', title: '结束日期', width: 110, sort: true, editor: isReadOnly ? undefined : 'date-editor' },
                {
                    field: 'progress',
                    title: '进度',
                    width: 0,
                    sort: true,
                    headerStyle: { borderColor: '#e1e4e8' },
                    style: { borderColor: '#e1e4e8', color: 'green' }
                }
            ],
            tableWidth: 'auto',
            minTableWidth: 350,
            maxTableWidth: 800
        },
        tasksShowMode: 'tasks_separate',
        // 之前报错缺少的 frame 配置
        frame: {
            verticalSplitLineMoveable: true,
            outerFrameStyle: { borderLineWidth: 1, borderColor: '#e5e7eb', cornerRadius: 8 },
            verticalSplitLine: { lineWidth: 2, lineColor: '#d1d5db' },
            verticalSplitLineHighlight: { lineColor: '#3b82f6', lineWidth: 2 }
        },
        // 之前报错缺少的 grid 配置
        grid: { 
            verticalLine: { lineWidth: 1, lineColor: '#f3f4f6' }, 
            horizontalLine: { lineWidth: 1, lineColor: '#f3f4f6' } 
        },
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
                barColor: '#3b82f6', // 这里的设置可能被忽略，因为我们会使用 customLayout
                completedBarColor: '#10b981',
                cornerRadius: 6,
                borderWidth: 1,
                borderColor: '#e5e7eb'
            },
            customLayout: (args) => {
                // 解构参数
                const { width, height, taskRecord, ganttInstance } = args;
                
                // ---------------------------------------------------------
                // 1. 计算颜色逻辑
                // ---------------------------------------------------------
                let barColor = '#3b82f6'; // 默认蓝色
                const isCompleted = taskRecord.is_completed === true || taskRecord.is_completed === 1;
                
                if (taskRecord && !isCompleted && taskRecord.end) {
                     const today = dayjs();
                     const endDate = dayjs(taskRecord.end);
                     // 逻辑：结束日期 < 今天 (不含今天)
                     if (endDate.isBefore(today, 'day')) {
                         barColor = 'red'; // 逾期变红
                     }
                }
                
                // ---------------------------------------------------------
                // 2. 创建图形容器 (使用 VRender)
                // ---------------------------------------------------------
                // 尝试从 VTableGantt 获取 VRender，如果不存在则尝试全局变量或其他方式
                // 注意：根据文档 VTableGantt.VRender 通常是可用的
                const VRender = VTableGantt.VRender;
                if (!VRender) {
                    console.error('[CustomLayout] VRender not found in VTableGantt export!');
                    return {};
                }

                const container = new VRender.Group({
                    width,
                    height,
                    x: 0,
                    y: 0
                });

                // ---------------------------------------------------------
                // 3. 绘制背景条 (代表任务总长度，颜色根据状态变化)
                // ---------------------------------------------------------
                const bgRect = new VRender.Rect({
                    width: width,
                    height: height,
                    fill: barColor,
                    cornerRadius: 6,
                    stroke: '#e5e7eb',
                    lineWidth: 1
                });
                container.add(bgRect);

                // ---------------------------------------------------------
                // 4. 绘制进度条 (已完成部分，覆盖在背景之上)
                // ---------------------------------------------------------
                const progressVal = parseFloat(taskRecord.progress) || 0;
                if (progressVal > 0) {
                    const progressWidth = Math.min(width, width * (progressVal / 100));
                    const progressRect = new VRender.Rect({
                        width: progressWidth,
                        height: height,
                        fill: '#10b981', // 绿色
                        cornerRadius: 6 // 保持圆角一致
                    });
                    container.add(progressRect);
                }

                // ---------------------------------------------------------
                // 5. 绘制文字 (显示任务名称和进度)
                // ---------------------------------------------------------
                const textContent = `${taskRecord.title} (${progressVal}%)`;
                const text = new VRender.Text({
                    text: textContent,
                    fontSize: 12,
                    fontFamily: 'Arial, sans-serif',
                    fill: '#24292f', // 文字颜色
                    x: width + 5, // 文字显示在条形右侧，避免遮挡？或者内部？
                                  // 原版配置是: labelText: '{title} ({progress}%)', labelTextStyle: { ... textAlign: 'left' }
                                  // 通常 VTable Gantt 的 label 是独立渲染的。
                                  // 如果我们用了 customLayout，还需要自己画文字吗？
                                  // 根据文档，customLayout 返回 rootContainer 后，系统可能还会尝试画 label？
                                  // 为了稳妥，我们把文字画在条形内部或旁边。
                                  // 这里模仿原版效果，放在条形右侧可能更好看，或者内部。
                                  // 考虑到条形可能很短，放在右侧比较安全。
                    y: height / 2,
                    textBaseline: 'middle'
                });
                
                // 这里有一个权衡：如果文字放在右侧，需要确保 container 足够大？
                // customLayout 的 args.width 是条形的宽度。
                // 如果我们在 container 里画了超出 width 的东西，可能会被裁剪。
                // 实际上，VTable Gantt 的 label 默认是在条形右侧或内部。
                // 如果我们只负责画条形（bar），文字由 labelText 配置控制。
                // 让我们先不画文字，看看 labelText 是否依然生效。
                // 如果 labelText 不生效，我们再把文字加回来。
                
                // 修正：为了保险，我先不画文字，依赖 external label 配置。
                // 如果发现文字没了，我们再加。
                
                return {
                    rootContainer: container,
                    renderDefaultText: true // 关键属性：尝试告诉引擎继续渲染默认文本
                };
            },
            progressAdjustable: true
        },
        timelineHeader: {
            verticalLine: { lineWidth: 1, lineColor: '#d1d5db' },
            horizontalLine: { lineWidth: 1, lineColor: '#d1d5db' },
            backgroundColor: '#f9fafb',
            colWidth: 40,
            scales: [
                {
                    unit: 'month',
                    step: 1,
                    format(date) {
                        if (!date || !date.startDate) return '';
                        const d = date.startDate;
                        return `${d.getFullYear()}年${d.getMonth() + 1}月`;
                    },
                    style: {
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: '#111827',
                        textAlign: 'left',
                        textStick: true, 
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
        rowSeriesNumber: { title: '#', width: 40, headerStyle: { bgColor: '#f9fafb', borderColor: '#d1d5db' }, style: { borderColor: '#d1d5db' } },
        scrollStyle: { visible: 'scrolling', width: 8, scrollRailColor: '#f3f4f6', scrollSliderColor: '#d1d5db' },
        overscrollBehavior: 'none'
    };

    // 2. Fetch Data
    const fetchData = async () => {
        if (!storeId) return;
        setIsLoading(true);
        console.log(`[DEBUG] Fetching data for store: ${storeId}`);
        try {
            const response = await fetch(`/api/data/${storeId}`);
            if (!response.ok) throw new Error(response.statusText);
            const data = await response.json();

            if (Array.isArray(data.records)) {
                console.log(`[DEBUG] API Data received. Records count: ${data.records.length}`);
                const processRecords = (nodes) => {
                    const mappedNodes = nodes.map(node => {
                        const boolCompleted = node.is_completed === 1 || node.is_completed === true;
                        const children = node.children ? processRecords(node.children) : undefined;
                        return {
                            ...node,
                            is_completed: boolCompleted, 
                            children: children
                        };
                    });
                    return mappedNodes.sort((a, b) => {
                        const titleA = a.title ? String(a.title) : '';
                        const titleB = b.title ? String(b.title) : '';
                        return titleA.localeCompare(titleB, 'zh-CN', { numeric: true });
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
            console.error('[DEBUG ERROR] Data Load Error:', error);
            message.error("数据加载失败");
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

    // 3. Initialize Gantt Instance
    useEffect(() => {
        if (containerRef.current && !instanceRef.current) {
            console.log("[DEBUG] Initializing Gantt Instance...");
            
            const inputEditor = new InputEditor();
            VTable.register.editor('input-editor', inputEditor);
            const dateEditor = new DateInputEditor();
            VTable.register.editor('date-editor', dateEditor);

            // 初始化时：合并 BaseOptions + 动态数据
            const option = {
                ...baseOptions, // 展开所有基础配置
                records: [], 
                markLine: [],
                minDate: viewRange[0].format('YYYY-MM-DD'),
                maxDate: viewRange[1].format('YYYY-MM-DD'),
            };

            const ganttInstance = new VTableGantt.Gantt(containerRef.current, option);
            instanceRef.current = ganttInstance;
            
            window.ganttInstance = ganttInstance;

            // --- Listener ---
            if (ganttInstance.taskListTableInstance) {
                ganttInstance.taskListTableInstance.on('checkbox_state_change', (args) => {
                    if (isReadOnly) return; // 只读模式下忽略 Checkbox 更改
                    const { col, row, checked } = args;
                    const record = ganttInstance.taskListTableInstance.getRecordByCell(col, row);
                    if (record) {
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

            const handleCellEdit = (args) => {
                if (isReadOnly) return; // 只读模式下忽略编辑
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

            const handleTaskChange = (args) => {
                if (isReadOnly) return; // 只读模式下忽略任务拖拽
                if (isUpdatingExternally.current) {
                    requestAnimationFrame(() => isUpdatingExternally.current = false);
                    return;
                }
                setRecords(args.records);
            };
            
            const handleMarkLineCreate = ({ data, position }) => {
                if (isReadOnly) return;
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
                if (isReadOnly) return;
                createPopup({ date: data.date, content: data.content }, position, async value => {
                  const updatedMarkLine = { ...data, content: value || data.content, store_id: storeId };
                  const result = await apiCall('markline', 'POST', updatedMarkLine);
                  if(result.success) {
                    setMarkLines(prev => prev.map(line => line.date === data.date ? { ...line, content: value } : line));
                  }
                });
            };

            const handleContextMenu = (args) => {
                if (isReadOnly) return;
                args.event.preventDefault();
                const record = instanceRef.current.getRecordByCell(args.col, args.row);
                if (record) {
                    setContextMenu({ visible: true, x: args.event.clientX, y: args.event.clientY, record: record });
                }
            };

            if (!isReadOnly) {
                ganttInstance.on('click_markline_create', handleMarkLineCreate);
                ganttInstance.on('click_markline_content', handleMarkLineClick);
                ganttInstance.on('change_task', handleTaskChange);
                ganttInstance.on('after_edit_cell', handleCellEdit);
                ganttInstance.on('contextmenu_cell', handleContextMenu);
            }
        }

        return () => {
            if (instanceRef.current) {
                instanceRef.current.release();
                instanceRef.current = null;
            }
        };
    }, []); 

    // 4. Update View Range (全量更新)
    useEffect(() => {
        if (isFirstRun.current) {
            isFirstRun.current = false;
            return;
        }

        if (!instanceRef.current || !viewRange || viewRange.length < 2) return;

        const minStr = viewRange[0].format('YYYY-MM-DD');
        const maxStr = viewRange[1].format('YYYY-MM-DD');
        
        console.log(`[DEBUG] ViewRange Triggered: ${minStr} to ${maxStr}`);
        
        try {
            // --- 关键修复：传入 baseOptions 中的所有属性 ---
            const updateParams = {
                ...baseOptions, // 包含 frame, grid, taskBar, timelineHeader, taskListTable 等所有配置
                minDate: minStr,
                maxDate: maxStr,
                records: records, // 当前数据
            };
            
            instanceRef.current.updateOption(updateParams);
            console.log('[DEBUG] updateOption executed successfully with FULL CONFIG.');
        } catch (err) {
            console.error('[DEBUG CRITICAL] Error during updateOption:', err);
        }
    }, [viewRange]); // 仅当日期变化时触发

    // 5. Update Data (数据变更)
    useEffect(() => {
        if (!instanceRef.current) return;
        instanceRef.current.setRecords(records);
    }, [records]);

    useEffect(() => {
        if (instanceRef.current && markLines) instanceRef.current.updateMarkLine(markLines);
    }, [markLines]);

    const handleDateRangeChange = (dates) => {
        if (dates && dates.length === 2) {
            setViewRange(dates);
        }
    };

    const handleRefresh = () => fetchData();

    const handleSaveChanges = async () => {
        if (isReadOnly) {
            message.warning('只读账号无法保存更改');
            return;
        }
        setIsLoading(true);
        try {
            console.log("Saving records to cloud:", records);
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
        if (isReadOnly) return;
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

    const handleClearInvalidTasks = async () => {
        if (isReadOnly) return;
        if (!window.confirm('确定要清理所有“新任务”且时长不超过1天的无效任务吗？此操作不可撤销。')) {
            return;
        }

        setIsLoading(true);
        let deletedCount = 0;

        const filterRecursive = (nodes) => {
            return nodes.filter(node => {
                // 检查是否符合删除条件
                const isNewTask = node.title && node.title.includes('新任务');
                let isShortDuration = false;
                if (node.start && node.end) {
                    const diff = dayjs(node.end).diff(dayjs(node.start), 'day');
                    if (diff <= 1) isShortDuration = true;
                }

                const shouldDelete = isNewTask && isShortDuration;

                if (shouldDelete) {
                    deletedCount++;
                    return false; // 过滤掉（删除）
                }

                // 如果不删除，继续检查子节点
                if (node.children) {
                    node.children = filterRecursive(node.children);
                }
                return true; // 保留
            });
        };

        const newRecords = filterRecursive(JSON.parse(JSON.stringify(records))); // 深拷贝以防副作用

        if (deletedCount === 0) {
            message.info('没有发现符合清理条件的无效任务');
            setIsLoading(false);
            return;
        }

        try {
            // 更新本地状态
            setRecords(newRecords);
            
            // 同步保存到云端
            const result = await apiCall('tasks', 'POST', { records: newRecords, storeId });
            if (result.success) {
                message.success(`成功清理了 ${deletedCount} 个无效任务`);
            } else {
                message.error('清理后保存失败: ' + (result.error?.message || '未知错误'));
                // 如果保存失败，最好重新拉取数据以恢复一致性
                fetchData();
            }
        } catch (error) {
            message.error('清理失败: ' + error.message);
            fetchData();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ height: '90vh', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
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
            
            <div style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '50px', flexShrink: 0 }}>
                <Space>
                   <span style={{fontWeight:'bold'}}>项目排期表</span>
                   <span style={{ marginLeft: 20 }}>视图范围：</span>
                   <RangePicker 
                       value={viewRange}
                       allowClear={false}
                       onChange={handleDateRangeChange}
                       style={{ width: 260 }}
                   />
                </Space>
                <Space>
                    <Link to={`/crowd-portrait/${storeId}`}><Button>人群画像分析</Button></Link>
                    <Button onClick={handleRefresh} disabled={isLoading}>{isLoading ? '正在刷新...' : '刷新同步数据'}</Button>
                    {/* 强制使用 style display none 作为双重保险，防止条件渲染延迟 */}
                    <Button
                        onClick={handleClearInvalidTasks}
                        disabled={isLoading || isReadOnly}
                        danger
                        style={{ display: isReadOnly ? 'none' : 'inline-block' }}
                    >
                        一键清理无效任务
                    </Button>
                    <Button
                        onClick={() => handleAddTask(null)}
                        disabled={isLoading || isReadOnly}
                        style={{ display: isReadOnly ? 'none' : 'inline-block' }}
                    >
                        新增任务
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleSaveChanges}
                        disabled={isLoading || isReadOnly}
                        loading={isLoading}
                    >
                        {isLoading ? '正在保存...' : (isReadOnly ? '只读模式' : '保存更改到云端')}
                    </Button>
                </Space>
            </div>
            
            <div ref={containerRef} style={{ flex: 1, width: '100%', minHeight: '400px' }} />
        </div>
    );
};

export default GanttChart;
