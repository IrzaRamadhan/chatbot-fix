const axios = require('axios');

const API_KEY = 'biteship_live.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1lIjoiY2hhdGJvdC1maXgiLCJ1c2VySWQiOiI2OTg3ZWI1ZGNhZGI5NTRlZTY1NWQzNzMiLCJpYXQiOjE3NzExNjQ3Mjl9.rVSLSL82OdwvSyr_jsKZ1RW1vYvV1n1reT0fU4Hn61k';
const BASE_URL = 'https://api.biteship.com/v1';

const fs = require('fs');
const path = require('path');

const STORE_CONFIG_PATH = path.join(__dirname, 'database', 'store.json');

// STORE INFORMATION (Loaded from JSON)
let STORE_INFO = {
    name: "Amanin Guys Store",
    phone: "6282245465241",
    address: "Jl. Ketintang No. X, Surabaya",
    area_id: "IDNP11IDNC434IDND5425IDZ60231",
    postal_code: "60231",
    latitude: -7.3117,
    longitude: 112.7303
};

try {
    if (fs.existsSync(STORE_CONFIG_PATH)) {
        STORE_INFO = JSON.parse(fs.readFileSync(STORE_CONFIG_PATH, 'utf8'));
    }
} catch (e) {
    console.error("Failed to load store config:", e);
}

exports.reloadStoreConfig = () => {
    try {
        if (fs.existsSync(STORE_CONFIG_PATH)) {
            STORE_INFO = JSON.parse(fs.readFileSync(STORE_CONFIG_PATH, 'utf8'));
            return true;
        }
    } catch (e) {
        console.error("Failed to reload store config:", e);
    }
    return false;
};

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

exports.getPickupLocations = async () => {
    try {
        const response = await axios.get(`${BASE_URL}/locations`, { headers });
        if (response.data && response.data.locations) {
            // Filter only 'origin' type locations
            return response.data.locations.filter(loc => loc.type === 'origin');
        }
        return [];
    } catch (error) {
        console.error("Biteship Get Locations Error:", error.response ? error.response.data : error.message);
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

// Create Draft Order (Safe - No Balance Deduction)
exports.createDraftOrder = async (consignee, courier, items) => {
    try {
        const payload = {
            shipper_contact_name: STORE_INFO.name,
            shipper_contact_phone: STORE_INFO.phone,
            shipper_organization: "Amanin Guys",
            origin_contact_name: STORE_INFO.name,
            origin_contact_phone: STORE_INFO.phone,
            origin_address: STORE_INFO.address,
            origin_postal_code: STORE_INFO.postal_code,
            origin_area_id: STORE_INFO.area_id,
            origin_coordinate: {
                latitude: STORE_INFO.latitude || -7.3117,
                longitude: STORE_INFO.longitude || 112.7303
            },
            destination_contact_name: consignee.name,
            destination_contact_phone: consignee.phone,
            destination_contact_email: "customer@example.com",
            destination_address: consignee.address,
            destination_postal_code: consignee.postal_code,
            destination_area_id: consignee.area_id,
            courier_company: courier.courier_code || courier.company,
            courier_type: courier.courier_service_code || courier.type,
            courier_insurance: 0,
            delivery_type: "now",
            delivery_date: new Date().toISOString().split('T')[0],
            delivery_time: "08:00", // Required for scheduled/later, sometimes now
            items: items
        };

        console.log("Creating Draft Order with payload:", JSON.stringify(payload, null, 2));
        const response = await axios.post(`${BASE_URL}/draft_orders`, payload, { headers });
        return response.data;
    } catch (error) {
        console.error("Biteship Create Draft Error:", error.response ? error.response.data : error.message);
        throw error;
    }
};

// Confirm Draft Order (Deducts Balance)
exports.confirmOrder = async (draftOrderId) => {
    try {
        const response = await axios.post(`${BASE_URL}/orders/${draftOrderId}/confirm`, {}, { headers });
        return response.data;
    } catch (error) {
        console.error("Biteship Confirm Order Error:", error.response ? error.response.data : error.message);
        throw error;
    }
};

// Get Order Details (Tracking)
exports.getOrder = async (orderId) => {
    try {
        const response = await axios.get(`${BASE_URL}/orders/${orderId}`, { headers });
        return response.data;
    } catch (error) {
        console.error("Biteship Get Order Error:", error.response ? error.response.data : error.message);
        return null;
    }
};
