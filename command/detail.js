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

        // If you had an image URL column, you'd use client.sendMessage with image: { url: ... }
        // For now, text reply
        await reply(caption);

    } catch (error) {
        console.error("Error sending product detail:", error);
        reply("Maaf, terjadi kesalahan saat mengambil detail produk.");
    }
};

module.exports.command = ['detail'];
module.exports.tags = ['main'];
module.exports.help = ['detail <id>'];
