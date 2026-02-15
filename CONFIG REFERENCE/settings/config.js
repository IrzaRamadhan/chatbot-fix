const fs = require('fs')

const config = {
    owner: "6285124153817",
    botNumber: "6285124153817",
    setPair: "TECHNIFY",
    thumbUrl: "https://files.catbox.moe/x1tbg9.png",
    session: "Technifysessions",
    status: {
        public: true,
        terminal: true,
        reactsw: false
    },
    message: {
        owner: "｢ ACCESS DENIED ｣",
        group: "Ketiknya Didalam Group Yang Mau Di Bug.",
        admin: "｢ ACCESS DENIED ｣",
        private: "this is specifically for private chat"
    },
    settings: {
        title: "Technify",
        packname: "Technify Digital",
        description: "Technify - Iky Technify",
        author: "https://wa.me/6285353671215",
        footer: "ジ© 2026 Technify`"
    },
    newsletter: {
        name: "INFORMATION - TECHNIFY DIGITAL",
        id: "0@newsletter"
    },
    socialMedia: {
        YouTube: "https://youtube.com/",
        GitHub: "https://github.com/",
        Telegram: "https://t.me/",
        ChannelWA: "https://whatsapp.com/channel/0029VbCU7537oQhc5hmIZS1Q"
    }
}

module.exports = config;

let file = require.resolve(__filename)
require('fs').watchFile(file, () => {
    require('fs').unwatchFile(file)
    console.log('\\x1b[0;32m' + __filename + ' \\x1b[1;32mupdated!\\x1b[0m')
    delete require.cache[file]
    require(file)
})
