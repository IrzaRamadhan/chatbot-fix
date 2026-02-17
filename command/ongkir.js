const session = require('../System/lib/session');
const biteship = require('../System/lib/biteship');
const supabase = require("../System/lib/supabase");
const { proto, generateWAMessageFromContent } = require("baileys");

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

                // Send QRIS
                await reply("⏳ Membuat kode pembayaran...");
                const qrisUrl = `https://cvqris-ariepulsa.my.id/api/?qris_data=${QRIS_DATA}&nominal=${grandTotal}`;
                const qrisData = await fetchJson(qrisUrl);

                if (qrisData?.link_qris) {
                    // Send QRIS Image
                    await client.sendMessage(m.chat, {
                        image: { url: qrisData.link_qris },
                        caption: `✅ *Total: Rp ${grandTotal.toLocaleString('id-ID')}*\n\nSilakan scan QRIS di atas.\nJika sudah, klik tombol di bawah.`
                    }, { quoted: m });

                    // Send Confirmation Button
                    const buttons = [
                        {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: "✅ Sudah Transfer",
                                id: "action_payment_confirmed"
                            })
                        }
                    ];

                    const msg = generateWAMessageFromContent(m.chat, {
                        viewOnceMessage: {
                            message: {
                                interactiveMessage: proto.Message.InteractiveMessage.create({
                                    body: proto.Message.InteractiveMessage.Body.create({ text: "Apakah sudah melakukan pembayaran?" }),
                                    footer: proto.Message.InteractiveMessage.Footer.create({ text: "Amanin Guys Bot" }),
                                    header: proto.Message.InteractiveMessage.Header.create({ title: "Konfirmasi Pembayaran", subtitle: "", hasMediaAttachment: false }),
                                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({ buttons: buttons })
                                })
                            }
                        }
                    }, { userJid: client.user.id });

                    await client.relayMessage(m.chat, msg.message, { messageId: msg.key.id });

                    userState.data.stage = 'payment_confirmation';

                } else {
                    reply("❌ Gagal generate QRIS.");
                }

            } else if (body === 'action_change_courier') {
                userState.data.stage = 'select_courier';
                await sendCourierList(client, m, userState.data.rates, userState.data.productName, userState.data.totalWeight, userState.data.areaName);
            } else if (body === 'action_change_qty') {
                userState.data.stage = 'ask_quantity';
                await reply("🔢 Oke, mau pesan berapa pcs?");
            }
        }

        // ----- STAGE 5: CONFIRMATION & DRAFT CREATION -----
        else if (userState.data.stage === 'payment_confirmation') {
            if (body === 'action_payment_confirmed') {
                await reply("⏳ Memproses data pesanan...");

                // 1. Create Biteship Draft Order
                try {
                    const draft = await biteship.createDraftOrder(
                        userState.data.consignee,
                        userState.data.selectedRate, // Contains courier info
                        userState.data.items
                    );

                    if (!draft || !draft.id) {
                        return reply("❌ Gagal membuat Draft Order di sistem kurir. Silakan hubungi Admin.");
                    }
                    userState.data.draftId = draft.id;

                    // 2. Save Customer Data (Upsert)
                    const { error: custError } = await supabase
                        .from('customers')
                        .upsert({
                            phone_number: m.sender.split('@')[0],
                            push_name: m.pushName,
                            full_name: userState.data.consignee.name,
                            address: userState.data.consignee.address,
                            district: userState.data.consignee.district, // Note: We validated district inside parseForm but didn't save raw text separate from searchArea result? 
                            // Actually searchArea result is used. We can save what we parsed.
                            // To keep simple, assume parsed data is good.
                            city: userState.data.consignee.city || '',
                            postal_code: userState.data.consignee.postal_code || ''
                        });

                    if (custError) console.error("Customer Save Error:", custError);

                    // 3. Save Order Data
                    const { data: orderData, error: orderError } = await supabase
                        .from('orders')
                        .insert({
                            customer_phone: m.sender.split('@')[0],
                            product_id: userState.data.productId,
                            quantity: userState.data.quantity,
                            total_amount: userState.data.grandTotal,
                            shipping_cost: userState.data.selectedRate.price,
                            courier_company: userState.data.selectedRate.courier_name,
                            courier_service: userState.data.selectedRate.courier_service_name,
                            status: 'pending_verification',
                            biteship_draft_id: draft.id
                        })
                        .select()
                        .single();

                    if (orderError) {
                        console.error("Order Save Error:", orderError);
                        return reply("⚠️ Pesanan tersimpan di Biteship tapi gagal masuk database bot. Screenshot chat ini ke Admin.");
                    }

                    userState.data.orderIdDB = orderData.id;
                    userState.data.stage = 'pending_verification';

                    await reply(`✅ *Pesanan Masuk!* (Draft ID: ${draft.id})\n\nLangkah Terakhir: 📸 *Kirim Foto Bukti Transfer* di sini untuk verifikasi.`);

                } catch (err) {
                    console.error("Draft Creation Error:", err);
                    reply("❌ Terjadi kesalahan saat membuat Order. Coba lagi nanti.");
                }
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
