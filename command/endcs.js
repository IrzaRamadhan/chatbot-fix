const session = require('../System/lib/session');
const config = require('../settings/config');

module.exports = async (m, { client, reply, args, isOwner }) => {
    if (!isOwner && !m.key.fromMe) return reply("❌ Hanya Admin yang bisa menggunakan perintah ini.");

    const targetNumber = args[0];
    if (!targetNumber) {
        return reply("⚠️ Gunakan: *.endcs <nomorHP>*\nContoh: `.endcs 6287728892890`");
    }

    const targetJid = targetNumber.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

    // Check if user has cs session
    const userSession = session.get(targetJid);
    if (!userSession || userSession.handler !== 'cs') {
        return reply(`⚠️ Nomor ${targetNumber} tidak sedang dalam mode CS.`);
    }

    // Clear CS session
    session.delete(targetJid);

    // Notify customer
    await client.sendMessage(targetJid, {
        text: `✅ Sesi chat dengan CS telah selesai.\n\nTerima kasih sudah menghubungi kami kak! 🙏\nJika butuh bantuan lagi, jangan ragu untuk chat ya 😊`
    });

    await reply(`✅ Mode CS untuk *${targetNumber}* telah diakhiri.`);
};

module.exports.command = ['endcs', 'closecs'];
module.exports.tags = ['admin'];
module.exports.help = ['endcs <nomorHP>'];
