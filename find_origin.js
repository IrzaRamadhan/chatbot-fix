const biteship = require('./System/lib/biteship');

(async () => {
    try {
        const areas = await biteship.searchArea("Ketintang, Gayungan, Surabaya");
        if (areas && areas.length > 0) {
            console.log("Area ID:", areas[0].id);
        } else {
            console.log("No area found.");
        }
    } catch (e) {
        console.error(e);
    }
})();
