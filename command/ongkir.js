const session = require('../System/lib/session');
const biteship = require('../System/lib/biteship');
const supabase = require("../System/lib/supabase");
const { proto, generateWAMessageFromContent } = require("baileys");

const ORIGIN_AREA_ID = 'IDNP11IDNC434IDND5425IDZ60231'; // Ketintang, Surabaya
const QRIS_DATA = "00020101021126610014COM.GO-JEK.WWW01189360091438156980690210G8156980690303UMI51440014ID.CO.QRIS.WWW0215ID10254460000570303UMI5204581653033605802ID5925IRZA%20MAULANA%20RAMADHAN,%20Ga6007SUMBAWA61058431662070703A0163041CB7";

// Main handler for the command (.ongkir_start)
module.exports = async (m, { reply, args }) => {
    const productId = args[0];
    if (!productId) return reply("Product ID missing.");

    // Start session with ask_quantity
    session.add(m.sender, 'ongkir', { productId, stage: 'ask_quantity' });

    await reply("🔢 *Jumlah Pesanan*\n\nMau pesan berapa pcs?\n_Kirim angkanya saja, misal: 1_");
};

// Handler for user input
module.exports.handleInput = async (m, { client, reply, fetchJson }, userState) => {
    try {
        const body = m.body || m.text || "";

        // ----- STAGE 1: ASK QUANTITY -----
        if (userState.data.stage === 'ask_quantity') {
            const qty = parseInt(body);
            if (isNaN(qty) || qty < 1) {
                return reply("⚠️ Mohon masukkan angka yang valid (minimal 1).");
            }

            userState.data.quantity = qty;
            userState.data.stage = 'ask_address';

            await reply(`✅ Oke, *${qty} pcs*.\n\n📍 Sekarang kirimkan **Alamat Lengkap** Anda (Kecamatan, Kota) untuk hitung ongkir.`);
        }

        // ----- STAGE 2: ASK ADDRESS (Hitung Ongkir) -----
        else if (userState.data.stage === 'ask_address') {
            const addressQuery = body;
            const productId = userState.data.productId;
            const quantity = userState.data.quantity || 1;

            await reply("🔍 Sedang mencari lokasi dan menghitung ongkir...");

            // 1. Search Destination
            const areas = await biteship.searchArea(addressQuery);
            if (!areas || areas.length === 0) {
                return reply("❌ Lokasi tidak ditemukan. Coba format: 'Kecamatan, Kota'.\nSilakan kirim ulang alamat.");
            }
            const destinationId = areas[0].id;

            // 2. Get Product Data
            const { data: product, error } = await supabase
                .from('product')
                .select('WeightProd, PriceProd, NameProd')
                .eq('IDprod', productId)
                .single();

            if (error || !product) {
                console.error("Supabase Error:", error);
                session.delete(m.sender);
                return reply("❌ Gagal mengambil data produk.");
            }

            const weightPerItem = product.WeightProd || 1000;
            const totalWeight = weightPerItem * quantity;
            const pricePerItem = product.PriceProd || 0;

            // 3. Get Rates
            const items = [{
                name: product.NameProd,
                value: pricePerItem,
                weight: weightPerItem,
                quantity: quantity
            }];

            const rates = await biteship.getRates(ORIGIN_AREA_ID, destinationId, totalWeight, items);

            if (!rates?.pricing?.length) {
                return reply("⚠️ Tidak ada kurir yang tersedia ke lokasi tersebut. Coba detailkan alamatnya lagi.");
            }

            const sortedRates = rates.pricing.sort((a, b) => a.price - b.price).slice(0, 10);

            // Store Data
            userState.data.rates = sortedRates;
            userState.data.productPrice = pricePerItem;
            userState.data.productName = product.NameProd;
            userState.data.areaName = areas[0].name;
            userState.data.totalWeight = totalWeight;
            userState.data.stage = 'select_courier';

            // Send Courier List
            await sendCourierList(client, m, sortedRates, product.NameProd, totalWeight, areas[0].name);
        }

        // ----- STAGE 3: SELECT COURIER -----
        else if (userState.data.stage === 'select_courier') {
            if (!body.startsWith('shipping_select_')) return; // Ignore chat chatter

            const index = parseInt(body.split('_')[2]);
            const rates = userState.data.rates;

            if (isNaN(index) || !rates[index]) return reply("❌ Pilihan tidak valid.");

            userState.data.selectedRate = rates[index];
            userState.data.stage = 'review_order';

            // Show Review
            await sendOrderReview(client, m, userState.data);
        }

        // ----- STAGE 4: REVIEW ORDER ACTIONS -----
        else if (userState.data.stage === 'review_order') {
            if (body === 'action_pay') {
                const qty = userState.data.quantity;
                const price = userState.data.productPrice;
                const shippingCost = userState.data.selectedRate.price;
                const grandTotal = (price * qty) + shippingCost;

                await reply("⏳ Sedang membuat kode QRIS...");

                const qrisUrl = `https://cvqris-ariepulsa.my.id/api/?qris_data=${QRIS_DATA}&nominal=${grandTotal}`;
                const qrisData = await fetchJson(qrisUrl);

                if (qrisData?.link_qris) {
                    await client.sendMessage(m.chat, {
                        image: { url: qrisData.link_qris },
                        caption: `✅ *QRIS Berhasil Dibuat*\n\nSilakan scan untuk membayar *Rp ${grandTotal.toLocaleString('id-ID')}*\n_(Pembayaran otomatis terverifikasi)_`
                    }, { quoted: m });
                } else {
                    reply("❌ Gagal generate QRIS. Silakan coba lagi nanti.");
                }
                session.delete(m.sender);

            } else if (body === 'action_change_courier') {
                userState.data.stage = 'select_courier';
                await sendCourierList(client, m, userState.data.rates, userState.data.productName, userState.data.totalWeight, userState.data.areaName);

            } else if (body === 'action_change_qty') {
                userState.data.stage = 'ask_quantity';
                await reply("🔢 Oke, mau pesan berapa pcs sekarang?");
            }
        }

    } catch (e) {
        console.error("Error handling ongkir input:", e);
        reply("❌ Maaf terjadi kesalahan sistem. Transaksi dibatalkan.");
        session.delete(m.sender);
    }
};

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

    // Using Button Message (Quick Reply style logic adapted for Interactive)
    // Assuming V10.js plugin loader supports 'buttonsResponseMessage' handling via m.body mapping we did earlier.

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
