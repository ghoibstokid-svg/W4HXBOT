// ============================================================
//  W4HX NOTIFICATION LIVE — WEBHOOK VERSION (FIXED)
//  TikTok Live → Discord Webhook (Semua Komentar)
// ============================================================

const { TikTokLiveConnection } = require('tiktok-live-connector');

// ============================================================
//  🔧 KONFIGURASI — EDIT DI SINI
// ============================================================

const WEBHOOK_URL = "https://discord.com/api/webhooks/1564444731528974457/0lwatfX5C1PFW3rJToqToXhLgnM62iXMwKC9xa0YFK1goiKLs7VRBZTP6NYQ_apoMDKj";
const TIKTOK_USERNAME = "w4hxareaofficial";
const SIGN_API_KEY = "euler_NTI4NGI1ZjNhOWIwN2FlZjY5MTE1NzVkNzJiMDQ4OTJkY2RmYTk1YTY2OTBlYWYxMjQ3YTQ5";

// ============================================================
//  VALIDASI
// ============================================================
if (!WEBHOOK_URL || WEBHOOK_URL.includes("xxxx")) {
    console.error("❌ [W4HX] WEBHOOK_URL belum diisi!");
    process.exit(1);
}
if (!TIKTOK_USERNAME || TIKTOK_USERNAME.includes("username_")) {
    console.error("❌ [W4HX] TIKTOK_USERNAME belum diisi!");
    process.exit(1);
}
if (!SIGN_API_KEY || SIGN_API_KEY.includes("ISI_")) {
    console.warn("⚠️ [W4HX] SIGN_API_KEY belum diisi / masih placeholder.");
    console.warn("⚠️ [W4HX] Koneksi TikTok kemungkinan gagal dengan error 401.");
}

// ============================================================
//  STATE
// ============================================================
let tiktokConnection = null;
let komentarCounter  = 0;
let reconnectTimer   = null;
let isConnecting     = false;

// ============================================================
//  KONEKSI TIKTOK
// ============================================================
async function connectToTikTok() {
    if (isConnecting) return;
    isConnecting = true;

    // Bersihkan koneksi lama
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

    // ✅ CEK STATUS LIVE DULU
    try {
        console.log("🔍 [W4HX] Mengecek status live...");
        const isLive = await tiktokConnection.fetchIsLive();
        if (!isLive) {
            isConnecting = false;
            console.log("📴 [W4HX] @" + TIKTOK_USERNAME + " belum live. Cek lagi 60 detik...");
            scheduleReconnect(60000);
            return;
        }
        console.log("🟢 [W4HX] @" + TIKTOK_USERNAME + " sedang LIVE!");
    } catch (err) {
        isConnecting = false;
        console.error("❌ [W4HX] Gagal cek status live:", err.message);
        if (err.message && err.message.toLowerCase().includes('invalid')) {
            console.error("💡 [W4HX] API Key EulerStream kemungkinan tidak valid. Buat key baru di eulerstream.com");
        }
        scheduleReconnect(30000);
        return;
    }

    // ✅ CONNECT KE TIKTOK
    tiktokConnection.connect()
        .then(state => {
            isConnecting = false;
            console.log("✅ [W4HX] Terhubung ke TikTok Live! roomId:", state.roomId);
            console.log("🎧 [W4HX] Mendengarkan SEMUA komentar...");
        })
        .catch(err => {
            isConnecting = false;
            console.error("❌ [W4HX] Gagal connect TikTok:", err.message);
            if (err.message && err.message.toLowerCase().includes('invalid')) {
                console.error("💡 [W4HX] API Key EulerStream tidak valid. Buat key baru di eulerstream.com");
            }
            scheduleReconnect(30000);
        });

    // ── Listener ──────────────────────────────────────────
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
    //  LOGIKA UTAMA: SEMUA KOMENTAR DIBACA
    // ========================================================
    tiktokConnection.on('chat', async (data) => {
        try {
            const komentar   = data.comment || '';
            const userTiktok = data.uniqueId || 'unknown';
            const nickname   = data.nickname || userTiktok;
            const waktu      = new Date().toLocaleTimeString('id-ID', { hour12: false });

            komentarCounter++;

            console.log(`[KOMENTAR #${komentarCounter}] @${userTiktok}: "${komentar}"`);

            await sendToWebhook({
                nomor: komentarCounter,
                tiktok: userTiktok,
                nickname: nickname,
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
//  KIRIM KE DISCORD VIA WEBHOOK
// ============================================================
async function sendToWebhook(data) {
    try {
        const payload = {
            username: "W4HX Notification Live",
            avatar_url: "https://i.imgur.com/4M34hi2.png",
            embeds: [
                {
                    title: "💬 Komentar Baru di Live TikTok",
                    description: `> ${data.komentar.length > 300 ? data.komentar.slice(0, 300) + '...' : data.komentar}`,
                    color: 0x00FF88,
                    fields: [
                        { name: "🔢 No.", value: `**#${data.nomor}**`, inline: true },
                        { name: "📱 TikTok", value: `[@${data.tiktok}](https://tiktok.com/@${data.tiktok})`, inline: true },
                        { name: "👤 Nickname", value: data.nickname, inline: true },
                        { name: "⏰ Waktu", value: data.waktu, inline: true }
                    ],
                    footer: { text: "W4HX System • Live Chat Reader" },
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
        } else {
            console.log(`✅ [W4HX] Komentar #${data.nomor} terkirim ke Discord.`);
        }
    } catch (err) {
        console.error("❌ [W4HX] Gagal kirim webhook:", err.message);
    }
}

// ============================================================
//  START
// ============================================================
console.log("============================================================");
console.log("🚀 [W4HX] W4HX Notification Live (Semua Komentar)");
console.log("📡 [W4HX] Memantau TikTok: @" + TIKTOK_USERNAME);
console.log("🔗 [W4HX] Webhook URL:", WEBHOOK_URL.substring(0, 50) + "...");
console.log("🔑 [W4HX] API Key:", SIGN_API_KEY.substring(0, 12) + "...");
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
