import React, { useEffect, useRef, useState } from 'react';
import * as VTable from '@visactor/vtable';
import * as VTableGantt from '@visactor/vtable-gantt';

// 初始任务数据（ID 已修正为唯一）
const INITIAL_RECORDS = [
  { id: 1, title: '选址', developer: '王某', avatar: 'https://p3-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/e130bd90147041f69e217bea26854a23~tplv-tb4s082cfz-aigc_resize_mark:1080:1080.webp?lk3s=43402efa&x-expires=1765152000&x-signature=U5Ml0l1sXRSXNvlA76vQcFJNBzw%3D&format=.webp', start: '2025-10-02', end: '2025-10-03', progress: 100, priority: 'P0' },
  { id: 2, title: '筹划', developer: '钟某', avatar: 'https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/82b75df716d342a5b4e0c6bcf8e5e61a~tplv-tb4s082cfz-aigc_resize_mark:720:720.webp?lk3s=43402efa&x-expires=1765152000&x-signature=QA1%2BvzQ9xvW4MyD01foyxUuROXQ%3D&format=.webp', start: '2025-10-04', end: '2025-10-05', progress: 60, priority: 'P0' },
  { id: 3, title: '对比', developer: '唐姐', avatar: 'https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/82b75df716d342a5b4e0c6bcf8e5e61a~tplv-tb4s082cfz-aigc_resize_mark:720:720.webp?lk3s=43402efa&x-expires=1765152000&x-signature=QA1%2BvzQ9xvW4MyD01foyxUuROXQ%3D&format=.webp', start: '2025-10-06', end: '2025-10-13', progress: 100, priority: 'P1' },
  { id: 4, title: '装修', developer: '猫弟', avatar: 'https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/82b75df716d342a5b4e0c6bcf8e5e61a~tplv-tb4s082cfz-aigc_resize_mark:720:720.webp?lk3s=43402efa&x-expires=1765152000&x-signature=QA1%2BvzQ9xvW4MyD01foyxUuROXQ%3D&format=.webp', start: '2025-10-14', end: '2025-10-21', progress: 100, priority: 'P0' },
  { id: 5, title: '招聘', developer: '鸟哥', avatar: 'https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/82b75df716d342a5b4e0c6bcf8e5e61a~tplv-tb4s082cfz-aigc_resize_mark:720:720.webp?lk3s=43402efa&x-expires=1765152000&x-signature=QA1%2BvzQ9xvW4MyD01foyxUuROXQ%3D&format=.webp', start: '2025-10-22', end: '2025-10-30', progress: 100, priority: 'P0' },
  { id: 6, title: '运营', developer: '大姐', avatar: 'https://p26-dreamina-sign.byteimg.com/tos-cn-i-tb4s082cfz/82b75df716d342a5b4e0c6bcf8e5e61a~tplv-tb4s082cfz-aigc_resize_mark:720:720.webp?lk3s=43402efa&x-expires=1765152000&x-signature=QA1%2BvzQ9xvW4MyD01foyxUuROXQ%3D&format=.webp', start: '2025-10-01', end: '2025-10-10', progress: 100, priority: 'P1' }
];

// 从 localStorage 加载任务数据的辅助函数
const getInitialRecords = () => {
    try {
        const savedRecords = localStorage.getItem('ganttRecords');
        if (savedRecords) {
            return JSON.parse(savedRecords);
        }
    } catch (error) {
        console.error('Failed to parse records from localStorage', error);
    }
    return INITIAL_RECORDS;
};

// 从 localStorage 加载标记线的辅助函数
const getInitialMarkLines = () => {
    try {
        const savedMarkLines = localStorage.getItem('ganttMarkLines');
        if (savedMarkLines) {
            return JSON.parse(savedMarkLines);
        }
    } catch (error) {
        console.error('Failed to parse markLines from localStorage', error);
    }
    return [
        {
            date: '2024-07-29',
            content: '里程碑1',
            contentStyle: { color: '#fff' },
            style: { lineWidth: 1, lineColor: 'blue', lineDash: [8, 4] }
        }
    ];
};

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
      <input type="text" placeholder="输入内容" class="popup-input" value="${content}" style="width: 150px; margin-bottom: 5px; padding: 5px;" />
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
    const [markLines, setMarkLines] = useState(getInitialMarkLines);
    const [records, setRecords] = useState(getInitialRecords);
    const prevMarkLinesRef = useRef();
    const [timeScale, setTimeScale] = useState('day');

    // 保存 MarkLines 到 localStorage
    useEffect(() => {
        try {
          localStorage.setItem('ganttMarkLines', JSON.stringify(markLines));
        } catch (error) {
          console.error('Failed to save markLines to localStorage', error);
        }
    }, [markLines]);

    // 保存 Records 到 localStorage
    useEffect(() => {
        try {
            localStorage.setItem('ganttRecords', JSON.stringify(records));
        } catch (error) {
            console.error('Failed to save records to localStorage', error);
        }
    }, [records]);

    // 初始化甘特图
    useEffect(() => {
        if (containerRef.current && !instanceRef.current) {
            const barColors0 = ['#aecde6', '#c6a49a', '#ffb582', '#eec1de', '#b3d9b3', '#cccccc', '#e59a9c', '#d9d1a5', '#c9bede'];
            const barColors = ['#1f77b4', '#8c564b', '#ff7f0e', '#e377c2', '#2ca02c', '#7f7f7f', '#d62728', '#bcbd22', '#9467bd'];
            
            const columns = [
              {
                field: 'title', title: '任务', width: '200', headerStyle: { textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: 'black', bgColor: '#f0f0fb' }, style: { bgColor: '#f0f0fb' },
                customLayout: args => {
                  const { table, row, col, rect } = args;
                  const taskRecord = table.getCellOriginRecord(col, row);
                  if (!taskRecord) return; // 防御性编程，避免记录不存在的错误
                  const { height, width } = rect ?? table.getCellRect(col, row);
                  const container = new VTableGantt.VRender.Group({ y: 10, x: 20, height: height - 20, width: width - 40, fill: 'white', display: 'flex', flexDirection: 'column', cornerRadius: 30 });
                  const titleText = new VTableGantt.VRender.Text({ text: taskRecord.title, fontSize: 16, fontFamily: 'sans-serif', fill: barColors[row % barColors.length], fontWeight: 'bold', maxLineWidth: width - 120, boundsPadding: [10, 0, 0, 0], alignSelf: 'center' });
                  container.add(titleText);
                  const days = new VTableGantt.VRender.Text({ text: `${VTableGantt.tools.formatDate(new Date(taskRecord.start), 'mm/dd')}-${VTableGantt.tools.formatDate(new Date(taskRecord.end), 'mm/dd')}`, fontSize: 12, fontFamily: 'sans-serif', fontWeight: 'bold', fill: 'black', boundsPadding: [10, 0, 0, 0], alignSelf: 'center' });
                  container.add(days);
                  return { rootContainer: container, expectedWidth: 160 };
                }
              }
            ];

            const simplePlusIcon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill=""/></svg>';

            const option = {
                records,
                taskListTable: { columns, tableWidth: 'auto', theme: { headerStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 18, fontWeight: 'bold', color: 'red' }, bodyStyle: { borderColor: '#e1e4e8', borderLineWidth: 0, fontSize: 16, color: '#4D4D4D', bgColor: '#FFF' } } },
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
                markLine: markLines,
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
                  setMarkLines(prev => [...prev, newMarkLine]);
                });
            };
      
            const handleMarkLineClick = ({ data, position }) => {
                createPopup({ date: data.date, content: data.content }, position, value => {
                  setMarkLines(prev => 
                    prev.map(line => 
                      line.date === data.date ? { ...line, content: value } : line
                    )
                  );
                });
            };

            const handleTaskChange = (args) => {
                const { originRecord, changedData } = args;
                setRecords(prevRecords => 
                    prevRecords.map(record => {
                        if (record.id === originRecord.id) {
                            return { ...record, ...changedData };
                        }
                        return record;
                    })
                );
            };
    
            ganttInstance.on('click_markline_create', handleMarkLineCreate);
            ganttInstance.on('click_markline_content', handleMarkLineClick);
            ganttInstance.on('change_task', handleTaskChange);

            prevMarkLinesRef.current = markLines;
        }

        return () => {
            if (instanceRef.current) {
                instanceRef.current.release();
                instanceRef.current = null;
            }
        };
    }, []);

    // 动态更新 MarkLines
    useEffect(() => {
        const ganttInstance = instanceRef.current;
        if (!ganttInstance) return;
        
        const prevLines = prevMarkLinesRef.current || [];
        const currentLines = markLines;
        const prevLinesMap = new Map(prevLines.map(line => [line.date, line]));
        const currentLinesMap = new Map(currentLines.map(line => [line.date, line]));

        prevLinesMap.forEach((_prevLine, date) => {
          if (!currentLinesMap.has(date)) {
            ganttInstance.removeMarkLine({ date });
          }
        });

        currentLinesMap.forEach((currentLine, date) => {
          const prevLine = prevLinesMap.get(date);
          if (!prevLine) {
            ganttInstance.addMarkLine(currentLine);
          } else if (JSON.stringify(prevLine) !== JSON.stringify(currentLine)) {
            ganttInstance.updateMarkLine(currentLine);
          }
        });
        
        prevMarkLinesRef.current = markLines;
    }, [markLines]);
    
    // 动态更新时间刻度
    useEffect(() => {
        if (instanceRef.current) {
            const newScales = getScalesConfig(timeScale);
            instanceRef.current.updateScales(newScales);
        }
    }, [timeScale]);
    
    // 新增任务的处理函数
    const handleAddTask = () => {
        const newId = records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 2);

        const newTask = {
            id: newId,
            title: `新任务 ${newId}`,
            developer: '待分配',
            avatar: 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/question.jpeg',
            start: formatDate(today),
            end: formatDate(endDate),
            progress: 0,
            priority: 'P2'
        };

        const newRecords = [...records, newTask];
        // 1. 更新 React State (这会触发保存到 localStorage 的 useEffect)
        setRecords(newRecords);

        // 2. 手动通知甘特图实例更新其数据
        if (instanceRef.current) {
            instanceRef.current.updateOption({ records: newRecords });
        }
    };

    const buttonStyle = {
        margin: '0 5px',
        padding: '5px 10px',
        cursor: 'pointer',
        border: '1px solid #ccc',
        borderRadius: '4px'
    };

    const activeButtonStyle = {
        ...buttonStyle,
        backgroundColor: '#389BFF',
        color: 'white',
        borderColor: '#389BFF'
    };
    
    return (
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                <span>时间粒度：</span>
                <button 
                    style={timeScale === 'day' ? activeButtonStyle : buttonStyle} 
                    onClick={() => setTimeScale('day')}
                >
                    日
                </button>
                <button 
                    style={timeScale === 'week' ? activeButtonStyle : buttonStyle} 
                    onClick={() => setTimeScale('week')}
                >
                    周
                </button>
                <button 
                    style={timeScale === 'month' ? activeButtonStyle : buttonStyle} 
                    onClick={() => setTimeScale('month')}
                >
                    月
                </button>
                <button 
                    style={{ ...buttonStyle, marginLeft: '20px' }} 
                    onClick={handleAddTask}
                >
                    新增任务
                </button>
            </div>
            <div ref={containerRef} style={{ flex: 1, width: '100%' }} />
        </div>
    );
};

export default GanttChart;
