// ============================================================
//  W4HX NOTIFICATION LIVE — WEBHOOK VERSION (DETAIL & FIXED)
// ============================================================

const { TikTokLiveConnection } = require('tiktok-live-connector');

// ============================================================
//  🔧 KONFIGURASI
// ============================================================
const WEBHOOK_URL = "https://discord.com/api/webhooks/1564444731528974457/0lwatfX5C1PFW3rJToqToXhLgnM62iXMwKC9xa0YFK1goiKLs7VRBZTP6NYQ_apoMDKj";
const TIKTOK_USERNAME = "w4hxareaofficial";
const SIGN_API_KEY = "euler_NTI4NGI1ZjNhOWIwN2FlZjY5MTE1NzVkNzJiMDQ4OTJkY2RmYTk1YTY2OTBlYWYxMjQ3YTQ5";

// ============================================================
//  VALIDASI
// ============================================================
if (!WEBHOOK_URL || WEBHOOK_URL.includes("xxxx")) {
    console.error("❌ WEBHOOK_URL belum diisi!");
    process.exit(1);
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

    if (tiktokConnection) {
        try { tiktokConnection.disconnect(); } catch (_) {}
        tiktokConnection = null;
    }

    console.log("🔄 [W4HX] Menghubungkan ke @" + TIKTOK_USERNAME + "...");

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

    // Cek live dulu
    try {
        console.log("🔍 [W4HX] Cek status live...");
        const isLive = await tiktokConnection.fetchIsLive();
        if (!isLive) {
            isConnecting = false;
            console.log("📴 [W4HX] Belum live. Cek lagi 60 detik...");
            scheduleReconnect(60000);
            return;
        }
        console.log("🟢 [W4HX] SEDANG LIVE!");
    } catch (err) {
        isConnecting = false;
        console.error("❌ [W4HX] Gagal cek live:", err.message);
        scheduleReconnect(30000);
        return;
    }

    // Connect
    tiktokConnection.connect()
        .then(state => {
            isConnecting = false;
            console.log("✅ [W4HX] Terhubung! roomId:", state.roomId);
            console.log("🎧 [W4HX] Mendengarkan komentar...");
        })
        .catch(err => {
            isConnecting = false;
            console.error("❌ [W4HX] Gagal connect:", err.message);
            if (err.message && err.message.toLowerCase().includes('invalid')) {
                console.error("💡 API Key EulerStream TIDAK VALID. Buat baru di eulerstream.com");
            }
            scheduleReconnect(30000);
        });

    tiktokConnection.on('disconnected', () => {
        console.warn("⚠️ Terputus. Reconnect...");
        scheduleReconnect(5000);
    });

    tiktokConnection.on('error', (err) => {
        console.error("❌ TikTok Error:", err.message || err);
    });

    tiktokConnection.on('streamEnd', () => {
        console.warn("🔴 Live berakhir. Tunggu live berikutnya...");
        scheduleReconnect(30000);
    });

    // ========================================================
    //  LOGIKA UTAMA: SEMUA KOMENTAR
    // ========================================================
    tiktokConnection.on('chat', async (data) => {
        try {
            const komentar   = data.comment || '';
            const userTiktok = data.uniqueId || 'unknown';
            const nickname   = data.nickname || userTiktok;
            const waktu      = new Date().toLocaleTimeString('id-ID', { hour12: false });
            const tanggal    = new Date().toLocaleDateString('id-ID');

            komentarCounter++;

            console.log(`[#${komentarCounter}] @${userTiktok} (${nickname}): "${komentar}"`);

            await sendToWebhook({
                nomor: komentarCounter,
                tiktok: userTiktok,
                nickname: nickname,
                waktu: waktu,
                tanggal: tanggal,
                komentar: komentar
            });
        } catch (err) {
            console.error("❌ Error proses chat:", err.message);
        }
    });
}

// ============================================================
//  RE-CONNECT
// ============================================================
function scheduleReconnect(ms) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        console.log("🔁 Reconnect...");
        connectToTikTok();
    }, ms);
}

// ============================================================
//  KIRIM KE DISCORD (PESAN DETAIL)
// ============================================================
async function sendToWebhook(data) {
    try {
        // Format pesan yang JELAS dan DETAIL
        const payload = {
            username: "W4HX Live Reader",
            avatar_url: "https://i.imgur.com/4M34hi2.png",
            embeds: [
                {
                    title: `💬 Komentar #${data.nomor} di Live @${TIKTOK_USERNAME}`,
                    description: `**Isi Komentar:**\n>>> ${data.komentar}`,
                    color: 0x00FF88,
                    fields: [
                        { 
                            name: "📱 Username TikTok", 
                            value: `[@${data.tiktok}](https://tiktok.com/@${data.tiktok})`, 
                            inline: true 
                        },
                        { 
                            name: "👤 Nama Tampilan", 
                            value: data.nickname, 
                            inline: true 
                        },
                        { 
                            name: "⏰ Waktu", 
                            value: `${data.waktu} (${data.tanggal})`, 
                            inline: false 
                        }
                    ],
                    footer: { 
                        text: "W4HX System • Live Chat Reader" 
                    },
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
            console.error(`❌ Webhook gagal (${response.status}):`, text);
        } else {
            console.log(`✅ Komentar #${data.nomor} terkirim ke Discord.`);
        }
    } catch (err) {
        console.error("❌ Gagal kirim webhook:", err.message);
    }
}

// ============================================================
//  START
// ============================================================
console.log("============================================================");
console.log("🚀 W4HX Notification Live — Semua Komentar");
console.log("📡 Target: @" + TIKTOK_USERNAME);
console.log("🔗 Webhook:", WEBHOOK_URL.substring(0, 60) + "...");
console.log("============================================================");

connectToTikTok();

// ============================================================
//  SHUTDOWN
// ============================================================
process.on('SIGINT', () => {
    console.log("🛑 Mematikan...");
    if (tiktokConnection) try { tiktokConnection.disconnect(); } catch (_) {}
    process.exit(0);
});
process.on('SIGTERM', () => {
    console.log("🛑 Mematikan (SIGTERM)...");
    if (tiktokConnection) try { tiktokConnection.disconnect(); } catch (_) {}
    process.exit(0);
});
process.on('unhandledRejection', (reason) => {
    console.error("⚠️ Unhandled Rejection:", reason);
});
