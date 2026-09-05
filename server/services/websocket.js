import { WebSocketServer } from 'ws';
import { isAllowedOrigin } from '../middleware/origin.js';

/**
 * Set up WebSocket server for real-time updates
 *
 * Message types:
 * - subscribe: { type: "subscribe", skitId: "abc123" }
 * - unsubscribe: { type: "unsubscribe", skitId: "abc123" }
 *
 * Server broadcasts:
 * - skit:created, skit:updated, skit:deleted
 * - sprite:created, sprite:updated, sprite:deleted
 * - publish:progress, publish:complete, publish:error
 */
export function setupWebSocket(server, allowedOrigins = '') {
  const wss = new WebSocketServer({ server, path: '/ws', verifyClient: ({ req }) => isAllowedOrigin(req, allowedOrigins) });

  // Track subscriptions: Map<skitId, Set<WebSocket>>
  const subscriptions = new Map();

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    // Track which skits this client is subscribed to
    const clientSubscriptions = new Set();

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.type) {
          case 'subscribe':
            if (msg.skitId) {
              // Add to subscription list
              if (!subscriptions.has(msg.skitId)) {
                subscriptions.set(msg.skitId, new Set());
              }
              subscriptions.get(msg.skitId).add(ws);
              clientSubscriptions.add(msg.skitId);

              // Acknowledge subscription
              ws.send(JSON.stringify({
                type: 'subscribed',
                skitId: msg.skitId
              }));
            }
            break;

          case 'unsubscribe':
            if (msg.skitId) {
              // Remove from subscription list
              const subs = subscriptions.get(msg.skitId);
              if (subs) {
                subs.delete(ws);
                if (subs.size === 0) {
                  subscriptions.delete(msg.skitId);
                }
              }
              clientSubscriptions.delete(msg.skitId);

              // Acknowledge unsubscription
              ws.send(JSON.stringify({
                type: 'unsubscribed',
                skitId: msg.skitId
              }));
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            break;

          default:
            console.warn('Unknown WebSocket message type:', msg.type);
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');

      // Clean up subscriptions
      for (const skitId of clientSubscriptions) {
        const subs = subscriptions.get(skitId);
        if (subs) {
          subs.delete(ws);
          if (subs.size === 0) {
            subscriptions.delete(skitId);
          }
        }
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
    });
  });

  /**
   * Broadcast a message to all connected clients
   */
  function broadcast(message) {
    const data = JSON.stringify(message);

    wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(data);
      }
    });
  }

  /**
   * Broadcast a message to clients subscribed to a specific skit
   */
  function broadcastToSkit(skitId, message) {
    const subs = subscriptions.get(skitId);
    if (!subs) return;

    const data = JSON.stringify(message);

    subs.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(data);
      }
    });
  }

  // Attach broadcast functions to wss for use by routes
  wss.broadcast = broadcast;
  wss.broadcastToSkit = broadcastToSkit;

  console.log('WebSocket server initialized at /ws');

  return wss;
}
