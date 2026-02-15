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

    // Start session
    session.add(m.sender, 'ongkir', { productId, stage: 'ask_address' });

    await reply("📍 *Cek Ongkos Kirim*\n\nSilakan kirimkan **Alamat Lengkap** Anda (Kecamatan, Kota) untuk pengecekan estimasi ongkir.\n\n_Contoh: Tebet, Jakarta Selatan_");
};

// Handler for user input (address)
module.exports.handleInput = async (m, { client, reply, fetchJson }, userState) => {
    try {
        // STAGE 1: ASK ADDRESS
        if (userState.data.stage === 'ask_address') {
            const addressQuery = m.body || m.text; // Get text content
            const productId = userState.data.productId;

            await reply("🔍 Sedang mencari lokasi dan menghitung ongkir...");

            // 1. Search Destination Area
            const areas = await biteship.searchArea(addressQuery);
            if (!areas || areas.length === 0) {
                return reply("Maaf, lokasi tidak ditemukan. Coba gunakan format 'Kecamatan, Kota'.\nSilakan kirim ulang alamat.");
            }
            const destinationId = areas[0].id; // Use top result

            // 2. Get Product Weight AND Price from Supabase
            const { data: product, error } = await supabase
                .from('product')
                .select('WeightProd, PriceProd, NameProd')
                .eq('IDprod', productId)
                .single();

            if (error || !product) {
                console.error("Supabase Error (Ongkir):", error);
                session.delete(m.sender);
                return reply("Gagal mengambil data produk. Cek ongkir dibatalkan.");
            }
            const weight = product.WeightProd || 1000;
            const price = product.PriceProd || 0;

            // 3. Get Rates from Biteship
            const items = [{
                name: product.NameProd || "Product",
                value: price,
                weight: weight,
                quantity: 1
            }];

            const rates = await biteship.getRates(ORIGIN_AREA_ID, destinationId, weight, items);

            if (!rates || !rates.pricing || rates.pricing.length === 0) {
                session.delete(m.sender);
                return reply("Maaf, tidak ada kurir yang tersedia untuk rute ini.");
            }

            // 4. Format Result & Update Session
            const sortedRates = rates.pricing.sort((a, b) => a.price - b.price).slice(0, 10);

            // Store rates and product info in session for next step
            userState.data.rates = sortedRates;
            userState.data.productPrice = price;
            userState.data.productName = product.NameProd;
            userState.data.stage = 'select_courier'; // Advance stage

            const shippingRows = sortedRates.map((rate, i) => ({
                header: rate.courier_name + " " + rate.courier_service_name,
                title: `Rp ${rate.price.toLocaleString('id-ID')}`,
                description: `Estimasi: ${rate.duration}`,
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
                                text: `📦 *Ongkir ke:* ${areas[0].name}\n⚖️ *Berat:* ${weight} gram\n\nSilakan pilih kurir untuk lanjut ke pembayaran:`
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.create({
                                text: "© Amanin Guys Bot"
                            }),
                            header: proto.Message.InteractiveMessage.Header.create({
                                title: "Pilih Kurir Pengiriman",
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

            // Don't delete session yet!
        }

        // STAGE 2: SELECT COURIER & PAY
        else if (userState.data.stage === 'select_courier') {
            const body = m.body || "";
            if (!body.startsWith('shipping_select_')) {
                // If user sends text instead of selecting list, maybe ignore or warn?
                // For now, let's just ignore or ask to select again.
                // return reply("Silakan pilih kurir dari list yang diberikan."); 
                // But native flow often sends the ID as message.
                // If it's not a selection, maybe they want to cancel?
                return;
            }

            const index = parseInt(body.split('_')[2]);
            const rates = userState.data.rates;

            if (isNaN(index) || !rates[index]) {
                return reply("Pilihan kurir tidak valid.");
            }

            const selectedRate = rates[index];
            const productPrice = parseFloat(userState.data.productPrice);
            const shippingCost = selectedRate.price;
            const total = productPrice + shippingCost;
            const productName = userState.data.productName;

            await reply(`✅ *Konfirmasi Pembayaran*\n\n🛍️ *Produk:* ${productName}\n💵 *Harga:* Rp ${productPrice.toLocaleString('id-ID')}\n🚚 *Ongkir:* Rp ${shippingCost.toLocaleString('id-ID')} (${selectedRate.courier_name})\n\n💰 *TOTAL:* Rp ${total.toLocaleString('id-ID')}\n\n_Sedang membuat QRIS..._`);

            // Generate QRIS
            const qrisUrl = `https://cvqris-ariepulsa.my.id/api/?qris_data=${QRIS_DATA}&nominal=${total}`;
            const qrisData = await fetchJson(qrisUrl);

            if (!qrisData || !qrisData.link_qris) {
                session.delete(m.sender);
                return reply("Gagal membuat QRIS. Silakan coba lagi nanti.");
            }

            // Send QRIS Image
            await client.sendMessage(m.chat, {
                image: { url: qrisData.link_qris },
                caption: `Scan QRIS di atas untuk membayar.\n\nNominal: *Rp ${total.toLocaleString('id-ID')}*\n\n_Pembayaran otomatis diverifikasi (Simulasi)._`
            }, { quoted: m });

            session.delete(m.sender);
        }

    } catch (e) {
        console.error("Error handling ongkir input:", e);
        reply("Maaf terjadi kesalahan sistem. Transaksi dibatalkan.");
        session.delete(m.sender);
    }
};

module.exports.command = ['ongkir_start'];
module.exports.tags = ['main'];
module.exports.help = ['ongkir_start'];
