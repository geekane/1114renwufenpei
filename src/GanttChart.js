import React, { useEffect, useRef } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

const GanttChart = ({ tasks }) => {
    const ganttRef = useRef(null);

    // Effect for one-time initialization of the Gantt chart
    useEffect(() => {
        // --- Gantt Configuration ---
        gantt.i18n.setLocale("cn");
        gantt.config.date_format = "%Y-%m-%d";
        gantt.config.readonly = true;
        gantt.config.row_height = 44; // Increase row height for dual bars
        gantt.config.columns = [
            { name: "text", label: "任务名称", tree: true, width: '*' },
            { name: "start_date", label: "开始时间", align: "center", width: 100 },
            { name: "duration", label: "工期(天)", align: "center", width: 80 },
        ];
        gantt.config.scales = [
            {unit: "month", step: 1, format: "%Y年 %F"},
            {unit: "day", step: 1, format: "%j日, %D"}
        ];

        // --- Template for dual-track display ---
        gantt.templates.task_text = function(start, end, task) {
            return `
                <div class="task-container">
                    <div class="baseline" style="left:${gantt.getTaskPosition(task, new Date(task.planned_start), new Date(task.planned_end)).left}px; width:${gantt.getTaskPosition(task, new Date(task.planned_start), new Date(task.planned_end)).width}px;"></div>
                    <div class="actual-time ${task.progress === 1 ? (end > new Date(task.planned_end) ? 'overdue' : 'on-time') : 'in-progress'}"></div>
                </div>
                ${task.text}
            `;
        };

        // --- Tooltip Template for Deviation Analysis ---
        gantt.templates.tooltip_text = function(start, end, task) {
            let html = `<b>任务:</b> ${task.text}<br/>`;
            html += `<b>实际时间:</b> ${gantt.templates.tooltip_date_format(start)} - ${gantt.templates.tooltip_date_format(end)}<br/>`;
            if (task.planned_start && task.planned_end) {
                const plannedEnd = new Date(task.planned_end);
                const diff = Math.round((end.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
                let deviation = '';
                if (task.progress === 1) {
                    if (diff > 0) {
                        deviation = `<span style="color: #ff4d4f;"> (超时 ${diff} 天)</span>`;
                    } else if (diff < 0) {
                        deviation = `<span style="color: #52c41a;"> (提前 ${-diff} 天)</span>`;
                    } else {
                        deviation = ' (按时完成)';
                    }
                }
                html += `<b>计划时间:</b> ${task.planned_start} - ${task.planned_end}${deviation}`;
            }
            return html;
        };

        gantt.init(ganttRef.current);

        // Cleanup function
        return () => {
            if (ganttRef.current) {
                gantt.clearAll();
                ganttRef.current.innerHTML = '';
            }
        };
    }, []);

    // Effect for loading and refreshing data
    useEffect(() => {
        if (!tasks || !ganttRef.current || ganttRef.current.innerHTML === '') return;
        
        const calculateDuration = (start, end) => Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;

        const transformedTasks = tasks.map(task => ({ ...task, duration: calculateDuration(task.start, task.end) }));
        
        const links = tasks
            .filter(task => task.dependencies)
            .map(task => ({ id: `link-${task.id}`, source: task.dependencies, target: task.id, type: '0' }));
        
        const timer = setTimeout(() => {
            gantt.clearAll();
            gantt.parse({ data: transformedTasks, links });
        }, 0);

        return () => clearTimeout(timer);
    }, [tasks]);

    return (
        <div>
            <style>{`
                .task-container { position: relative; width: 100%; height: 100%; }
                .baseline { position: absolute; top: 5px; height: 12px; background-color: #e0e0e0; border-radius: 2px; opacity: 0.8; z-index: 0; }
                .actual-time { position: absolute; bottom: 5px; height: 12px; border-radius: 2px; width: 100%; }
                .actual-time.on-time { background-color: #52c41a; }
                .actual-time.overdue { background-color: #ff4d4f; }
                .actual-time.in-progress { background-color: #40a9ff; }
                .gantt_task_content { display: none; } /* Hide default content to use template */
            `}</style>
            <div ref={ganttRef} style={{ width: '100%', height: '500px' }} />
        </div>
    );
};

export default GanttChart;