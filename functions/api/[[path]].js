// --- START OF FILE functions/api/[[path]].js ---

// A simple JSON response helper
const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Main request handler
export async function onRequest(context) {
  const { request, env, params } = context;
  const url = new URL(request.url);
  const pathSegments = params.path || [];

  // Route: POST /api/tasks
  // Saves all tasks in bulk for a specific store
  if (request.method === 'POST' && pathSegments[0] === 'tasks') {
    try {
      const { records, storeId } = await request.json();
      if (!Array.isArray(records) || !storeId) {
        return jsonResponse({ error: 'Invalid data format' }, 400);
      }

      // Helper to flatten the nested records
      const flattenRecords = (nodes, parentId = null) => {
        let flatList = [];
        nodes.forEach(node => {
          const { children, ...taskData } = node;
          flatList.push({ ...taskData, parent_id: parentId });
          if (children && children.length > 0) {
            flatList = flatList.concat(flattenRecords(children, node.id));
          }
        });
        return flatList;
      };

      const flatRecords = flattenRecords(records);

      const statements = [
        // 1. Delete all existing tasks for the given storeId
        env.DB.prepare('DELETE FROM gantt_tasks WHERE store_id = ?').bind(storeId),
        
        // 2. Insert new tasks (including is_completed)
        ...flatRecords.map(rec => {
            // Convert JS boolean/null to SQL integer (1/0)
            const completedVal = (rec.is_completed === true || rec.is_completed === 1) ? 1 : 0;
            
            return env.DB.prepare(
              'INSERT INTO gantt_tasks (id, parent_id, title, start, end, progress, sub, avatar, store_id, is_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(
              rec.id, 
              rec.parent_id, 
              rec.title, 
              rec.start, 
              rec.end, 
              rec.progress, 
              rec.sub || null, 
              rec.avatar, 
              storeId,
              completedVal // Ensure this is inserted
            );
        })
      ];
      
      await env.DB.batch(statements);

      return jsonResponse({ success: true, count: flatRecords.length });

    } catch (e) {
      console.error('Error saving tasks to D1:', e);
      return jsonResponse({ error: 'Failed to save.', details: e.message }, 500);
    }
  }

  // Route: GET /api/data/:storeId
  if (request.method === 'GET' && pathSegments[0] === 'data' && pathSegments[1]) {
    const storeId = pathSegments[1];
    try {
      if (!env.DB) throw new Error("D1 binding not found");

      const [tasksResult, marklinesResult] = await env.DB.batch([
          env.DB.prepare('SELECT * FROM gantt_tasks WHERE store_id = ? ORDER BY start').bind(storeId),
          env.DB.prepare('SELECT * FROM gantt_marklines WHERE store_id = ?').bind(storeId)
      ]);

      const tasks = tasksResult.results || [];
      const marklines = (marklinesResult.results || []).map(line => ({
        ...line,
        style: JSON.parse(line.style || '{}'),
        contentStyle: JSON.parse(line.contentStyle || '{}'),
      }));
      
      // Build Tree
      const taskMap = new Map(tasks.map(t => [String(t.id), { ...t, children: [] }]));
      const tree = [];

      tasks.forEach(task => {
        const pId = task.parent_id ? String(task.parent_id) : null;
        if (pId && taskMap.has(pId)) {
          taskMap.get(pId).children.push(taskMap.get(String(task.id)));
        } else {
          tree.push(taskMap.get(String(task.id)));
        }
      });

      // Cleanup empty children
      const cleanTree = (nodes) => {
        return nodes.map(node => {
          if (node.children && node.children.length > 0) {
            node.children = cleanTree(node.children);
          } else {
            delete node.children;
          }
          return node;
        });
      };

      return jsonResponse({ records: cleanTree(tree), markLines: marklines });
    } catch (e) {
      return jsonResponse({ error: 'Failed to fetch data.', details: e.message }, 500);
    }
  }

  // Route: POST /api/task/add
  if (request.method === 'POST' && pathSegments[0] === 'task' && pathSegments[1] === 'add') {
    try {
      const { task, storeId } = await request.json();
      if (!task || !storeId) return jsonResponse({ error: 'Invalid data' }, 400);

      const newId = crypto.randomUUID();
      const newTask = {
        id: newId,
        title: task.title || '新任务',
        start: task.start,
        end: task.end,
        progress: task.progress || 0,
        avatar: task.avatar || '',
        store_id: storeId,
        parent_id: task.parent_id || null,
        is_completed: 0
      };

      await env.DB.prepare(
        'INSERT INTO gantt_tasks (id, title, start, end, progress, avatar, store_id, parent_id, is_completed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        newTask.id, newTask.title, newTask.start, newTask.end, newTask.progress, 
        newTask.avatar, newTask.store_id, newTask.parent_id, newTask.is_completed
      ).run();

      return jsonResponse({ success: true, task: newTask });
    } catch (e) {
      return jsonResponse({ error: 'Failed to add task.', details: e.message }, 500);
    }
  }

  // Route: DELETE /api/task/:taskId/:storeId
  if (request.method === 'DELETE' && pathSegments[0] === 'task' && pathSegments[1]) {
    try {
      const taskId = pathSegments[1];
      const storeId = pathSegments[2];
      await env.DB.prepare('DELETE FROM gantt_tasks WHERE id = ? AND store_id = ?').bind(taskId, storeId).run();
      return jsonResponse({ success: true });
    } catch (e) {
      return jsonResponse({ error: 'Failed to delete.', details: e.message }, 500);
    }
  }
  
  // Route: PATCH /api/task/:taskId
  if (request.method === 'PATCH' && pathSegments[0] === 'task' && pathSegments[1]) {
    try {
      const taskId = pathSegments[1];
      const { changedData, storeId } = await request.json();
      const fields = Object.keys(changedData);
      const values = Object.values(changedData);
      const setClause = fields.map(field => `${field} = ?`).join(', ');

      await env.DB.prepare(`UPDATE gantt_tasks SET ${setClause} WHERE id = ? AND store_id = ?`)
        .bind(...values, taskId, storeId).run();
      return jsonResponse({ success: true });
    } catch (e) {
      return jsonResponse({ error: 'Failed to update.', details: e.message }, 500);
    }
  }

  // Route: POST /api/markline
  if (request.method === 'POST' && pathSegments[0] === 'markline') {
    try {
        const { date, content, style, contentStyle, store_id } = await request.json();
        const stmt = env.DB.prepare(
            'INSERT INTO gantt_marklines (date, content, style, contentStyle, store_id) VALUES (?, ?, ?, ?, ?) ' +
            'ON CONFLICT(date, store_id) DO UPDATE SET content=excluded.content, style=excluded.style, contentStyle=excluded.contentStyle'
        );
        await stmt.bind(date, content, JSON.stringify(style||{}), JSON.stringify(contentStyle||{}), store_id).run();
        return jsonResponse({ success: true });
    } catch (e) {
      return jsonResponse({ error: 'Failed to update markline.', details: e.message }, 500);
    }
  }

  return new Response('Not Found', { status: 404 });
}
