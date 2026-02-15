const axios = require('axios');

(async () => {
    console.log('Testing connectivity to google.com...');
    try {
        let res = await axios.get('https://www.google.com');
        console.log('Google Status:', res.status);
        console.log('Connectivity OK.');
    } catch (err) {
        console.error('Google Error:', err.message);
        console.error('Network connectivity seems broken.');
    }
})();
