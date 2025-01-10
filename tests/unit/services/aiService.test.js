const aiService = require('../../../services/aiService');
const tokenService = require('../../../services/tokenService');

// Mock tokenService
jest.mock('../../../services/tokenService', () => ({
  initialize: jest.fn(),
  ensureValidToken: jest.fn().mockResolvedValue('mock-token')
}));

describe('AI Service Tests', () => {
  const mockStream = {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' World' } }] };
    }
  };

  const mockWs = {
    readyState: 1,
    send: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OpenAI Client', () => {
    it('should get client with valid token', async () => {
      const client = await aiService.getClient();
      expect(client).toBeDefined();
      expect(tokenService.initialize).toHaveBeenCalled();
      expect(tokenService.ensureValidToken).toHaveBeenCalled();
    });

    it('should handle token service error', async () => {
      tokenService.ensureValidToken.mockRejectedValueOnce(new Error('Token error'));
      await expect(aiService.getClient()).rejects.toThrow('Token error');
    });
  });

  describe('Message Processing', () => {
    it('should process stream successfully', async () => {
      const success = await aiService.processStream(mockStream, mockWs, 'test-session');
      expect(success).toBe(true);
      expect(mockWs.send).toHaveBeenCalledTimes(3); // 2 content chunks + completion
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ content: 'Hello' }));
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ content: ' World' }));
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'completion' }));
    });

    it('should handle invalid stream or WebSocket', async () => {
      const success = await aiService.processStream(null, mockWs, 'test-session');
      expect(success).toBe(false);
    });

    it('should handle WebSocket not open', async () => {
      const closedWs = { ...mockWs, readyState: 3 };
      const success = await aiService.processStream(mockStream, closedWs, 'test-session');
      expect(success).toBe(false);
    });
  });
}); 