import { autoGenerateAppModules } from './apps';

export class CompilerWorker {
  private app: any;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(app: any) {
    this.app = app;
  }

  start() {
    if (this.intervalId) return;
    
    // Async stuck task cleanup on startup to release queue locks from previous sessions
    (async () => {
      try {
        const db = this.app.db;
        const taskRepo = db.getRepository('compilationTasks');
        if (taskRepo) {
          const stuckTasks = await taskRepo.find({ filter: { status: 'processing' } });
          if (stuckTasks.length > 0) {
            console.log(`[Compiler Worker] Found ${stuckTasks.length} stuck processing tasks on startup. Resetting to failed...`);
            for (const task of stuckTasks) {
              const logs = Array.isArray(task.logs) ? task.logs : [];
              logs.push(`[${new Date().toLocaleTimeString()}] ❌ Task interrupted due to server restart/shutdown.`);
              await taskRepo.update({
                filter: { id: task.id },
                values: {
                  status: 'failed',
                  error: 'Task interrupted due to server restart/shutdown.',
                  logs,
                  finishedAt: new Date(),
                }
              });
            }
          }
        }
      } catch (err: any) {
        console.error('[Compiler Worker] Failed to reset stuck tasks on startup:', err.message);
      }
    })();

    // Poll the compilation task queue every 2 seconds
    this.intervalId = setInterval(async () => {
      await this.pollAndExecute();
    }, 2000);
    
    console.log('[Compiler Worker] Background compilation queue worker started.');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[Compiler Worker] Background compilation queue worker stopped.');
  }

  private async pollAndExecute() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const db = this.app.db;
    let taskId: number | null = null;

    try {
      const isSQLite = db.sequelize.getDialect() === 'sqlite';

      if (isSQLite) {
        // SQLite fallback: simple SELECT (SQLite only supports single writer)
        const [results]: any = await db.sequelize.query(
          `SELECT id FROM compilation_tasks WHERE status = 'pending' ORDER BY id ASC LIMIT 1`
        );
        if (results && results.length > 0) {
          taskId = results[0].id;
        }
      } else {
        // PostgreSQL / MySQL: robust SKIP LOCKED
        try {
          const [results]: any = await db.sequelize.query(
            `SELECT id FROM compilation_tasks WHERE status = 'pending' ORDER BY id ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
          );
          if (results && results.length > 0) {
            taskId = results[0].id;
          }
        } catch (err: any) {
          // Fallback if SELECT FOR UPDATE fails
          const [results]: any = await db.sequelize.query(
            `SELECT id FROM compilation_tasks WHERE status = 'pending' ORDER BY id ASC LIMIT 1`
          );
          if (results && results.length > 0) {
            taskId = results[0].id;
          }
        }
      }

      if (!taskId) {
        this.isProcessing = false;
        return;
      }

      console.log(`[Compiler Worker] Found pending compilation task ID: ${taskId}. Locking and processing...`);

      // Update task to processing and record startedAt
      await db.sequelize.query(
        `UPDATE compilation_tasks SET status = 'processing', "startedAt" = NOW() WHERE id = :taskId`,
        { replacements: { taskId } }
      );

      // Fetch task details
      const tasksRepo = db.getRepository('compilationTasks');
      const taskRecord = await tasksRepo.findOne({ filter: { id: taskId } });

      if (!taskRecord) {
        throw new Error(`Task record with ID ${taskId} not found after locking.`);
      }

      // Fetch the app record to construct correct context
      const appsRepo = db.getRepository('apps');
      const appRecord = await appsRepo.findOne({ filter: { id: taskRecord.appId } });

      if (!appRecord) {
        throw new Error(`Application ID ${taskRecord.appId} associated with task ${taskId} not found.`);
      }

      // Logger helper to write dynamic logs directly to DB task record
      const appendLog = async (msg: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const formattedMsg = `[${timestamp}] ${msg}`;
        console.log(`[Compiler Worker Log - Task ${taskId}] ${formattedMsg}`);
        
        try {
          // Fetch current logs, append new log and save
          const latestTask = await tasksRepo.findOne({ filter: { id: taskId } });
          if (latestTask) {
            const logs = Array.isArray(latestTask.logs) ? latestTask.logs : [];
            logs.push(formattedMsg);
            await tasksRepo.update({
              filter: { id: taskId },
              values: { logs }
            });
          }
        } catch (dbErr: any) {
          console.error('[Compiler Worker] Failed to write task log:', dbErr.message);
        }
      };

      await appendLog(`🚀 Initializing application compiler for "${appRecord.title}"...`);

      // Setup custom context for compilation log interception
      const compilerCtx = {
        app: this.app,
        onCompilationLog: appendLog,
        taskId: taskId,
      } as any;

      // Execute auto-generation
      await autoGenerateAppModules(compilerCtx, appRecord, taskRecord.blueprint);

      // Mark completed
      await appendLog(`🎉 Application "${appRecord.title}" compiled successfully!`);
      await tasksRepo.update({
        filter: { id: taskId },
        values: {
          status: 'completed',
          finishedAt: new Date(),
        }
      });

      console.log(`[Compiler Worker] Task ${taskId} completed successfully.`);
    } catch (err: any) {
      console.error(`[Compiler Worker] Task failed:`, err.message);
      
      if (taskId) {
        try {
          const tasksRepo = db.getRepository('compilationTasks');
          const latestTask = await tasksRepo.findOne({ filter: { id: taskId } });
          const logs = latestTask && Array.isArray(latestTask.logs) ? latestTask.logs : [];
          logs.push(`❌ Error: ${err.message}`);
          
          await tasksRepo.update({
            filter: { id: taskId },
            values: {
              status: 'failed',
              error: err.message,
              logs,
              finishedAt: new Date(),
            }
          });
        } catch (updateErr: any) {
          console.error('[Compiler Worker] Failed to update failed task status:', updateErr.message);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
