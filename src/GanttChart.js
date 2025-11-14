import React, { useEffect, useRef } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

const GanttChart = ({ tasks }) => {
    const ganttRef = useRef(null);

    useEffect(() => {
        gantt.i18n.setLocale("cn");
        gantt.config.date_format = "%Y-%m-%d";
        gantt.config.readonly = true;
        gantt.config.row_height = 44; 
        gantt.config.columns = [
            { name: "text", label: "任务名称", tree: true, width: '*' },
            { name: "start_date", label: "开始时间", align: "center", width: 100 },
            { name: "duration", label: "工期(天)", align: "center", width: 80 },
        ];
        gantt.config.scales = [
            {unit: "month", step: 1, format: "%Y年 %F"},
            {unit: "day", step: 1, format: "%j日, %D"}
        ];

        // --- Task Class Template for Color-Coding ---
        gantt.templates.task_class = function(start, end, task) {
            if (task.progress === 1) { // Completed tasks
                const plannedEnd = new Date(task.planned_end);
                return end > plannedEnd ? "gantt-overdue" : "gantt-on-time";
            }
            return "gantt-in-progress"; // In-progress tasks
        };

        // --- Task Text Template to Display Task Name ---
        gantt.templates.task_text = function(start, end, task) {
            return task.text;
        };

        gantt.templates.tooltip_text = function(start, end, task) {
            let html = `<b>任务:</b> ${task.text}<br/>`;
            html += `<b>实际时间:</b> ${gantt.templates.tooltip_date_format(start)} - ${gantt.templates.tooltip_date_format(end)}<br/>`;
            if (task.planned_start && task.planned_end) {
                const plannedEnd = new Date(task.planned_end);
                const diff = Math.round((end.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
                let deviation = '';
                if (task.progress === 1) {
                    if (diff > 0) deviation = `<span style="color: #ff4d4f;"> (超时 ${diff} 天)</span>`;
                    else if (diff < 0) deviation = `<span style="color: #52c41a;"> (提前 ${-diff} 天)</span>`;
                    else deviation = ' (按时完成)';
                }
                html += `<b>计划时间:</b> ${task.planned_start} - ${task.planned_end}${deviation}`;
            }
            return html;
        };

        gantt.init(ganttRef.current);

        const ganttContainer = ganttRef.current;
        return () => {
            if (ganttContainer) {
                gantt.clearAll();
                ganttContainer.innerHTML = '';
            }
        };
    }, []);

    useEffect(() => {
        if (!tasks || !ganttRef.current || ganttRef.current.innerHTML === '') return;
        
        const calculateDuration = (start, end) => Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;

        const transformedTasks = tasks.map(task => ({
            ...task,
            text: task.name, // Explicitly map name to text
            start_date: new Date(task.start),
            duration: calculateDuration(task.start, task.end)
        }));
        
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
                /* Green for on-time/early completion */
                .gantt_task_line.gantt-on-time .gantt_task_content {
                    background-color: #52c41a;
                }
                .gantt_task_line.gantt-on-time:hover .gantt_task_content {
                    background-color: #389e0d;
                }

                /* Red for overdue completion */
                .gantt_task_line.gantt-overdue .gantt_task_content {
                    background-color: #ff4d4f;
                }
                .gantt_task_line.gantt-overdue:hover .gantt_task_content {
                    background-color: #cf1322;
                }

                 /* Blue for in-progress tasks (default) */
                .gantt_task_line.gantt-in-progress .gantt_task_content {
                    background-color: #40a9ff;
                }
                .gantt_task_line.gantt-in-progress:hover .gantt_task_content {
                    background-color: #096dd9;
                }
            `}</style>
            <div ref={ganttRef} style={{ width: '100%', height: '500px' }} />
        </div>
    );
};

export default GanttChart;
