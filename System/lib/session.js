const fs = require('fs');
const path = require('path');

const sessionFile = path.resolve(__dirname, 'sessions.json');

// Load sessions from file or initialize empty
let sessions = {};
if (fs.existsSync(sessionFile)) {
    try {
        sessions = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    } catch (e) {
        sessions = {};
    }
}

function saveSessions() {
    fs.writeFileSync(sessionFile, JSON.stringify(sessions, null, 2));
}

exports.add = (jid, handler, data = {}) => {
    sessions[jid] = { handler, data };
    saveSessions();
};

exports.get = (jid) => {
    return sessions[jid];
};

exports.delete = (jid) => {
    delete sessions[jid];
    saveSessions();
};

exports.getAll = () => {
    return { ...sessions };
};
