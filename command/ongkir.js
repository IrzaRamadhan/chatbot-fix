const session = require('../System/lib/session');
const biteship = require('../System/lib/biteship');
const supabase = require("../System/lib/supabase");
const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require("baileys");

const ORIGIN_AREA_ID = 'IDNP11IDNC434IDND5425IDZ60231'; // Ketintang, Surabaya
const QRIS_DATA = "00020101021126610014COM.GO-JEK.WWW01189360091438156980690210G8156980690303UMI51440014ID.CO.QRIS.WWW0215ID10254460000570303UMI5204581653033605802ID5925IRZA%20MAULANA%20RAMADHAN,%20Ga6007SUMBAWA61058431662070703A0163041CB7";
const OWNER_NUMBER = "6285124153817@s.whatsapp.net"; // Admin/Owner Number updated

// Main handler for the command (.ongkir_start)
module.exports = async (m, { reply, args }) => {
    const productId = args[0];
    if (!productId) return reply("Product ID missing.");

    // Start session directly with parse_form
    session.add(m.sender, 'ongkir', { productId, stage: 'parse_form' });

    const formTemplate =
        `📝 *Formulir Pemesanan*
Silakan Salin & Isi data berikut (Jangan ubah format):

Jumlah Pesanan (Angka): 
Nama Penerima: 
No HP: 
Alamat Lengkap: 
Kecamatan: 
Kota: 
Kode Pos: `;

    await reply(formTemplate);
};

// Handler for user input
module.exports.handleInput = async (m, { client, reply, fetchJson }, userState) => {
    try {
        const body = m.body || m.text || "";
        const isImage = m.mtype === 'imageMessage';

        // ----- STAGE 1: PARSE FORM (Combined) -----
        if (userState.data.stage === 'parse_form') {
            const formData = parseForm(body);

            // Validation
            if (!formData.name || !formData.phone || !formData.address || !formData.district || !formData.city || !formData.quantity) {
                // Check if it's just a number (fallback for old flow users?) 
                // No, strict form.
                return reply("⚠️ Data tidak lengkap. Pastikan *Jumlah Pesanan*, Nama, No HP, Alamat, Kecamatan, dan Kota terisi.\n\nSilakan kirim ulang formnya.");
            }

            const qty = parseInt(formData.quantity);
            if (isNaN(qty) || qty < 1) return reply("⚠️ Jumlah pesanan harus angka valid (minimal 1).");

            userState.data.quantity = qty;

            await reply("🔍 Sedang mencari lokasi dan menghitung ongkir...");

            // 1. Search Destination Area
            const query = `${formData.district}, ${formData.city}, ${formData.postal_code}`;
            const areas = await biteship.searchArea(query);

            if (!areas || areas.length === 0) {
                // Try broader search
                const areasBroader = await biteship.searchArea(`${formData.district}, ${formData.city}`);
                if (!areasBroader || areasBroader.length === 0) {
                    return reply("❌ Lokasi tidak ditemukan di database kurir.\nPastikan penulisan Kecamatan dan Kota benar.");
                }
                userState.data.areaId = areasBroader[0].id; // Pick first match
                userState.data.areaName = areasBroader[0].name;
            } else {
                userState.data.areaId = areas[0].id;
                userState.data.areaName = areas[0].name;
            }

            // Save consignee data
            userState.data.consignee = {
                name: formData.name,
                phone: formData.phone,
                address: formData.address, // Full address
                area_id: userState.data.areaId,
                postal_code: formData.postal_code || areas[0].postal_code
            };

            // 2. Get Product Data
            const { data: product, error } = await supabase
                .from('product')
                .select('WeightProd, PriceProd, NameProd')
                .eq('IDprod', userState.data.productId)
                .single();

            if (error || !product) {
                console.error("Supabase Error:", error);
                session.delete(m.sender);
                return reply("❌ Gagal mengambil data produk.");
            }

            // 3. Get Rates
            const weightPerItem = product.WeightProd || 1000;
            const totalWeight = weightPerItem * userState.data.quantity;
            const items = [{
                name: product.NameProd,
                value: product.PriceProd,
                weight: weightPerItem,
                quantity: userState.data.quantity
            }];

            const rates = await biteship.getRates(ORIGIN_AREA_ID, userState.data.areaId, totalWeight, items);

            if (!rates?.pricing?.length) {
                return reply("⚠️ Tidak ada kurir yang tersedia. Coba perbaiki alamat (Kecamatan/Kota).");
            }

            const sortedRates = rates.pricing.sort((a, b) => a.price - b.price).slice(0, 10);

            // Store Data
            userState.data.rates = sortedRates;
            userState.data.productPrice = product.PriceProd;
            userState.data.productName = product.NameProd;
            userState.data.totalWeight = totalWeight;
            userState.data.items = items;
            userState.data.stage = 'select_courier';
            session.add(m.sender, 'ongkir', userState.data); // SAVE STATE

            // Send Courier List
            await sendCourierList(client, m, sortedRates, product.NameProd, totalWeight, userState.data.areaName);
        }

        // ----- STAGE 2: SELECT COURIER -----
        else if (userState.data.stage === 'select_courier') {
            if (!body.startsWith('shipping_select_')) return;

            const index = parseInt(body.split('_')[2]);
            const rates = userState.data.rates;

            if (isNaN(index) || !rates[index]) return reply("❌ Pilihan tidak valid.");

            userState.data.selectedRate = rates[index];
            userState.data.stage = 'review_order';
            session.add(m.sender, 'ongkir', userState.data); // SAVE STATE

            await sendOrderReview(client, m, userState.data);
        }

        // ----- STAGE 4: REVIEW -> ACTION PAY -----
        else if (userState.data.stage === 'review_order') {
            if (body === 'action_pay') {
                const qty = userState.data.quantity;
                const price = userState.data.productPrice;
                const shippingCost = userState.data.selectedRate.price;
                const grandTotal = (price * qty) + shippingCost;
                userState.data.grandTotal = grandTotal;

                await reply("⏳ Memproses pesanan & membuat kode QRIS...");

                try {
                    // 1. Save Customer (Upsert)
                    await supabase.from('customers').upsert({
                        phone_number: m.sender.split('@')[0],
                        push_name: m.pushName,
                        full_name: userState.data.consignee.name,
                        address: userState.data.consignee.address,
                        district: userState.data.consignee.district,
                        city: userState.data.consignee.city || '',
                        postal_code: userState.data.consignee.postal_code || ''
                    });

                    // 2. Insert Order (Pending Payment)
                    const { data: orderData, error: orderError } = await supabase
                        .from('orders')
                        .insert({
                            customer_phone: m.sender.split('@')[0],
                            product_id: userState.data.productId,
                            quantity: userState.data.quantity,
                            total_amount: grandTotal,
                            shipping_cost: shippingCost,
                            courier_company: userState.data.selectedRate.courier_name,
                            courier_service: userState.data.selectedRate.courier_service_name,
                            status: 'pending_payment',
                            created_at: new Date()
                        })
                        .select()
                        .single();

                    if (orderError || !orderData) {
                        console.error("Order Insert Error:", orderError);
                        return reply("❌ Gagal menyimpan pesanan. Silakan coba lagi.");
                    }

                    const orderId = orderData.id;
                    userState.data.orderId = orderId;

                    // 3. Create WijayaPay Transaction
                    const wijayapay = require('../System/lib/wijayapay');
                    const QRCode = require('qrcode');

                    const transaction = await wijayapay.createTransaction(orderId, grandTotal);

                    if (transaction && transaction.success && transaction.data && transaction.data.qr_string) {
                        const qrString = transaction.data.qr_string;
                        const qrBuffer = await QRCode.toBuffer(qrString);

                        // Send QRIS Image
                        await client.sendMessage(m.chat, {
                            image: qrBuffer,
                            caption: `✅ *Total: Rp ${grandTotal.toLocaleString('id-ID')}*\n🆔 Order ID: \`${orderId}\`\n\nSilakan scan QRIS di atas untuk membayar.\n\n📸 Setelah bayar, kirimkan *screenshot bukti pembayaran* di chat ini ya kak.`
                        }, { quoted: m });

                        // 4. Create Biteship Draft Order
                        try {
                            const biteship = require('../System/lib/biteship');
                            const consignee = {
                                name: userState.data.consignee.name,
                                phone: m.sender.split('@')[0],
                                address: userState.data.consignee.address,
                                postal_code: userState.data.consignee.postal_code,
                                area_id: userState.data.consignee.area_id
                            };
                            const courier = userState.data.selectedRate;
                            const items = [{
                                name: userState.data.productName,
                                value: userState.data.productPrice * userState.data.quantity,
                                weight: userState.data.totalWeight || 1000,
                                quantity: userState.data.quantity
                            }];

                            const draftOrder = await biteship.createDraftOrder(consignee, courier, items);

                            if (draftOrder && draftOrder.id) {
                                // Save draft order ID to Supabase
                                await supabase
                                    .from('orders')
                                    .update({ biteship_order_id: draftOrder.id })
                                    .eq('id', orderId);
                                console.log(`Biteship Draft Order created: ${draftOrder.id} for Order ${orderId}`);
                            }
                        } catch (biteshipErr) {
                            console.error("Biteship Draft Error (non-blocking):", biteshipErr.message);
                            // Non-blocking: payment still proceeds even if draft fails
                        }

                        // Update Stage
                        userState.data.stage = 'waiting_payment';
                        session.add(m.sender, 'ongkir', userState.data);

                    } else {
                        console.error("WijayaPay Error:", transaction);
                        const errMsg = transaction ? transaction.message : "No response";
                        reply(`❌ Gagal membuat QRIS.\nMsg: ${errMsg}`);
                    }

                } catch (err) {
                    console.error("Process Error:", err);
                    reply("❌ Terjadi kesalahan sistem.");
                }

            } else if (body === 'action_change_courier') {
                userState.data.stage = 'select_courier';
                await sendCourierList(client, m, userState.data.rates, userState.data.productName, userState.data.totalWeight, userState.data.areaName);
            } else if (body === 'action_change_qty') {
                userState.data.stage = 'ask_quantity';
                await reply("🔢 Oke, mau pesan berapa pcs?");
            }
        }

        // ----- STAGE 5: WAITING PAYMENT (Kirim Bukti) -----
        else if (userState.data.stage === 'waiting_payment') {
            const isImage = m.message && (m.message.imageMessage || (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.quotedMessage && m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage));

            if (isImage) {
                // Customer sent proof of payment - forward to admin
                await reply("📥 Bukti pembayaran diterima! Sedang diteruskan ke Admin...");

                const orderId = userState.data.orderId;
                const caption = `🔔 *BUKTI PEMBAYARAN BARU*\n\n👤 *Customer:* ${m.pushName || 'Unknown'}\n📱 *No HP:* ${m.sender.split('@')[0]}\n🆔 *Order ID:* \`${orderId}\`\n📦 *Produk:* ${userState.data.productName}\n🔢 *Qty:* ${userState.data.quantity}\n💰 *Total:* Rp ${userState.data.grandTotal.toLocaleString('id-ID')}\n🚚 *Kurir:* ${userState.data.selectedRate.courier_name} - ${userState.data.selectedRate.courier_service_name}\n\nKetik *.acc ${orderId}* untuk konfirmasi pembayaran.`;

                try {
                    // Download and forward image to admin
                    const { downloadMediaMessage } = require('baileys');
                    const buffer = await downloadMediaMessage(m, 'buffer', {});
                    await client.sendMessage(OWNER_NUMBER, {
                        image: buffer,
                        caption: caption
                    });
                } catch (fwdErr) {
                    console.error("Forward proof error:", fwdErr.message);
                    // Fallback: send text notification to admin
                    await client.sendMessage(OWNER_NUMBER, {
                        text: caption + '\n\n⚠️ Foto gagal diteruskan, cek chat customer langsung.'
                    });
                }

                await reply("✅ Bukti pembayaran sudah dikirim ke Admin. Mohon tunggu konfirmasi ya kak! 🙏");

                // Keep session with orderId for admin to reference
                userState.data.stage = 'waiting_admin_confirm';
                session.add(m.sender, 'ongkir', userState.data);
            } else {
                await reply(`📸 Silakan kirimkan *screenshot bukti pembayaran* untuk Order ID: \`${userState.data.orderId}\`\n\nAtau ketik *.batal* untuk membatalkan.`);
            }
        }

        // ----- STAGE 6: PROOF HANDLING -----
        else if (userState.data.stage === 'pending_verification') {
            if (isImage) {
                await reply("📥 Bukti transfer diterima. Sedang diteruskan ke Admin...");

                // Forward to Admin
                const caption =
                    `🔔 *KONFIRMASI PEMBAYARAN BARU*

👤 *User:* ${m.pushName}
📱 *JID:* ${m.sender.split('@')[0]}
🆔 *Draft ID:* ${userState.data.draftId}
💰 *Total:* Rp ${userState.data.grandTotal.toLocaleString('id-ID')}

📸 *Bukti:* (Lihat Foto di atas)

Ketik *alldone* untuk menyetujui & memproses order ini otomatis.`;

                // Send image to owner
                // We need to download the image first? Or just forward the message?
                // Forwarding is easiest if supported. 
                // client.sendMessage(to, { forward: m }) often works.
                // But let's try to just use the quoted mechanism or re-send buffer if needed.
                // Simpler: Just send a text notification referencing the user JID, 
                // and the ADMIN should look at the chat? 
                // Or better: Re-send the image.

                // Let's assume 'm' contains the media message.
                // We can use 'client.relayMessage' to forward, or simple sendImage with buffer if we downloaded it.
                // For now, let's just notify Admin via Text and ask Admin to check.
                // "Admin, cek chat dari [Number]" is safest if forward is tricky.
                // But user wants "diteruskan".

                // Trying to forward:
                await client.sendMessage(OWNER_NUMBER, {
                    image: m.message.imageMessage,
                    caption: caption
                });

                await reply("✅ Mohon tunggu, Admin segera memproses pesanan Anda. Nanti Anda akan dapat Notifikasi Resi otomatis.");

                // Keep session alive or clear?
                // Keep it pending until Admin actions. 
                // Or we can Upgrade session to 'tracking' mode?
                // Actually, if we clear session, we lose context. 
                // But status is in DB. Admin command will query DB.
                // So we can clear session to free memory.
                session.delete(m.sender);

            } else {
                reply("📸 Mohon kirim *FOTO* bukti transfer ya kak.");
            }
        }

    } catch (e) {
        console.error("Error handling ongkir input:", e);
        reply("❌ Maaf terjadi kesalahan sistem.");
    }
};

// Helper: Parse Form
function parseForm(text) {
    const data = {};
    const lines = text.split('\n');
    lines.forEach(line => {
        const lower = line.toLowerCase();
        const parts = line.split(':');
        if (parts.length < 2) return;
        const value = parts.slice(1).join(':').trim();

        if (lower.includes('jumlah')) data.quantity = value.replace(/[^0-9]/g, ''); // Extract number only
        else if (lower.includes('nama')) data.name = value;
        else if (lower.includes('hp')) data.phone = value;
        else if (lower.includes('alamat')) data.address = value;
        else if (lower.includes('kecamatan')) data.district = value;
        else if (lower.includes('kota')) data.city = value;
        else if (lower.includes('pos')) data.postal_code = value;
    });
    return data;
}

// Re-use helpers (sendCourierList, sendOrderReview) from previous version...
// Helper: Send Courier List
async function sendCourierList(client, m, rates, productName, totalWeight, areaName) {
    const shippingRows = rates.map((rate, i) => ({
        header: rate.courier_name + " " + rate.courier_service_name,
        title: `Rp ${rate.price.toLocaleString('id-ID')}`,
        description: `Est: ${rate.duration}`,
        id: `shipping_select_${i}`
    }));

    const listMessage = {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({
                        text: `📦 *Pilihan Kurir*\n\n🛍️ Produk: ${productName}\n⚖️ Berat: ${totalWeight}g\n📍 Tujuan: ${areaName}\n\nSilakan pilih kurir:`
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.create({
                        text: "© Amanin Guys Bot"
                    }),
                    header: proto.Message.InteractiveMessage.Header.create({
                        title: "Kurir Pengiriman",
                        subtitle: "Pilih Kurir",
                        hasMediaAttachment: false
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: [
                            {
                                name: "single_select",
                                buttonParamsJson: JSON.stringify({
                                    title: "Lihat Tarif",
                                    sections: [{
                                        title: "Kurir Tersedia",
                                        rows: shippingRows
                                    }]
                                })
                            }
                        ]
                    })
                })
            }
        }
    };

    const msg = generateWAMessageFromContent(m.chat, listMessage.viewOnceMessage.message, { userJid: client.user.id, quoted: m });
    await client.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}

// Helper: Send Order Review
async function sendOrderReview(client, m, data) {
    const qty = data.quantity;
    const price = data.productPrice;
    const productTotal = price * qty;
    const shippingCost = data.selectedRate.price;
    const grandTotal = productTotal + shippingCost;

    let text = `📋 *Review Pesanan*\n\n`;
    text += `🛍️ *Produk:* ${data.productName}\n`;
    text += `🔢 *Jumlah:* ${qty} pcs\n`;
    text += `⚖️ *Berat Total:* ${data.totalWeight} gram\n`;
    text += `💵 *Harga Barang:* Rp ${productTotal.toLocaleString('id-ID')}\n`;
    text += `🚚 *Ongkir:* Rp ${shippingCost.toLocaleString('id-ID')} (${data.selectedRate.courier_name})\n`;
    text += `📍 *Tujuan:* ${data.areaName}\n\n`;
    text += `💰 *TOTAL BAYAR: Rp ${grandTotal.toLocaleString('id-ID')}*`;

    const buttons = [
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "✅ Bayar Sekarang",
                id: "action_pay"
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "🚚 Ubah Kurir",
                id: "action_change_courier"
            })
        },
        {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
                display_text: "🔢 Ubah Jumlah",
                id: "action_change_qty"
            })
        }
    ];

    const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: {
            message: {
                interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({ text: text }),
                    footer: proto.Message.InteractiveMessage.Footer.create({ text: "Silakan periksa kembali pesanan Anda." }),
                    header: proto.Message.InteractiveMessage.Header.create({ title: "Konfirmasi Pesanan", subtitle: "", hasMediaAttachment: false }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                        buttons: buttons
                    })
                })
            }
        }
    }, { userJid: client.user.id, quoted: m });

    await client.relayMessage(m.chat, msg.message, { messageId: msg.key.id });
}

module.exports.command = ['ongkir_start'];
module.exports.tags = ['main'];
module.exports.help = ['ongkir_start'];
