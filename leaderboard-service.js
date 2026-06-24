const firebaseConfig = {
    apiKey: "AIzaSyA5xPCoSsbT3L6qJLVN8mi0_Ee5RCpMkXk",
    authDomain: "bubble-game-c3516.firebaseapp.com",
    projectId: "bubble-game-c3516",
    storageBucket: "bubble-game-c3516.firebasestorage.app",
    messagingSenderId: "444568505186",
    appId: "1:444568505186:web:4fcf0e958dda35f7ac7a3b",
    measurementId: "G-N8TFZCRNSH"
};

firebase.initializeApp(firebaseConfig);

const LeaderboardService = {
    saveScore: function (name, score) {
        const today = new Date().toLocaleDateString('vi-VN');
        this._saveLocal(name, score, today);
        this._saveOnline(name, score, today);
    },

    loadLeaderboard: async function () {
        const local = this._loadLocal();
        if (this._isFirebaseReady()) {
            try {
                const online = await this._fetchOnline();
                return this._merge(local, online);
            } catch (e) {
                console.warn('Không tải được leaderboard online:', e.message);
            }
        }
        return local;
    },

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

    _isFirebaseReady: function () {
        return typeof firebase !== 'undefined' && firebase.firestore;
    },

    _saveOnline: async function (name, score, date) {
        if (!this._isFirebaseReady()) return;
        try {
            const db = firebase.firestore();
            const snapshot = await db.collection('leaderboard')
                .where('name', '==', name)
                .limit(1)
                .get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const data = doc.data();
                if (score > data.score) {
                    await doc.ref.update({ score, date });
                }
            } else {
                await db.collection('leaderboard').add({ name, score, date });
            }
        } catch (e) {
            console.warn('Lỗi gửi điểm online:', e.message);
        }
    },

    _fetchOnline: async function () {
        const db = firebase.firestore();
        const snapshot = await db.collection('leaderboard')
            .orderBy('score', 'desc')
            .limit(10)
            .get();
        return snapshot.docs.map(doc => ({ name: doc.data().name, score: doc.data().score, date: doc.data().date }));
    },

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
