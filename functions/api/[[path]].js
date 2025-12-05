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
  // Saves all tasks in bulk for a specific store, overwriting existing data for that store.
  if (request.method === 'POST' && pathSegments[0] === 'tasks') {
    try {
      const { records, storeId } = await request.json();
      if (!Array.isArray(records) || !storeId) {
        return jsonResponse({ error: 'Invalid data format, expected { records: [], storeId: "..." }' }, 400);
      }

      // Helper to flatten the nested records into a list, assigning parent_id
      const flattenRecords = (records, parentId = null) => {
        let flatList = [];
        records.forEach(rec => {
          const { children, ...rest } = rec;
          flatList.push({ ...rest, parent_id: parentId });
          if (children && children.length > 0) {
            flatList = flatList.concat(flattenRecords(children, rec.id));
          }
        });
        return flatList;
      };

      const flatRecords = flattenRecords(records);

      const statements = [
        // 1. Delete all existing tasks for the given storeId
        env.DB.prepare('DELETE FROM gantt_tasks WHERE store_id = ?').bind(storeId),
        // 2. Prepare insert statements for all new tasks
        ...flatRecords.map(rec => env.DB.prepare(
          'INSERT INTO gantt_tasks (id, parent_id, title, start, end, progress, avatar, store_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(rec.id, rec.parent_id, rec.title, rec.start, rec.end, rec.progress, rec.avatar, storeId))
      ];
      
      // Execute all statements in a single transaction
      await env.DB.batch(statements);

      return jsonResponse({ success: true, message: `Successfully saved ${flatRecords.length} tasks for store ${storeId}.` });

    } catch (e) {
      console.error('Error saving tasks to D1:', e);
      return jsonResponse({
        error: 'Failed to save tasks to D1.',
        details: e.message,
        stack: e.stack,
      }, 500);
    }
  }

  // Route: GET /api/data/:storeId
  // Fetches initial records and marklines for a specific store
  if (request.method === 'GET' && pathSegments[0] === 'data' && pathSegments[1]) {
    const storeId = pathSegments[1];
    try {
      console.log(`Attempting to fetch data from D1 for store_id: ${storeId}...`);
      if (!env.DB) {
          throw new Error("D1 database binding 'DB' not found. Check wrangler.toml.");
      }

      const tasksStmt = env.DB.prepare('SELECT * FROM gantt_tasks WHERE store_id = ? ORDER BY start').bind(storeId);
      const marklinesStmt = env.DB.prepare('SELECT * FROM gantt_marklines WHERE store_id = ?').bind(storeId);
      console.log("Statements prepared. Executing batch...");

      const [tasksResult, marklinesResult] = await env.DB.batch([tasksStmt, marklinesStmt]);
      console.log("D1 batch execution complete.");
      console.log(`Found ${tasksResult.results.length} tasks and ${marklinesResult.results.length} marklines for store ${storeId}.`);

      const tasks = tasksResult.results || [];
      const marklines = (marklinesResult.results || []).map(line => ({
        ...line,
        style: JSON.parse(line.style || '{}'),
        contentStyle: JSON.parse(line.contentStyle || '{}'),
      }));
      
      // ----------------- 修改开始 -----------------
      // 1. 强制将 ID 转为 String 作为 Map 的 Key，防止数据库返回 Number 导致匹配失败
      const taskMap = new Map(tasks.map(t => [String(t.id), { ...t, children: [] }]));
      const tree = [];

      tasks.forEach(task => {
        // 2. 获取 parent_id 并转为 String (如果是 null/undefined 则保持 null)
        const pId = task.parent_id ? String(task.parent_id) : null;

        // 3. 严格检查 parent_id 是否存在于 map 中
        if (pId && taskMap.has(pId)) {
          const parent = taskMap.get(pId);
          // 确保 children 数组存在
          if (!parent.children) {
            parent.children = [];
          }
          // 将当前节点加入父节点的 children
          parent.children.push(taskMap.get(String(task.id)));
        } else {
          // 没有父节点，或者父节点ID找不到，归为根节点
          tree.push(taskMap.get(String(task.id)));
        }
      });
      // ----------------- 修改结束 -----------------

      // Clean up empty children arrays to avoid rendering expander icons for leaf nodes
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

      return jsonResponse({
        records: cleanTree(tree),
        markLines: marklines,
      });
    } catch (e) {
      console.error('--- FATAL D1 ERROR ---');
      console.error('Error fetching data from D1:', e);
      console.error('Error Name:', e.name);
      console.error('Error Message:', e.message);
      console.error('Error Cause:', e.cause);
      console.error('--- END FATAL D1 ERROR ---');
      return jsonResponse({
        error: 'Failed to fetch data from D1. See server logs for details.',
        details: {
          name: e.name,
          message: e.message,
          cause: e.cause,
        },
      }, 500);
    }
  }

  // Route: POST /api/task/add
  // Adds a new task for a specific store
  if (request.method === 'POST' && pathSegments[0] === 'task' && pathSegments[1] === 'add') {
    try {
      const { task, storeId } = await request.json();
      if (!task || !storeId) {
        return jsonResponse({ error: 'Invalid data format, expected { task: {}, storeId: "..." }' }, 400);
      }

      // Generate a unique ID for the new task
      const newId = crypto.randomUUID();
      const newTask = {
        id: newId,
        title: task.title || '新任务',
        start: task.start,
        end: task.end,
        progress: task.progress || 0,
        avatar: task.avatar || 'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/VTable/custom-render/question.jpeg',
        store_id: storeId,
        parent_id: task.parent_id || null // New tasks are root tasks by default
      };

      const stmt = env.DB.prepare(
        'INSERT INTO gantt_tasks (id, title, start, end, progress, avatar, store_id, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      );
      await stmt.bind(newTask.id, newTask.title, newTask.start, newTask.end, newTask.progress, newTask.avatar, newTask.store_id, newTask.parent_id).run();

      return jsonResponse({ success: true, task: newTask });

    } catch (e) {
      console.error('Error adding task to D1:', e);
      return jsonResponse({ error: 'Failed to add task.', details: e.message }, 500);
    }
  }

  // Route: DELETE /api/task/:taskId/:storeId
  // Deletes a single task
  if (request.method === 'DELETE' && pathSegments[0] === 'task' && pathSegments[1] && pathSegments[2]) {
    try {
      const taskId = pathSegments[1];
      const storeId = pathSegments[2];
      
      const stmt = env.DB.prepare('DELETE FROM gantt_tasks WHERE id = ? AND store_id = ?');
      const result = await stmt.bind(taskId, storeId).run();

      if (result.changes > 0) {
        return jsonResponse({ success: true, message: `Task ${taskId} deleted.` });
      } else {
        return jsonResponse({ success: false, message: 'Task not found or not deleted.' }, 404);
      }

    } catch (e) {
      console.error('Error deleting task from D1:', e);
      return jsonResponse({ error: 'Failed to delete task.', details: e.message }, 500);
    }
  }
  
  // Route: PATCH /api/task/:taskId
  // Updates a single task for a specific store
  if (request.method === 'PATCH' && pathSegments[0] === 'task' && pathSegments[1]) {
    try {
      const taskId = pathSegments[1];
      const { changedData, storeId } = await request.json();
      if (!changedData || !storeId) {
        return jsonResponse({ error: 'Missing changedData or storeId' }, 400);
      }

      const fields = Object.keys(changedData);
      const values = Object.values(changedData);
      const setClause = fields.map(field => `${field} = ?`).join(', ');

      const stmt = env.DB.prepare(`UPDATE gantt_tasks SET ${setClause} WHERE id = ? AND store_id = ?`);
      await stmt.bind(...values, taskId, storeId).run();

      return jsonResponse({ success: true });
    } catch (e) {
      console.error('Error updating task:', e);
      return jsonResponse({ error: 'Failed to update task.', details: e.message }, 500);
    }
  }

  // Route: POST /api/markline
  // Creates or updates a markline for a specific store (UPSERT)
  if (request.method === 'POST' && pathSegments[0] === 'markline') {
    try {
        const markline = await request.json();
        if (!markline || !markline.date || !markline.store_id) {
            return jsonResponse({ error: 'Invalid markline data, missing date or store_id' }, 400);
        }

        const { date, content, style, contentStyle, store_id } = markline;

        // Use UPSERT logic: insert, or on conflict (date and store_id exists), update.
        const stmt = env.DB.prepare(
            'INSERT INTO gantt_marklines (date, content, style, contentStyle, store_id) VALUES (?, ?, ?, ?, ?) ' +
            'ON CONFLICT(date, store_id) DO UPDATE SET content=excluded.content, style=excluded.style, contentStyle=excluded.contentStyle'
        );
        
        // Stringify style objects for storage
        await stmt.bind(
            date,
            content,
            JSON.stringify(style || {}),
            JSON.stringify(contentStyle || {}),
            store_id
        ).run();

        return jsonResponse({ success: true });
    } catch (e) {
      console.error('Error creating/updating markline:', e);
      return jsonResponse({
        error: 'Failed to create/update markline.',
        details: e.message,
        stack: e.stack,
      }, 500);
    }
  }



  // Route: POST /api/upload
  // Handles file uploads to R2
  if (request.method === 'POST' && pathSegments[0] === 'upload') {
    try {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file) {
        return jsonResponse({ error: 'No file uploaded.' }, 400);
      }
      
      // Generate a unique key for the file in R2
      const fileKey = `${Date.now()}-${file.name}`;
      
      await env.R2.put(fileKey, file.stream(), {
        httpMetadata: { contentType: file.type },
      });

      return jsonResponse({ success: true, key: fileKey, name: file.name, type: file.type });

    } catch (e) {
      console.error('Error uploading to R2:', e);
      return jsonResponse({ error: 'Failed to upload file.', details: e.message }, 500);
    }
  }

  // Route: DELETE /api/file/:key
  // Deletes a file from R2
  if (request.method === 'DELETE' && pathSegments[0] === 'file' && pathSegments[1]) {
    try {
      const fileKey = pathSegments.slice(1).join('/'); // Handle keys with slashes
      await env.R2.delete(fileKey);
      return jsonResponse({ success: true, message: `File ${fileKey} deleted.` });
    } catch (e) {
      console.error('Error deleting file from R2:', e);
      return jsonResponse({ error: 'Failed to delete file.', details: e.message }, 500);
    }
  }

  // Route: POST /api/rename-file
  // Renames a file in R2 (copy then delete)
  if (request.method === 'POST' && pathSegments[0] === 'rename-file') {
    try {
      const { oldKey, newKey } = await request.json();
      if (!oldKey || !newKey) {
        return jsonResponse({ error: 'oldKey and newKey are required.' }, 400);
      }

      // Copy the object to the new key
      const object = await env.R2.get(oldKey);
      if (object === null) {
         return jsonResponse({ error: 'Old key does not exist.' }, 404);
      }
      await env.R2.put(newKey, object.body, {
          httpMetadata: object.httpMetadata,
      });

      // Delete the old object
      await env.R2.delete(oldKey);

      return jsonResponse({ success: true, message: `Renamed ${oldKey} to ${newKey}` });
    } catch (e) {
      console.error('Error renaming file in R2:', e);
      return jsonResponse({ error: 'Failed to rename file.', details: e.message }, 500);
    }
  }
  
  // Route: POST /api/store-detail/:id
  // Updates a single store detail entry
  if (request.method === 'POST' && pathSegments[0] === 'store-detail' && pathSegments[1]) {
    try {
      const storeId = pathSegments[1];
      const data = await request.json();

      // We can't update the primary key, so remove it if it exists.
      delete data.store_id;
      delete data.key;

      const fields = Object.keys(data);
      const values = Object.values(data);
      
      if (fields.length === 0) {
        return jsonResponse({ error: 'No fields to update' }, 400);
      }

      // Special handling for related_documents to ensure it's a string
      const docIndex = fields.indexOf('related_documents');
      if (docIndex > -1 && typeof values[docIndex] !== 'string') {
        values[docIndex] = JSON.stringify(values[docIndex]);
      }

      const setClause = fields.map(field => `${field} = ?`).join(', ');

      const stmt = env.DB.prepare(`UPDATE store_details SET ${setClause} WHERE store_id = ?`);
      await stmt.bind(...values, storeId).run();

      return jsonResponse({ success: true });
    } catch (e)
     {
      console.error('Error updating store detail:', e);
      return jsonResponse({
        error: 'Failed to update store detail.',
        details: e.message,
        stack: e.stack,
      }, 500);
    }
  }

  // Route: POST /api/amap/geocode
  // Proxies geocoding requests to AMap to hide origin and key.
  if (request.method === 'POST' && pathSegments[0] === 'amap' && pathSegments[1] === 'geocode') {
    try {
      const { address } = await request.json();
      if (!address) {
        return jsonResponse({ error: 'Address is required.' }, 400);
      }
      const apiKey = env.AMAP_KEY;
      if (!apiKey) {
        return jsonResponse({ error: 'AMAP_KEY not configured on server.' }, 500);
      }
      
      const amapUrl = `https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(address)}`;
      const amapResponse = await fetch(amapUrl);
      const amapData = await amapResponse.json();
      
      return jsonResponse(amapData);

    } catch (e) {
      return jsonResponse({ error: 'Failed to proxy geocode request.', details: e.message }, 500);
    }
  }

  // Route: POST /api/amap/around
  // Proxies place around search requests to AMap.
  if (request.method === 'POST' && pathSegments[0] === 'amap' && pathSegments[1] === 'around') {
    try {
      const { location, radius, keywords, types } = await request.json();
       if (!location) {
        return jsonResponse({ error: 'Location is required.' }, 400);
      }
      const apiKey = env.AMAP_KEY;
       if (!apiKey) {
        return jsonResponse({ error: 'AMAP_KEY not configured on server.' }, 500);
      }

      const params = new URLSearchParams({
        key: apiKey,
        location,
        radius: radius || 800,
        offset: 20,
        page: 1
      });
      // Only add these if they exist to avoid empty params
      if (keywords) params.append('keywords', keywords);
      if (types) params.append('types', types);
      if (types === '050000') params.append('show_fields', 'business'); // only for food search

      const amapUrl = `https://restapi.amap.com/v3/place/around?${params.toString()}`;
      const amapResponse = await fetch(amapUrl);
      const amapData = await amapResponse.json();

      return jsonResponse(amapData);

    } catch(e) {
      return jsonResponse({ error: 'Failed to proxy place search request.', details: e.message }, 500);
    }
  }

  // Route: GET /api/portrait/:storeId
  // Fetches cached portrait analysis for a specific store
  if (request.method === 'GET' && pathSegments[0] === 'portrait' && pathSegments[1]) {
    const storeId = pathSegments[1];
    try {
      const stmt = env.DB.prepare(
        'SELECT portrait_score, portrait_rating, portrait_recommendation, portrait_details FROM store_details WHERE store_id = ?'
      ).bind(storeId);
      const data = await stmt.first();

      if (data && data.portrait_score !== null) {
        // If data exists and is valid, return it.
        return jsonResponse({
            ...data,
            // Ensure details are parsed from JSON string if stored as TEXT
            portrait_details: typeof data.portrait_details === 'string' ? JSON.parse(data.portrait_details) : data.portrait_details
        });
      } else {
        // No cached data found
        return jsonResponse({ message: "No cached portrait data found." }, 404);
      }
    } catch (e) {
      console.error('Error fetching portrait data:', e);
      return jsonResponse({ error: 'Failed to fetch portrait data.', details: e.message }, 500);
    }
  }

  // Route: POST /api/portrait/:storeId
  // Saves new portrait analysis data to the database for a specific store
  if (request.method === 'POST' && pathSegments[0] === 'portrait' && pathSegments[1]) {
    const storeId = pathSegments[1];
    try {
      const { portrait_score, portrait_rating, portrait_recommendation, portrait_details } = await request.json();

      if (portrait_score === undefined || !portrait_rating || !portrait_recommendation || !portrait_details) {
        return jsonResponse({ error: 'Missing required portrait data fields.' }, 400);
      }

      const stmt = env.DB.prepare(
        'UPDATE store_details SET portrait_score = ?, portrait_rating = ?, portrait_recommendation = ?, portrait_details = ? WHERE store_id = ?'
      );
      
      await stmt.bind(
        portrait_score,
        portrait_rating,
        portrait_recommendation,
        JSON.stringify(portrait_details), // Always stringify JSON for storage
        storeId
      ).run();

      return jsonResponse({ success: true, message: 'Portrait data saved.' });
    } catch (e) {
      console.error('Error saving portrait data:', e);
      return jsonResponse({ error: 'Failed to save portrait data.', details: e.message }, 500);
    }
  }


  // Route: GET /api/store-details
  // Fetches store details from the database
  if (request.method === 'GET' && pathSegments[0] === 'store-details') {
    try {
      console.log("Attempting to fetch store details from D1...");
      if (!env.DB) {
        throw new Error("D1 database binding 'DB' not found. Check wrangler.toml.");
      }

      console.log("Preparing D1 statement for store_details...");
      const storeDetailsStmt = env.DB.prepare('SELECT * FROM store_details ORDER BY sort_order');
      console.log("Statement prepared. Executing query...");
      
      const storeDetailsResult = await storeDetailsStmt.all();
      console.log("D1 query execution complete.");
      console.log(`Found ${storeDetailsResult.results.length} store details.`);

      return jsonResponse({
        storeDetails: storeDetailsResult.results,
      });
    } catch (e) {
      console.error('--- FATAL D1 ERROR ---');
      console.error('Error fetching store details from D1:', e);
      console.error('Error Name:', e.name);
      console.error('Error Message:', e.message);
      console.error('Error Cause:', e.cause);
      console.error('--- END FATAL D1 ERROR ---');
      return jsonResponse({
        error: 'Failed to fetch store details from D1. See server logs for details.',
        details: {
          name: e.name,
          message: e.message,
          cause: e.cause,
        },
      }, 500);
    }
  }

  return new Response('Not Found', { status: 404 });
}
