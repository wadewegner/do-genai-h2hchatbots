const { OpenAI } = require('openai');
const tokenService = require('./tokenService');

class AIService {
  constructor() {
    this.AGENT_ENDPOINT = process.env.AGENT_ENDPOINT;
    console.log('AIService initialized with endpoint:', this.AGENT_ENDPOINT);
  }

  async getClient() {
    try {
      console.log('Getting access token...');
      tokenService.initialize(); // Initialize TokenService
      const accessToken = await tokenService.ensureValidToken();
      console.log('Got access token, creating OpenAI client...');
      return new OpenAI({
        baseURL: this.AGENT_ENDPOINT,
        apiKey: accessToken,
      });
    } catch (error) {
      console.error('Error creating OpenAI client:', {
        error: error.message,
        name: error.name,
        status: error.status,
        stack: error.stack
      });
      throw error;
    }
  }

  async sendMessage(message, sessionId) {
    try {
      const client = await this.getClient();
      return await client.chat.completions.create({
        model: 'gpt-4-1106-preview',
        messages: [{ role: 'user', content: message }],
        stream: true
      });
    } catch (error) {
      console.error('Error sending message:', {
        error: error.message,
        sessionId,
        status: error.status
      });
      throw error;
    }
  }

  async processStream(stream, ws, sessionId) {
    if (!stream || !ws) {
      console.error('Invalid stream or WebSocket:', { stream: !!stream, ws: !!ws, sessionId });
      return false;
    }

    try {
      for await (const chunk of stream) {
        if (ws.readyState !== 1) { // WebSocket not OPEN
          console.error('WebSocket not open during stream processing:', { sessionId });
          return false;
        }

        if (chunk.choices[0]?.delta?.content) {
          const content = chunk.choices[0].delta.content;
          ws.send(JSON.stringify({ content }));
        }
      }

      // Send completion message
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({ type: 'completion' }));
      }

      return true;
    } catch (error) {
      console.error('Error processing stream:', {
        error: error.message,
        sessionId,
        status: error.status
      });
      return false;
    }
  }
}

module.exports = new AIService(); 