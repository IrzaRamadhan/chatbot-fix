const axios = require("axios");
const config = require("../../settings/config");
const fs = require("fs");
const path = require("path");

require('dotenv').config({ override: true });

console.log("[DEBUG] AI Library (ai.js) reloaded - Using OpenRouter Mode.");

const chatHistories = {};
const MAX_HISTORY = 10;

// Fallback models if the user-specified one fails
const FALLBACK_MODELS = [
    process.env.AI_MODEL || "stepfun/step-3.5-flash:free",
    "google/gemini-2.0-flash-exp:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-7b-instruct:free"
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
 * Common function to call OpenRouter API
 */
async function callOpenRouter(messages) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error("[DEBUG] OpenRouter API Key missing in .env");
        return null;
    }

    for (const modelName of FALLBACK_MODELS) {
        try {
            const response = await axios.post(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    model: modelName,
                    messages: messages,
                    max_tokens: 200,
                    temperature: 0.7,
                },
                {
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:3000", // Optional, for OpenRouter analytics
                        "X-Title": "WhatsApp Shop Bot", // Optional
                    },
                    timeout: 20000 // 20s timeout for OpenRouter
                }
            );

            if (response.data && response.data.choices && response.data.choices[0].message) {
                const text = response.data.choices[0].message.content;
                if (text) {
                    console.log(`[DEBUG] OpenRouter success using model: ${modelName}`);
                    return text;
                }
            }
        } catch (error) {
            const status = error.response?.status;
            const errorMsg = error.response?.data?.error?.message || error.message;

            console.error(`[DEBUG] Error with OpenRouter model ${modelName}:`, errorMsg);

            if (status === 402 || status === 429) {
                // Out of credits or rate limited, try next model if it's free, otherwise might need more models
                console.log(`[DEBUG] Status ${status}, trying next fallback model...`);
                continue;
            }

            // For other errors, also try next
            continue;
        }
    }
    return null;
}

async function chatReply(userJid, userMessage, pushname, products = []) {
    if (!config.aiEnabled) return null;

    try {
        if (!chatHistories[userJid]) chatHistories[userJid] = [];
        const history = chatHistories[userJid];
        const systemPrompt = buildSystemPrompt(products);

        const messages = [
            { role: "system", content: systemPrompt }
        ];

        // Add history
        for (const msg of history) {
            messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.text });
        }

        // Add current message
        messages.push({ role: "user", content: userMessage });

        const reply = await callOpenRouter(messages);

        if (reply) {
            history.push({ role: "user", text: userMessage });
            history.push({ role: "assistant", text: reply });
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
        const messages = [{ role: "user", content: prompt }];

        const reply = await callOpenRouter(messages);
        return reply ? reply.trim() : instruction;
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
