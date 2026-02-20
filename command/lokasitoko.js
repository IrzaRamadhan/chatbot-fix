const fs = require('fs');
const path = require('path');

module.exports = async (m, { client, reply }) => {
    try {
        const storePath = path.join(__dirname, '..', 'System', 'lib', 'database', 'store.json');

        if (!fs.existsSync(storePath)) {
            return reply("❌ Data toko belum dikonfigurasi.");
        }

        const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

        const mapsUrl = `https://www.google.com/maps?q=${store.latitude},${store.longitude}`;

        const msg = `📍 *LOKASI TOKO*\n\n` +
            `🏪 *Nama:* ${store.name || store.contact_name || '-'}\n` +
            `📞 *Telepon:* ${store.phone || '-'}\n` +
            `📮 *Kode Pos:* ${store.postal_code || '-'}\n` +
            `🏠 *Alamat:*\n${store.address || '-'}\n\n` +
            `🌐 *Koordinat:*\n` +
            `  Lat: ${store.latitude}\n` +
            `  Lng: ${store.longitude}\n\n` +
            `🗺️ *Buka di Google Maps:*\n${mapsUrl}`;

        await reply(msg);

    } catch (error) {
        console.error("Error lokasitoko:", error);
        reply("❌ Gagal memuat info toko.");
    }
};

module.exports.command = ['lokasitoko', 'toko', 'alamattoko'];
module.exports.tags = ['info'];
module.exports.help = ['lokasitoko'];
