const wsManager = require('./wsManager');
const aiService = require('./aiService');

class ConversationState {
  constructor(leftBot, rightBot, topic) {
    this.leftBot = leftBot;
    this.rightBot = rightBot;
    this.topic = topic;
    this.isActive = true;
    this.currentSpeaker = null;
  }

  getBotByRole(isLeft) {
    return isLeft ? this.leftBot : this.rightBot;
  }

  getOtherBot(isLeft) {
    return isLeft ? this.rightBot : this.leftBot;
  }
}

class Bot {
  constructor(sessionId, personality, name) {
    this.sessionId = sessionId;
    this.personality = personality;
    this.name = name;
    this.lastMessage = null;
    this.isResponding = false;
    this.messages = [];
  }
}

class WebSocketManager {
  constructor() {
    this.wsManager = wsManager;
  }

  sendContent(sessionId, content) {
    const ws = this.wsManager.getConnection(sessionId);
    if (ws) {
      ws.send(JSON.stringify({ content }));
    }
  }

  sendCompletion(sessionId) {
    const ws = this.wsManager.getConnection(sessionId);
    if (ws) {
      ws.send(JSON.stringify({ type: 'completion' }));
    }
  }

  sendThinking(sessionId) {
    const ws = this.wsManager.getConnection(sessionId);
    if (ws) {
      ws.send(JSON.stringify({ type: 'thinking' }));
    }
  }
}

const DEFAULT_CONFIG = {
  turnDelay: 5000,
  maxMessages: 100,
  // other configurable values
};

class ChatServiceError extends Error {
  constructor(message, code, originalError = null) {
    super(message);
    this.code = code;
    this.originalError = originalError;
  }
}

class ChatService {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.activeConversations = new Map();
    this.wsManager = new WebSocketManager();
  }

  async initializeConversation(leftPersonality, rightPersonality, topic) {
    const conversationId = Date.now().toString();
    
    const leftBot = new Bot(
      `left_${conversationId}`,
      leftPersonality.prompt,
      leftPersonality.name
    );
    
    const rightBot = new Bot(
      `right_${conversationId}`,
      rightPersonality.prompt,
      rightPersonality.name
    );

    const conversation = new ConversationState(leftBot, rightBot, topic);
    this.activeConversations.set(conversationId, conversation);

    return conversationId;
  }

  async processMessageStream(stream, currentBot, otherBot, conversation) {
    let fullMessage = '';
    
    for await (const chunk of stream) {
      if (chunk.choices[0]?.delta?.content) {
        const content = chunk.choices[0].delta.content;
        fullMessage += content;
        this.wsManager.sendContent(currentBot.sessionId, content);
      }
    }
    
    // Update state and send completion
    currentBot.lastMessage = fullMessage;
    currentBot.messages.push(fullMessage);
    currentBot.isResponding = false;
    
    this.wsManager.sendCompletion(currentBot.sessionId);
    
    return fullMessage;
  }

  buildPrompt(currentBot, otherBot, conversation, lastMessage = null) {
    const conversationHistory = currentBot.messages.length + otherBot.messages.length > 0 
      ? '\nPrevious messages:\n' + 
        currentBot.messages.map((msg, i) => `You: ${msg}\n${otherBot.name}: ${otherBot.messages[i]}`).join('\n') +
        (lastMessage ? `\n${otherBot.name}: ${lastMessage}` : '')
      : '';

    const context = `Context: You are having a conversation with ${otherBot.name}${conversation.topic ? ` about ${conversation.topic}` : ''}.`;
    const instruction = lastMessage 
      ? `${conversationHistory}\n${conversationHistory ? 'Continue the conversation by responding to: ' : 'Respond to: '}${lastMessage}`
      : `\nStart a conversation about this topic.`;

    return `${currentBot.personality}\n${context}${instruction}\nKeep your response concise${lastMessage ? ' and maintain conversation continuity' : ''}.`;
  }

  async handleConversationTurn(conversationId, lastMessage = null, isLeftBot = true) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation || !conversation.isActive) {
      throw new ChatServiceError(
        'Conversation not found or inactive',
        'INVALID_CONVERSATION'
      );
    }

    const currentBot = conversation.getBotByRole(isLeftBot);
    const otherBot = conversation.getOtherBot(isLeftBot);

    // Reset states
    currentBot.isResponding = true;
    otherBot.isResponding = false;

    if (lastMessage) {
      otherBot.messages.push(lastMessage);
    }

    const prompt = this.buildPrompt(currentBot, otherBot, conversation, lastMessage);
    console.log(`Conversation prompt for ${isLeftBot ? 'left' : 'right'} bot:`, prompt);

    try {
      const stream = await aiService.sendMessage(prompt, currentBot.sessionId);
      const fullMessage = await this.processMessageStream(stream, currentBot, otherBot, conversation);

      if (fullMessage && conversation.isActive) {
        // Signal other bot is thinking
        this.wsManager.sendThinking(otherBot.sessionId);

        // Schedule next turn
        setTimeout(() => {
          if (conversation.isActive) {
            conversation.currentSpeaker = isLeftBot ? 'right' : 'left';
            otherBot.isResponding = false;
            this.handleConversationTurn(conversationId, fullMessage, !isLeftBot);
          }
        }, this.config.turnDelay);
      }

      return stream;
    } catch (error) {
      console.error('Error in conversation turn:', error);
      currentBot.isResponding = false;
      throw new ChatServiceError(
        'Failed to process conversation turn',
        'CONVERSATION_TURN_ERROR',
        error
      );
    }
  }

  async startConversation(conversationId) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      throw new ChatServiceError(
        'Conversation not found',
        'CONVERSATION_NOT_FOUND'
      );
    }

    conversation.currentSpeaker = 'left';
    return this.handleConversationTurn(conversationId);
  }

  async continueConversation(conversationId, lastMessage, isLeftBot = false) {
    return this.handleConversationTurn(conversationId, lastMessage, isLeftBot);
  }

  async stopConversation(conversationId) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      throw new ChatServiceError(
        'Conversation not found',
        'CONVERSATION_NOT_FOUND'
      );
    }

    conversation.isActive = false;
    
    // Clean up WebSocket connections
    wsManager.removeConnection(conversation.leftBot.sessionId);
    wsManager.removeConnection(conversation.rightBot.sessionId);
    
    return true;
  }

  addConnection(conversationId, ws, isLeftBot = true) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const sessionId = isLeftBot ? conversation.leftBot.sessionId : conversation.rightBot.sessionId;
    return wsManager.addConnection(sessionId, ws);
  }

  getConnection(conversationId, isLeftBot = true) {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    const bot = conversation.getBotByRole(isLeftBot);
    return wsManager.getConnection(bot.sessionId);
  }
}

module.exports = new ChatService(); 