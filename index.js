// ============================================================
//  W4HX NOTIFICATION LIVE
//  TikTok Live → Discord Notification Bot
//  Konfigurasi ditulis langsung di bawah (pakai tanda kutip)
// ============================================================

const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const { WebcastPushConnection } = require('tiktok-live-connector');

// ============================================================
//  🔧 KONFIGURASI — EDIT DI SINI
// ============================================================

// Bot ID (Application ID) — dari Developer Portal → General Information
const BOT_ID = "1564444731528974457";

// Bot Token — dari Developer Portal → Bot → Reset Token
const BOT_TOKEN = "https://discord.com/api/webhooks/1564444731528974457/0lwatfX5C1PFW3rJToqToXhLgnM62iXMwKC9xa0YFK1goiKLs7VRBZTP6NYQ_apoMDKj";

// Channel ID Discord tujuan notifikasi
const CHANNEL_ID = "1564444648917835886";

// Username TikTok yang mau dipantau (tanpa @)
const TIKTOK_USERNAME = "w4hxareaofficial";

// API Key EulerStream (untuk signing TikTok Live)
const SIGN_API_KEY = "ad7c9b408e98a9cab0ff1cc22d654ba1b99f4a7ebfe1374de178cb7b6c9e86c6";

// ============================================================
//  VALIDASI
// ============================================================
if (
    BOT_TOKEN.includes("ISI_") ||
    CHANNEL_ID.includes("ISI_") ||
    TIKTOK_USERNAME.includes("ISI_")
) {
    console.error("❌ [W4HX] Kamu belum mengisi konfigurasi di bagian atas index.js!");
    console.error("   Isi BOT_TOKEN, CHANNEL_ID, dan TIKTOK_USERNAME terlebih dahulu.");
    process.exit(1);
}

// ============================================================
//  STATE GLOBAL
// ============================================================
let tiktokConnection = null;
let antrianCounter   = 0;
let reconnectTimer   = null;
let isConnecting     = false;

// ============================================================
//  DISCORD CLIENT
// ============================================================
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
    console.log("============================================================");
    console.log("✅ [W4HX] Bot Discord online sebagai:", client.user.tag);
    console.log("🆔 [W4HX] Bot ID:", client.user.id);
    console.log("📡 [W4HX] Memantau TikTok Live: @" + TIKTOK_USERNAME);
    console.log("📢 [W4HX] Channel Notifikasi ID:", CHANNEL_ID);
    console.log("============================================================");

    // Info link invite bot (pakai BOT_ID)
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${BOT_ID}&scope=bot&permissions=2048`;
    console.log("🔗 [W4HX] Link invite bot:", inviteUrl);

    client.user.setActivity('W4HX Notification Live', { type: ActivityType.Watching });

    connectToTikTok();
});

client.on('error', (err) => {
    console.error("❌ [W4HX] Discord Client Error:", err.message);
});

// ============================================================
//  KONEKSI KE TIKTOK LIVE
// ============================================================
function connectToTikTok() {
    if (isConnecting) return;
    isConnecting = true;

    if (tiktokConnection) {
        try { tiktokConnection.disconnect(); } catch (_) {}
        tiktokConnection = null;
    }

    console.log("🔄 [W4HX] Menghubungkan ke TikTok Live @" + TIKTOK_USERNAME + "...");

    const options = {
        processInitialData: false,
        enableExtendedGiftInfo: false,
        enableWebsocketUpgrade: true,
        requestPollingIntervalMs: 2000
    };
    if (SIGN_API_KEY && !SIGN_API_KEY.includes("ISI_")) {
        options.signProvider = 'eulerstream';
        options.signApiKey = SIGN_API_KEY;
    }

    tiktokConnection = new WebcastPushConnection(TIKTOK_USERNAME, options);

    tiktokConnection.connect()
        .then(state => {
            isConnecting = false;
            console.log("✅ [W4HX] Terhubung ke TikTok Live! roomId:", state.roomId);
            console.log("🎧 [W4HX] Mendengarkan komentar...");
        })
        .catch(err => {
            isConnecting = false;
            console.error("❌ [W4HX] Gagal connect TikTok:", err.message);
            if (err.message && err.message.toLowerCase().includes('eulerstream')) {
                console.error("💡 [W4HX] Daftar API key gratis di https://www.eulerstream.com lalu isi SIGN_API_KEY.");
            }
            scheduleReconnect(15000);
        });

    tiktokConnection.on('disconnected', () => {
        console.warn("⚠️ [W4HX] Koneksi TikTok terputus. Reconnect dalam 5 detik...");
        scheduleReconnect(5000);
    });

    tiktokConnection.on('error', (err) => {
        console.error("❌ [W4HX] TikTok Error:", err.message || err);
    });

    tiktokConnection.on('streamEnd', () => {
        console.warn("🔴 [W4HX] Live TikTok telah berakhir. Menunggu live berikutnya...");
        scheduleReconnect(30000);
    });

    // ========================================================
    //  LOGIKA UTAMA: SETIAP KOMENTAR MASUK
    // ========================================================
    tiktokConnection.on('chat', async (data) => {
        try {
            const komentar    = data.comment || '';
            const userTiktok  = data.uniqueId || 'unknown';
            const nickname    = data.nickname || userTiktok;
            const waktu       = new Date().toLocaleTimeString('id-ID', { hour12: false });

            // FILTER: Deteksi ID Free Fire (8–12 digit angka)
            const ffIdMatch = komentar.match(/\b\d{8,12}\b/);
            if (!ffIdMatch) return;

            const ffId = ffIdMatch[0];
            antrianCounter++;

            console.log(
                `[ANTRIAN #${antrianCounter}] @${userTiktok} | FF: ${ffId} | ${waktu} | "${komentar}"`
            );

            await sendToDiscord({
                antrian: antrianCounter,
                tiktok: userTiktok,
                nickname: nickname,
                ffId: ffId,
                waktu: waktu,
                komentar: komentar
            });
        } catch (err) {
            console.error("❌ [W4HX] Error saat proses chat:", err.message);
        }
    });
}

// ============================================================
//  RE-CONNECT SCHEDULER
// ============================================================
function scheduleReconnect(ms) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        console.log("🔁 [W4HX] Mencoba reconnect...");
        connectToTikTok();
    }, ms);
}

// ============================================================
//  KIRIM NOTIFIKASI KE DISCORD
// ============================================================
async function sendToDiscord(data) {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            console.error("❌ [W4HX] Channel Discord tidak ditemukan / bukan text channel:", CHANNEL_ID);
            return;
        }

        const embed = new EmbedBuilder()
            .setAuthor({
                name: 'W4HX Notification Live',
                iconURL: client.user.displayAvatarURL()
            })
            .setTitle('🎮 Antrian Free Fire Baru!')
            .setDescription(
                `Komplain dari Live **@${TIKTOK_USERNAME}**\n` +
                `> ${data.komentar.length > 200 ? data.komentar.slice(0, 200) + '...' : data.komentar}`
            )
            .setColor(0x00FF88)
            .addFields(
                { name: '🔢 Antrian',   value: `**#${data.antrian}**`, inline: true },
                { name: '📱 TikTok',    value: `[@${data.tiktok}](https://tiktok.com/@${data.tiktok})`, inline: true },
                { name: '👤 Nickname',  value: data.nickname, inline: true },
                { name: '🆔 ID Free Fire', value: `\`${data.ffId}\``, inline: true },
                { name: '⏰ Waktu',      value: data.waktu, inline: true }
            )
            .setFooter({ text: 'W4HX System • Live Notification' })
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (err) {
        console.error("❌ [W4HX] Gagal kirim ke Discord:", err.message);
    }
}

// ============================================================
//  LOGIN DISCORD
// ============================================================
client.login(BOT_TOKEN).catch(err => {
    console.error("❌ [W4HX] Gagal login Discord:", err.message);
    console.error("💡 [W4HX] Periksa BOT_TOKEN di bagian atas index.js.");
    process.exit(1);
});

// ============================================================
//  GRACEFUL SHUTDOWN
// ============================================================
process.on('SIGINT', () => {
    console.log("🛑 [W4HX] Mematikan bot...");
    if (tiktokConnection) try { tiktokConnection.disconnect(); } catch (_) {}
    client.destroy();
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log("🛑 [W4HX] Mematikan bot (SIGTERM)...");
    if (tiktokConnection) try { tiktokConnection.disconnect(); } catch (_) {}
    client.destroy();
    process.exit(0);
});
process.on('unhandledRejection', (reason) => {
    console.error("⚠️ [W4HX] Unhandled Rejection:", reason);
});
