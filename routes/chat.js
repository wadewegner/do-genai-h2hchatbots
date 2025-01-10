const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const WebSocket = require('ws');

// GET / - Render the chat interface
router.get('/', (req, res) => {
  res.render('index', {
    title: 'AI Chat'
  });
});

// POST /h2h/init - Initialize a new head-to-head conversation
router.post('/init', async (req, res) => {
  try {
    const { leftPersonality, rightPersonality, topic } = req.body;
    
    // Validate inputs
    if (!leftPersonality || !rightPersonality || !topic) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize the conversation
    const conversationId = await chatService.initializeConversation(
      leftPersonality,
      rightPersonality,
      topic
    );

    res.json({ conversationId });
  } catch (error) {
    console.error('Error initializing conversation:', error);
    res.status(500).json({ error: 'Failed to initialize conversation' });
  }
});

// POST /h2h/start - Start a conversation
router.post('/start', async (req, res) => {
  try {
    const { conversationId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Missing conversation ID' });
    }

    // Start the conversation with the left bot
    const stream = await chatService.startConversation(conversationId);
    
    // The response will be handled by the WebSocket connection
    res.json({ success: true });
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// POST /h2h/stop - Stop a conversation
router.post('/stop', async (req, res) => {
  try {
    const { conversationId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Missing conversation ID' });
    }

    await chatService.stopConversation(conversationId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error stopping conversation:', error);
    res.status(500).json({ error: 'Failed to stop conversation' });
  }
});

// WebSocket handler setup function
const setupWebSocket = (wss) => {
  wss.on('connection', async (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const conversationId = params.get('conversationId');
    const side = params.get('side');

    if (!conversationId || !side) {
      ws.close(1002, 'Missing required parameters');
      return;
    }

    const isLeftBot = side === 'left';
    console.log(`WebSocket connected for ${side} bot in conversation ${conversationId}`);
    
    try {
      // Add the WebSocket connection to the service
      chatService.addConnection(conversationId, ws, isLeftBot);

      // Set up message handling
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'response') {
            // Continue the conversation with the other bot
            const response = await chatService.continueConversation(
              conversationId,
              data.content,
              !isLeftBot // Switch sides for the response
            );
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });

      // Handle WebSocket closure
      ws.on('close', () => {
        console.log(`WebSocket closed for ${side} bot in conversation ${conversationId}`);
      });

      // Handle WebSocket errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${side} bot in conversation ${conversationId}:`, error);
      });

      // Send initial connection success message
      ws.send(JSON.stringify({ type: 'connected', side }));
    } catch (error) {
      console.error('Error setting up WebSocket connection:', error);
      ws.close(1011, 'Failed to setup connection');
    }
  });

  return wss;
};

module.exports = { router, setupWebSocket }; 