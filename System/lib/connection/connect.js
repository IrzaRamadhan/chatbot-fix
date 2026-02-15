const fs = require('fs');
const config = () => require('../../../settings/config');

exports.konek = async ({ client, update, clientstart, DisconnectReason, Boom }) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
        let reason = new Boom(lastDisconnect?.error)?.output.statusCode;

        if (reason === DisconnectReason.badSession) {
            console.log(`Bad session - attempting reconnect without clearing session`);
            // DON'T delete session - try to reconnect
            // Session will only be cleared via manual reset or new pairing request
            clientstart();
        } else if (reason === DisconnectReason.connectionClosed) {
            console.log("Connection closed, reconnecting...");
            clientstart();
        } else if (reason === DisconnectReason.connectionLost) {
            console.log("Connection lost from server, reconnecting...");
            clientstart();
        } else if (reason === DisconnectReason.connectionReplaced) {
            console.log("Connection replaced, another new session opened, please restart bot");
            client.end();
        } else if (reason === DisconnectReason.loggedOut) {
            console.log(`Device logged out, please delete folder session and scan again.`);
            const sessionDir = `./${config().session}`;
            if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
            clientstart();
        } else if (reason === DisconnectReason.restartRequired) {
            console.log("Restart required, restarting...");
            clientstart();
        } else if (reason === DisconnectReason.timedOut) {
            console.log("Connection timed out, reconnecting...");
            clientstart();
        } else {
            console.log(`Unknown disconnect reason: ${reason}|${connection}`);
            clientstart();
        }
    } else if (connection === "open") {
        console.log('Berhasil tersambung');

        // ID Channel 
        const newsletterIDs = [
            "0@newsletter",
            "0@newsletter"
        ];

        // Link Grup 
        const groupInvites = [
            "0",
            "0"
        ];

        const uniqueNewsletterIDs = [...new Set(newsletterIDs)];

        async function followAllNewsletters() {
            try {
                for (const id of uniqueNewsletterIDs) {
                    try {
                        await client.newsletterFollow(id);
                        console.log(`Successfully followed newsletter: ${id}`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                    }
                }
            } catch (error) {
            }
        }

        async function joinAllGroups() {
            try {
                for (const inviteCode of groupInvites) {
                    try {
                        await client.groupAcceptInvite(inviteCode);

                        // Delay antar join group
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    } catch (error) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            } catch (error) {
            }
        }

        try {
            await followAllNewsletters();
            await joinAllGroups();
        } catch (error) {
        }
    }
}