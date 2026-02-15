const axios = require('axios');

const API_KEY = 'biteship_live.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiY2hhdGJvdC1maXgiLCJ1c2VySWQiOiI2OTg3ZWI1ZGNhZGI5NTRlZTY1NWQzNzMiLCJpYXQiOjE3NzExNjQ3Mjl9.rVSLSL82OdwvSyr_jsKZ1RW1vYvV1n1reT0fU4Hn61k';
const BASE_URL = 'https://api.biteship.com/v1';

const headers = {
    'Authorization': API_KEY,
    'Content-Type': 'application/json'
};

exports.searchArea = async (query) => {
    try {
        const response = await axios.get(`${BASE_URL}/maps/areas?countries=ID&input=${encodeURIComponent(query)}&type=single`, { headers });
        return response.data.areas;
    } catch (error) {
        console.error("Biteship Search Error:", error.response ? error.response.data : error.message);
        return [];
    }
};

exports.getRates = async (originId, destinationId, weight, items) => {
    try {
        const payload = {
            origin_area_id: originId,
            destination_area_id: destinationId,
            couriers: "jne,jnt,sicepat,gojek,grab", // Default couriers
            items: items // [{name, value, weight, quantity}]
        };

        const response = await axios.post(`${BASE_URL}/rates/couriers`, payload, { headers });
        return response.data;
    } catch (error) {
        console.error("Biteship Rates Error:", error.response ? error.response.data : error.message);
        return null;
    }
};
