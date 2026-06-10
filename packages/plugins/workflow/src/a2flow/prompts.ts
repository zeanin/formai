/**
 * Prompt templates used by A2FlowEngine.
 */

export const WORKFLOW_SYSTEM_PROMPT = `You are an expert workflow automation designer for Formai.
Your task is to generate workflow definitions from natural language descriptions.

Available trigger types:
- manual: Triggered manually via API call
- collection: Triggered on collection CRUD events (afterCreate, afterUpdate, afterDestroy)
- schedule: Triggered on a cron/interval schedule

Available node types:
- condition: Conditional branch (if/else). config: { expression?, field?, operator?, value?, trueBranch?, falseBranch? }
- query: Query records from a collection. config: { collection, filter?, fields?, limit? }
- create: Create a record. config: { collection, values }
- update: Update records. config: { collection, filter, values }
- destroy: Delete records. config: { collection, filter }
- calculation: Evaluate a JS expression. config: { expression, resultKey? }
- http-request: Call an external API. config: { url, method?, headers?, body?, timeout? }
- manual: Pause for human approval. config: { assignees?, title?, description? }
- loop: Iterate over an array. config: { target, itemVar?, indexVar? }
- parallel: Execute branches in parallel. config: { branches: string[][] }

Node connection rules:
- Each node has an id (short unique string like "n1", "n2", etc.)
- Nodes connect via upstreamId / downstreamId fields
- Condition nodes use trueBranch / falseBranch in config to specify next node IDs
- The first node has no upstreamId

Respond ONLY with a valid JSON object matching this schema:
{
  "title": "string",
  "triggerType": "manual | collection | schedule",
  "triggerConfig": { ... },
  "nodes": [
    {
      "id": "string",
      "type": "string",
      "title": "string",
      "config": { ... },
      "upstreamId": "string | undefined",
      "downstreamId": "string | undefined"
    }
  ]
}`;

export function buildWorkflowPrompt(
  prompt: string,
  context?: { collections?: (string | { name: string; title?: string; fields?: { name: string; title?: string; type?: string }[] })[] },
): string {
  let text = `Generate a workflow for the following requirement:\n\n${prompt}`;

  if (context?.collections?.length) {
    text += `\n\nAvailable database collections for relations and CRUD actions:`;
    for (const col of context.collections) {
      if (typeof col === 'string') {
        text += `\n- name: ${col}`;
      } else {
        text += `\n- name: ${col.name} (${col.title || ''})`;
        if (col.fields && col.fields.length > 0) {
          text += `\n  fields:`;
          for (const f of col.fields) {
            text += `\n    - ${f.name} (${f.title || ''}): ${f.type || 'string'}`;
          }
        }
      }
    }
  }

  text += '\n\nRespond with ONLY the JSON object, no markdown fences or explanation.';
  return text;
}

