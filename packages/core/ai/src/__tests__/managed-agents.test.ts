import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRuntime } from '../agent/runtime';
import { MultiAgentCoordinator } from '../agent/coordinator';
import { CritiqueEvaluator } from '../agent/evaluator';
import { LLMManager } from '../llm/manager';
import { MockLLMProvider } from '../llm/providers/mock';
import { A2DataEngine } from '../a2data/engine';
import { A2UIEngine } from '../a2ui/engine';
import { A2FlowEngine } from '../a2flow/engine';
import { A2MenuEngine } from '../a2menu/engine';
import { ResourceSkillRegistry } from '../skills/resource-skill-registry';
import type { AIAgent, AIMessage, ToolCall } from '@formai/shared';

// ─── Mock Database ──────────────────────────────────────────────────────────

class MockRepository {
  private records: Map<string, any> = new Map();

  async create(options: { values: any }): Promise<any> {
    const record = {
      id: options.values.id || `mock_${Math.random().toString(36).substring(7)}`,
      ...options.values,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.records.set(record.id, record);
    return record;
  }

  async findOne(options: { filter: any }): Promise<any> {
    const list = await this.find(options);
    return list[0] || null;
  }

  async find(options?: { filter?: any }): Promise<any[]> {
    const filter = options?.filter || {};
    return Array.from(this.records.values()).filter((rec) => {
      for (const [k, v] of Object.entries(filter)) {
        if (rec[k] !== v) return false;
      }
      return true;
    });
  }

  async update(options: { filterByTk?: string; filter?: any; values: any }): Promise<any[]> {
    const pk = options.filterByTk;
    const filter = options.filter || {};
    const list = Array.from(this.records.values()).filter((rec) => {
      if (pk) return rec.id === pk;
      for (const [k, v] of Object.entries(filter)) {
        if (rec[k] !== v) return false;
      }
      return true;
    });

    for (const rec of list) {
      Object.assign(rec, options.values, { updatedAt: new Date() });
    }
    return list;
  }
}

class MockDatabase {
  private repositories: Map<string, MockRepository> = new Map();

  getRepository(name: string): MockRepository {
    if (!this.repositories.has(name)) {
      this.repositories.set(name, new MockRepository());
    }
    return this.repositories.get(name)!;
  }
}

// ─── Test Agent Configurations ──────────────────────────────────────────────────

const TEST_AGENT: AIAgent = {
  id: 'managed-test-agent',
  name: 'Managed Test Agent',
  description: 'Agent for persistent state tests',
  systemPrompt: 'You are a managed agent assistant.',
  model: 'mock-1',
  provider: 'mock',
  tools: [],
};

describe('Managed Agents Stateful Loop & Infrastructure', () => {
  let manager: LLMManager;
  let mockLLM: MockLLMProvider;
  let db: MockDatabase;
  let skillRegistry: ResourceSkillRegistry;
  let runtime: AgentRuntime;

  beforeEach(() => {
    manager = new LLMManager();
    mockLLM = new MockLLMProvider();
    manager.registerProvider(mockLLM);
    db = new MockDatabase();
    skillRegistry = new ResourceSkillRegistry();
    runtime = new AgentRuntime(manager, db, skillRegistry);
  });

  // ─── AgentRuntime Stateful loop ───

  describe('AgentRuntime Persistence', () => {
    it('creates session and checkpoints, and runs the persistent ReAct loop', async () => {
      mockLLM.setResponses([
        { role: 'assistant', content: 'Persistent execution has finished successfully.' },
      ]);

      const sessionId = 'session_test_123';
      const result = await runtime.execute(TEST_AGENT, 'Start executing', { sessionId });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Persistent execution has finished successfully.');

      const sessionRepo = db.getRepository('agentSessions');
      const checkpointRepo = db.getRepository('agentCheckpoints');
      const traceRepo = db.getRepository('agentTraces');

      // Check session
      const session = await sessionRepo.findOne({ filter: { id: sessionId } });
      expect(session).not.toBeNull();
      expect(session.status).toBe('completed');
      expect(session.currentCheckpointId).toBeDefined();

      // Check checkpoint
      const checkpoint = await checkpointRepo.findOne({ filter: { id: session.currentCheckpointId } });
      expect(checkpoint).not.toBeNull();
      expect(checkpoint.messages.length).toBeGreaterThanOrEqual(3);

      // Check traces
      const traces = await traceRepo.find({ filter: { sessionId } });
      expect(traces.length).toBeGreaterThanOrEqual(1);
      expect(traces[0].stepType).toBe('thought');
    });

    it('pauses loop for human-in-the-loop approval, writes state, and resumes correctly', async () => {
      // Register pre-execute hook requiring confirm
      skillRegistry.addPreExecuteHook(async (skill) => {
        if (skill.name === 'danger_zone') {
          return { requiresConfirm: true, reason: 'Requires approval to drop database' };
        }
      });

      skillRegistry.register(
        {
          name: 'danger_zone',
          title: 'Danger Zone Action',
          description: 'A dangerous action',
          resourceType: 'system',
          resourceName: 'db',
          appId: null,
          skillType: 'custom',
          enabled: true,
          requiresConfirm: false,
          rolesAllowed: [],
          handler: { type: 'rest_action', resource: 'db', action: 'drop' },
          inputSchema: {},
        },
        async () => 'Action Dropped Successful',
      );

      // First LLM response: call danger_zone tool
      const toolCallResponse: AIMessage = {
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'call_danger',
            type: 'function',
            function: { name: 'danger_zone', arguments: '{}' },
          },
        ] as ToolCall[],
      };
      // Second LLM response: final answer after tool resume
      const finalResponse: AIMessage = {
        role: 'assistant',
        content: 'Database was successfully dropped.',
      };

      mockLLM.setResponses([toolCallResponse, finalResponse]);

      const sessionId = 'session_danger_456';
      const result = await runtime.execute(TEST_AGENT, 'Drop database please', { sessionId });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Paused for confirmation');
      expect(result.pendingConfirmation).toBeDefined();
      expect(result.pendingConfirmation.skillName).toBe('danger_zone');

      const sessionRepo = db.getRepository('agentSessions');
      const checkpointRepo = db.getRepository('agentCheckpoints');

      // Verify session state is waiting_approval
      let session = await sessionRepo.findOne({ filter: { id: sessionId } });
      expect(session.status).toBe('waiting_approval');

      // Resume execution with approval
      const resumeResult = await runtime.resume(
        sessionId,
        true, // approved
      );

      expect(resumeResult.success).toBe(true);
      expect(resumeResult.output).toBe('Database was successfully dropped.');

      session = await sessionRepo.findOne({ filter: { id: sessionId } });
      expect(session.status).toBe('completed');

      const latestCheckpoint = await checkpointRepo.findOne({ filter: { id: session.currentCheckpointId } });
      expect(latestCheckpoint.messages.some((m: any) => m.role === 'tool' && m.content.includes('Action Dropped Successful'))).toBe(true);
    });
  });

  // ─── Multi-Agent Coordinator ───

  describe('MultiAgentCoordinator', () => {
    it('schedules sub-agents and tracks orchestrator execution paths', async () => {
      const a2data = new A2DataEngine(manager);
      const a2ui = new A2UIEngine(manager);
      const a2flow = new A2FlowEngine(manager);
      const a2menu = new A2MenuEngine(manager);

      const coordinator = new MultiAgentCoordinator(manager, a2data, a2ui, a2flow, a2menu);

      const planResponse = {
        collections: ['Create items collection'],
        pages: ['Create items list page'],
        workflows: ['Create approve workflow'],
        menus: 'Create sidebar menu link to items',
      };

      // Set LLM mocks for coordinator plan, collection mock, ui schema mock, workflow mock, menu mock
      mockLLM.setResponses([
        { role: 'assistant', content: JSON.stringify(planResponse) }, // Breakdown plan
        { role: 'assistant', content: '{"name": "items", "fields": []}' }, // A2Data
        { role: 'assistant', content: '{"type": "void", "x-component": "Page", "properties": {}}' }, // A2UI
        { role: 'assistant', content: '{"title": "Approve Workflow", "triggerType": "manual", "nodes": []}' }, // A2Flow
        { role: 'assistant', content: '{"menus": [{"title": "Items", "type": "page", "path": "items", "icon": "📦"}]}' }, // A2Menu
      ]);

      const sessionId = 'session_coordinate_789';
      const results = await coordinator.coordinate(
        'Generate items collection and page',
        'mock-1',
        'mock',
        { db, sessionId },
      );

      expect(results.collections).toHaveLength(1);
      expect(results.pages).toHaveLength(1);
      expect(results.workflows).toHaveLength(1);
      expect(results.menus).toBeDefined();

      const traceRepo = db.getRepository('agentTraces');
      const traces = await traceRepo.find({ filter: { sessionId } });

      // Checks traces tree contains orchestrator and sub-agents
      expect(traces.some((t: any) => t.agentName === 'Orchestrator')).toBe(true);
      expect(traces.some((t: any) => t.agentName === 'DataAgent')).toBe(true);
      expect(traces.some((t: any) => t.agentName === 'UIAgent')).toBe(true);
    });
  });

  // ─── CritiqueEvaluator ───

  describe('CritiqueEvaluator self-healing', () => {
    it('detects syntax violations and runs the feedback loops to heal schemas', async () => {
      const evaluator = new CritiqueEvaluator(manager);

      const correctedSchema = {
        type: 'void',
        'x-component': 'Page',
        properties: {},
      };

      mockLLM.setResponses([
        { role: 'assistant', content: JSON.stringify(correctedSchema) },
      ]);

      const invalidSchema = {
        type: 'invalid', // Invalid type
        'x-component': 'Page',
      };

      const result = await evaluator.evaluateAndHealSchema(
        invalidSchema,
        'Fix page schema',
        'mock-1',
        'mock',
      );

      expect(result.type).toBe('void');
      expect(result['x-component']).toBe('Page');
    });
  });
});
