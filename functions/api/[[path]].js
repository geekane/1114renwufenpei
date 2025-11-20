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

      const statements = [
        // 1. Delete all existing tasks for the given storeId
        env.DB.prepare('DELETE FROM gantt_tasks WHERE store_id = ?').bind(storeId),
        // 2. Prepare insert statements for all new tasks
        ...records.map(rec => env.DB.prepare(
          'INSERT INTO gantt_tasks (id, title, start, end, progress, avatar, store_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(rec.id, rec.title, rec.start, rec.end, rec.progress, rec.avatar, storeId))
      ];
      
      // Execute all statements in a single transaction
      await env.DB.batch(statements);

      return jsonResponse({ success: true, message: `Successfully saved ${records.length} tasks for store ${storeId}.` });

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

      const tasksStmt = env.DB.prepare('SELECT * FROM gantt_tasks WHERE store_id = ?').bind(storeId);
      const marklinesStmt = env.DB.prepare('SELECT * FROM gantt_marklines WHERE store_id = ?').bind(storeId);
      console.log("Statements prepared. Executing batch...");

      const [tasksResult, marklinesResult] = await env.DB.batch([tasksStmt, marklinesStmt]);
      console.log("D1 batch execution complete.");
      console.log(`Found ${tasksResult.results.length} tasks and ${marklinesResult.results.length} marklines for store ${storeId}.`);

      // Parse JSON strings back into objects for the frontend
      const marklines = marklinesResult.results.map(line => ({
        ...line,
        style: JSON.parse(line.style || '{}'),
        contentStyle: JSON.parse(line.contentStyle || '{}'),
      }));

      return jsonResponse({
        records: tasksResult.results,
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

  // Route: POST /api/task
  // Updates a single task for a specific store
  if (request.method === 'POST' && pathSegments[0] === 'task') {
    try {
      const { id, changedData, storeId } = await request.json();
      if (!id || !changedData || !storeId) {
        return jsonResponse({ error: 'Missing id, changedData, or storeId' }, 400);
      }

      // Build the SET part of the SQL query dynamically
      const fields = Object.keys(changedData);
      const values = Object.values(changedData);
      const setClause = fields.map(field => `${field} = ?`).join(', ');

      const stmt = env.DB.prepare(`UPDATE gantt_tasks SET ${setClause} WHERE id = ? AND store_id = ?`);
      await stmt.bind(...values, id, storeId).run();

      return jsonResponse({ success: true });
    } catch (e) {
      console.error('Error updating task:', e);
      return jsonResponse({
        error: 'Failed to update task.',
        details: e.message,
        stack: e.stack,
      }, 500);
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
