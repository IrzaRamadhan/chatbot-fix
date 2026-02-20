const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require("baileys");
const wijayaPay = require('../System/lib/wijayapay');
const QRCode = require('qrcode');
const supabase = require("../System/lib/supabase");

module.exports = async (m, { client, args, reply }) => {
    // 1. Parse Nominal
    const nominalRaw = args[0];
    if (!nominalRaw) return reply("⚠️ Gunakan format: *.generate <nominal>*\nContoh: *.generate 10000*");

    const nominal = parseInt(nominalRaw.replace(/[^0-9]/g, ''));
    if (isNaN(nominal) || nominal < 100) return reply("⚠️ Nominal tidak valid (min 100).");

    await reply(`⏳ Membuat Test QRIS senilai Rp ${nominal.toLocaleString('id-ID')}...`);

    try {
        // 2. Insert Dummy Order to DB (so webhook works)
        const phone = m.sender.split('@')[0];
        const dummyId = `TEST-${Date.now()}`; // For fallback

        // We try to insert to get a valid UUID from DB if needed, 
        // or just insert what we can. 
        // Schema says ID is UUID Default.
        // Let's insert and see what ID we get.

        let refId = dummyId;

        const { data: orderData, error: dbError } = await supabase
            .from('orders')
            .insert({
                customer_phone: phone,
                total_amount: nominal,
                product_id: 'DEV-TEST',
                status: 'pending_payment',
                shipping_cost: 0,
                created_at: new Date()
            })
            .select()
            .single();

        if (orderData && !dbError) {
            refId = orderData.id;
        } else {
            console.error("DB Insert Error (Dev):", dbError);
            // If DB fails, we proceed with dummyId, but Webhook won't verify it.
        }

        // 3. Call WijayaPay
        const transaction = await wijayaPay.createTransaction(refId, nominal);

        if (transaction && transaction.success && transaction.data && transaction.data.qr_string) {
            const qrString = transaction.data.qr_string;
            const qrBuffer = await QRCode.toBuffer(qrString);

            await client.sendMessage(m.chat, {
                image: qrBuffer,
                caption: `✅ *TEST QRIS*
💰 Nominal: Rp ${nominal.toLocaleString('id-ID')}
🆔 Order ID: \`${refId}\`
(via WijayaPay)

*Tips:* Bayar QR ini, lalu tunggu notifikasi Payment Successful.`
            }, { quoted: m });

        } else {
            console.error("WijayaPay Dev Error:", transaction);
            const errMsg = transaction ? transaction.message : "No response";
            reply(`❌ Gagal generate QRIS.\nMsg: ${errMsg}`);
        }
    } catch (e) {
        console.error("Error generate:", e);
        reply("❌ Error: " + e.message);
    }
};

module.exports.command = ['generate', 'gen'];
module.exports.tags = ['developer'];
module.exports.help = ['generate <nominal>'];
