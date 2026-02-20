const supabase = require('../System/lib/supabase');
const config = require('../settings/config');

module.exports = async (m, { client, reply, args }) => {
    // Only owner/admin/self-chat can use this
    const senderNumber = m.sender.split('@')[0];
    if (senderNumber !== config.owner && senderNumber !== config.botNumber && !m.key.fromMe) {
        return reply("❌ Hanya Admin yang bisa menggunakan perintah ini.");
    }

    const orderId = args[0];
    if (!orderId) {
        return reply("⚠️ Gunakan: *.acc <Order ID>*\nContoh: `.acc 65eab6d9-5651-4ac0-9108-7c5fbbfec698`");
    }

    try {
        // 1. Fetch order details
        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (fetchErr || !order) {
            return reply(`❌ Order ID \`${orderId}\` tidak ditemukan.`);
        }

        // If already PAID, we still proceed to resend notification
        const { error: updateErr } = await supabase
            .from('orders')
            .update({ status: 'PAID' })
            .eq('id', orderId);

        if (updateErr) {
            console.error("ACC Update Error:", updateErr);
            return reply("❌ Gagal update status order.");
        }

        // 3. Get product name
        let productName = 'Unknown Product';
        if (order.product_id) {
            const { data: product } = await supabase
                .from('product')
                .select('NameProd')
                .eq('IDprod', order.product_id)
                .single();
            if (product) productName = product.NameProd;
        }

        // 4. Build "TRANSAKSI BERHASIL" message
        const customerPhone = order.customer_phone.replace(/\D/g, '');
        const customerJid = `${customerPhone}@s.whatsapp.net`;

        const now = new Date();
        const tanggal = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const msg = `┌─────────────────────┐\n` +
            `  ｢ *TRANSAKSI BERHASIL* ｣\n` +
            `└─────────────────────┘\n\n` +
            `📅 *TANGGAL :* ${tanggal}\n` +
            `⏰ *JAM :* ${jam}\n` +
            `✨ *STATUS :* Berhasil\n\n` +
            `📦 *DETAIL PESANAN:*\n` +
            `  ▢ Produk: ${productName}\n` +
            `  ▢ Jumlah: ${order.quantity || '-'}\n` +
            `  ▢ Ongkir: Rp ${parseInt(order.shipping_cost || 0).toLocaleString('id-ID')}\n` +
            `  ▢ Total: *Rp ${parseInt(order.total_amount).toLocaleString('id-ID')}*\n` +
            `  ▢ Kurir: ${order.courier_company || '-'} - ${order.courier_service || '-'}\n\n` +
            `Terimakasih sudah berbelanja! 🙏\n` +
            `Pesanan Anda akan segera diproses.\n🔔`;

        // 5. Send to Admin (reply in same chat)
        await reply(`✅ Order \`${orderId}\` → *PAID*`);

        // 6. Send to Customer
        try {
            await client.sendMessage(customerJid, { text: msg });
            console.log(`ACC: Notification sent to ${customerJid}`);
        } catch (sendErr) {
            console.error("ACC sendMessage Error:", sendErr.message);
            // Fallback: send in current chat
            await reply("⚠️ Gagal kirim ke customer, mengirim di sini:");
        }

        // 7. Also show in admin chat for confirmation
        await reply(msg);

    } catch (error) {
        console.error("ACC Error:", error);
        reply("❌ Terjadi kesalahan: " + error.message);
    }
};

module.exports.command = ['acc', 'done', 'konfirmasi'];
module.exports.tags = ['admin'];
module.exports.help = ['acc <orderId>'];
