const fs = require('fs');
const path = require('path');
const biteship = require('../System/lib/biteship');

const STORE_CONFIG_PATH = path.join(__dirname, '../System/lib/database', 'store.json');

module.exports = async (m, { reply, args, isOwner }) => {
    if (!isOwner) return reply("❌ Maaf, perintah ini hanya untuk Owner/Admin.");

    // Load current config
    let config = {};
    try {
        if (fs.existsSync(STORE_CONFIG_PATH)) {
            config = JSON.parse(fs.readFileSync(STORE_CONFIG_PATH, 'utf8'));
        }
    } catch (e) {
        return reply("❌ Gagal membaca file konfigurasi toko.");
    }

    // Case 1: No arguments -> Show current config
    if (!args[0]) {
        let text = `🏪 *Konfigurasi Toko Saat Ini*\n\n`;
        text += `🏷️ *Nama:* ${config.name || '-'}\n`;
        text += `📞 *No HP:* ${config.phone || '-'}\n`;
        text += `📍 *Alamat:* ${config.address || '-'}\n`;
        text += `🏘️ *ID Area:* ${config.area_id || '-'}\n`;
        text += `📮 *Kode Pos:* ${config.postal_code || '-'}\n`;
        text += `🌐 *Lat/Long:* ${config.latitude},${config.longitude}\n\n`;
        text += `*Cara Ubah:* \n.setshop [key] [value]\n\n`;
        text += `*Contoh:* \n.setshop name Toko Baru\n.setshop address Jl. Mawar No 10\n.setshop area_id IDNP12345`;
        return reply(text);
    }

    const key = args[0].toLowerCase();
    const value = args.slice(1).join(' ');

    if (!value) return reply(`❌ Masukkan nilai baru untuk *${key}*.`);

    // Validation/Mapping
    const validKeys = ['name', 'phone', 'address', 'area_id', 'postal_code', 'latitude', 'longitude'];

    if (!validKeys.includes(key)) {
        return reply(`❌ Key tidak valid. Pilihan: ${validKeys.join(', ')}`);
    }

    // Special handling for numbers
    if (key === 'latitude' || key === 'longitude') {
        const num = parseFloat(value);
        if (isNaN(num)) return reply("❌ Nilai harus berupa angka.");
        config[key] = num;
    } else {
        config[key] = value;
    }

    // Save Config
    try {
        fs.writeFileSync(STORE_CONFIG_PATH, JSON.stringify(config, null, 2));
    } catch (e) {
        console.error(e);
        return reply("❌ Gagal menyimpan konfigurasi.");
    }

    // Reload in Biteship
    if (biteship.reloadStoreConfig) {
        biteship.reloadStoreConfig();
    }

    await reply(`✅ Berhasil mengubah *${key}* menjadi:\n${value}`);
};

module.exports.command = ['setshop', 'setstore'];
module.exports.tags = ['admin'];
module.exports.help = ['setshop'];
