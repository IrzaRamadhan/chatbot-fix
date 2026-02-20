const axios = require('axios');

const MERCHANT_CODE = 'WP6996a11cb388d';
const API_KEY = '2b1edcde2c6774bc8854db39de';
const URL = `https://wijayapay.com/api/get-payment?code_merchant=${MERCHANT_CODE}&api_key=${API_KEY}`;

async function testConnection() {
    try {
        console.log("Fetching payment channels...");
        const response = await axios.get(URL);
        console.log("Response Status:", response.status);
        console.log("Response Data:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) {
            console.error("Data:", error.response.data);
        }
    }
}

testConnection();
