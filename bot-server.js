const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const path = require('path');
const fs = require('fs');
const { start, reset, getSession } = require('./bot');

app.set('view engine', 'ejs');
// app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    next();
});

app.get('/', (req, res) => {
    res.render('index');
});

// API: Get current config
app.get('/api/config', (req, res) => {
    try {
        const config = require('./settings/config');
        res.json({
            success: true,
            data: {
                owner: config.owner,
                botNumber: config.botNumber,
                setPair: config.setPair,
                thumbUrl: config.thumbUrl,
                public: config.status.public,
                terminal: config.status.terminal,
                reactsw: config.status.reactsw
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Update config
app.post('/api/config', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'settings', 'config.js');
        const currentConfig = require('./settings/config');

        // Update config values
        if (req.body.owner) currentConfig.owner = req.body.owner;
        if (req.body.botNumber) currentConfig.botNumber = req.body.botNumber;
        if (req.body.setPair) currentConfig.setPair = req.body.setPair;
        if (req.body.thumbUrl) currentConfig.thumbUrl = req.body.thumbUrl;
        if (req.body.public !== undefined) currentConfig.status.public = req.body.public;
        if (req.body.terminal !== undefined) currentConfig.status.terminal = req.body.terminal;
        if (req.body.reactsw !== undefined) currentConfig.status.reactsw = req.body.reactsw;

        // Write back to file
        const configContent = `const fs = require('fs')

const config = ${JSON.stringify(currentConfig, null, 4).replace(/"([^"]+)":/g, '$1:')}

module.exports = config;

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
    require('fs').unwatchFile(file)
    console.log('\\\\x1b[0;32m' + __filename + ' \\\\x1b[1;32mupdated!\\\\x1b[0m')
    delete require.cache[file]
    require(file)
})
`;

        fs.writeFileSync(configPath, configContent);

        res.json({ success: true, message: 'Config updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Start pairing
app.post('/api/pairing', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ success: false, error: 'Phone number required' });
        }

        const cleanedNumber = phoneNumber.replace(/\D/g, '');

        console.log(`API Pairing request for: ${cleanedNumber}`);

        // Broadcast to websocket clients
        io.emit('pairing-request', cleanedNumber);
        io.emit('log', `Pairing request for ${cleanedNumber}`);

        // Start pairing process - pass io for broadcasting
        // IMPORTANT: index.js clientstart needs socket/io to emit pairing-code
        start(io, cleanedNumber).catch(err => {
            console.error('Pairing start error:', err);
            io.emit('log', `Pairing error: ${err.message}`);
        });

        res.json({ success: true, message: 'Pairing initiated' });
    } catch (error) {
        console.error('API pairing error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Reset session
app.post('/api/reset', (req, res) => {
    try {
        reset();
        res.json({ success: true, message: 'Session reset successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Get bot status
let botStatus = 'offline';
app.get('/api/status', (req, res) => {
    res.json({ success: true, status: botStatus });
});

// API: Get session details
app.get('/api/session', (req, res) => {
    try {
        const session = getSession();
        res.json({ success: true, data: session });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Capture console logs
const originalLog = console.log;
const originalError = console.error;

function broadcastLog(message) {
    io.emit('log', message);
}

console.log = function (...args) {
    const msg = args.map(arg => (typeof arg === 'object' && arg !== null) ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    originalLog.apply(console, args);
    broadcastLog(msg);
};

console.error = function (...args) {
    const msg = args.map(arg => (typeof arg === 'object' && arg !== null) ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    originalError.apply(console, args);
    broadcastLog(`[ERROR] ${msg}`);
};

let botSocket = null;

io.on('connection', (socket) => {
    console.log('Web client connected');
    botSocket = socket;

    // Send current status
    socket.emit('status', botStatus);

    // Attempt to connect with existing session if possible
    // We pass the socket so it can receive status updates
    start(io, null).catch(err => {
        // If it fails (e.g. restart loop), we log it
        console.error('Bot start error:', err);
    });

    socket.on('start-pairing', (number) => {
        console.log(`Initiating pairing for: ${number}`);
        // Ensure format is correct (digits only)
        const cleanedNumber = number.replace(/\D/g, '');
        start(io, cleanedNumber).catch(err => console.error(err));
    });

    socket.on('reset-pairing', () => {
        console.log('Received reset request');
        reset();
        botStatus = 'offline';
        io.emit('status', botStatus);
    });

    socket.on('disconnect', () => {
        console.log('Web client disconnected');
    });
});

// Update bot status function
global.updateBotStatus = (status) => {
    botStatus = status;
    io.emit('status', status);
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    originalLog(`Server running on http://localhost:${PORT}`);
});
