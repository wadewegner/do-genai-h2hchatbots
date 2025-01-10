require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');
const { WebSocketServer } = require('ws');
const url = require('url');
const { router: chatRouter, setupWebSocket } = require('./routes/chat');

const app = express();

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/', chatRouter);

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Something broke!' });
});

// Add health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Create HTTP server
const server = require('http').createServer(app);

// Create WebSocket servers
const wss = new WebSocketServer({ noServer: true });

// Keep track of ping intervals
const pingIntervals = new Map();

// Set up WebSocket upgrade handling
server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;

    if (pathname === '/ws') {
        // Handle WebSocket connections
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
});

// Set up WebSocket handlers
setupWebSocket(wss);

// Clean up intervals on shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    
    // Clear all ping intervals
    for (const interval of pingIntervals.values()) {
        clearInterval(interval);
    }
    pingIntervals.clear();
    
    // Close WebSocket server
    wss.close(() => {
        console.log('WebSocket server closed.');
        // Close HTTP server
        server.close(() => {
            console.log('HTTP server closed.');
            process.exit(0);
        });
    });
    
    // Force close after 10s
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 