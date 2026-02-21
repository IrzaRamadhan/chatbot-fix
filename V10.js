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
const session = require('./System/lib/session');
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
    m.body = body; // Attach parsed body to message object for plugins

    // --- Anti-Spam / Anti-Judol Filter ---
    const blacklist = require('./System/lib/blacklist');
    if (blacklist.isSpam(body)) {
      console.log(`[DEBUG] Ignored Spam Message from ${m.sender}: ${body.substring(0, 30)}...`);
      return;
    }

    const sender = m.key.fromMe ? client.user.id.split(":")[0] + "@s.whatsapp.net" ||
      client.user.id : m.key.participant || m.key.remoteJid;

    const senderNumber = sender.split('@')[0];
    const budy = (typeof m.text === 'string' ? m.text : '');
    const prefa = ["", "!", ".", ",", "🐤", "🗿"];

    const prefixRegex = /^[°zZ#$@*+,.?=''():√%!¢£¥€π¤ΠΦ_&><™©®Δ^βα~¦|/\\©^]/;
    const prefix = body && prefixRegex.test(body) ? body.match(prefixRegex)[0] : '';
    const from = m.key.remoteJid;
    const isGroup = from.endsWith("@g.us");

    // --- Inactivity Handler ---
    if (!isGroup && !m.key.fromMe) {
      const chatId = m.chat;

      // Skip inactivity handler if user is in CS mode
      const csSession = session.get(sender);
      if (csSession && csSession.handler === 'cs') {
        // Don't set any timers during CS mode
      } else {
        // Reset existing timers
        if (userSessions[chatId]) {
          clearTimeout(userSessions[chatId].followUp);
          clearTimeout(userSessions[chatId].closing);
        }

        userSessions[chatId] = {
          followUp: setTimeout(async () => {
            try {
              let msg = "gimana nih kak, ada lagi ga?"; // Default fallback

              const currentSession = session.get(sender);
              const sessionType = currentSession?.handler || 'idle';
              const sessionStage = currentSession?.data?.stage || '';

              // Try to get follow-up config from Supabase
              try {
                const supabase = require('./System/lib/supabase');
                const ai = require('./System/lib/ai');

                let query = supabase
                  .from('followup_config')
                  .select('*')
                  .eq('session_type', sessionType)
                  .eq('is_active', true);

                if (sessionStage) {
                  query = query.eq('session_stage', sessionStage);
                }

                const { data: configs } = await query.limit(1);

                if (configs && configs.length > 0) {
                  const cfg = configs[0];
                  msg = await ai.generateFollowUp(cfg.ai_instruction, pushname || "Kak");
                }
              } catch (cfgErr) {
                console.log("FollowUp config error, using fallback:", cfgErr.message);
                // Fallback to hardcoded
                if (currentSession && currentSession.handler === 'ongkir') {
                  const stage = currentSession.data.stage;
                  if (stage === 'parse_form') msg = "Kak, form pemesanannya belum diisi ya? Ditunggu 😊";
                  else if (stage === 'select_courier') msg = "Kak, kurirnya belum dipilih nih 📦";
                  else if (stage === 'review_order') msg = "Kak, jangan lupa konfirmasi pesanannya ya! 💸";
                  else if (stage === 'waiting_payment') msg = "Kak, bukti pembayarannya ditunggu ya 🙏";
                }
              }

              await client.sendMessage(chatId, { text: msg });

              // Start Closing Timer (5 min after follow-up)
              userSessions[chatId].closing = setTimeout(async () => {
                try {
                  // Send Interactive Button Message instead of auto-close
                  const buttons = [
                    {
                      name: "quick_reply",
                      buttonParamsJson: JSON.stringify({
                        display_text: "🔴 Akhiri Obrolan",
                        id: "session_end"
                      })
                    },
                    {
                      name: "quick_reply",
                      buttonParamsJson: JSON.stringify({
                        display_text: "🟢 Lanjutkan",
                        id: "session_continue"
                      })
                    }
                  ];

                  const msg = generateWAMessageFromContent(chatId, {
                    viewOnceMessage: {
                      message: {
                        interactiveMessage: proto.Message.InteractiveMessage.create({
                          body: proto.Message.InteractiveMessage.Body.create({ text: "Halo kak, sepertinya tidak ada aktivitas. Mau disudahi atau lanjut? 😊" }),
                          footer: proto.Message.InteractiveMessage.Footer.create({ text: "Amanin Guys Bot" }),
                          header: proto.Message.InteractiveMessage.Header.create({ title: "Sesi Validasi Akhir", subtitle: "", hasMediaAttachment: false }),
                          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                            buttons: buttons
                          })
                        })
                      }
                    }
                  }, { userJid: client.user.id });

                  await client.relayMessage(chatId, msg.message, { messageId: msg.key.id });

                } catch (e) {
                  if (e?.output?.statusCode !== 428 && e?.message !== 'Connection Closed') {
                    console.error("Error sending closing confirmation:", e);
                  }
                }
              }, 300000);

            } catch (e) {
              // Ignore connection closed errors (harmless cleanup)
              if (e?.output?.statusCode !== 428 && e?.message !== 'Connection Closed') {
                console.error("Error sending follow-up:", e);
              }
            }
          }, 300000) // 5 min inactivity
        };
      } // end else (not CS mode)
    }

    // --- Handle Session Control Buttons ---
    if (body === 'session_end') {
      await reply("Terima kasih, selamat beraktifitas! 👋");
      if (userSessions[m.chat]) {
        clearTimeout(userSessions[m.chat].followUp);
        clearTimeout(userSessions[m.chat].closing);
        delete userSessions[m.chat];
      }
      session.delete(sender);
      return;
    }

    if (body === 'session_continue') {
      const userSession = session.get(sender);
      let msg = "Oke kak, kita lanjut ya! 🚀";

      if (userSession && userSession.handler === 'ongkir') {
        const stage = userSession.data.stage;
        if (stage === 'ask_quantity') msg = "Siip! Jadi pesan berapa pcs nih? 😊";
        else if (stage === 'ask_address') msg = "Lanjut kak! Alamatnya ditunggu ya... 🚚";
        else if (stage === 'select_courier') msg = "Yuk lanjut pilih kurirnya kak... 📦";
        else if (stage === 'review_order') msg = "Pesanan aman. Jangan lupa selesaikan pembayaran ya! 💸";
      }

      await reply(msg);
      // Timers will be reset automatically by the next message processing loop or strictly here?
      // logic above resets timers on ANY message. So this message "session_continue" ALREADY reset the timers at top of logic.
      return;
    }
    // --------------------------
    // --------------------------
    const botNumber = await client.decodeJid(client.user.id);
    // Use config.owner from settings/config.js which is updated by Web Admin
    const ownerNumber = config.owner;
    const isOwner = [botNumber, ownerNumber].map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m.sender);
    const isBot = botNumber.includes(senderNumber);

    const isCmd = body && prefix.length > 0 && body.startsWith(prefix);
    const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
    console.log(`[DEBUG] Command detected: '${command}' (isCmd: ${isCmd}, Body: '${body}')`);
    const command2 = body ? body.replace(prefix, '').trim().split(/ +/).shift().toLowerCase() : '';
    const args = body ? body.trim().split(/ +/).slice(1) : [];
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



    // Check for active session
    let userState = session.get(sender);

    // Only reset session if it's an explicit order command or menu button
    // AND NOT when user is in CS mode (to protect human operator conversation)
    if ((command === 'order' || command === 'menu') && (!userState || userState.handler !== 'cs')) {
      session.delete(sender);
      userState = null; // Re-sync local variable
    }

    console.log(`[DEBUG] Session check for ${sender}:`, userState ? "FOUND" : "NONE");
    if (userState && !['generate', 'gen', 'halo', 'order', 'menu'].includes(command)) {
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
        return; // Command handled, stop
      }
    }

    // --- AI Fallback for non-command private messages ---
    const csCheck = session.get(sender);
    if (!isGroup && !isCmd && !m.key.fromMe && body && body.trim().length > 0 && config.aiEnabled && (!csCheck || csCheck.handler !== 'cs')) {
      try {
        const aiPath = require.resolve('./System/lib/ai');
        delete require.cache[aiPath];
        const ai = require('./System/lib/ai');
        const supabase = require('./System/lib/supabase');

        // Fetch products for AI context
        const { data: products } = await supabase
          .from('product')
          .select('*')
          .eq('IsActive', true);

        const aiResponse = await ai.chatReply(sender, body, pushname, products || []);
        if (aiResponse) {
          // Send AI response with action buttons
          const buttons = [
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "🛒 Order Sekarang",
                id: ".order"
              })
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "📦 Cek Pesanan",
                id: ".cekpesanan"
              })
            },
            {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: "💬 Chat dengan CS",
                id: ".cs"
              })
            }
          ];

          const aiMsg = generateWAMessageFromContent(m.chat, {
            viewOnceMessage: {
              message: {
                interactiveMessage: proto.Message.InteractiveMessage.create({
                  body: proto.Message.InteractiveMessage.Body.create({ text: aiResponse }),
                  footer: proto.Message.InteractiveMessage.Footer.create({ text: "© Amanin Guys Bot" }),
                  nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                    buttons: buttons
                  })
                })
              }
            }
          }, { userJid: client.user.id, quoted: m });

          await client.relayMessage(m.chat, aiMsg.message, { messageId: aiMsg.key.id });
        }
      } catch (aiErr) {
        console.error("AI Fallback Error:", aiErr.message);
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