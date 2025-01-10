class AIChat {
  constructor() {
    this.conversationId = null;
    this.leftWs = null;
    this.rightWs = null;
    
    // New state management
    this.conversationState = {
      isActive: false,
      currentSpeaker: null,
      lastMessageSide: null,
      messageCount: 0,
      leftBot: {
        name: '',
        personality: '',
        isTyping: false
      },
      rightBot: {
        name: '',
        personality: '',
        isTyping: false
      }
    };

    // DOM Elements
    this.leftBotSelect = document.getElementById('leftBotSelect');
    this.rightBotSelect = document.getElementById('rightBotSelect');
    this.leftName = document.getElementById('leftName');
    this.rightName = document.getElementById('rightName');
    this.leftPersonality = document.getElementById('leftPersonality');
    this.rightPersonality = document.getElementById('rightPersonality');
    this.leftCustomInputs = document.getElementById('leftCustomInputs');
    this.rightCustomInputs = document.getElementById('rightCustomInputs');
    this.leftPresetDisplay = document.getElementById('leftPresetDisplay');
    this.rightPresetDisplay = document.getElementById('rightPresetDisplay');
    this.topic = document.getElementById('topic');
    this.startBtn = document.getElementById('startBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.chatContainer = document.getElementById('chatContainer');
    this.typingIndicator = document.querySelector('.typing-indicator');

    // Initialize personality selectors
    this.initializePersonalitySelectors();
    
    // Set default personalities
    this.setDefaultPersonalities();

    // Bind event listeners
    this.startBtn.addEventListener('click', () => this.startConversation());
    this.stopBtn.addEventListener('click', () => this.stopConversation());
  }

  initializePersonalitySelectors() {
    // Populate dropdowns
    Object.entries(window.BOT_PERSONALITIES).forEach(([key, personality]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = personality.name;
      
      this.leftBotSelect.appendChild(option.cloneNode(true));
      this.rightBotSelect.appendChild(option);
    });
    
    // Add event listeners
    this.leftBotSelect.addEventListener('change', (e) => this.handlePersonalitySelect('left', e.target));
    this.rightBotSelect.addEventListener('change', (e) => this.handlePersonalitySelect('right', e.target));
  }

  setDefaultPersonalities() {
    // Set Paddy as default left bot
    this.leftBotSelect.value = 'paddy';
    this.handlePersonalitySelect('left', this.leftBotSelect);
    
    // Set Gandalf as default right bot
    this.rightBotSelect.value = 'gandalf';
    this.handlePersonalitySelect('right', this.rightBotSelect);

    // Set default topic
    this.topic.value = 'DigitalOcean is the simplist scalable cloud for AI and large businesses';
  }

  handlePersonalitySelect(side, selectElement) {
    const customInputs = document.getElementById(`${side}CustomInputs`);
    const presetDisplay = document.getElementById(`${side}PresetDisplay`);
    const nameInput = document.getElementById(`${side}Name`);
    const personalityInput = document.getElementById(`${side}Personality`);
    
    if (selectElement.value === 'custom') {
      customInputs.style.display = 'block';
      presetDisplay.style.display = 'none';
      
      // Clear custom inputs
      nameInput.value = '';
      personalityInput.value = '';
    } else if (selectElement.value === '') {
      customInputs.style.display = 'none';
      presetDisplay.style.display = 'none';
    } else {
      customInputs.style.display = 'none';
      const personality = window.BOT_PERSONALITIES[selectElement.value];
      
      // Update state
      if (side === 'left') {
        this.conversationState.leftBot.name = personality.name;
        this.conversationState.leftBot.personality = personality.prompt;
      } else {
        this.conversationState.rightBot.name = personality.name;
        this.conversationState.rightBot.personality = personality.prompt;
      }
      
      // Display personality details
      this.displayPersonality(side, personality);
    }
  }

  displayPersonality(side, personality) {
    const display = document.getElementById(`${side}PresetDisplay`);
    display.style.display = 'block';
    display.innerHTML = `
      <div class="personality-preview">
        <h6>${personality.name}</h6>
        <p class="text-muted small">${personality.prompt}</p>
      </div>
    `;
  }

  // Get the current personality for a side
  getPersonality(side) {
    const select = document.getElementById(`${side}BotSelect`);
    const nameInput = document.getElementById(`${side}Name`);
    const personalityInput = document.getElementById(`${side}Personality`);
    
    if (select.value === 'custom') {
      return {
        name: nameInput.value.trim(),
        prompt: personalityInput.value.trim()
      };
    } else {
      return window.BOT_PERSONALITIES[select.value];
    }
  }

  // Validate inputs before starting conversation
  validateInputs() {
    const leftPersonality = this.getPersonality('left');
    const rightPersonality = this.getPersonality('right');
    
    if (!leftPersonality || !leftPersonality.name || !leftPersonality.prompt) {
      this.showError('Please complete the left bot personality');
      return false;
    }
    
    if (!rightPersonality || !rightPersonality.name || !rightPersonality.prompt) {
      this.showError('Please complete the right bot personality');
      return false;
    }
    
    if (!this.topic.value.trim()) {
      this.showError('Please enter a conversation topic');
      return false;
    }
    
    return true;
  }

  // Start the conversation
  async startConversation() {
    if (!this.validateInputs()) return;

    try {
      // Clear previous messages
      while (this.chatContainer.firstChild) {
        this.chatContainer.removeChild(this.chatContainer.firstChild);
      }

      // Reset conversation state
      this.conversationState.currentSpeaker = null;
      this.conversationState.lastMessageSide = null;
      this.conversationState.messageCount = 0;

      // Get selected personalities
      const leftPersonality = this.getPersonality('left');
      const rightPersonality = this.getPersonality('right');
      
      // Initialize conversation
      const initResponse = await fetch('/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leftPersonality: {
            name: leftPersonality.name,
            prompt: leftPersonality.prompt
          },
          rightPersonality: {
            name: rightPersonality.name,
            prompt: rightPersonality.prompt
          },
          topic: this.topic.value.trim()
        })
      });

      if (!initResponse.ok) throw new Error('Failed to initialize conversation');
      
      const { conversationId } = await initResponse.json();
      this.conversationId = conversationId;

      // Setup WebSockets
      this.setupWebSockets();

      // Start the conversation
      const startResponse = await fetch('/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId })
      });

      if (!startResponse.ok) throw new Error('Failed to start conversation');

      // Update UI
      this.conversationState.isActive = true;
      this.startBtn.disabled = true;
      this.stopBtn.disabled = false;

      // Show initial typing indicator for right bot since left bot will send message immediately
      if (this.typingIndicator) {
        this.typingIndicator.textContent = `${rightPersonality.name} is thinking...`;
        this.typingIndicator.style.display = 'block';
      }

    } catch (error) {
      console.error('Error starting conversation:', error);
      this.showError(error.message);
    }
  }

  // Initialize WebSocket connections
  setupWebSockets() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsBase = `${wsProtocol}//${window.location.host}/ws`;
    
    console.log('Setting up WebSocket connections:', wsBase);

    // Setup left bot WebSocket
    this.leftWs = new WebSocket(`${wsBase}?conversationId=${this.conversationId}&side=left`);
    this.setupWebSocketHandlers(this.leftWs, 'left', this.leftName.value);

    // Setup right bot WebSocket
    this.rightWs = new WebSocket(`${wsBase}?conversationId=${this.conversationId}&side=right`);
    this.setupWebSocketHandlers(this.rightWs, 'right', this.rightName.value);
  }

  // Set up WebSocket event handlers
  setupWebSocketHandlers(ws, side, name) {
    let messageBuffer = '';
    let messageContainer = null;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'connected') {
        console.log(`${side} bot connected`);
        return;
      }

      if (data.type === 'thinking') {
        if (this.typingIndicator) {
          this.typingIndicator.style.display = 'block';
          // Show the other bot is thinking about their response
          const currentSide = this.conversationState.lastMessageSide;
          const thinkingSide = currentSide === 'left' ? 'right' : 'left';
          this.typingIndicator.textContent = `${this.getPersonality(thinkingSide).name} is thinking...`;
        }
        return;
      }

      if (data.type === 'completion') {
        if (this.typingIndicator) {
          this.typingIndicator.style.display = 'none';
        }
        
        // Clear message tracking
        messageContainer = null;
        messageBuffer = '';
        this.conversationState.currentSpeaker = null;
        
        // Scroll to bottom
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        return;
      }

      if (data.content) {
        // Only create a new message if this is the current speaker or no speaker is set
        if (this.conversationState.currentSpeaker === null || this.conversationState.currentSpeaker === side) {
          this.conversationState.currentSpeaker = side;
          this.conversationState.lastMessageSide = side;
          
          // Show typing indicator only if this isn't the first message from left bot
          if (!(side === 'left' && this.conversationState.messageCount === 0)) {
            if (this.typingIndicator) {
              this.typingIndicator.style.display = 'block';
              this.typingIndicator.textContent = `${this.getPersonality(side).name} is typing...`;
            }
          }
          
          // Create new message container if we don't have one
          if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.className = `message ${side}`;
            messageContainer.style.opacity = '0';
            messageContainer.style.transition = 'opacity 0.3s ease-in';
            
            // Add author name
            const author = document.createElement('div');
            author.className = 'author';
            author.textContent = this.getPersonality(side).name;
            messageContainer.appendChild(author);
            
            // Add message content container
            const content = document.createElement('div');
            content.className = 'content';
            messageContainer.appendChild(content);
            
            // Add to chat container
            this.chatContainer.appendChild(messageContainer);
            
            // Trigger fade in
            setTimeout(() => {
              messageContainer.style.opacity = '1';
            }, 50);

            // Increment message count
            this.conversationState.messageCount++;
          }
          
          // Append new content to buffer
          messageBuffer += data.content;
          
          // Update message content, removing any surrounding quotes
          const cleanedMessage = messageBuffer.replace(/^["']|["']$/g, '').trim();
          messageContainer.querySelector('.content').textContent = cleanedMessage;
          
          // Scroll to bottom
          this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
      }
    };

    ws.onclose = () => {
      console.log(`${side} WebSocket closed`);
      if (this.typingIndicator) {
        this.typingIndicator.style.display = 'none';
      }
      if (this.conversationState.isActive) {
        this.showError(`${this.getPersonality(side).name} disconnected. Please try refreshing the page.`);
      }
    };

    ws.onerror = (error) => {
      console.error(`${side} WebSocket error:`, error);
      this.showError(`Error with ${this.getPersonality(side).name}'s connection. Please try refreshing the page.`);
    };
  }

  // Show error message
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  // Stop the conversation
  async stopConversation() {
    try {
      const response = await fetch('/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: this.conversationId })
      });

      if (!response.ok) throw new Error('Failed to stop conversation');

      // Close WebSocket connections
      if (this.leftWs) this.leftWs.close();
      if (this.rightWs) this.rightWs.close();

      // Reset conversation state
      this.conversationState.isActive = false;
      this.conversationState.currentSpeaker = null;
      this.conversationState.lastMessageSide = null;
      this.conversationState.messageCount = 0;
      this.startBtn.disabled = false;
      this.stopBtn.disabled = true;

      // Hide typing indicator
      if (this.typingIndicator) {
        this.typingIndicator.style.display = 'none';
      }

      // Add end message
      const endMessage = document.createElement('div');
      endMessage.className = 'message text-center';
      endMessage.style.width = '100%';
      endMessage.style.backgroundColor = '#f8f9fa';
      endMessage.style.border = '1px solid #dee2e6';
      endMessage.textContent = '--- Conversation Ended ---';
      this.chatContainer.appendChild(endMessage);
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;

    } catch (error) {
      console.error('Error stopping conversation:', error);
      this.showError(error.message);
    }
  }
}

// Initialize the chat
document.addEventListener('DOMContentLoaded', () => {
  window.h2hChat = new AIChat();
}); 