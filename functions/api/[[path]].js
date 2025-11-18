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
  // Saves all tasks in bulk, overwriting existing data.
  if (request.method === 'POST' && pathSegments[0] === 'tasks') {
    try {
      const { records } = await request.json();
      if (!Array.isArray(records)) {
        return jsonResponse({ error: 'Invalid data format, expected { records: [] }' }, 400);
      }

      const statements = [
        // 1. Delete all existing tasks
        env.DB.prepare('DELETE FROM gantt_tasks'),
        // 2. Prepare insert statements for all new tasks
        ...records.map(rec => env.DB.prepare(
          'INSERT INTO gantt_tasks (id, title, start, end, progress, sub, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(rec.id, rec.title, rec.start, rec.end, rec.progress, rec.sub, rec.avatar))
      ];
      
      // Execute all statements in a single transaction
      await env.DB.batch(statements);

      return jsonResponse({ success: true, message: `Successfully saved ${records.length} tasks.` });

    } catch (e) {
      console.error('Error saving tasks to D1:', e);
      return jsonResponse({
        error: 'Failed to save tasks to D1.',
        details: e.message,
        stack: e.stack,
      }, 500);
    }
  }

  // Route: GET /api/data
  // Fetches initial records and marklines
  if (request.method === 'GET' && pathSegments[0] === 'data') {
    try {
      console.log("Attempting to fetch data from D1...");
      if (!env.DB) {
          throw new Error("D1 database binding 'DB' not found. Check wrangler.toml.");
      }

      console.log("Preparing D1 statements for gantt_tasks and gantt_marklines...");
      const tasksStmt = env.DB.prepare('SELECT * FROM gantt_tasks');
      const marklinesStmt = env.DB.prepare('SELECT * FROM gantt_marklines');
      console.log("Statements prepared. Executing batch...");

      const [tasksResult, marklinesResult] = await env.DB.batch([tasksStmt, marklinesStmt]);
      console.log("D1 batch execution complete.");
      console.log(`Found ${tasksResult.results.length} tasks and ${marklinesResult.results.length} marklines.`);

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
  // Updates a single task
  if (request.method === 'POST' && pathSegments[0] === 'task') {
    try {
      const { id, changedData } = await request.json();
      if (!id || !changedData) {
        return jsonResponse({ error: 'Missing id or changedData' }, 400);
      }

      // Build the SET part of the SQL query dynamically
      const fields = Object.keys(changedData);
      const values = Object.values(changedData);
      const setClause = fields.map(field => `${field} = ?`).join(', ');

      const stmt = env.DB.prepare(`UPDATE gantt_tasks SET ${setClause} WHERE id = ?`);
      await stmt.bind(...values, id).run();

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
  // Creates or updates a markline (UPSERT)
  if (request.method === 'POST' && pathSegments[0] === 'markline') {
    try {
        const markline = await request.json();
        if (!markline || !markline.date) {
            return jsonResponse({ error: 'Invalid markline data' }, 400);
        }

        const { date, content, style, contentStyle } = markline;

        // Use UPSERT logic: insert, or on conflict (date exists), update.
        const stmt = env.DB.prepare(
            'INSERT INTO gantt_marklines (date, content, style, contentStyle) VALUES (?, ?, ?, ?) ' +
            'ON CONFLICT(date) DO UPDATE SET content=excluded.content, style=excluded.style, contentStyle=excluded.contentStyle'
        );
        
        // Stringify style objects for storage
        await stmt.bind(
            date, 
            content, 
            JSON.stringify(style || {}), 
            JSON.stringify(contentStyle || {})
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
