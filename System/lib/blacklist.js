/**
 * Anti-Spam & Judol Blacklist
 * Common keywords found in WhatsApp spam messages (especially online gambling)
 */
const BANNED_KEYWORDS = [
    "judi", "slot", "gacor", "bandar", "depo", "withdraw", "wd", "rtp", "zeus",
    "maxwin", "jackpot", "kode4d", "testi138", "kilat69", "koi288", "s858",
    "jalurin.me", "daftarin", "link alternatif", "situs terpercaya",
    "pilihan yang bikin betah", "testi yang berkata", "biarkan testi"
];

/**
 * Checks if a string contains any banned keywords
 * @param {string} text 
 * @returns {boolean}
 */
function isSpam(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return BANNED_KEYWORDS.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

module.exports = {
    BANNED_KEYWORDS,
    isSpam
};
