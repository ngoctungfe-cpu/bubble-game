// =====================================================
// CẤU HÌNH SUPABASE - THAY ĐỔI THÔNG TIN CỦA BẠN Ở ĐÂY
// =====================================================
// Hướng dẫn: https://supabase.com -> tạo project mới
// Vào Settings > API lấy URL và anon key dán xuống dưới
const SUPABASE_URL = 'https://thay-the-bang-url-cua-ban.supabase.co';
const SUPABASE_ANON_KEY = 'thay-the-bang-anon-key-cua-ban';

// =====================================================
// LEADERBOARD SERVICE
// =====================================================
const LeaderboardService = {
    // Lưu điểm: local + online
    saveScore: function (name, score) {
        // Luôn lưu local
        const today = new Date().toLocaleDateString('vi-VN');
        this._saveLocal(name, score, today);
        // Lưu online (bất đồng bộ, âm thầm)
        this._saveOnline(name, score, today);
    },

    // Load: local + online, merge lại
    loadLeaderboard: async function () {
        const local = this._loadLocal();
        if (this._isSupabaseReady()) {
            try {
                const online = await this._fetchOnline();
                return this._merge(local, online);
            } catch (e) {
                console.warn('Không tải được leaderboard online:', e.message);
            }
        }
        return local;
    },

    // ---- LOCAL ----
    _saveLocal: function (name, score, date) {
        try {
            let data = JSON.parse(localStorage.getItem('bubbleLeaderboard')) || [];
            const idx = data.findIndex(item => item.name.toLowerCase() === name.toLowerCase());
            if (idx !== -1) {
                if (score > data[idx].score) {
                    data[idx].score = score;
                    data[idx].date = date;
                }
            } else {
                data.push({ name, score, date });
            }
            data.sort((a, b) => b.score - a.score);
            localStorage.setItem('bubbleLeaderboard', JSON.stringify(data.slice(0, 10)));
        } catch (e) {
            console.warn('Không lưu được local leaderboard:', e.message);
        }
    },

    _loadLocal: function () {
        try {
            return JSON.parse(localStorage.getItem('bubbleLeaderboard')) || [];
        } catch (e) {
            return [];
        }
    },

    // ---- ONLINE (Supabase) ----
    _isSupabaseReady: function () {
        return SUPABASE_URL && SUPABASE_ANON_KEY
            && !SUPABASE_URL.includes('thay-the')
            && typeof supabase !== 'undefined';
    },

    _saveOnline: async function (name, score, date) {
        if (!this._isSupabaseReady()) return;
        try {
            const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            // Lấy điểm cũ của người chơi
            const { data: existing } = await sb
                .from('leaderboard')
                .select('id, score')
                .ilike('name', name)
                .limit(1);
            if (existing && existing.length > 0) {
                if (score > existing[0].score) {
                    await sb.from('leaderboard').update({ score, date }).eq('id', existing[0].id);
                }
            } else {
                await sb.from('leaderboard').insert({ name, score, date });
            }
        } catch (e) {
            console.warn('Lỗi gửi điểm online:', e.message);
        }
    },

    _fetchOnline: async function () {
        const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data } = await sb
            .from('leaderboard')
            .select('name, score, date')
            .order('score', { ascending: false })
            .limit(10);
        return data || [];
    },

    // ---- MERGE ----
    _merge: function (local, online) {
        const map = new Map();
        local.forEach(item => {
            const key = item.name.toLowerCase();
            if (!map.has(key) || item.score > map.get(key).score) {
                map.set(key, item);
            }
        });
        online.forEach(item => {
            const key = (item.name || '').toLowerCase();
            if (!key) return;
            if (!map.has(key) || item.score > map.get(key).score) {
                map.set(key, item);
            }
        });
        return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 10);
    }
};
