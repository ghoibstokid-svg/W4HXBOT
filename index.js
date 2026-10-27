// ============================================================
//  W4HX NOTIFICATION LIVE — WEBHOOK VERSION
//  TikTok Live → Discord Webhook
// ============================================================

const { TikTokLiveConnection } = require('tiktok-live-connector');

// ============================================================
//  🔧 KONFIGURASI — EDIT DI SINI
// ============================================================

// Discord Webhook URL (bukan Bot Token!)
// Cara dapat: Discord → klik kanan channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL
const WEBHOOK_URL = "https://discord.com/api/webhooks/1564444731528974457/0lwatfX5C1PFW3rJToqToXhLgnM62iXMwKC9xa0YFK1goiKLs7VRBZTP6NYQ_apoMDKj";

// Username TikTok target (tanpa @)
const TIKTOK_USERNAME = "w4hxareaofficial";

// API Key EulerStream
const SIGN_API_KEY = "euler_NTI4NGI1ZjNhOWIwN2FlZjY5MTE1NzVkNzJiMDQ4OTJkY2RmYTk1YTY2OTBlYWYxMjQ3YTQ5";

// ============================================================
//  VALIDASI
// ============================================================
if (!WEBHOOK_URL || WEBHOOK_URL.includes("xxxx")) {
    console.error("❌ [W4HX] WEBHOOK_URL belum diisi! Copy URL webhook dari Discord.");
    process.exit(1);
}
if (!TIKTOK_USERNAME || TIKTOK_USERNAME.includes("username_")) {
    console.error("❌ [W4HX] TIKTOK_USERNAME belum diisi!");
    process.exit(1);
}

// ============================================================
//  STATE
// ============================================================
let tiktokConnection = null;
let antrianCounter   = 0;
let reconnectTimer   = null;
let isConnecting     = false;

// ============================================================
//  KONEKSI TIKTOK
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

    tiktokConnection = new TikTokLiveConnection(TIKTOK_USERNAME, options);

    tiktokConnection.connect()
        .then(state => {
            isConnecting = false;
            console.log("✅ [W4HX] Terhubung ke TikTok Live! roomId:", state.roomId);
            console.log("🎧 [W4HX] Mendengarkan komentar...");
        })
        .catch(err => {
            isConnecting = false;
            console.error("❌ [W4HX] Gagal connect TikTok:", err.message);
            scheduleReconnect(15000);
        });

    tiktokConnection.on('disconnected', () => {
        console.warn("⚠️ [W4HX] Koneksi TikTok terputus. Reconnect...");
        scheduleReconnect(5000);
    });

    tiktokConnection.on('error', (err) => {
        console.error("❌ [W4HX] TikTok Error:", err.message || err);
    });

    tiktokConnection.on('streamEnd', () => {
        console.warn("🔴 [W4HX] Live berakhir. Menunggu live berikutnya...");
        scheduleReconnect(30000);
    });

    // ========================================================
    //  LOGIKA UTAMA: KOMENTAR MASUK
    // ========================================================
    tiktokConnection.on('chat', async (data) => {
        try {
            const komentar   = data.comment || '';
            const userTiktok = data.uniqueId || 'unknown';
            const nickname   = data.nickname || userTiktok;
            const waktu      = new Date().toLocaleTimeString('id-ID', { hour12: false });

            // FILTER: Deteksi ID Free Fire (8–12 digit angka)
            const ffIdMatch = komentar.match(/\b\d{8,12}\b/);
            if (!ffIdMatch) return;

            const ffId = ffIdMatch[0];
            antrianCounter++;

            console.log(`[ANTRIAN #${antrianCounter}] @${userTiktok} | FF: ${ffId} | ${waktu}`);

            await sendToWebhook({
                antrian: antrianCounter,
                tiktok: userTiktok,
                nickname: nickname,
                ffId: ffId,
                waktu: waktu,
                komentar: komentar
            });
        } catch (err) {
            console.error("❌ [W4HX] Error proses chat:", err.message);
        }
    });
}

// ============================================================
//  RE-CONNECT
// ============================================================
function scheduleReconnect(ms) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        console.log("🔁 [W4HX] Mencoba reconnect...");
        connectToTikTok();
    }, ms);
}

// ============================================================
//  KIRIM KE DISCORD VIA WEBHOOK (FETCH)
// ============================================================
async function sendToWebhook(data) {
    try {
        const payload = {
            username: "W4HX Notification Live",
            avatar_url: "https://i.imgur.com/4M34hi2.png",
            embeds: [
                {
                    title: "🎮 Antrian Free Fire Baru!",
                    description: `Komplain dari Live **@${TIKTOK_USERNAME}**\n> ${data.komentar.length > 200 ? data.komentar.slice(0, 200) + '...' : data.komentar}`,
                    color: 0x00FF88,
                    fields: [
                        { name: "🔢 Antrian", value: `**#${data.antrian}**`, inline: true },
                        { name: "📱 TikTok", value: `[@${data.tiktok}](https://tiktok.com/@${data.tiktok})`, inline: true },
                        { name: "👤 Nickname", value: data.nickname, inline: true },
                        { name: "🆔 ID Free Fire", value: `\`${data.ffId}\``, inline: true },
                        { name: "⏰ Waktu", value: data.waktu, inline: true }
                    ],
                    footer: { text: "W4HX System • Live Notification" },
                    timestamp: new Date().toISOString()
                }
            ]
        };

        const response = await fetch(WEBHOOK_URL + "?wait=true", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`❌ [W4HX] Webhook gagal (${response.status}):`, text);
        }
    } catch (err) {
        console.error("❌ [W4HX] Gagal kirim webhook:", err.message);
    }
}

// ============================================================
//  START
// ============================================================
console.log("============================================================");
console.log("🚀 [W4HX] W4HX Notification Live (Webhook Mode)");
console.log("📡 [W4HX] Memantau TikTok: @" + TIKTOK_USERNAME);
console.log("🔗 [W4HX] Webhook URL:", WEBHOOK_URL.substring(0, 50) + "...");
console.log("============================================================");

connectToTikTok();

// ============================================================
//  GRACEFUL SHUTDOWN
// ============================================================
process.on('SIGINT', () => {
    console.log("🛑 [W4HX] Mematikan...");
    if (tiktokConnection) try { tiktokConnection.disconnect(); } catch (_) {}
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log("🛑 [W4HX] Mematikan (SIGTERM)...");
    if (tiktokConnection) try { tiktokConnection.disconnect(); } catch (_) {}
    process.exit(0);
});
process.on('unhandledRejection', (reason) => {
    console.error("⚠️ [W4HX] Unhandled Rejection:", reason);
});
