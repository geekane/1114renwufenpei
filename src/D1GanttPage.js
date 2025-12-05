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
            // Use a more specific error message if available
            throw new Error(errorData.details || errorData.error || `Network response was not ok: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`ERROR: API call to /api/${endpoint} failed.`, error);
        alert(`操作失败: ${error.message}`);
        return { success: false, error }; // Indicate failure
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
    const { storeId } = useParams(); // Get storeId from URL
    const containerRef = useRef(null);
    const instanceRef = useRef(null);
    const isUpdatingExternally = useRef(false);
    const [records, setRecords] = useState([]);
    const [markLines, setMarkLines] = useState([]);
    const [timeScale, setTimeScale] = useState('day');
    const [isLoading, setIsLoading] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, record: null });

    // 1. Fetch data for the specific store
    const fetchData = async () => {
        if (!storeId) return;
        console.log(`Attempting to fetch data from API for storeId: ${storeId}...`);
        setIsLoading(true);
        try {
            const response = await fetch(`/api/data/${storeId}`);
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            console.log("SUCCESS: Loaded data from API.", data);

            if (Array.isArray(data.records)) {
                setRecords(data.records);
            } else {
                console.error("ERROR: API response for records is not an array.", data);
                setRecords([]); // Reset to empty array on error
            }
            if (Array.isArray(data.markLines)) {
                setMarkLines(data.markLines);
            } else {
                setMarkLines([]);
            }
        } catch (error) {
            console.error('ERROR: Failed to fetch or parse data from API.', error);
            alert('数据加载失败，请检查网络或联系管理员！');
        } finally {
            setIsLoading(false);
        }
    };

    // 2. Re-fetch data when storeId changes
    useEffect(() => {
        fetchData();
    }, [storeId]);

    // Close context menu on any click
    useEffect(() => {
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, record: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    // This useEffect handles the INITIALIZATION of the Gantt chart instance.
    // It runs only ONCE when the component mounts.
    useEffect(() => {
        if (containerRef.current && !instanceRef.current) {
            console.log("EVENT: Component mounted. INITIALIZING Gantt Chart instance...");
            
            // 根据进度获取对应的渐变色组合
            const getProgressColors = (progress) => {
                const p = Number(progress || 0);
                
                // 1. 完成 (100%): 绿色系
                if (p >= 100) {
                    return { light: '#b3d9b3', dark: '#2ca02c' };
                }
                // 2. 推进良好 (60% - 99%): 蓝色系
                if (p >= 60) {
                    return { light: '#aecde6', dark: '#1f77b4' };
                }
                // 3. 有进展 (30% - 59%): 橙色系
                if (p >= 30) {
                    return { light: '#ffb582', dark: '#ff7f0e' };
                }
                // 4. 起步/滞后 (0% - 29%): 红色/粉色系
                return { light: '#e59a9c', dark: '#d62728' };
            };

            const inputEditor = new InputEditor();
            VTable.register.editor('input-editor', inputEditor);
            const dateEditor = new DateInputEditor();
            VTable.register.editor('date-editor', dateEditor);

            const columns = [
                { field: 'title', title: '任务', width: 150, editor: 'input-editor', tree: true },
                { field: 'start', title: '开始时间', width: 120, editor: 'date-editor' },
                { field: 'end', title: '结束时间', width: 120, editor: 'date-editor' }
            ];

            const simplePlusIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill=""/></svg>';
            
            const today = new Date();
            const maxDate = new Date();
            maxDate.setMonth(today.getMonth() + 2);

            const option = {
                records, // Uses the state initialized from localStorage
                markLine: markLines, // Uses the state initialized from localStorage
                taskListTable: {
                    columns,
                    tableWidth: 'auto',
                    minTableWidth: 300,
                    theme: { headerStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 18, fontWeight: 'bold', 'color': 'red' }, bodyStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 16, color: '#4D4D4D', bgColor: '#FFF' } },
                    hierarchyIndent: 25, // 设置缩进宽度
                    hierarchyExpandLevel: 2, // 默认只展开 2 层
                },
                frame: {
                  outerFrameStyle: { borderLineWidth: 0, borderColor: 'red', cornerRadius: 8 },
                  verticalSplitLine: {
                    lineColor: '#d5d9ee',
                    lineWidth: 2,
                    visible: true
                  },
                  verticalSplitLineHighlight: {
                    lineColor: '#1677ff', // A common highlight color
                    lineWidth: 3,
                    visible: true
                  }
                },
                grid: { backgroundColor: '#f0f0fb', horizontalLine: { lineWidth: 2, lineColor: '#d5d9ee' } },
                headerRowHeight: 80,
                rowHeight: 80,
                taskBar: {
                  startDateField: 'start', endDateField: 'end', progressField: 'progress', barStyle: { width: 60 },
                  draggable: true,
                  resizable: true,
                  customLayout: args => {
                    const { width, height, taskRecord } = args; // 不需要 index 了
        
                    // 1. 【核心修改】根据当前任务的 progress 获取颜色
                    const colors = getProgressColors(taskRecord.progress);
            
                    // 2. 使用获取到的 colors.light 和 colors.dark 构建渐变
                    const container = new VTableGantt.VRender.Group({
                        width,
                        height,
                        cornerRadius: 30,
                        fill: {
                            gradient: 'linear',
                            x0: 0, y0: 0, x1: 1, y1: 0,
                            stops: [
                                { offset: 0, color: colors.light },   // 浅色
                                { offset: 0.5, color: colors.dark },  // 深色
                                { offset: 1, color: colors.light }    // 浅色
                            ]
                        },
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'nowrap'
                    });
            
                    // ... 下面的代码保持不变 (头像、文字等) ...
                    const containerLeft = new VTableGantt.VRender.Group({ height, width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around' });
                    container.add(containerLeft);
                    
                    // 这里的 avatar 如果没有值，建议给一个默认图，防止报错
                    const avatarUrl = taskRecord.avatar || 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/question.jpeg';
                    const avatar = new VTableGantt.VRender.Image({ width: 50, height: 50, image: avatarUrl, cornerRadius: 25 });
                    containerLeft.add(avatar);
            
                    const containerCenter = new VTableGantt.VRender.Group({ height, width: width - (width >= 120 ? 120 : 60), display: 'flex', flexDirection: 'column' });
                    container.add(containerCenter);
                    
                    const titleText = new VTableGantt.VRender.Text({ text: taskRecord.title, fontSize: 16, fontFamily: 'sans-serif', fill: 'white', fontWeight: 'bold', maxLineWidth: width - (width >= 120 ? 120 : 60), boundsPadding: [10, 0, 0, 0] });
                    containerCenter.add(titleText);
                    
                    const days = new VTableGantt.VRender.Text({ text: `${args.taskDays}天`, fontSize: 13, fontFamily: 'sans-serif', fill: 'white', boundsPadding: [10, 0, 0, 0] });
                    containerCenter.add(days);
            
                    if (width >= 120) {
                        const containerRight = new VTableGantt.VRender.Group({ cornerRadius: 20, fill: 'white', height: 40, width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boundsPadding: [10, 0, 0, 0] });
                        container.add(containerRight);
                        const progressText = new VTableGantt.VRender.Text({ text: `${taskRecord.progress || 0}%`, fontSize: 12, fontFamily: 'sans-serif', fill: 'black', alignSelf: 'center', fontWeight: 'bold', maxLineWidth: (width - 60) / 2, boundsPadding: [0, 0, 0, 0] });
                        containerRight.add(progressText);
                    }
                    return { rootContainer: container };
                  },
                  hoverBarStyle: { cornerRadius: 30 }
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

            const handleCellEdit = (args) => {
                const { col, row, field, value } = args;
                const record = instanceRef.current.getRecordByCell(col, row);

                if (!record || !record.id || !field) {
                    console.warn('Cell edit ignored: could not determine record ID or field.', { args, record });
                    return;
                }

                const id = record.id;
                let formattedValue = value;
                if ((field === 'start' || field === 'end') && value) {
                    formattedValue = formatDate(new Date(value));
                }

                const changedData = { [field]: formattedValue };
                console.log(`EVENT: User edited cell. Task ID: ${id}. Staging changes.`, changedData);

                // Update React state directly, don't call API yet.
                setRecords(currentRecords => {
                    const updateNode = (nodes) => {
                        return nodes.map(node => {
                            if (node.id === id) {
                                return { ...node, ...changedData };
                            }
                            if (node.children) {
                                return { ...node, children: updateNode(node.children) };
                            }
                            return node;
                        });
                    };
                    return updateNode(currentRecords);
                });
            };
            
            const handleMarkLineCreate = ({ data, position }) => {
                createPopup({ date: data.startDate, content: '' }, position, async value => {
                  const newMarkLine = {
                    date: formatDate(data.startDate),
                    content: value || '新建里程碑',
                    store_id: storeId, // Associate with the current store
                    contentStyle: {
                        color: '#fff'
                    },
                    style: { lineWidth: 1, lineColor: 'red' }
                  };
                  
                  const result = await apiCall('markline', 'POST', newMarkLine);

                  if (result.success) {
                    console.log("EVENT: User created new markline. Syncing with D1 was successful. UPDATING state.", newMarkLine);
                    setMarkLines(prev => [...prev, newMarkLine]);
                  }
                });
            };
      
            const handleMarkLineClick = ({ data, position }) => {
                createPopup({ date: data.date, content: data.content }, position, async value => {
                  // Create the updated object, ensuring we don't send undefined values
                  const updatedMarkLine = { ...data, content: value || data.content, store_id: storeId };
                  
                  // The backend handles UPSERT, so we just POST the updated object.
                  const result = await apiCall('markline', 'POST', updatedMarkLine);
                  
                  if(result.success) {
                    console.log(`EVENT: User updated markline. Sync with D1 successful. UPDATING state for date: ${data.date}`);
                    setMarkLines(prev =>
                      prev.map(line =>
                        line.date === data.date ? { ...line, content: value } : line
                      )
                    );
                  }
                });
            };

            const handleTaskChange = (args) => {
                if (isUpdatingExternally.current) {
                    console.log("INFO: Ignoring `change_task` event from external update.");
                    requestAnimationFrame(() => {
                        isUpdatingExternally.current = false;
                    });
                    return;
                }
                const { records: newRecords } = args;

                // Instead of diffing and calling the API, just update the state
                // and mark that there are unsaved changes.
                console.log("EVENT: `change_task` (drag/resize) fired. Staging changes.");
                setRecords(newRecords);
            };

            const handleContextMenu = (args) => {
                args.event.preventDefault(); // Prevent default browser menu
                const record = instanceRef.current.getRecordByCell(args.col, args.row);
                if (record) {
                    setContextMenu({
                        visible: true,
                        x: args.event.clientX,
                        y: args.event.clientY,
                        record: record
                    });
                }
            };
    
            ganttInstance.on('click_markline_create', handleMarkLineCreate);
            ganttInstance.on('click_markline_content', handleMarkLineClick);
            ganttInstance.on('change_task', handleTaskChange);
            ganttInstance.on('after_edit_cell', handleCellEdit); // Register the new handler
            ganttInstance.on('contextmenu_cell', handleContextMenu);
        }

        return () => {
            if (instanceRef.current) {
                console.log("EVENT: Component unmounting. Releasing Gantt instance.");
                instanceRef.current.release();
                instanceRef.current = null;
            }
        };
    }, []); // NOTE: The empty dependency array is CRUCIAL. It ensures this effect runs only ONCE.

    // This useEffect is ONLY for updating the gantt instance when state changes, AFTER the initial mount.
    useEffect(() => {
        if (instanceRef.current) {
            console.log("SYNC: Syncing `records` state to Gantt instance.");
            instanceRef.current.setRecords(records);
        }
    }, [records]);

    useEffect(() => {
        if (instanceRef.current) {
            console.log("SYNC: Syncing `markLines` state to Gantt instance.");
            instanceRef.current.updateMarkLine(markLines);
        }
    }, [markLines]);

    // Update time scale dynamically
    useEffect(() => {
        if (instanceRef.current) {
            console.log("SYNC: Updating time scale to:", timeScale);
            instanceRef.current.updateScales(getScalesConfig(timeScale));
        }
    }, [timeScale]);

    // 3. 定义按钮的点击处理函数
    const handleRefresh = () => {
        console.log("User clicked refresh button. Fetching data again...");
        fetchData(); // 直接调用封装好的函数
    };

    // 4. 定义保存更改的处理函数
    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            console.log("User clicked save changes button. Sending data to API...", records);
            const result = await apiCall('tasks', 'POST', { records, storeId });
            
            if (result.success) {
                message.success('更改已成功保存');
            } else {
                message.error('保存失败: ' + (result.error?.message || '未知错误'));
            }
        } catch (error) {
            console.error('保存更改时发生错误:', error);
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
            parent_id: parentId
        };
        setIsLoading(true);
        try {
            const result = await apiCall('task/add', 'POST', { task: newTask, storeId });
            if (result.success) {
                message.success('任务添加成功');
                await fetchData(); // Easiest way to ensure tree is correct
            } else {
                message.error('添加失败: ' + (result.error || '未知错误'));
            }
        } catch (e) {
            message.error('添加失败: ' + e.message);
        } finally {
            setIsLoading(false);
            if (contextMenu.visible) {
                setContextMenu({ visible: false, x: 0, y: 0, record: null });
            }
        }
    };

    return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {contextMenu.visible && (
                <div 
                    style={{
                        position: 'absolute',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        background: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                        zIndex: 1001,
                        padding: '5px 0'
                    }}
                >
                    <div 
                        style={{ padding: '8px 15px', cursor: 'pointer' }} 
                        onClick={() => handleAddTask(contextMenu.record.id)}
                    >
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
                    <Link to={`/crowd-portrait/${storeId}`}>
                        <Button>人群画像分析</Button>
                    </Link>
                    <Button
                        onClick={handleRefresh}
                        disabled={isLoading}
                    >
                        {isLoading ? '正在刷新...' : '刷新同步数据'}
                    </Button>
                    <Button
                        onClick={() => handleAddTask(null)}
                        disabled={isLoading}
                    >
                        新增任务
                    </Button>
                    <Button
                        type="primary"
                        onClick={handleSaveChanges}
                        disabled={isLoading}
                        loading={isLoading}
                    >
                        {isLoading ? '正在保存...' : '保存更改到云端'}
                    </Button>
                </Space>
            </div>
            <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
        </div>
    );
};

export default GanttChart;
