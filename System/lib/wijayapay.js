const axios = require('axios');
const crypto = require('crypto');
const config = require('../../settings/config');

const BASE_URL = 'https://wijayapay.com/api';

/**
 * Generate MD5 Signature
 * Formula: md5(merchant_code + api_key + ref_id)
 */
function generateSignature(refId) {
    if (!config.wijayaPay) {
        throw new Error("Missing config.wijayaPay");
    }
    const raw = config.wijayaPay.merchantCode + config.wijayaPay.apiKey + refId;
    return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Create QRIS Transaction
 * @param {string} refId - Unique Order ID
 * @param {number} amount - Amount in IDR
 */
async function createTransaction(refId, amount) {
    try {
        const signature = generateSignature(refId);

        const payload = new URLSearchParams();
        payload.append('code_merchant', config.wijayaPay.merchantCode);
        payload.append('api_key', config.wijayaPay.apiKey);
        payload.append('ref_id', refId);
        payload.append('code_payment', 'QRIS');
        payload.append('nominal', amount);

        // Note: Callback/return_url is optional or configured in dashboard?
        // documentation typically sends it, but screenshot showed minimal fields using curl.
        // We will stick to the mandatory fields for now. 

        const response = await axios.post(`${BASE_URL}/transaction/create`, payload, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                // 'X-Signature': signature // Screenshot shows signature in Header AND suggests it might be auto-checked?
                // Actually screenshot "Contoh Request" shows "X-Signature" in CURLOPT_HTTPHEADER
                'X-Signature': signature
            }
        });

        // Debug response if needed
        // console.log("WijayaPay Response:", response.data);

        return response.data;
    } catch (error) {
        console.error("WijayaPay Create Error:", error.response ? error.response.data : error.message);
        return error.response ? error.response.data : { success: false, message: error.message };
    }
}

/**
 * Check Transaction Status (Placeholder - Endpoint not fully confirmed, using provided screenshot context if available)
 * Based on sidebar "Cek Status Pembayaran", assuming endpoint is /transaction/status or similar?
 * But user didn't provide that screenshot. for now, we only implement createTransaction.
 */

module.exports = {
    createTransaction
};
