const axios = require('axios');

const API_KEY = 'biteship_live.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiY2hhdGJvdC1maXgiLCJ1c2VySWQiOiI2OTg3ZWI1ZGNhZGI5NTRlZTY1NWQzNzMiLCJpYXQiOjE3NzExNjQ3Mjl9.rVSLSL82OdwvSyr_jsKZ1RW1vYvV1n1reT0fU4Hn61k';
const BASE_URL = 'https://api.biteship.com/v1';

const headers = {
    'Authorization': API_KEY,
    'Content-Type': 'application/json'
};

async function testLocations() {
    try {
        console.log('Fetching locations...');
        const response = await axios.get(`${BASE_URL}/locations`, { headers });
        console.log('Success:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

testLocations();
