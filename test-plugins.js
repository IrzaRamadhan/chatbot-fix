const fs = require('fs');
const path = require('path');

const commandDir = path.resolve('c:/Users/Administrator/Downloads/TECHNIFY WHATSAPP BASE/command');
const files = fs.readdirSync(commandDir);

console.log('Verifying plugins in:', commandDir);

let hasError = false;

files.forEach(file => {
    if (file.endsWith('.js')) {
        const filePath = path.join(commandDir, file);
        try {
            const plugin = require(filePath);
            console.log(`[OK] Loaded ${file}`);

            if (typeof plugin !== 'function') {
                console.error(`[ERR] ${file} does not export a function (handler).`);
                hasError = true;
            }

            if (!plugin.command) {
                console.warn(`[WARN] ${file} does not have .command property.`);
            } else {
                console.log(`     Commands: ${plugin.command.join(', ')}`);
            }

        } catch (e) {
            console.error(`[FAIL] Failed to load ${file}:`, e.message);
            hasError = true;
        }
    }
});

if (hasError) {
    console.log('Verification FAILED');
    process.exit(1);
} else {
    console.log('Verification PASSED');
}
