const sessions = {};

exports.add = (jid, handler, data = {}) => {
    sessions[jid] = { handler, data };
};

exports.get = (jid) => {
    return sessions[jid];
};

exports.delete = (jid) => {
    delete sessions[jid];
};
