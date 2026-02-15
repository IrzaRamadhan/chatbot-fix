const session = require('../System/lib/session');
const { proto, generateWAMessageFromContent } = require("baileys");

// Main handler for the command (.ongkir_start)
module.exports = async (m, { reply, args }) => {
    const productId = args[0];
    if (!productId) return reply("Product ID missing.");

    // Start session
    session.add(m.sender, 'ongkir', { productId, stage: 'ask_address' });

    await reply("📍 *Cek Ongkos Kirim*\n\nSilakan kirimkan **Alamat Lengkap** Anda (Kecamatan, Kota) untuk pengecekan estimasi ongkir.\n\n_Contoh: Tebet, Jakarta Selatan_");
};

// Handler for user input (address)
module.exports.handleInput = async (m, { client, reply }, userState) => {
    try {
        if (userState.data.stage === 'ask_address') {
            const address = m.body || m.text; // Get text content
            const productId = userState.data.productId;

            // Mock Data Ongkir (Simulasi)
            const couriers = [
                { name: "JNE REG", price: 10000, etd: "2-3 Hari" },
                { name: "J&T Express", price: 12000, etd: "2-3 Hari" },
                { name: "SiCepat REG", price: 11000, etd: "2-3 Hari" },
                { name: "GoSend Instant", price: 25000, etd: "Hari ini" }
            ];

            const shippingRows = couriers.map((c, i) => ({
                header: c.name,
                title: `Rp ${c.price.toLocaleString('id-ID')}`,
                description: `Estimasi: ${c.etd}`,
                id: `shipping_select_${i}` // In real app, you'd save this choice
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
                                text: `📦 *Pilihan Ongkir ke:* ${address}\n\nSilakan pilih kurir yang diinginkan:`
                            }),
                            footer: proto.Message.InteractiveMessage.Footer.create({
                                text: "© Amanin Guys Bot"
                            }),
                            header: proto.Message.InteractiveMessage.Header.create({
                                title: "Hasil Cek Ongkir",
                                subtitle: "Pilih Kurir",
                                hasMediaAttachment: false
                            }),
                            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                                buttons: [
                                    {
                                        name: "single_select",
                                        buttonParamsJson: JSON.stringify({
                                            title: "Pilih Kurir",
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

            // End session after showing options (or keep it if you want to handle courier selection next)
            session.delete(m.sender);
        }
    } catch (e) {
        console.error("Error handling ongkir input:", e);
        reply("Maaf terjadi kesalahan.");
        session.delete(m.sender);
    }
};

module.exports.command = ['ongkir_start'];
module.exports.tags = ['main'];
module.exports.help = ['ongkir_start'];
