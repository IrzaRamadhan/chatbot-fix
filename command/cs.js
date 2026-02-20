const session = require('../System/lib/session');
const fs = require('fs');
const path = require('path');

const ADMIN_JID = '6285124153817@s.whatsapp.net';

module.exports = async (m, { client, reply, pushname }) => {
    const senderNumber = m.sender.split('@')[0];

    // Tell customer to wait
    await reply(`Baik kak ${pushname || ''}, admin kami akan segera merespons di chat ini ya. Mohon ditunggu sebentar 🙏`);

    // Set session to "cs_mode" so AI doesn't auto-reply
    session.add(m.sender, 'cs', { startedAt: Date.now() });

    // Notify admin via self-chat (send as image so it shows up)
    const notif = `🔔 *PERMINTAAN CHAT CS*\n\n` +
        `👤 *Customer:* ${pushname || 'Unknown'}\n` +
        `📱 *No HP:* ${senderNumber}\n` +
        `⏰ *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n` +
        `Buka chat *${senderNumber}* di WA Bot untuk membalas.\n` +
        `Ketik *.endcs ${senderNumber}* jika sudah selesai.`;

    const thumbnail = fs.readFileSync(path.join(__dirname, '../System/lib/media/menu.jpg'));
    await client.sendMessage(ADMIN_JID, {
        image: thumbnail,
        caption: notif
    });
};

module.exports.command = ['cs', 'chatcs', 'bantuan'];
module.exports.tags = ['main'];
module.exports.help = ['cs'];
