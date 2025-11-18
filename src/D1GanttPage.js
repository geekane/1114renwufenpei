import React, { useEffect, useRef, useState } from 'react';
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
                    unit: 'day',
                    step: 1,
                    format(date) { return date.dateIndex.toString(); },
                    customLayout: args => {
                        const { width, height, dateIndex, startDate } = args;
                        const container = new VTableGantt.VRender.Group({ width, height, fill: '#f0f0fb', display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' });
                        const containerLeft = new VTableGantt.VRender.Group({ height, width: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around' });
                        container.add(containerLeft);

                        const simpleCalendarIcon = '<svg viewBox="0 0 24 24" fill="#389BFF" xmlns="http://www.w3.org/2000/svg"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M7 7v2h2V7H7z"/></svg>';
                        const avatar = new VTableGantt.VRender.Image({ width: 20, height: 30, image: simpleCalendarIcon });
                        
                        containerLeft.add(avatar);
                        const containerCenter = new VTableGantt.VRender.Group({ height, width: width - 30, display: 'flex', flexDirection: 'column' });
                        container.add(containerCenter);
                        const dayNumber = new VTableGantt.VRender.Text({ text: String(dateIndex).padStart(2, '0'), fontSize: 20, fontWeight: 'bold', fontFamily: 'sans-serif', fill: 'black', textAlign: 'right', maxLineWidth: width - 30, boundsPadding: [15, 0, 0, 0] });
                        containerCenter.add(dayNumber);
                        const weekDay = new VTableGantt.VRender.Text({ text: getChineseWeekday(startDate), fontSize: 12, fontFamily: 'sans-serif', fill: 'black', boundsPadding: [0, 0, 0, 0] });
                        containerCenter.add(weekDay);
                        return { rootContainer: container };
                    }
                }
            ];
    }
};

const GanttChart = () => {
    const containerRef = useRef(null);
    const instanceRef = useRef(null);
    const isUpdatingExternally = useRef(false);
    const [records, setRecords] = useState([]);
    const [markLines, setMarkLines] = useState([]);
    const [timeScale, setTimeScale] = useState('day');
    const [isLoading, setIsLoading] = useState(false); // 新增一个 loading 状态

    // 1. 将数据获取逻辑封装成一个独立的函数
    const fetchData = async () => {
        console.log("Attempting to fetch data from API...");
        setIsLoading(true); // 开始加载，设置 loading 状态
        try {
            const response = await fetch('/api/data');
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            const data = await response.json();
            console.log("SUCCESS: Loaded data from API.", data);

            // 确保 data.records 是数组
            if (Array.isArray(data.records)) {
                setRecords(data.records);
            } else {
                console.error("ERROR: API response for records is not an array.", data);
            }
            // 确保 data.markLines 是数组
            if (Array.isArray(data.markLines)) {
                setMarkLines(data.markLines);
            } else {
                setMarkLines([]);
            }
        } catch (error) {
            console.error('ERROR: Failed to fetch or parse data from API.', error);
            // 可以在这里添加一些用户提示，比如弹窗
            alert('数据加载失败，请检查网络或联系管理员！');
        } finally {
            setIsLoading(false); // 加载结束，无论成功失败都取消 loading
        }
    };

    // 2. 在组件加载时调用这个函数
    useEffect(() => {
        fetchData();
    }, []); // 空依赖数组确保只在首次加载时运行

    // This useEffect handles the INITIALIZATION of the Gantt chart instance.
    // It runs only ONCE when the component mounts.
    useEffect(() => {
        if (containerRef.current && !instanceRef.current) {
            console.log("EVENT: Component mounted. INITIALIZING Gantt Chart instance...");
            const barColors0 = ['#aecde6', '#c6a49a', '#ffb582', '#eec1de', '#b3d9b3', '#cccccc', '#e59a9c', '#d9d1a5', '#c9bede'];
            const barColors = ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#7f7f7f', '#d62728', '#bcbd22', '#9467bd'];
            
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
            
            const option = {
                records, // Uses the state initialized from localStorage
                markLine: markLines, // Uses the state initialized from localStorage
                taskListTable: { columns, tableWidth: 390, theme: { headerStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 18, fontWeight: 'bold', color: 'red' }, bodyStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 16, color: '#4D4D4D', bgColor: '#FFF' } } },
                frame: { outerFrameStyle: { borderLineWidth: 0, borderColor: 'red', cornerRadius: 8 } },
                grid: { backgroundColor: '#f0f0fb', horizontalLine: { lineWidth: 2, lineColor: '#d5d9ee' } },
                headerRowHeight: 60,
                rowHeight: 80,
                taskBar: {
                  startDateField: 'start', endDateField: 'end', progressField: 'progress', barStyle: { width: 60 },
                  draggable: true,
                  resizable: true,
                  customLayout: args => {
                    const colorLength = barColors.length;
                    const { width, height, index, taskRecord } = args;
                    const container = new VTableGantt.VRender.Group({ width, height, cornerRadius: 30, fill: { gradient: 'linear', x0: 0, y0: 0, x1: 1, y1: 0, stops: [{ offset: 0, color: barColors0[index % colorLength] }, { offset: 0.5, color: barColors[index % colorLength] }, { offset: 1, color: barColors0[index % colorLength] }] }, display: 'flex', flexDirection: 'row', flexWrap: 'nowrap' });
                    const containerLeft = new VTableGantt.VRender.Group({ height, width: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-around' });
                    container.add(containerLeft);
                    const avatar = new VTableGantt.VRender.Image({ width: 50, height: 50, image: taskRecord.avatar, cornerRadius: 25 });
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
                      const progressText = new VTableGantt.VRender.Text({ text: `${args.progress}%`, fontSize: 12, fontFamily: 'sans-serif', fill: 'black', alignSelf: 'center', fontWeight: 'bold', maxLineWidth: (width - 60) / 2, boundsPadding: [0, 0, 0, 0] });
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
                minDate: '2025-10-01',
                maxDate: '2025-11-15',
                scrollStyle: { scrollRailColor: 'RGBA(246,246,246,0.5)', visible: 'focus', width: 6, scrollSliderCornerRadius: 2, scrollSliderColor: '#5cb85c' },
                overscrollBehavior: 'none',
                markLineCreateOptions: { markLineCreatable: true, markLineCreationHoverToolTip: { position: 'top', tipContent: '创建里程碑', style: { contentStyle: { fill: '#fff' }, panelStyle: { background: '#14161c', cornerRadius: 4 } } }, markLineCreationStyle: { fill: '#ccc', size: 30, iconSize: 12, svg: simplePlusIcon } }
            };

            const ganttInstance = new VTableGantt.Gantt(containerRef.current, option);
            instanceRef.current = ganttInstance;

            const handleCellEdit = async (args) => {
                const { col, row, field, value } = args;

                // Use the instance's method to get the canonical record for the edited cell.
                // This is more reliable for tree structures.
                const record = instanceRef.current.getRecordByCell(col, row);

                if (!record || !record.id || !field) {
                  console.warn('Cell edit ignored: could not determine record ID or field.', { args, record });
                  return;
                }
                
                const id = record.id;
            
                let formattedValue = value;
                // Ensure date values are formatted correctly as 'YYYY-MM-DD' for the backend.
                if ((field === 'start' || field === 'end') && value) {
                    // Create a Date object from the editor's value and format it.
                    formattedValue = formatDate(new Date(value));
                }

                const changedData = { [field]: formattedValue };
                console.log(`EVENT: User edited cell. Task ID: ${id}. Sending to API:`, changedData);
            
                const result = await apiCall('task', 'POST', { id, changedData });
            
                if (result.success) {
                  // The UI in the VTable instance is already updated.
                  // We now sync our React state to match, which serves as the source of truth.
                  console.log("SYNC: API call successful. Updating React state.");
                  setRecords(currentRecords => {
                    const updateNode = (nodes) => {
                        return nodes.map(node => {
                            if (node.id === id) {
                                // Important: Merge with the *formatted* value
                                return { ...node, ...changedData };
                            }
                            if (node.sub) {
                                return { ...node, sub: updateNode(node.sub) };
                            }
                            return node;
                        });
                    };
                    return updateNode(currentRecords);
                  });
                } else {
                  // If the API call fails, revert the change by refetching data from the server.
                  alert('更新失败，正在从服务器恢复数据...');
                  fetchData();
                }
            };
            
            const handleMarkLineCreate = ({ data, position }) => {
                createPopup({ date: data.startDate, content: '' }, position, async value => {
                  const newMarkLine = {
                    date: formatDate(data.startDate),
                    content: value || '新建里程碑',
                    // Styling simplified as per user's final instruction.
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
                  const updatedMarkLine = { ...data, content: value || data.content };
                  
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
            
                // The `records` variable in this closure holds the state *before* this change.
                // We can use it to diff against `newRecords`.
                let changedRecord = null;
                let originalRecord = null;
            
                // Helper to find a record by ID in a nested structure
                const findRecordById = (id, nodes) => {
                    for (const node of nodes) {
                        if (node.id === id) return node;
                        if (node.sub) {
                            const found = findRecordById(id, node.sub);
                            if (found) return found;
                        }
                    }
                    return null;
                };
            
                // Flatten the new records to make searching easier
                const flatNewRecords = instanceRef.current.getRecords();
            
                for (const newRec of flatNewRecords) {
                    const oldRec = findRecordById(newRec.id, records); // `records` is the state before the update
                    if (oldRec && (newRec.start !== oldRec.start || newRec.end !== oldRec.end || newRec.progress !== oldRec.progress)) {
                        changedRecord = newRec;
                        originalRecord = oldRec;
                        break;
                    }
                }
            
                if (changedRecord && originalRecord) {
                    const changedData = {};
                    if (changedRecord.start !== originalRecord.start) changedData.start = changedRecord.start;
                    if (changedRecord.end !== originalRecord.end) changedData.end = changedRecord.end;
                    if (changedRecord.progress !== originalRecord.progress) changedData.progress = changedRecord.progress;
            
                    if (Object.keys(changedData).length > 0) {
                        console.log(`EVENT: \`change_task\` (drag/resize) fired. Task ID: ${changedRecord.id}, changed:`, changedData);
                        
                        apiCall('task', 'POST', { id: changedRecord.id, changedData })
                          .then(result => {
                              if (!result.success) {
                                  alert('同步任务变更失败，正在从服务器恢复数据...');
                                  fetchData(); // Revert on failure
                              }
                          });
                    }
                }
                
                console.log("EVENT: `change_task` fired from Gantt instance. UPDATING records state.");
                // Update React state to reflect the UI change immediately.
                setRecords(newRecords);
            };
    
            ganttInstance.on('click_markline_create', handleMarkLineCreate);
            ganttInstance.on('click_markline_content', handleMarkLineClick);
            ganttInstance.on('change_task', handleTaskChange);
            ganttInstance.on('after_edit_cell', handleCellEdit); // Register the new handler
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

    const buttonStyle = { margin: '0 5px', padding: '5px 10px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px' };
    const activeButtonStyle = { ...buttonStyle, backgroundColor: '#389BFF', color: 'white', borderColor: '#389BFF' };
    
    return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                <span>时间粒度：</span>
                <button style={timeScale === 'day' ? activeButtonStyle : buttonStyle} onClick={() => setTimeScale('day')}>日</button>
                <button style={timeScale === 'week' ? activeButtonStyle : buttonStyle} onClick={() => setTimeScale('week')}>周</button>
                <button style={timeScale === 'month' ? activeButtonStyle : buttonStyle} onClick={() => setTimeScale('month')}>月</button>
                
                {/* 新增的刷新按钮 */}
                <button
                    style={{ ...buttonStyle, marginLeft: '10px' }}
                    onClick={handleRefresh}
                    disabled={isLoading} // 当正在加载时，禁用按钮防止重复点击
                >
                    {isLoading ? '正在刷新...' : '刷新同步数据'}
                </button>
            </div>
            <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
        </div>
    );
};

export default GanttChart;
