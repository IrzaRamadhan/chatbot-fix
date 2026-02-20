const axios = require('axios');

const API_KEY = 'biteship_live.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiY2hhdGJvdC1maXgiLCJ1c2VySWQiOiI2OTg3ZWI1ZGNhZGI5NTRlZTY1NWQzNzMiLCJpYXQiOjE3NzExNjQ3Mjl9.rVSLSL82OdwvSyr_jsKZ1RW1vYvV1n1reT0fU4Hn61k';
const BASE_URL = 'https://api.biteship.com/v1';

const headers = {
    'Authorization': API_KEY,
    'Content-Type': 'application/json'
};

async function test() {
    try {
        console.log("Testing Biteship API...");
        const response = await axios.get(`${BASE_URL}/locations`, { headers });
        console.log("Success! Status:", response.status);
        if (response.data && response.data.locations) {
            console.log("Locations found:", response.data.locations.length);
        }
    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) {
            console.error("Data:", error.response.data);
        } else {
            console.error("Code:", error.code);
        }
    }
}

test();
