const biteship = require('../System/lib/biteship');
const supabase = require('../System/lib/supabase');

module.exports = async (m, { client, reply, args, isOwner, prefix, command }) => {
    if (!isOwner) return reply("❌ Khusus Admin/Owner.");

    let userPhone = args[0];

    // If no phone provided, check if replying to a message with a phone number (e.g., from the order notification)
    if (!userPhone && m.quoted) {
        // Try to extract phone number from the quoted message text "JID: 628..."
        const quotedText = m.quoted.text || m.quoted.caption || "";
        const match = quotedText.match(/JID:\s*(\d+)/);
        if (match) {
            userPhone = match[1];
        } else {
            // Or if replying to the user's message forwarded by bot? 
            // In ongkir.js we sent a text notification with "JID: ..." so the regex should work.
        }
    }

    if (!userPhone) return reply(`⚠️ Format salah.\nKetik: ${prefix}${command} [NomorWA]\nAtau Reply pesan notifikasi order dengan .acc`);

    userPhone = userPhone.replace(/[^0-9]/g, '');
    await reply(`⏳ Memproses validasi order untuk ${userPhone}...`);

    try {
        // 1. Find Pending Order
        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('customer_phone', userPhone)
            .eq('status', 'pending_verification')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !order) {
            console.error("Supabase Find Order Error:", error);
            return reply("❌ Tidak ada order status 'pending_verification' untuk user tersebut.");
        }

        // 2. Confirm Draft Order in Biteship
        // Note: This DEDUCTS BALANCE
        let trackingId, waybillId;

        try {
            const result = await biteship.confirmOrder(order.biteship_draft_id);
            if (!result || !result.success) {
                // Sometimes success is not explicitly true but data is returned? 
                // Let's assume result IS the order object if it has 'id'.
                if (result && result.id) {
                    // Success
                } else {
                    throw new Error("Biteship Confirm Failed: " + JSON.stringify(result));
                }
            }
            trackingId = result.id;
            waybillId = result.courier ? result.courier.waybill_id : "WAITING_PICKUP";
        } catch (biteshipError) {
            console.error("Biteship Error:", biteshipError);
            return reply("❌ Gagal confirm ke Biteship. Cek saldo atau draft ID.");
        }

        // 3. Update Database
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                status: 'paid',
                biteship_order_id: trackingId,
                biteship_waybill_id: waybillId
            })
            .eq('id', order.id);

        if (updateError) {
            console.error("DB Update Error", updateError);
            reply("⚠️ Order confirmed di Biteship tapi gagal update status DB.");
        } else {
            reply(`✅ *Order Sukses Diproses*\n\nUser: ${userPhone}\nResi: ${waybillId || 'Menunggu Kurir'}\nStatus: Paid & Processed via Biteship`);
        }

        // 4. Notify User
        const userJid = userPhone + '@s.whatsapp.net';
        await client.sendMessage(userJid, {
            text: `✅ *Pembayaran Diterima!*\n\nTerima kasih, pembayaran Anda telah diverifikasi.\n\n📦 *No Resi:* ${waybillId || 'Sedang diproses kurir'}\n🚚 *Kurir:* ${order.courier_company} - ${order.courier_service}\n\nPaket akan segera diserahkan ke kurir.`
        });

    } catch (e) {
        console.error("Admin Process Error:", e);
        reply(`❌ Gagal memproses order.\nError: ${e.message}`);
    }
};

module.exports.command = ['acc', 'confirm_order'];
module.exports.tags = ['admin'];
