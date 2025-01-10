class WebSocketManager {
  constructor() {
    this.activeConnections = new Map();
    this.connectionTimeouts = new Map();
    this.CLEANUP_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    // Store interval ID for cleanup
    this.cleanupInterval = setInterval(() => this.cleanupInactiveConnections(), this.CLEANUP_TIMEOUT);
  }

  cleanupInactiveConnections() {
    console.log('Running WebSocket connection cleanup...');
    for (const [sessionId, connection] of this.activeConnections.entries()) {
      if (connection.readyState !== 1) { // Not OPEN
        console.log(`Cleaning up inactive session: ${sessionId}`);
        this.removeConnection(sessionId);
      }
    }
  }

  addConnection(id, ws) {
    console.log('Adding new WebSocket connection for session:', id);
    
    // Clear any existing connection
    if (this.activeConnections.has(id)) {
      console.log('Removing existing connection for session:', id);
      this.removeConnection(id);
    }

    // Clear any existing timeout
    if (this.connectionTimeouts.has(id)) {
      console.log('Clearing existing timeout for session:', id);
      clearTimeout(this.connectionTimeouts.get(id));
      this.connectionTimeouts.delete(id);
    }

    // Store the new connection
    this.activeConnections.set(id, ws);
    console.log(`Active connections count: ${this.activeConnections.size}`);

    // Handle WebSocket close
    ws.on('close', () => {
      console.log('WebSocket connection closed for session:', id);
      this.removeConnection(id);
      
      // Set a timeout to clean up if no reconnection happens
      console.log('Setting cleanup timeout for session:', id);
      this.connectionTimeouts.set(id, setTimeout(() => {
        console.log('Cleaning up session:', id);
        this.connectionTimeouts.delete(id);
      }, this.CLEANUP_TIMEOUT));
    });

    return true;
  }

  removeConnection(id) {
    console.log('Removing WebSocket connection for session:', id);
    const connection = this.activeConnections.get(id);
    if (connection) {
      if (connection.readyState === 1) { // 1 = OPEN
        try {
          connection.send(JSON.stringify({ content: 'Connection closed' }));
        } catch (error) {
          console.error('Error sending close message:', error);
        }
      }
      // Remove all listeners to prevent memory leaks
      connection.removeAllListeners();
      this.activeConnections.delete(id);
    }
  }

  getConnection(id) {
    return this.activeConnections.get(id);
  }

  cleanup() {
    console.log('Cleaning up WebSocket manager...');
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Clear all timeouts
    for (const timeout of this.connectionTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.connectionTimeouts.clear();
    
    // Close all connections
    for (const [id, connection] of this.activeConnections.entries()) {
      if (connection.readyState === 1) { // 1 = OPEN
        connection.close();
      }
    }
    this.activeConnections.clear();
  }
}

module.exports = new WebSocketManager(); 