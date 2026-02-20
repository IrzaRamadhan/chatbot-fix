const { proto, generateWAMessageFromContent } = require("baileys");
const supabase = require("../System/lib/supabase");
const ai = require("../System/lib/ai");

module.exports = async (m, { client, reply, pushname }) => {
    try {
        // Fetch products from Supabase
        const { data: products, error } = await supabase
            .from('product')
            .select('*')
            .eq('IsActive', true);

        if (error) {
            console.error("Supabase Error:", error);
            return reply("Maaf, sedang ada gangguan koneksi ke database produk. " + error.message);
        }

        if (!products || products.length === 0) {
            return reply("Belum ada produk yang tersedia saat ini.");
        }

        // Generate AI greeting
        const greetingText = await ai.generateGreeting(pushname || "Kak", products);

        // Map products to list rows
        const productRows = products.map(product => ({
            header: product.NameProd || "Produk",
            title: product.NameProd || "Tanpa Nama",
            description: `Rp ${parseInt(product.PriceProd).toLocaleString('id-ID')} | Stok: ${product.StockProd}`,
            id: `.detail ${product.IDprod}`
        }));

        const sections = [
            {
                title: "Daftar Produk Kami",
                rows: productRows
            }
        ];

        const listMessage = {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: proto.Message.InteractiveMessage.Body.create({
                            text: greetingText
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.create({
                            text: "© Amanin Guys Bot"
                        }),
                        header: proto.Message.InteractiveMessage.Header.create({
                            title: "Halo Kak! 👋",
                            subtitle: "Selamat Datang di Amanin Guys",
                            hasMediaAttachment: false
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: [
                                {
                                    name: "single_select",
                                    buttonParamsJson: JSON.stringify({
                                        title: "Lihat Produk",
                                        sections: sections
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

    } catch (error) {
        console.error("Error sending halo list:", error);
        reply("Maaf, terjadi kesalahan saat memuat daftar produk.");
    }
};

module.exports.command = ['order', 'halo', 'hi', 'hello', 'hallo'];
module.exports.tags = ['main'];
module.exports.help = ['order'];

