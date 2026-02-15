const supabase = require("../System/lib/supabase");

module.exports = async (m, { client, args, reply }) => {
    try {
        const productId = args[0];

        if (!productId) {
            return reply("ID Produk tidak ditemukan.");
        }

        // Fetch product details from Supabase
        const { data: product, error } = await supabase
            .from('product') // Use consistent table name
            .select('*')
            .eq('IDprod', productId)
            .single();

        if (error || !product) {
            console.error("Supabase Error (Detail):", error);
            return reply("Maaf, produk tidak ditemukan atau sudah dihapus.");
        }

        // Send product details
        const caption = `
*${product.NameProd}*

💰 *Harga:* Rp ${parseInt(product.PriceProd).toLocaleString('id-ID')}
📦 *Stok:* ${product.StockProd} item
⚖️ *Berat:* ${product.WeightProd} gram

📝 *Deskripsi:*
${product.DescProd || "Tidak ada deskripsi."}

_Tertarik? Silakan hubungi admin untuk pemesanan!_
        `.trim();

        const { proto, generateWAMessageFromContent } = require("baileys");

        const msg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: proto.Message.InteractiveMessage.create({
                        body: proto.Message.InteractiveMessage.Body.create({
                            text: caption // Use the caption we built
                        }),
                        footer: proto.Message.InteractiveMessage.Footer.create({
                            text: "© Amanin Guys Bot"
                        }),
                        header: proto.Message.InteractiveMessage.Header.create({
                            title: "Detail Produk",
                            subtitle: product.NameProd,
                            hasMediaAttachment: false
                        }),
                        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: [
                                {
                                    name: "quick_reply",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "🚚 Cek Ongkir",
                                        id: `.ongkir_start ${product.IDprod}`
                                    })
                                }
                            ]
                        })
                    })
                }
            }
        }, { userJid: client.user.id, quoted: m });

        await client.relayMessage(m.chat, msg.message, { messageId: msg.key.id });

    } catch (error) {
        console.error("Error sending product detail:", error);
        reply("Maaf, terjadi kesalahan saat mengambil detail produk.");
    }
};

module.exports.command = ['detail'];
module.exports.tags = ['main'];
module.exports.help = ['detail <id>'];
