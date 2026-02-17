const fs = require('fs');
const biteship = require('./System/lib/biteship');

async function debug() {
    try {
        console.log("Fetching Biteship locations...");
        const locations = await biteship.getPickupLocations();
        console.log(`Found ${locations.length} locations.`);

        fs.writeFileSync('debug_output.json', JSON.stringify(locations, null, 2));
        console.log("Output saved to debug_output.json");
    } catch (error) {
        console.error("Error:", error);
        fs.writeFileSync('debug_output.json', JSON.stringify({ error: error.message }, null, 2));
    }
}

debug();
