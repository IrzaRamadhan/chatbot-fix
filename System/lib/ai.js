const { GoogleGenAI } = require("@google/genai");
const config = require("../../settings/config");
const fs = require("fs");
const path = require("path");

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

// In-memory chat history per user (max 10 messages)
const chatHistories = {};
const MAX_HISTORY = 10;

// Load store info for context
function getStoreInfo() {
    try {
        const storePath = path.join(__dirname, "database", "store.json");
        return JSON.parse(fs.readFileSync(storePath, "utf8"));
    } catch (e) {
        return { name: "Amanin Guys", phone: "-", address: "-" };
    }
}

// Build system prompt with store & product context
function buildSystemPrompt(products = []) {
    const store = getStoreInfo();
    const productList = products.length > 0
        ? products.map(p => `- ${p.NameProd}: Rp ${parseInt(p.PriceProd).toLocaleString('id-ID')} (Stok: ${p.StockProd})`).join("\n")
        : "- Belum ada produk";

    return `Kamu adalah asisten customer service WhatsApp untuk toko "${store.name}".

INFO TOKO:
- Nama: ${store.name}
- Alamat: ${store.address}
- Telepon: ${store.phone}
- Kontak: ${store.contact_name}

DAFTAR PRODUK:
${productList}

ATURAN:
1. Jawab dalam Bahasa Indonesia yang santai, ramah, dan natural (seperti chat WA biasa).
2. Gunakan emoji 1-2 saja.
3. Jawaban HARUS sangat singkat, MAKSIMAL 1 kalimat pendek (di bawah 80 karakter). JANGAN PERNAH lebih dari 1 kalimat.
4. Jika customer bertanya soal order/beli, arahkan ketik ".order" untuk mulai pesan.
5. Jika customer bertanya soal alamat toko, jawab dari data di atas.
6. Jika customer bertanya soal ongkir, bilang bisa dicek saat order.
7. Jangan pernah menyebut bahwa kamu AI, robot, atau asisten virtual. Kamu adalah CS toko.
8. Jangan membuat informasi produk yang tidak ada di daftar.
9. Jika tidak tahu jawabannya, bilang "wah maaf kak, untuk info lebih lanjut bisa hubungi admin langsung ya".`;
}

/**
 * Generate a greeting message for the .order command
 * @param {string} pushname - User's WhatsApp name
 * @param {Array} products - Product list from Supabase
 * @returns {string} AI-generated greeting text
 */
async function generateGreeting(pushname, products = []) {
    if (!config.aiEnabled || !config.geminiApiKey) {
        return `Halo kak ${pushname}! 👋\nSilakan pilih produk kami di bawah ini ya:`;
    }

    try {
        const prompt = `Buatkan sapaan singkat (1-2 kalimat) untuk customer bernama "${pushname}" yang baru buka list produk toko.
Sebutkan nama 1-2 produk unggulan dari daftar ini untuk menarik minat.
Akhiri dengan ajakan untuk pilih produk di bawah.
Jangan pakai format list atau bullet point. Cukup teks biasa.`;

        const systemPrompt = buildSystemPrompt(products);

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction: systemPrompt,
                maxOutputTokens: 150,
                temperature: 0.8,
            }
        });

        const text = response.text?.trim();
        if (text && text.length > 10) return text;

        return `Halo kak ${pushname}! 👋\nSilakan pilih produk kami di bawah ini ya:`;
    } catch (error) {
        console.error("AI Greeting Error:", error.message);
        return `Halo kak ${pushname}! 👋\nSilakan pilih produk kami di bawah ini ya:`;
    }
}

/**
 * Chat reply for free-text messages (non-command)
 * @param {string} userJid - User's JID for history tracking
 * @param {string} userMessage - User's message text
 * @param {string} pushname - User's WhatsApp name
 * @param {Array} products - Product list from Supabase
 * @returns {string} AI response
 */
async function chatReply(userJid, userMessage, pushname, products = []) {
    if (!config.aiEnabled || !config.geminiApiKey) {
        return null; // Disabled, let it fall through
    }

    try {
        // Get or create chat history
        if (!chatHistories[userJid]) {
            chatHistories[userJid] = [];
        }
        const history = chatHistories[userJid];

        // Build conversation context
        const systemPrompt = buildSystemPrompt(products);

        // Build contents with history
        const contents = [];

        // Add history
        for (const msg of history) {
            contents.push({
                role: msg.role,
                parts: [{ text: msg.text }]
            });
        }

        // Add current message
        contents.push({
            role: "user",
            parts: [{ text: userMessage }]
        });

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction: systemPrompt,
                maxOutputTokens: 200,
                temperature: 0.7,
            }
        });

        const reply = response.text?.trim();

        if (reply && reply.length > 0) {
            // Save to history
            history.push({ role: "user", text: userMessage });
            history.push({ role: "model", text: reply });

            // Trim history if too long
            while (history.length > MAX_HISTORY * 2) {
                history.shift();
            }

            return reply;
        }

        return null;
    } catch (error) {
        console.error("AI Chat Error:", error.message);
        return null;
    }
}

/**
 * Clear chat history for a user
 */
function clearHistory(userJid) {
    delete chatHistories[userJid];
}

module.exports = { generateGreeting, chatReply, clearHistory };
