import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Resolves the application workspace directory on the local filesystem.
 * Path: ~/.formai/apps/{appId}/workspace
 */
export function getAppWorkspaceDir(appId: string | number): string {
  return path.join(os.homedir(), '.formai', 'apps', String(appId), 'workspace');
}

/**
 * Exports all database records of the application into local workspace files.
 * This guarantees Codex can read them and knows the complete global state.
 */
export async function exportAppToWorkspace(db: any, app: any): Promise<string> {
  const workspaceDir = getAppWorkspaceDir(app.id);
  await fs.mkdir(workspaceDir, { recursive: true });

  console.log(`[Workspace Sync] Exporting application "${app.title}" (ID: ${app.id}) to ${workspaceDir}`);

  // 1. Export blueprint.md
  await fs.writeFile(path.join(workspaceDir, 'blueprint.md'), app.blueprint || '', 'utf8');

  // 2. Export collections.json
  const collections = await db.getRepository('collections').find({ filter: { appId: app.name } });
  const collectionNames = collections.map((c: any) => c.name);
  
  let fields: any[] = [];
  if (collectionNames.length > 0) {
    fields = await db.getRepository('fields').find({
      filter: { collectionName: { $in: collectionNames } }
    });
  }

  const collectionsData = collections.map((c: any) => {
    const colFields = fields.filter((f: any) => f.collectionName === c.name);
    return {
      name: c.name,
      title: c.title,
      options: c.options || {},
      fields: colFields.map((f: any) => ({
        name: f.name,
        type: f.type,
        title: f.options?.title || f.name,
        allowNull: f.allowNull,
        unique: f.unique,
        defaultValue: f.defaultValue,
        options: f.options || {},
      })),
    };
  });
  await fs.writeFile(
    path.join(workspaceDir, 'collections.json'),
    JSON.stringify(collectionsData, null, 2),
    'utf8'
  );

  // 3. Export pages.json
  const uiSchemas = await db.getRepository('uiSchemas').find({ filter: { appId: app.name } });
  const pagesData = uiSchemas.map((s: any) => ({
    uid: s.uid,
    title: s.title,
    schema: s.schema || {},
  }));
  await fs.writeFile(
    path.join(workspaceDir, 'pages.json'),
    JSON.stringify(pagesData, null, 2),
    'utf8'
  );

  // 4. Export workflows.json
  const workflows = await db.getRepository('workflows').find({ filter: { appId: app.id } });
  const workflowsData = workflows.map((w: any) => ({
    title: w.title,
    description: w.description,
    enabled: w.enabled,
    triggerType: w.triggerType,
    config: w.config || {},
  }));
  await fs.writeFile(
    path.join(workspaceDir, 'workflows.json'),
    JSON.stringify(workflowsData, null, 2),
    'utf8'
  );

  // 5. Export menus.json
  const menus = await db.getRepository('appMenus').find({ filter: { appId: app.id } });
  const menusData = menus.map((m: any) => ({
    title: m.title,
    icon: m.icon,
    type: m.type,
    route: m.route,
    options: m.options || {},
  }));
  await fs.writeFile(
    path.join(workspaceDir, 'menus.json'),
    JSON.stringify(menusData, null, 2),
    'utf8'
  );

  console.log(`[Workspace Sync] Export completed successfully for "${app.title}".`);
  return workspaceDir;
}
