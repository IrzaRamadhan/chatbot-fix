const config = require('./settings/config');
const fs = require('fs');
const axios = require('axios');
const chalk = require("chalk");
const jimp = require("jimp");
const util = require("util");
const fetch = require("node-fetch");
const moment = require("moment-timezone");
const path = require("path");
const os = require('os');
const crypto = require("crypto");
const speed = require('performance-now');
const { spawn, exec, execSync } = require('child_process');
const { default: baileys, getContentType, generateWAMessageFromContent, proto } = require("baileys");
const userSessions = {}; // Global session tracker
module.exports = client = async (client, m, chatUpdate, store) => {
  console.log("[DEBUG] V10 handler triggered. Message type:", m.mtype);
  try {
    const body = (
      m.mtype === "conversation" ? m.message.conversation :
        m.mtype === "imageMessage" ? m.message.imageMessage.caption :
          m.mtype === "videoMessage" ? m.message.videoMessage.caption :
            m.mtype === "extendedTextMessage" ? m.message.extendedTextMessage.text :
              m.mtype === "buttonsResponseMessage" ? m.message.buttonsResponseMessage.selectedButtonId :
                m.mtype === "listResponseMessage" ? m.message.listResponseMessage.singleSelectReply.selectedRowId :
                  m.mtype === "templateButtonReplyMessage" ? m.message.templateButtonReplyMessage.selectedId :
                    m.mtype === "interactiveResponseMessage" ? JSON.parse(m.msg.nativeFlowResponseMessage.paramsJson).id :
                      m.mtype === "templateButtonReplyMessage" ? m.msg.selectedId :
                        m.mtype === "messageContextInfo" ? m.message.buttonsResponseMessage?.selectedButtonId ||
                          m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text : ""
    );

    const sender = m.key.fromMe ? client.user.id.split(":")[0] + "@s.whatsapp.net" ||
      client.user.id : m.key.participant || m.key.remoteJid;

    const senderNumber = sender.split('@')[0];
    const budy = (typeof m.text === 'string' ? m.text : '');
    const prefa = ["", "!", ".", ",", "🐤", "🗿"];

    const prefixRegex = /^[°zZ#$@*+,.?=''():√%!¢£¥€π¤ΠΦ_&><™©®Δ^βα~¦|/\\©^]/;
    const prefix = prefixRegex.test(body) ? body.match(prefixRegex)[0] : '';
    const from = m.key.remoteJid;
    const isGroup = from.endsWith("@g.us");

    // --- Inactivity Handler ---
    if (!isGroup && !m.key.fromMe) {
      const chatId = m.chat;

      // Reset existing timers
      if (userSessions[chatId]) {
        clearTimeout(userSessions[chatId].followUp);
        clearTimeout(userSessions[chatId].closing);
      }

      userSessions[chatId] = {
        followUp: setTimeout(async () => {
          try {
            await client.sendMessage(chatId, { text: "Halo kak, masih ada yang bisa dibantu?" });

            // Start Closing Timer (1 min after follow-up)
            userSessions[chatId].closing = setTimeout(async () => {
              try {
                await client.sendMessage(chatId, { text: "Terima kasih, selamat beraktifitas" });
                delete userSessions[chatId];
              } catch (e) {
                // Ignore connection closed errors (harmless cleanup)
                if (e?.output?.statusCode !== 428 && e?.message !== 'Connection Closed') {
                  console.error("Error sending closing:", e);
                }
              }
            }, 60000);

          } catch (e) {
            // Ignore connection closed errors (harmless cleanup)
            if (e?.output?.statusCode !== 428 && e?.message !== 'Connection Closed') {
              console.error("Error sending follow-up:", e);
            }
          }
        }, 60000) // 1 min inactivity
      };
    }
    // --------------------------
    const botNumber = await client.decodeJid(client.user.id);
    const kontributor = JSON.parse(fs.readFileSync(path.resolve(__dirname, './System/lib/database/owner.json'), 'utf8'));
    const isOwner = [botNumber, ...kontributor].map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m.sender);
    const isBot = botNumber.includes(senderNumber);

    const isCmd = body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
    console.log(`[DEBUG] Command detected: '${command}' (isCmd: ${isCmd}, Body: '${body}')`);
    const command2 = body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase();
    const args = body.trim().split(/ +/).slice(1);
    const pushname = m.pushName || "No Name";
    const text = q = args.join(" ");
    const quoted = m.quoted ? m.quoted : m;
    const mime = (quoted.msg || quoted).mimetype || '';
    const qmsg = (quoted.msg || quoted);
    const isMedia = /image|video|sticker|audio/.test(mime);

    const { smsg, fetchJson, sleep, formatSize, runtime } = require('./System/lib/myfunction');
    const cihuy = fs.readFileSync('./System/lib/media/menu.jpg');
    const bug = fs.readFileSync('./System/lib/media/bugs.jpg');
    const thumbnail = fs.readFileSync('./System/lib/media/w-shennmine.jpg');
    const { fquoted } = require('./System/lib/fquoted');

    // group
    const groupMetadata = m?.isGroup ? await client.groupMetadata(m.chat).catch(() => ({})) : {};
    const groupName = m?.isGroup ? groupMetadata.subject || '' : '';
    const participants = m?.isGroup ? groupMetadata.participants?.map(p => {
      let admin = null;
      if (p.admin === 'superadmin') admin = 'superadmin';
      else if (p.admin === 'admin') admin = 'admin';
      return {
        id: p.id || null,
        jid: p.jid || null,
        admin,
        full: p
      };
    }) || [] : [];
    const groupOwner = m?.isGroup ? participants.find(p => p.admin === 'superadmin')?.jid || '' : '';
    const groupAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.jid || p.id);
    const isBotAdmins = m?.isGroup ? groupAdmins.includes(botNumber) : false;
    const isAdmins = m?.isGroup ? groupAdmins.includes(m.sender) : false;
    const isGroupOwner = m?.isGroup ? groupOwner === m.sender : false;
    async function getLid(jid) {
      return client.getLidUser(jid);
    }

    if (m.message) {
      console.log('\x1b[30m--------------------\x1b[0m');
      console.log(chalk.bgHex("#4a69bd").bold(`▢ New Message`));
      console.log(
        chalk.bgHex("#ffffff").black(
          `   ▢ Tanggal: ${new Date().toLocaleString()} \n` +
          `   ▢ Pesan: ${m.body || m.mtype} \n` +
          `   ▢ Pengirim: ${pushname} \n` +
          `   ▢ JID: ${senderNumber} \n`
        )
      );
      console.log();
    }

    const zets = {
      key: {
        fromMe: false,
        participant: "0@s.whatsapp.net",
        remoteJid: "status@broadcast"
      },
      message: {
        orderMessage: {
          orderId: "2029",
          thumbnail: thumbnail,
          itemCount: `9999999`,
          status: "INQUIRY",
          surface: "CATALOG",
          message: `#-- Zoecode ( 2026 )`,
          token: "AR6xBKbXZn0Xwmu76Ksyd7rnxI+Rx87HfinVlW4lwXa6JA=="
        }
      },
      contextInfo: {
        mentionedJid: [m.sender],
        forwardingScore: 999,
        isForwarded: true
      }
    };


    async function getBuffer(url) {
      const res = await axios.get(url, { responseType: "arraybuffer" });
      return Buffer.from(res.data, "binary");
    }

    const reaction = async (jidss, emoji) => {
      client.sendMessage(jidss, {
        react: {
          text: emoji,
          key: m.key
        }
      });
    };

    async function reply(text) {
      client.sendMessage(m.chat, {
        text: "\n" + text + "\n",
        contextInfo: {
          mentionedJid: [sender],
          externalAdReply: {
            title: config.settings.title,
            body: config.settings.description,
            thumbnailUrl: config.thumbUrl,
            sourceUrl: config.socialMedia.Telegram,
            renderLargerThumbnail: false,
          }
        }
      }, { quoted: fquoted.packSticker });
    }

    // --------------- ( Function ampas lu 🤭 ) --------------- \\

    // ---------------- ( end func bug ampas ) ----------------- \\

    const pluginsLoader = async (directory) => {
      let plugins = [];
      const folders = fs.readdirSync(directory);
      folders.forEach(file => {
        const filePath = path.join(directory, file);
        if (filePath.endsWith(".js")) {
          try {
            const resolvedPath = require.resolve(filePath);
            if (require.cache[resolvedPath]) {
              delete require.cache[resolvedPath];
            }
            const plugin = require(filePath);
            plugins.push(plugin);
          } catch (error) {
            console.log(`${filePath}:`, error);
          }
        }
      });
      return plugins;
    };

    const plugins = await pluginsLoader(path.resolve(__dirname, "./command"));
    console.log(`[DEBUG] Plugins loaded: ${plugins.length} (Reload triggered 11)`);
    const plug = {
      client,
      prefix,
      command,
      reply,
      text,
      isBot,
      reaction,
      pushname,
      mime,
      quoted,
      sleep,
      fquoted,
      fetchJson,
      args,
      isOwner,
      isGroup,
      q,
      budy,
      zets,
      groupMetadata,
      participants,
      groupAdmins,
      isBotAdmins,
      isAdmins,
      isGroupOwner
    };

    const session = require('./System/lib/session');

    // Check for active session
    const userState = session.get(sender); // Use full JID to match session.add
    console.log(`[DEBUG] Session check for ${sender}:`, userState ? "FOUND" : "NONE");
    if (userState) {
      const handlerPlugin = plugins.find(p => p.command.includes(userState.handler + '_start')); // trick to find plugin file? No, better use require
      // Better: dynamically require the file based on handler name if possible, OR
      // Since we know 'ongkir' is the handler, let's just specific check for now or safer:
      // We will loop plugins and check if they have a 'handleInput' and if the command matches the handler?
      // Actually, easiest way: Just require the file directly if we follow convention.
      // But plugins are already loaded in `plugins` array.

      // Let's iterate plugins to find one that handles this state
      // We can add a property to plugin `handlerName`?
      // Or just hardcode for ongkir for now since we haven't standardized 'handler' property in all plugins.

      if (userState.handler === 'ongkir') {
        try {
          const ongkirPlugin = require('./command/ongkir');
          if (ongkirPlugin.handleInput) {
            await ongkirPlugin.handleInput(m, plug, userState);
            return; // Stop processing normal commands
          }
        } catch (e) { console.error('Session handler error', e); }
      }
    }

    for (let plugin of plugins) {
      if (plugin.command.find(e => e == command.toLowerCase())) {
        if (plugin.isBot && !isBot) {
          return;
        }

        if (plugin.private && !plug.isPrivate) {
          return m.reply(config.message.private);
        }

        if (typeof plugin !== "function") return;
        await plugin(m, plug);
      }
    }

  } catch (error) {
    console.error(error);
  }
};

let file = require.resolve(__filename);
require('fs').watchFile(file, () => {
  require('fs').unwatchFile(file);
  console.log('\x1b[0;32m' + __filename + ' \x1b[1;32mupdated!\x1b[0m');
  delete require.cache[file];
  require(file);
});