const fs = require('fs');
const path = require('path');

module.exports = async (m, { client, reply }) => {
    try {
        const storePath = path.resolve(__dirname, '../System/lib/database/store.json');

        if (!fs.existsSync(storePath)) {
            return reply("Maaf, Data Toko belum diatur.");
        }

        const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

        let caption = `*📍 ALAMAT TOKO AKTIF SAAT INI*
        
🏢 *Nama Toko:* ${store.name || '-'}
👤 *Nama Pengirim:* ${store.contact_name || '-'}
📞 *Nomor Pengirim:* ${store.phone || '-'}
        
🏠 *Alamat Lengkap:*
${store.address || '-'}
        
📮 *Kode Pos:* ${store.postal_code || '-'}`;

        // Send the text caption first
        await reply(caption);

        // Send Location Pin Point if available
        if (store.latitude && store.longitude) {
            await client.sendMessage(m.chat, {
                location: {
                    degreesLatitude: parseFloat(store.latitude),
                    degreesLongitude: parseFloat(store.longitude),
                    name: store.name,
                    address: store.address
                }
            }, { quoted: m });
        } else {
            await reply("⚠️ *Catatan:* Detail lokasi peta (Pin Point) belum tersedia. Silakan atur ulang alamat lewat Web Admin."); // Optional warning
        }

    } catch (e) {
        console.error(e);
        reply("Terjadi kesalahan saat mengambil data alamat.");
    }
};

module.exports.command = ['alamatnow', 'cekalamat'];
module.exports.tags = ['main'];
module.exports.help = ['alamatnow'];
