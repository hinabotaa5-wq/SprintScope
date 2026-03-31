import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebaseの設定
const firebaseConfig = {
    apiKey: "AIzaSyDFxbyaB9H-Zadg5FvRjxufg2eibVNw3vA",
    authDomain: "sprintscope-e8ef7.firebaseapp.com",
    projectId: "sprintscope-e8ef7",
    storageBucket: "sprintscope-e8ef7.firebasestorage.app",
    messagingSenderId: "585818029718",
    appId: "1:585818029718:web:dd4d9190027289d4b64cb7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const CLOUD_NAME = "doipeut1j"; 
const UPLOAD_PRESET = "sprint_preset"; 

// --- 1. ログイン・ログアウト管理 ---
window.handleAuth = async function() {
    if (auth.currentUser) {
        if (confirm("ログアウトしますか？")) {
            await signOut(auth);
            location.reload();
        }
    } else {
        try {
            await signInWithPopup(auth, provider);
        } catch (e) { alert("ログイン失敗"); }
    }
}

onAuthStateChanged(auth, (user) => {
    const authBtn = document.getElementById('auth-btn');
    if (user) {
        authBtn.innerText = "ログアウト";
        authBtn.style.background = "#95a5a6";
    } else {
        authBtn.innerText = "ログイン";
        authBtn.style.background = "#e67e22";
    }
    renderVideos(); // ログイン状態が変わったら画面を更新
});

// --- 2. タブ切り替え ---
window.switchTab = async function(tabName) {
    if ((tabName === 'upload' || tabName === 'profile') && !auth.currentUser) {
        const message = (tabName === 'upload')
        ? "投稿にはログインが必要です。ログインしますか？"
        : "プロフィールを見るにはログインが必要です。ログインしますか？";

        if (confirm(message)) {
            try {
                await signInWithPopup(auth, provider);
            } catch (e) { 
                alert("ログイン失敗"); 
                return; 
            }
        } else { 
            return; 
        }
    }

    const screens = ['home', 'upload', 'profile', 'analysis'];
    screens.forEach(s => document.getElementById(s + '-screen').style.display = 'none');
    document.getElementById(tabName + '-screen').style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(tabName === 'home') document.getElementById('tab-btn-home').classList.add('active');
    if(tabName === 'upload') document.getElementById('tab-btn-upload').classList.add('active');

    const topTabs = document.getElementById('top-tabs');
    const header = document.querySelector('.header'); // ヘッダーを取得

    if(topTabs) {
        topTabs.style.display = (tabName === 'profile' || tabName === 'analysis') ? 'none' : 'flex';
    }

    if(header) {
        // プロフィール画面（profile）と分析画面（analysis）の時だけヘッダーを完全に消す
        header.style.display = (tabName === 'profile' || tabName === 'analysis') ? 'none' : 'block';
    }
    
    renderVideos();
}

// --- 3. 投稿機能（Cloudinary + Firestore） ---
window.submitPost = async function() {
    const fileInput = document.getElementById('video-file-input');
    const phase = document.getElementById('sprint-phase').value;
    const question = document.getElementById('user-question').value;
    const user = auth.currentUser;

    if (!user) { alert("ログインが必要です"); return; }
    if (!fileInput.files[0]) { alert("動画を選択してください"); return; }

    document.getElementById('submit-btn').disabled = true;
    document.getElementById('loading-msg').style.display = 'block';

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('upload_preset', UPLOAD_PRESET);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, {
            method: 'POST', body: formData
        });
        const data = await response.json();
        
        await addDoc(collection(db, "posts"), {
            url: data.secure_url,
            title: `【${phase}】 ${new Date().toLocaleDateString()}`,
            question: question || "（質問なし）",
            userId: user.uid,
            userName: user.displayName,
            createdAt: new Date()
        });

        alert("投稿完了！");
        document.getElementById('user-question').value = "";
        document.getElementById('video-file-input').value = "";
        switchTab('home');
    } catch (e) {
        console.error(e);
        alert("アップロード失敗");
    } finally {
        document.getElementById('submit-btn').disabled = false;
        document.getElementById('loading-msg').style.display = 'none';
    }
};

// --- 4. 動画一覧の描画（ホーム & プロフィール） ---
async function renderVideos() {
    const grid = document.getElementById('main-grid');
    const profGrid = document.getElementById('profile-video-list');
    const user = auth.currentUser;

    if (grid) grid.innerHTML = "<p>Loading...</p>";
    if (profGrid) profGrid.innerHTML = "";
    
    try {
        const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (grid) grid.innerHTML = "";

        const createVideoCardHTML = (post, phaseText, thumbUrl) => `
            <div class="video-thumbnail-wrapper">
                <img src="${thumbUrl}" alt="thumbnail" class="video-thumbnail">
                <div class="phase-label">${phaseText}</div>
            </div>
            <div class="video-info">
                <p class="video-description">${post.question}</p>
            </div>
        `;

        // 🔥 動画認証チェック関数（外に出して使い回し）
        const checkVideoAuth = async function(event) {
            const video = event.target;

            if (!auth.currentUser) {
                video.pause();

                if (confirm("動画を再生するにはログインが必要です。ログインしますか？")) {
                    try {
                        await signInWithPopup(auth, provider);
                        video.play();
                    } catch (e) {
                        alert("ログインに失敗しました");
                    }
                }
            }
        };

        // 🔥 分析画面開く
        const openAnalysis = (post, id) => {
            window.currentPostId = id;
            switchTab('analysis');

            document.getElementById('current-title').innerText = post.question;

            const video = document.getElementById('myVideo');

            video.src = post.url;
            video.load();

            // ⚠️ イベント重複防止
            video.removeEventListener('play', checkVideoAuth);
            video.addEventListener('play', checkVideoAuth);

            renderComments(id);
        };

        querySnapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const id = docSnap.id;

            // 🔥 サムネ安全化
            const thumbUrl = post.thumbnailUrl || post.url.replace(/\.[^/.]+$/, ".jpg");

            const match = post.title ? post.title.match(/【(.*?)】/) : null;
            const phaseText = match ? match[1] : "(質問なし)";

            // --- ホームカード ---
            const homeCard = document.createElement('div');
            homeCard.className = 'video-card'; 
            homeCard.innerHTML = createVideoCardHTML(post, phaseText, thumbUrl);

            // 🔥 引数ちゃんと渡す
            homeCard.onclick = () => openAnalysis(post, id);

            if (grid) grid.appendChild(homeCard);

            // --- プロフィールカード ---
            if (profGrid && user && post.userId === user.uid) {
                const profCard = document.createElement('div');
                profCard.className = 'video-card';
                profCard.innerHTML = createVideoCardHTML(post, phaseText, thumbUrl);

                profCard.onclick = () => openAnalysis(post, id);

                // 削除ボタンをサムネイル内に配置
                const delBtn = document.createElement('button');
                delBtn.className = 'del-btn';
                delBtn.innerHTML = '×';
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteVideo(id);
                };

                // サムネイルのラッパー内に削除ボタンを追加
                const thumbnailWrapper = profCard.querySelector('.video-thumbnail-wrapper');
                thumbnailWrapper.appendChild(delBtn);
                profGrid.appendChild(profCard);
            }
        });

        // Lucideアイコン
        if (window.lucide) {
            lucide.createIcons();
        }

    } catch (e) { 
        console.error("表示エラー:", e); 
    }
}

// --- 5. 削除機能 ---
window.deleteVideo = async function(id) {
    if (!confirm("削除しますか？")) return;
    try {
        await deleteDoc(doc(db, "posts", id));
        alert("削除しました");
    } catch (e) {
        alert("削除に失敗しました");
    }
}

// --- 6. 再生速度の変更 ---
window.changeSpeed = function(s, el) {
    document.getElementById('myVideo').playbackRate = s;
    document.querySelectorAll('.btn-speed').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}

window.postAdvice = async function() {
    const text = document.getElementById('advise-input').value;
    const user = auth.currentUser;
    const postId = window.currentPostId; // 今見ている動画のID

    if (!user) { alert("ログインが必要です"); return; }
    if (!text) { alert("内容を入力してください"); return; }

    try {
    // postsコレクションの中の、特定の動画ドキュメントの中に「comments」というサブコレクションを作る
        await addDoc(collection(db, "posts", postId, "comments"), {
            text: text,
            userId: user.uid,
            userName: user.displayName,
            createdAt: new Date()
        });

        document.getElementById('advise-input').value = ""; // 入力欄を空にする
        alert("アドバイスを送信しました！");
        renderComments(postId); // 一覧を更新
    } catch (e) {
        console.error(e);
        alert("送信に失敗しました");
    }
}

async function renderComments(postId) {
    const commentList = document.getElementById('comment-list');
    const user = auth.currentUser;
    commentList.innerHTML = "読み込み中...";

    // 作成日時順に取得
    const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    commentList.innerHTML = "";
    querySnapshot.forEach((doc) => {
        const comment = doc.data();
        const commentId = doc.id;
        const date = comment.createdAt.toDate().toLocaleString(); // 日付を読みやすく変換

        const div = document.createElement('div');
        div.style = "background: white; padding: 10px; border-radius: 5px; margin-bottom: 10px; border: 1px solid #eee; font-size: 0.9em;";

        let actionButtons = "";
        if (user && comment.userId === user.uid) {
            actionButtons = `
                <div style="margin-top: 5px; text-align: right;">
                <button onclick="editComment('${postId}', '${commentId}', '${comment.text}')" style="font-size: 0.7em; cursor: pointer;">編集</button>
                <button onclick="deleteComment('${postId}', '${commentId}')" style="font-size: 0.7em; cursor: pointer; color: red;">削除</button>
            </div>
            `;
        }

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="color: #999; font-size: 0.8em;">${date}</span>
            </div>
            <div style="line-height: 1.4;">${comment.text}</div>
            ${actionButtons}
        `;
        commentList.appendChild(div);
    });
}

window.deleteComment = async function(postId, commentId) {
    if (!confirm("このアドバイスを削除しますか？")) return;
    try {
        await deleteDoc(doc(db, "posts", postId, "comments", commentId));
        alert("削除しました");
        renderComments(postId);
    } catch (e) {
        console.error(e);
        alert("削除に失敗しました");
    }
}

window.editComment = async function(postId, commentId, oldText) {
    const newText = prompt("アドバイスを編集してください：", oldText);
    if (!newText || newText === oldText) return;
    try {
        const commentRef = doc(db, "posts", postId, "comments", commentId);
        await updateDoc(commentRef, {
            text: newText,
            updatedAt: new Date()
        });
        alert("更新しました");
        renderComments(postId);
    } catch (e) {
        console.error(e);
        alert("更新に失敗しました");
    }
}

window.onload = () => {
    renderVideos();
};