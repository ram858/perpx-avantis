import { WebSocketServer, WebSocket, type Data } from 'ws';
import { TradingSessionManager } from '../session-manager.js';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
  sessionId?: string;
  data?: any;
}

export class TradingWebSocketServer {
  private wss: WebSocketServer;
  private sessionManager: TradingSessionManager;
  private port: number;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(port: number, sessionManager: TradingSessionManager) {
    this.port = port;
    this.sessionManager = sessionManager;
    
    this.wss = new WebSocketServer({ 
      port,
      perMessageDeflate: false // Disable compression for better performance
    });
    
    this.setupWebSocketServer();
    this.startPingInterval();
    
    console.log(`[WEBSOCKET] Server started on port ${port}`);
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientIP = req.socket.remoteAddress;
      console.log(`[WEBSOCKET] Client connected from ${clientIP}`);
      
      // Set up message handling
      ws.on('message', (message: Data) => {
        try {
          const data: WebSocketMessage = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('[WEBSOCKET] Invalid message format:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });
      
      // Handle connection close
      ws.on('close', (code: number, reason: string) => {
        console.log(`[WEBSOCKET] Client disconnected (${code}): ${reason}`);
        this.cleanupClient(ws);
      });
      
      // Handle connection errors
      ws.on('error', (error: Error) => {
        console.error('[WEBSOCKET] Client error:', error);
        this.cleanupClient(ws);
      });
      
      // Send welcome message
      this.sendMessage(ws, {
        type: 'pong',
        data: { message: 'Connected to trading WebSocket server' }
      });
    });
    
    // Handle server errors
    this.wss.on('error', (error: Error) => {
      console.error('[WEBSOCKET] Server error:', error);
    });
  }

  private handleMessage(ws: WebSocket, message: WebSocketMessage) {
    switch (message.type) {
      case 'subscribe':
        if (message.sessionId) {
          this.sessionManager.subscribeToUpdates(message.sessionId, ws);
          this.sendMessage(ws, {
            type: 'pong',
            data: { message: `Subscribed to session ${message.sessionId}` }
          });
        } else {
          this.sendError(ws, 'Session ID required for subscription');
        }
        break;
        
      case 'unsubscribe':
        if (message.sessionId) {
          this.sessionManager.unsubscribeFromUpdates(message.sessionId, ws);
          this.sendMessage(ws, {
            type: 'pong',
            data: { message: `Unsubscribed from session ${message.sessionId}` }
          });
        } else {
          this.sendError(ws, 'Session ID required for unsubscription');
        }
        break;
        
      case 'ping':
        this.sendMessage(ws, { type: 'pong', data: { timestamp: Date.now() } });
        break;
        
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private sendMessage(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WEBSOCKET] Failed to send message:', error);
      }
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      data: { error, timestamp: Date.now() }
    });
  }

  private cleanupClient(ws: WebSocket) {
    // Remove client from all session subscriptions
    // This is handled by the session manager when WebSocket closes
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendMessage(ws, { type: 'ping', data: { timestamp: Date.now() } });
        }
      });
    }, 30000); // Ping every 30 seconds
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }

  public getConnectedClients(): number {
    return this.wss.clients.size;
  }

  public broadcast(message: any) {
    this.wss.clients.forEach((ws) => {
      this.sendMessage(ws, message);
    });
  }

  public close() {
    console.log('[WEBSOCKET] Closing WebSocket server');
    this.stopPingInterval();
    this.wss.close();
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WEBSOCKET] Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WEBSOCKET] Received SIGINT, shutting down gracefully');
  process.exit(0);
});
