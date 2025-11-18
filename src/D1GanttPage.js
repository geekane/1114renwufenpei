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

            const handleMarkLineCreate = ({ data, position }) => {
                createPopup({ date: data.startDate, content: '' }, position, value => {
                  const newMarkLine = {
                    date: formatDate(data.startDate),
                    content: value || '新建里程碑',
                    contentStyle: { color: '#fff' },
                    style: { lineWidth: 1, lineColor: 'red' }
                  };
                  console.log("EVENT: User created new markline. UPDATING markLines state.", newMarkLine);
                  setMarkLines(prev => [...prev, newMarkLine]);
                });
            };
      
            const handleMarkLineClick = ({ data, position }) => {
                createPopup({ date: data.date, content: data.content }, position, value => {
                  console.log(`EVENT: User updated markline. UPDATING markLines state for date: ${data.date}`);
                  setMarkLines(prev => 
                    prev.map(line => 
                      line.date === data.date ? { ...line, content: value } : line
                    )
                  );
                });
            };

            const handleTaskChange = (args) => {
                if (isUpdatingExternally.current) {
                    console.log("INFO: Ignoring `change_task` event from external update.");
                    // Reset the flag on the next frame to avoid race conditions
                    // where multiple events might be fired from a single action.
                    requestAnimationFrame(() => {
                        isUpdatingExternally.current = false;
                    });
                    return;
                }
                const { records: newRecords } = args;
                console.log("EVENT: `change_task` fired from Gantt instance. UPDATING records state.");
                setRecords(newRecords);
            };
    
            ganttInstance.on('click_markline_create', handleMarkLineCreate);
            ganttInstance.on('click_markline_content', handleMarkLineClick);
            ganttInstance.on('change_task', handleTaskChange);
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

    const handleUpdateTask = () => {
        if (instanceRef.current) {
            const taskIdToUpdate = 2;
            const newDateInfo = {
                // Per your request, the date update process is removed.
                // start: '2025-10-08',
                // end: '2025-10-15',
                title: '筹划 (已延期)'
            };
    
            console.log(`正在通过 setRecords 更新任务 ID: ${taskIdToUpdate}`);
    
            // 1. Set a flag to indicate this update is from our code, not the user.
            isUpdatingExternally.current = true;
    
            // 2. Update React's state, which is the single source of truth.
            // The useEffect hook will then sync this change to the Gantt instance.
            setRecords(currentRecords =>
                currentRecords.map(record =>
                    record.id === taskIdToUpdate ? { ...record, ...newDateInfo } : record
                )
            );
    
            alert(`任务 ${taskIdToUpdate} 已更新!`);
        }
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
                <button style={{ ...buttonStyle, marginLeft: '20px' }} onClick={handleUpdateTask}>更新任务</button>
                
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
