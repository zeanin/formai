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
