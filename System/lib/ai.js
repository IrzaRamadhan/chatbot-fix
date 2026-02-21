const axios = require("axios");
const config = require("../../settings/config");
const fs = require("fs");
const path = require("path");

require('dotenv').config({ override: true });

console.log("[DEBUG] AI Library (ai.js) reloaded - Using Ultra-Robust Direct API Mode.");

const chatHistories = {};
const MAX_HISTORY = 10;

// PREFERRED MODELS Based on user's key availability
const PREFERRED_MODELS = [
    "gemini-2.0-flash-lite-001",
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-1.5-flash"
];

function getStoreInfo() {
    try {
        const storePath = path.join(__dirname, "..", "..", "database", "store.json");
        if (fs.existsSync(storePath)) return JSON.parse(fs.readFileSync(storePath, "utf8"));
        return { name: "Amanin Guys", phone: "-", address: "-" };
    } catch (e) {
        return { name: "Amanin Guys", phone: "-", address: "-" };
    }
}

function buildSystemPrompt(products = []) {
    const store = getStoreInfo();
    const productList = products.length > 0
        ? products.map(p => `- ${p.NameProd}: Rp ${parseInt(p.PriceProd).toLocaleString('id-ID')} (Stok: ${p.StockProd})`).join("\n")
        : "- Belum ada produk";

    return `Kamu adalah asisten CS untuk toko "${store.name}".
DAFTAR PRODUK:
${productList}
ATURAN: Jawab santai, ramah, max 1 kalimat pendek. Jika order arahkan ketik .order. Jangan sebut AI.`;
}

/**
 * Common function to call Gemini API directly with Model Fallback
 */
async function callGemini(contents, systemInstruction = "") {
    const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;
    if (!apiKey) return null;

    let lastError = null;

    for (const modelName of PREFERRED_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        try {
            const payload = {
                contents: contents,
                generationConfig: {
                    maxOutputTokens: 200,
                    temperature: 0.7,
                }
            };

            if (systemInstruction) {
                payload.systemInstruction = {
                    parts: [{ text: systemInstruction }]
                };
            }

            const response = await axios.post(url, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });

            if (response.data && response.data.candidates && response.data.candidates[0].content) {
                return response.data.candidates[0].content.parts[0].text;
            }
        } catch (error) {
            lastError = error;
            const status = error.response?.status;
            const errorMsg = error.response?.data?.error?.message || "";

            if (status === 404) {
                console.log(`[DEBUG] Model ${modelName} not found, trying next...`);
                continue;
            }

            if (status === 429 || errorMsg.includes("quota")) {
                console.error(`[DEBUG] Quota Exceeded for ${modelName}.`);
                // If it's a quota issue for the whole tier, continuing might not help, 
                // but let's try one more model just in case.
                continue;
            }

            console.error(`[DEBUG] Error with model ${modelName}:`, errorMsg || error.message);
        }
    }

    // If we reach here, all models failed. 
    // If the last error was quota, return a special message.
    if (lastError?.response?.status === 429 || lastError?.response?.data?.error?.message?.includes("quota")) {
        return "Maaf ya kak, saat ini aku sedang menerima banyak tamu. Coba lagi sebentar lagi ya! 🙏";
    }

    return null;
}

async function chatReply(userJid, userMessage, pushname, products = []) {
    if (!config.aiEnabled) return null;

    try {
        if (!chatHistories[userJid]) chatHistories[userJid] = [];
        const history = chatHistories[userJid];
        const systemPrompt = buildSystemPrompt(products);

        const contents = [];
        for (const msg of history) {
            contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
        }
        contents.push({ role: "user", parts: [{ text: userMessage }] });

        const reply = await callGemini(contents, systemPrompt);

        if (reply) {
            if (reply.includes("Maaf ya kak")) return reply; // Don't save quota errors to history

            history.push({ role: "user", text: userMessage });
            history.push({ role: "model", text: reply });
            while (history.length > MAX_HISTORY * 2) history.shift();
            return reply.trim();
        }
        return null;
    } catch (error) {
        console.error("AI chatReply Error:", error.message);
        return null;
    }
}

async function generateFollowUp(instruction, pushname = "Kak") {
    if (!config.aiEnabled) return instruction;
    try {
        const prompt = `Buatkan pesan follow-up WA singkat (1 kalimat) untuk customer "${pushname}" berdasarkan instruksi: "${instruction}". Pakai bahasa Indonesia ramah.`;
        const contents = [{ role: "user", parts: [{ text: prompt }] }];
        const reply = await callGemini(contents);
        return (reply && !reply.includes("Maaf ya kak")) ? reply.trim() : instruction;
    } catch (error) {
        return instruction;
    }
}

module.exports = {
    chatReply,
    clearHistory: (jid) => delete chatHistories[jid],
    generateFollowUp,
    generateGreeting: async (n) => `Halo kak ${n}! Ada yang bisa dibantu? Ketik .order untuk lihat produk.`
};
