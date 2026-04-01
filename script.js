import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, updateDoc,serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
        // SweetAlert2で確認ダイアログを出す
        const result = await Swal.fire({
            title: 'ログアウトしますか？',
            text: "セッションを終了します。",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6', // サイトの色に合わせて調整
            cancelButtonColor: '#aaa',
            confirmButtonText: 'ログアウト',
            cancelButtonText: 'キャンセル',
            // ここでデザインの微調整（例：角を丸くするなど）
            customClass: {
                popup: 'my-swal-popup'
            }
        });

        // 「はい（confirm）」が押された場合のみ実行
        if (result.isConfirmed) {
            await signOut(auth);
            location.reload();
        }
    } else {
        try {
            await signInWithPopup(auth, provider);
        } catch (e) {
            // alertもSwalにすると統一感が出ます
            Swal.fire("ログイン失敗", "もう一度お試しください", "error");
        }
    }
}

onAuthStateChanged(auth, (user) => {
    const authBtn = document.getElementById('auth-btn');
    if (user) {
        authBtn.innerText = "ログアウト";
        authBtn.style.background = "#95a5a6";
    } else {
        authBtn.innerText = "ログイン";
        authBtn.style.background = "#0ea5e9";
    }
    renderVideos(); // ログイン状態が変わったら画面を更新
});

// --- 2. タブ切り替え ---
window.switchTab = async function(tabName) {
    if ((tabName === 'upload' || tabName === 'profile') && !auth.currentUser) {
        const message = (tabName === 'upload')
            ? "投稿にはログインが必要です。ログインしますか？"
            : "プロフィールを見るにはログインが必要です。ログインしますか？";

        // SweetAlert2で確認ダイアログを表示
        const result = await Swal.fire({
            title: 'ログインが必要です',
            text: message,
            icon: 'info', // 案内なのでinfoアイコン
            showCancelButton: true,
            confirmButtonText: 'ログインする',
            cancelButtonText: 'あとで',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#aaa',
        });

        // 「ログインする」が押された場合
        if (result.isConfirmed) {
            try {
                await signInWithPopup(auth, provider);
                // ログイン成功後にそのままタブを切り替える処理を続ける場合はここへ
            } catch (e) {
                Swal.fire("ログイン失敗", "エラーが発生しました", "error");
                return;
            }
        } else {
            // キャンセルされた場合はタブ切り替えを中断
            return;
        }
    }
    console.log(`Tab switched to: ${tabName}`);

    const screens = ['home', 'upload', 'profile', 'analysis'];
    screens.forEach(s => document.getElementById(s + '-screen').style.display = 'none');
    document.getElementById(tabName + '-screen').style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(tabName === 'home') document.getElementById('tab-btn-home').classList.add('active');
    if(tabName === 'upload') document.getElementById('tab-btn-upload').classList.add('active');

    const topTabs = document.getElementById('top-tabs');
    const header = document.querySelector('.header'); // ヘッダーを取得
    const phaseTabs = document.getElementById('phase-tabs-container');

    if(topTabs) {
        topTabs.style.display = (tabName === 'profile' || tabName === 'analysis') ? 'none' : 'flex';
    }

    if(phaseTabs) {
        phaseTabs.style.display = (tabName === 'upload' || tabName === 'profile' || tabName === 'analysis') ? 'none' : 'flex';
    }

    if(header) {
        header.style.display = (tabName === 'profile' || tabName === 'analysis') ? 'none' : 'block';
    }
    
    renderVideos();
}

let currentPhase = 'all'; 
let currentSortOrder = 'newest'; 

// 局面フィルタ
window.filterByPhase = function(phase, element) {
    const tabs = document.querySelectorAll('.phase-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    if (element) element.classList.add('active');

    currentPhase = phase;
    renderVideos(); // 引数なしで呼ぶ
};

// 並び替え
window.sortVideos = function(order, element) {
    const btns = document.querySelectorAll('.sort-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    if (element) element.classList.add('active');

    currentSortOrder = order;
    renderVideos(); // 引数なしで呼ぶ
};

// --- 3. 投稿機能（Cloudinary + Firestore） ---
window.submitPost = async function() {
    const fileInput = document.getElementById('video-file-input');
    const phase = document.getElementById('sprint-phase').value;
    const question = document.getElementById('user-question').value;
    const user = auth.currentUser;

    // user（ログインチェック）のバリデーション
    if (!user) {
        await Swal.fire({
            icon: 'error',
            title: 'ログインが必要です',
            text: 'この機能を利用するにはログインしてください。',
            confirmButtonColor: '#3085d6'
        });
        return;
    }

    // ファイル選択のバリデーション
    if (!fileInput.files[0]) {
        await Swal.fire({
            icon: 'warning',
            title: '動画を選択してください',
            text: 'アップロードするファイルが選択されていません。',
            confirmButtonColor: '#f39c12'
        });
        return;
    }

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

        // --- 成功時の演出 ---
        await Swal.fire({
            icon: 'success',
            title: '投稿完了！',
            text: '動画をアップロードしました',
            timer: 2000, // 2秒で勝手に閉じる設定（お好みで）
            showConfirmButton: false // タイマーを使う場合はボタンを隠すとスマート
        });

        document.getElementById('user-question').value = "";
        document.getElementById('video-file-input').value = "";
        document.getElementById('sprint-phase').value = "スタート";
        switchTab('home');

    } catch (e) {
        console.error(e);
        // --- 失敗時の演出 ---
        Swal.fire({
            icon: 'error',
            title: 'アップロード失敗',
            text: 'ネットワーク環境などを確認してください。',
        });
    } finally {
        document.getElementById('submit-btn').disabled = false;
        document.getElementById('loading-msg').style.display = 'none';
    }
}


// --- 4. 動画一覧の描画（ホーム & プロフィール） ---
async function renderVideos() {
    const grid = document.getElementById('main-grid');
    const profGrid = document.getElementById('profile-video-list');
    const user = auth.currentUser;

    if (grid) grid.innerHTML = "<p>Loading...</p>";
    if (profGrid) profGrid.innerHTML = "";
    
    try {
        // currentSortOrderに応じて並び替え順を変更
        const sortOrder = currentSortOrder === 'newest' ? 'desc' : 'asc';
        const q = query(collection(db, "posts"), orderBy("createdAt", sortOrder));
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
                // まず動画を止める
                video.pause();

                // 画面内ダイアログを表示
                const result = await Swal.fire({
                    title: 'ログインが必要です',
                    text: '動画の続きを視聴するにはログインしてください。',
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'ログインする',
                    cancelButtonText: 'あとで',
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#aaa',
                    // ダイアログの外をクリックしても閉じないようにする（強制力を高める場合）
                    allowOutsideClick: false 
                });

                if (result.isConfirmed) {
                    try {
                        await signInWithPopup(auth, provider);
                        // ログイン成功したら再生再開
                        video.play();
                    } catch (e) {
                        Swal.fire({
                            icon: 'error',
                            title: '失敗',
                            text: 'ログインに失敗しました。'
                        });
                    }
                } else {
                    // キャンセルされた場合、動画を最初に戻すなどの処理が必要ならここに書く
                    video.currentTime = 0; 
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

            // --- ★ここから追加：動画通報ボタンの出し分け ---
            const reportBtn = document.getElementById('btn-report-video');
            if (reportBtn && auth.currentUser) {
                // 投稿者が自分以外 (userId !== currentUid) の時だけ表示する
                if (post.userId !== auth.currentUser.uid) {
                    reportBtn.style.display = 'inline-flex'; // または 'block'
                } else {
                    reportBtn.style.display = 'none'; // 自分の動画なら隠す
                }
            }
            // ------------------------------------------

            renderComments(id);
        };  

        querySnapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const id = docSnap.id;

            // 🔥 サムネ安全化
            const thumbUrl = post.thumbnailUrl || post.url.replace(/\.[^/.]+$/, ".jpg");

            const match = post.title ? post.title.match(/【(.*?)】/) : null;
            const phaseText = match ? match[1] : "(質問なし)";

            if (currentPhase !== 'all' && phaseText !== currentPhase) {
                return; // この動画は表示せずに次のループへ
            }

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
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

    } catch (e) { 
        console.error("表示エラー:", e); 
    }
}

window.reportVideo = async function(postId) {
    if (!auth.currentUser) {
        Swal.fire('ログインが必要', '通報するにはログインしてください', 'error');
        return;
    }

    const { value: reason } = await Swal.fire({
        title: '動画の通報',
        input: 'select',
        inputOptions: {
            '不適切なコンテンツ': '不適切なコンテンツ',
            '著作権侵害': '著作権侵害',
            'その他': 'その他'
        },
        inputPlaceholder: '理由を選択してください',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        inputValidator: (value) => !value && '理由を選択してください！'
    });

    if (reason) {
        try {
            await addDoc(collection(db, "video_reports"), {
                postId: postId,
                reporterId: auth.currentUser.uid,
                reason: reason,
                createdAt: serverTimestamp(),
                status: "pending"
            });
            Swal.fire('報告済み', '動画の通報を受理しました。', 'success');
        } catch (e) {
            Swal.fire('エラー', '送信に失敗しました。', 'error');
        }
    }
};

// --- 5. 削除機能 ---
window.deleteVideo = async function(id) {
    // 1. 最初の確認ダイアログ
    const result = await Swal.fire({
        title: '動画を削除しますか？',
        text: "この操作は取り消せません！",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33', // 削除なので赤色
        cancelButtonColor: '#aaa',
        confirmButtonText: '削除する',
        cancelButtonText: 'キャンセル'
    });

    if (!result.isConfirmed) return;

    try {
        // 2. 削除実行
        await deleteDoc(doc(db, "posts", id));

        // 3. 成功通知（タイマーで勝手に閉じる）
        await Swal.fire({
            icon: 'success',
            title: '削除完了',
            text: '動画を削除しました',
            timer: 1500,
            showConfirmButton: false
        });

        renderVideos();

    } catch (e) {
        console.error(e);
        // 4. 失敗通知
        Swal.fire({
            icon: 'error',
            title: '削除に失敗しました',
            text: 'しばらく経ってから再度お試しください。'
        });
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

    // ログインチェック
    if (!user) {
        await Swal.fire({
            icon: 'info',
            title: 'ログインが必要です',
            text: 'コメントをするにはログインしてください',
            confirmButtonColor: '#3085d6'
        });
        return;
    }

    // 入力チェック
    if (!text) {
        await Swal.fire({
            icon: 'warning',
            title: '入力してください',
            text: '空欄のままでは送信できません',
            confirmButtonColor: '#f39c12'
        });
        return;
    }

    try {
        // Firebaseへの保存処理
        await addDoc(collection(db, "posts", postId, "comments"), {
            text: text,
            userId: user.uid,
            userName: user.displayName,
            createdAt: new Date()
        });

        document.getElementById('advise-input').value = ""; // 入力欄を空にする
        
        // --- 成功：右上にスッと出すトースト通知 ---
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'アドバイスを送信しました！',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });

        renderComments(postId); // 一覧を更新

    } catch (e) {
        console.error(e);
        
        // --- 失敗：しっかりエラーを伝える ---
        Swal.fire({
            icon: 'error',
            title: '送信に失敗しました',
            text: 'ネットワークの状態を確認して、もう一度お試しください。'
        });
    }
}

async function renderComments(postId) {
    const commentList = document.getElementById('comment-list');
    const user = auth.currentUser;
    if (!commentList) return;

    commentList.innerHTML = "読み込み中...";

    try {
        const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        commentList.innerHTML = "";
        
        querySnapshot.forEach((docSnap) => {
            const comment = docSnap.data();
            const commentId = docSnap.id;
            
            // 日付の変換（データがまだサーバーに届いていない瞬間は null になるので対策）
            const date = comment.createdAt ? comment.createdAt.toDate().toLocaleString() : "送信中...";

            const div = document.createElement('div');
            // ここでスタイルを直接書かずに、CSSで管理すると後で楽になります
            div.className = "comment-card"; 

            let actionButtons = "";
            
            // --- ここが「出し分け」の重要ポイント ---
            if (user && comment.userId === user.uid) {
                // 自分のコメント：編集と削除だけ
                actionButtons = `
                    <div class="comment-actions">
                        <button class="btn-comment-edit" onclick="editComment('${postId}', '${commentId}', '${comment.text.replace(/'/g, "\\'")}')">編集</button>
                        <button class="btn-comment-delete" onclick="deleteComment('${postId}', '${commentId}')">削除</button>
                    </div>
                `;
            } else {
                // 他人のコメント：通報だけ（ログインしてなくてもボタンは出す or ログイン時のみ）
                actionButtons = `
                    <div class="comment-actions">
                        <button class="btn-comment-report" onclick="reportComment('${postId}', '${commentId}', '${comment.text.replace(/'/g, "\\'")}')">通報</button>
                    </div>
                `;
            }

            div.innerHTML = `
                <div class="comment-header">
                    <span class="comment-date">${date}</span>
                </div>
                <div class="comment-body">${comment.text}</div>
                ${actionButtons}
            `;
            commentList.appendChild(div);
        });

    } catch (e) {
        console.error("コメント読み込みエラー:", e);
        commentList.innerHTML = "コメントの読み込みに失敗しました。";
    }
}

window.reportComment = async function(postId,commentId, commentText) {
    if (!auth.currentUser) {
        Swal.fire({
            icon: 'error',
            title: 'ログインが必要です',
            text: '通報するにはログインしてください。',
            confirmButtonColor: '#0ea5e9' // SprintScopeブルー
        });
        return;
    }

    // Swalの入力フォームを表示
    const { value: reason } = await Swal.fire({
        title: '通報の理由',
        input: 'select',
        inputOptions: {
            '誹謗中傷': '不適切な言葉・誹謗中傷',
            'スパム': 'スパム・広告',
            'その他': 'その他'
        },
        inputPlaceholder: '理由を選択してください',
        showCancelButton: true,
        confirmButtonText: '報告する',
        cancelButtonText: 'キャンセル',
        confirmButtonColor: '#ef4444', // 警告なので赤

        inputValidator: (value) => {
            if (!value) {
                return '理由を選択してください！'; // 未選択時に表示されるメッセージ
            }
        }
    });

    if (reason) {
        try {
            await addDoc(collection(db, "reports"), {
                postId: postId,
                commentId: commentId,
                commentText: commentText,
                reason: reason,
                reporterId: auth.currentUser.uid,
                createdAt: serverTimestamp(),
                status: "pending"
            });
            
            Swal.fire({
                icon: 'success',
                title: '報告を送信しました',
                text: 'ご協力ありがとうございます。',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (e) {
            Swal.fire('エラー', '送信に失敗しました', 'error');
        }
    }
};

window.deleteComment = async function(postId, commentId) {
    // 1. 削除前の確認（赤ボタンで警告）
    const result = await Swal.fire({
        title: 'アドバイスを削除しますか？',
        text: "この操作は取り消せません",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33', // 削除は赤
        cancelButtonColor: '#aaa',
        confirmButtonText: '削除する',
        cancelButtonText: 'キャンセル'
    });

    // キャンセルなら終了
    if (!result.isConfirmed) return;

    try {
        // 2. 実際の削除処理
        await deleteDoc(doc(db, "posts", postId, "comments", commentId));

        // 3. 削除成功の通知（トースト形式でさらっと出す）
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: '削除しました',
            showConfirmButton: false,
            timer: 1500
        });

        // 4. 一覧を更新
        renderComments(postId);

    } catch (e) {
        console.error(e);
        // 5. 失敗時の通知
        Swal.fire({
            icon: 'error',
            title: '削除に失敗しました',
            text: 'もう一度お試しください'
        });
    }
};

window.editComment = async function(postId, commentId, oldText) {
    // 1. promptをSwalの入力ダイアログに置き換え
    const { value: newText } = await Swal.fire({
        title: 'アドバイスを編集',
        input: 'text',
        inputValue: oldText, // 最初から元の文字を入れておく
        showCancelButton: true,
        confirmButtonText: '更新',
        cancelButtonText: 'キャンセル',
        inputValidator: (value) => {
            if (!value) {
                return '内容を入力してください！'; // 未入力チェックもその場でできる
            }
        }
    });

    // キャンセルされた場合、または内容が変わっていない場合は終了
    if (!newText || newText === oldText) return;

    try {
        const commentRef = doc(db, "posts", postId, "comments", commentId);
        await updateDoc(commentRef, {
            text: newText,
            updatedAt: new Date()
        });

        // 成功時のトースト表示
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: '更新しました',
            showConfirmButton: false,
            timer: 1500,
            timerProgressBar: true
        });

        renderComments(postId); 
    } catch (e) {
        console.error(e);
        Swal.fire({
            icon: 'error',
            title: '更新に失敗しました',
            text: 'ネットワークの状態を確認してください。'
        });
    }
}

window.onload = () => {
    renderVideos();
};