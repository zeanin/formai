import { Plugin } from '@formai/plugin';
import { Codex } from './sdk/codex';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

export default class CodexPlugin extends Plugin {
  private tcpServer?: net.Server;

  async load(): Promise<void> {
    const config = this.app.config?.ai || {};
    
    // Resolve codexPathOverride (checks config, env, and local project binary)
    const localCodexBin = path.join(__dirname, '..', 'bin', 'codex');
    const codexPathOverride = config.codexPath || process.env.CODEX_PATH || process.env.CODEX_BIN || (fs.existsSync(localCodexBin) ? localCodexBin : undefined);

    // Instantiate the Codex client with default credentials from config or environment
    const codexClient = new Codex({
      apiKey: config.openai?.apiKey || config.openaiApiKey || process.env.OPENAI_API_KEY,
      baseUrl: config.openai?.baseURL || config.openai?.baseUrl || config.openaiBaseUrl || process.env.OPENAI_BASE_URL,
      daemonUrl: config.daemonUrl || process.env.CODEX_DAEMON_URL,
      socketPath: config.socketPath || process.env.CODEX_SOCKET_PATH,
      codexPathOverride,
    });

    // Make codex client available globally on the FormAI application instance
    this.app.codex = codexClient;

    console.log('[Codex Plugin] Codex agent client successfully initialized on app.codex.');

    // 1. Programmatically write/create the mcp-server.js proxy script in output dist/sdk directory
    // This script will be run by Codex Daemon to proxy stdio streams to our TCP socket bridge
    const distSdkDir = path.join(__dirname, 'sdk');
    if (!fs.existsSync(distSdkDir)) {
      fs.mkdirSync(distSdkDir, { recursive: true });
    }
    const mcpScriptPath = path.join(distSdkDir, 'mcp-server.js');
    const mcpScriptContent = `
const net = require('net');
const port = process.env.FORMAI_MCP_PORT ? parseInt(process.env.FORMAI_MCP_PORT, 10) : 3006;
const socket = net.connect(port, '127.0.0.1', () => {
  process.stdin.pipe(socket);
  socket.pipe(process.stdout);
});
socket.on('error', (err) => {
  console.error('MCP Bridge Error:', err);
  process.exit(1);
});
socket.on('close', () => {
  process.exit(0);
});
`;
    fs.writeFileSync(mcpScriptPath, mcpScriptContent.trim() + '\n', 'utf8');

    // 2. Start a dynamic local loopback TCP socket bridge server to receive MCP connections
    const tcpServer = net.createServer((socket) => {
      console.log('[FormAI MCP Server] Received TCP bridge connection from Codex Daemon.');

      // Instantiate a fresh MCP Server for this connection session
      const mcpServer = new Server(
        {
          name: "formai-copilot-engine",
          version: "1.0.0",
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Handle MCP ListTools requests: dynamically query all platform skills
      mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
        const skillContext = { roles: ['developer'] }; // developer context provides full architectural access
        const availableSkills = this.app.skillRegistry.getAvailableTools(skillContext);

        const mcpTools = availableSkills.map((skill: any) => ({
          name: skill.name,
          description: skill.description,
          inputSchema: skill.inputSchema || { type: "object", properties: {} },
        }));

        return { tools: mcpTools };
      });

      // Handle MCP CallTool requests: execute platform skills in main process memory space
      mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        const skillContext = { roles: ['developer'] };

        try {
          const execResult = await this.app.skillRegistry.execute(name, args || {}, skillContext);
          
          if (execResult.type === 'confirmation') {
            throw new Error(`Execution blocked: Pending user confirmation for ${name}`);
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(execResult.result || execResult.data || execResult || {}, null, 2),
              },
            ],
          };
        } catch (error: any) {
          return {
            isError: true,
            content: [{ type: "text", text: `MCP Execution Error in ${name}: ${error.message}` }],
          };
        }
      });

      // Bind the dynamic TCP socket to standard MCP stdio transport streams
      const transport = new StdioServerTransport(socket, socket);
      mcpServer.connect(transport).then(() => {
        console.log('[FormAI MCP Server] MCP protocol connected over TCP bridge socket.');
      }).catch((err) => {
        console.error('[FormAI MCP Server] MCP connection error:', err);
      });

      socket.on('close', () => {
        console.log('[FormAI MCP Server] TCP bridge socket closed.');
        mcpServer.close().catch(() => {});
      });
      
      socket.on('error', (err) => {
        console.error('[FormAI MCP Server] TCP bridge socket error:', err);
      });
    });

    const mcpPort = config.mcpPort || (process.env.FORMAI_MCP_PORT ? parseInt(process.env.FORMAI_MCP_PORT, 10) : 3006);

    // Listen on fixed port on 127.0.0.1 (safe loopback interface only)
    tcpServer.listen(mcpPort, '127.0.0.1', () => {
      const address = tcpServer.address() as net.AddressInfo;
      const port = address.port;
      
      // Store on app.codex client instance so other plugins (like @formai/plugin-ai) can query it
      (this.app.codex as any).mcpBridgePort = port;
      (this.app.codex as any).mcpScriptPath = mcpScriptPath;
      
      console.log(`[FormAI MCP Server] TCP bridge server successfully listening on 127.0.0.1:${port}`);
    });

    this.tcpServer = tcpServer;
  }

  async destroy(): Promise<void> {
    if (this.tcpServer) {
      this.tcpServer.close();
      console.log('[Codex Plugin] TCP bridge server closed.');
    }
    if (this.app.codex) {
      delete this.app.codex;
    }
  }
}
