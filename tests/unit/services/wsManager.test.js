const wsManager = require('../../../services/wsManager');

describe('WebSocket Manager Tests', () => {
  const mockWs = {
    readyState: 1,
    send: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
    close: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    wsManager.cleanup();
  });

  afterAll(() => {
    wsManager.cleanup();
  });

  describe('Connection Management', () => {
    it('should add and get connection', () => {
      const sessionId = 'test-session';
      wsManager.addConnection(sessionId, mockWs);
      const connection = wsManager.getConnection(sessionId);
      expect(connection).toBe(mockWs);
    });

    it('should remove connection', () => {
      const sessionId = 'test-session';
      wsManager.addConnection(sessionId, mockWs);
      wsManager.removeConnection(sessionId);
      const connection = wsManager.getConnection(sessionId);
      expect(connection).toBeUndefined();
    });

    it('should handle removing non-existent connection', () => {
      expect(() => wsManager.removeConnection('non-existent')).not.toThrow();
    });

    it('should cleanup all connections', () => {
      const sessionId1 = 'test-session-1';
      const sessionId2 = 'test-session-2';
      wsManager.addConnection(sessionId1, mockWs);
      wsManager.addConnection(sessionId2, mockWs);
      wsManager.cleanup();
      expect(wsManager.getConnection(sessionId1)).toBeUndefined();
      expect(wsManager.getConnection(sessionId2)).toBeUndefined();
    });

    it('should handle connection close event', () => {
      const sessionId = 'test-session';
      wsManager.addConnection(sessionId, mockWs);
      
      // Simulate close event
      const closeHandler = mockWs.on.mock.calls.find(call => call[0] === 'close')[1];
      closeHandler();
      
      expect(wsManager.getConnection(sessionId)).toBeUndefined();
    });
  });
}); 