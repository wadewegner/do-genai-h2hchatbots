# AI Head-to-Head Chat Application

This application demonstrates a unique chat interface where two AI personalities engage in a conversation about a given topic using DigitalOcean's GenAI Platform. It features real-time streaming responses, WebSocket communication, and dynamic personality selection.

## Architecture

### Chat Service

The `ChatService` manages the core chat functionality:
- Handles two simultaneous AI personalities in conversation
- Maintains separate WebSocket connections for each bot
- Manages conversation state and turn-taking
- Processes streaming responses from both AIs
- Handles conversation history and context

### AI Service

The `AIService` handles communication with DigitalOcean's GenAI Platform:
- Manages API requests to the AI endpoint
- Handles streaming responses
- Processes prompts and personalities
- Maintains conversation context

### WebSocket Manager

The `WebSocketManager` handles real-time communication:
- Manages separate connections for each AI personality
- Handles message streaming for both bots
- Manages connection lifecycle
- Provides real-time typing indicators

## Setup

### Prerequisites

- Node.js 18 or higher
- npm
- A DigitalOcean GenAI Platform account with:
  - An Agent ID
  - An Agent Key
  - An Agent Endpoint

### Environment Variables

Create a `.env` file in the root directory:

```env
# For local development only, App Platform will set PORT automatically
PORT=3000

# Required environment variables
AGENT_ENDPOINT=your-agent-endpoint
SESSION_SECRET=your-session-secret
```

**Note**: When deploying to DigitalOcean App Platform, do not set the `PORT` environment variable as it is automatically managed by the platform.

### Installation

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev

# Start production server
npm start
```

## Running Tests

The application includes tests for core components:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Features

### AI Personalities

- Pre-configured personality options:
  - Various character types and expertise levels
  - Customizable personalities
  - Dynamic personality switching

### Real-time Chat

- Streaming responses from both AIs
- Turn-based conversation flow
- Real-time typing indicators
- Automatic conversation management
- Natural dialogue progression

### User Interface

- Clean, modern design
- Mobile-responsive layout
- Easy personality selection
- Topic customization
- Conversation controls
- Message history display

### Technical Features

- WebSocket-based communication
- Real-time streaming responses
- Session management
- Error handling and recovery
- Conversation state management

## DigitalOcean Deployment Requirements

To deploy this application on DigitalOcean:

1. **App Platform Setup**:
   - Deploy as a single container/instance
   - Set required environment variables
   - Configure health checks

2. **GenAI Platform Requirements**:
   - Create an AI Agent in your DigitalOcean account
   - Configure the agent endpoint
   - Set up the agent endpoint URL (must end with `/api/v1/`)

For detailed instructions on setting up and using AI Agents, refer to:
- [DigitalOcean GenAI Platform Documentation](https://docs.digitalocean.com/products/genai-platform/how-to/manage-ai-agent/use-agent/)
- [Early Access Documentation](https://docs.digitalocean.com/products/genai-platform/)

## Security Notes

- Never commit your `.env` file
- Use a strong `SESSION_SECRET`
- The application validates environment variables on startup
- WebSocket connections are authenticated
- Sessions are managed securely

## License

ISC License 