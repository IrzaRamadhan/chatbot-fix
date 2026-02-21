const express = require('express');
require('dotenv').config({ override: true });
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
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.get('/', (req, res) => {
    res.render('index');
});

// API: Get active bot sessions
app.get('/api/sessions', (req, res) => {
    try {
        const session = require('./System/lib/session');
        const allSessions = session.getAll ? session.getAll() : {};
        res.json(allSessions);
    } catch (e) {
        res.json({});
    }
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
require('dotenv').config({ override: true });

const config = ${JSON.stringify(currentConfig, null, 4).replace(/"([^"]+)":/g, '$1:')}

// Force environment variable override
config.geminiApiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;

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

// API: Get Store Config
app.get('/api/store-config', (req, res) => {
    try {
        const storeConfigPath = path.join(__dirname, 'System/lib/database', 'store.json');
        if (fs.existsSync(storeConfigPath)) {
            const config = JSON.parse(fs.readFileSync(storeConfigPath, 'utf8'));
            res.json({ success: true, data: config });
        } else {
            res.json({ success: false, message: 'Store config not found' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Update Store Config
app.post('/api/store-config', (req, res) => {
    try {
        const storeConfigPath = path.join(__dirname, 'System/lib/database', 'store.json');
        const newConfig = req.body;

        fs.writeFileSync(storeConfigPath, JSON.stringify(newConfig, null, 2));

        // Reload in Biteship (if possible, or just require again)
        const biteship = require('./System/lib/biteship');
        if (biteship.reloadStoreConfig) {
            biteship.reloadStoreConfig();
        }

        res.json({ success: true, message: 'Store config updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Get Biteship Pickup Locations
app.get('/api/biteship/pickup-locations', async (req, res) => {
    try {
        const biteship = require('./System/lib/biteship');
        const locations = await biteship.getPickupLocations();
        res.json({ success: true, data: locations });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Search Biteship Area
app.get('/api/biteship/area', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ success: false, error: 'Query required' });
        }

        const biteship = require('./System/lib/biteship');
        const areas = await biteship.searchArea(query);
        res.json({ success: true, data: areas });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Get Address Book
app.get('/api/address-book', (req, res) => {
    try {
        const addressBookPath = path.join(__dirname, 'System/lib/database', 'address_book.json');
        if (fs.existsSync(addressBookPath)) {
            const addressBook = JSON.parse(fs.readFileSync(addressBookPath, 'utf8'));
            res.json({ success: true, data: addressBook });
        } else {
            res.json({ success: true, data: [] });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Add/Update Address Book Item
app.post('/api/address-book', (req, res) => {
    try {
        const addressBookPath = path.join(__dirname, 'System/lib/database', 'address_book.json');
        let addressBook = [];
        if (fs.existsSync(addressBookPath)) {
            addressBook = JSON.parse(fs.readFileSync(addressBookPath, 'utf8'));
        }

        const newAddress = req.body;
        if (!newAddress.id) {
            newAddress.id = Date.now().toString();
        }

        const existingIndex = addressBook.findIndex(a => a.id === newAddress.id);
        if (existingIndex >= 0) {
            addressBook[existingIndex] = newAddress;
        } else {
            addressBook.push(newAddress);
        }

        fs.writeFileSync(addressBookPath, JSON.stringify(addressBook, null, 2));
        res.json({ success: true, message: 'Address saved', data: newAddress });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Delete Address Book Item
app.delete('/api/address-book/:id', (req, res) => {
    try {
        const addressBookPath = path.join(__dirname, 'System/lib/database', 'address_book.json');
        if (!fs.existsSync(addressBookPath)) {
            return res.status(404).json({ success: false, error: 'Address book not found' });
        }

        let addressBook = JSON.parse(fs.readFileSync(addressBookPath, 'utf8'));
        const id = req.params.id;
        addressBook = addressBook.filter(a => a.id !== id);

        fs.writeFileSync(addressBookPath, JSON.stringify(addressBook, null, 2));
        res.json({ success: true, message: 'Address deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});



// API: WijayaPay Webhook Notification
app.post('/api/wijayapay/notification', async (req, res) => {
    try {
        console.log("WijayaPay Webhook Received:", JSON.stringify(req.body, null, 2));

        const { ref_id, status, status_transaction, amount, external_id } = req.body;

        const paymentStatus = (status || status_transaction || '').toUpperCase();
        const orderId = ref_id || external_id;

        if (paymentStatus === 'PAID' || paymentStatus === 'SUCCESS' || paymentStatus === 'SETTLEMENT') {
            const supabase = require('./System/lib/supabase');

            // 1. Update DB first (most important)
            const { data: order, error } = await supabase
                .from('orders')
                .update({ status: 'PAID' })
                .eq('id', orderId)
                .select()
                .single();

            if (error) {
                console.error("Supabase Update Error:", error);
                return res.status(500).json({ success: false, message: 'DB Update Failed' });
            }

            // DB updated successfully - respond to WijayaPay first
            res.json({ success: true, message: 'Order updated' });

            // 2. Notify User via WhatsApp (non-blocking, after response)
            if (order) {
                console.log(`Order ${orderId} PAID. Notifying user ${order.customer_phone}...`);
                try {
                    if (global.client && typeof global.client.sendMessage === 'function') {
                        const phone = order.customer_phone.replace(/\D/g, '');
                        const jid = `${phone}@s.whatsapp.net`;

                        const msg = `✅ *PEMBAYARAN BERHASIL*\n\nTerima kasih! Pembayaran untuk Order ID: *${orderId}* sebesar *Rp ${parseInt(order.total_amount).toLocaleString('id-ID')}* telah diterima.\n\nPesanan Anda akan segera diproses.`;

                        await global.client.sendMessage(jid, { text: msg });
                        console.log(`WA Notification sent to ${jid}`);
                    } else {
                        console.error("Global Client not available or sendMessage not found. Keys:", global.client ? Object.keys(global.client).slice(0, 5) : 'null');
                    }
                } catch (waError) {
                    console.error("WA Notification Error (non-blocking):", waError.message);
                }
            }
            return; // Already responded above
        }

        res.json({ success: true, message: 'Status ignored' });

    } catch (error) {
        console.error("WijayaPay Webhook Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Smart Location Search (Nominatim + Biteship)
app.get('/api/location-search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return res.status(400).json({ success: false, error: 'Query required' });

        const axios = require('axios');
        const biteship = require('./System/lib/biteship');

        // 1. Search Nominatim
        // We must provide a User-Agent to comply with Nominatim Usage Policy
        const nomRes = await axios.get(`https://nominatim.openstreetmap.org/search`, {
            params: {
                format: 'json',
                q: query,
                addressdetails: 1,
                limit: 1
            },
            headers: {
                'User-Agent': 'AmaninGuysBot/1.0 (admin@amaninguys.com)'
            }
        });

        const nomData = nomRes.data;
        let result = {
            latitude: null,
            longitude: null,
            address_components: null,
            areas: []
        };

        let biteshipQuery = query; // Default fallback

        if (nomData && nomData.length > 0) {
            const bestMatch = nomData[0];
            result.latitude = parseFloat(bestMatch.lat);
            result.longitude = parseFloat(bestMatch.lon);
            result.address_components = bestMatch.address;

            // Construct smarter Biteship Query
            if (bestMatch.address) {
                const addr = bestMatch.address;
                // Priority: Kecamatan (suburb/village/town) + City
                const district = addr.suburb || addr.village || addr.town || '';
                const city = addr.city || addr.municipality || addr.county || '';

                if (district && city) {
                    biteshipQuery = `${district}, ${city}`;
                } else if (city) {
                    biteshipQuery = city;
                }
            }
        }

        // 2. Search Biteship with refined query
        const areas = await biteship.searchArea(biteshipQuery);
        result.areas = areas;
        result.biteship_query = biteshipQuery;

        res.json({ success: true, data: result });

    } catch (error) {
        console.error('Location search error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Get Address Book
app.get('/api/address-book', (req, res) => {
    try {
        const addressBookPath = path.join(__dirname, 'System/lib/database', 'address_book.json');
        if (fs.existsSync(addressBookPath)) {
            const addressBook = JSON.parse(fs.readFileSync(addressBookPath, 'utf8'));
            res.json({ success: true, data: addressBook });
        } else {
            res.json({ success: true, data: [] });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Add/Update Address Book Item
app.post('/api/address-book', (req, res) => {
    try {
        const addressBookPath = path.join(__dirname, 'System/lib/database', 'address_book.json');
        let addressBook = [];
        if (fs.existsSync(addressBookPath)) {
            addressBook = JSON.parse(fs.readFileSync(addressBookPath, 'utf8'));
        }

        const newAddress = req.body;
        if (!newAddress.id) {
            newAddress.id = Date.now().toString();
        }

        const existingIndex = addressBook.findIndex(a => a.id === newAddress.id);
        if (existingIndex >= 0) {
            addressBook[existingIndex] = newAddress;
        } else {
            addressBook.push(newAddress);
        }

        fs.writeFileSync(addressBookPath, JSON.stringify(addressBook, null, 2));
        res.json({ success: true, message: 'Address saved', data: newAddress });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// API: Delete Address Book Item
app.delete('/api/address-book/:id', (req, res) => {
    try {
        const addressBookPath = path.join(__dirname, 'System/lib/database', 'address_book.json');
        if (!fs.existsSync(addressBookPath)) {
            return res.status(404).json({ success: false, error: 'Address book not found' });
        }

        let addressBook = JSON.parse(fs.readFileSync(addressBookPath, 'utf8'));
        const id = req.params.id;
        addressBook = addressBook.filter(a => a.id !== id);

        fs.writeFileSync(addressBookPath, JSON.stringify(addressBook, null, 2));
        res.json({ success: true, message: 'Address deleted' });
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
