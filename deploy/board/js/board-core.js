import {
    supabase,
    getCurrentUser,
    displayNameFromUser,
    initSupabaseAuthCache,
    signInWithGoogleOAuth,
    sendEmailOtp,
    verifyEmailOtp,
    consumeOAuthRedirectErrorFromUrl,
    getOAuthRedirectTo,
} from "../../supabase-client.js";
import { renderComments } from "./comments.js";

const CLOUD_NAME = "doipeut1j";
const UPLOAD_PRESET = "sprint_preset";

async function promptLoginMethod() {
    const methodResult = await Swal.fire({
        title: "ログイン方法を選択",
        text: "Google またはメールアドレスでログインできます。",
        icon: "question",
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: "Googleでログイン",
        denyButtonText: "メールでログイン",
        cancelButtonText: "キャンセル",
        confirmButtonColor: "#2f8a96",
        denyButtonColor: "#64748b",
        cancelButtonColor: "#aaa",
    });

    if (methodResult.isConfirmed) {
        const { error } = await signInWithGoogleOAuth();
        if (error) {
            await Swal.fire("ログイン失敗", error.message || "もう一度お試しください", "error");
        }
        return;
    }

    if (methodResult.isDenied) {
        const emailResult = await Swal.fire({
            title: "メールアドレスでログイン",
            input: "email",
            inputLabel: "6桁の認証コードを送信します",
            inputPlaceholder: "you@example.com",
            customClass: { popup: "swal-board-email-auth" },
            showCancelButton: true,
            confirmButtonText: "コードを送信",
            cancelButtonText: "キャンセル",
            confirmButtonColor: "#2f8a96",
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const raw = Swal.getInput()?.value ?? "";
                const email = String(raw).trim();
                if (!email) {
                    Swal.showValidationMessage("メールアドレスを入力してください");
                    return false;
                }
                const confirmBtn = Swal.getConfirmButton();
                const cancelBtn = Swal.getCancelButton();
                if (confirmBtn) confirmBtn.disabled = true;
                if (cancelBtn) cancelBtn.disabled = true;
                try {
                    console.log("OTP送信に使うメアド:", email);
                    const { error } = await sendEmailOtp(email);
                    if (error) {
                        Swal.showValidationMessage(error.message || "メール送信に失敗しました");
                        return false;
                    }
                    return email;
                } finally {
                    if (confirmBtn) confirmBtn.disabled = false;
                    if (cancelBtn) cancelBtn.disabled = false;
                }
            },
        });

        if (!emailResult.isConfirmed || !emailResult.value) return;
        const email = String(emailResult.value).trim();

        const otpResult = await Swal.fire({
            title: "認証コードを入力",
            customClass: { popup: "swal-board-otp" },
            html: `
                <p class="swal-board-otp-lead">メールで届いた6桁のコードを入力してください。</p>
                <div class="swal-board-otp-field">
                    <label class="swal-board-otp-label" for="email-otp-input">認証コード（6桁）</label>
                    <input id="email-otp-input" class="swal-board-otp-input" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="123456" autocomplete="one-time-code" />
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "ログインする",
            cancelButtonText: "キャンセル",
            confirmButtonColor: "#2f8a96",
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            didOpen: () => {
                document.getElementById("email-otp-input")?.focus();
            },
            preConfirm: async () => {
                const input = document.getElementById("email-otp-input");
                const token = String(input?.value || "").trim();
                if (!/^\d{6}$/.test(token)) {
                    Swal.showValidationMessage("6桁の数字を入力してください");
                    return false;
                }
                const confirmBtn = Swal.getConfirmButton();
                const cancelBtn = Swal.getCancelButton();
                if (confirmBtn) confirmBtn.disabled = true;
                if (cancelBtn) cancelBtn.disabled = true;
                try {
                    console.log("検証に使うメアド:", email);
                    const { error: verifyError } = await verifyEmailOtp(email, token);
                    if (verifyError) {
                        Swal.showValidationMessage(verifyError.message || "認証コードが正しくありません");
                        return false;
                    }
                    return token;
                } finally {
                    if (confirmBtn) confirmBtn.disabled = false;
                    if (cancelBtn) cancelBtn.disabled = false;
                }
            },
        });

        if (!otpResult.isConfirmed || !otpResult.value) return;
        await Swal.fire("ログイン成功", "メール認証でログインしました。", "success");
    }
}

// --- 1. ログイン・ログアウト（Supabase Auth + Google OAuth） ---
window.handleAuth = async function () {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (user) {
        const result = await Swal.fire({
            title: "ログアウトしますか？",
            text: "セッションを終了します。",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#2f8a96",
            cancelButtonColor: "#aaa",
            confirmButtonText: "ログアウト",
            cancelButtonText: "キャンセル",
            customClass: {
                popup: "my-swal-popup",
            },
        });

        if (result.isConfirmed) {
            await supabase.auth.signOut();
            location.reload();
        }
    } else {
        await promptLoginMethod();
    }
};

function updateAuthButtonLabel() {
    const btn = document.getElementById("auth-btn");
    if (!btn) return;
    btn.textContent = getCurrentUser() ? "ログアウト" : "ログイン";
}

function updateAnalysisVideoLoginOverlay() {
    const analysisScreen = document.getElementById("analysis-screen");
    const overlay = document.getElementById("analysis-video-login-overlay");
    if (!overlay || !analysisScreen) return;
    const onAnalysis = analysisScreen.style.display === "block";
    const show = onAnalysis && !getCurrentUser();
    overlay.style.display = show ? "flex" : "none";
}

function hideLoginModalIfSignedIn(sessionUser) {
    const signedIn = Boolean(sessionUser || getCurrentUser());
    if (!signedIn) return;
    if (typeof Swal !== "undefined" && Swal.isVisible()) {
        Swal.close();
    }
}

function isProtectedTabVisible() {
    const uploadVisible = document.getElementById("upload-screen")?.style.display === "block";
    const profileVisible = document.getElementById("profile-screen")?.style.display === "block";
    return uploadVisible || profileVisible;
}

async function ensureSessionOnStartup() {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
        hideLoginModalIfSignedIn(session.user);
        return true;
    }
    return false;
}

async function isSignedIn() {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) hideLoginModalIfSignedIn(session.user);
    return Boolean(session?.user);
}

// --- 2. タブ切り替え ---
window.switchTab = async function (tabName) {
    if (tabName === "questionbox") {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.getElementById("tab-btn-questionbox")?.classList.add("active");
        location.href = "../question-box/pages/qb_top.html";
        return;
    }

    if ((tabName === "upload" || tabName === "profile") && !(await isSignedIn())) {
        const message =
            tabName === "upload"
                ? "投稿にはログインが必要です。ログインしますか？"
                : "プロフィールを見るにはログインが必要です。ログインしますか？";

        const result = await Swal.fire({
            title: "ログインが必要です",
            text: message,
            icon: "info",
            showCancelButton: true,
            confirmButtonText: "ログインする",
            cancelButtonText: "あとで",
            confirmButtonColor: "#2f8a96",
            cancelButtonColor: "#aaa",
        });

        if (result.isConfirmed) {
            await promptLoginMethod();
        }
        return;
    }
    console.log(`Tab switched to: ${tabName}`);

    currentPhase = "all";
    document.querySelectorAll(".phase-tab").forEach((tab) => {
        tab.classList.remove("active");
        if (tab.textContent.includes("すべて")) {
            tab.classList.add("active");
        }
    });

    const screens = ["home", "upload", "profile", "analysis"];
    screens.forEach((s) => {
        const el = document.getElementById(s + "-screen");
        if (el) el.style.display = "none";
    });
    const active = document.getElementById(tabName + "-screen");
    if (active) active.style.display = "block";

    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    if (tabName === "home") document.getElementById("tab-btn-home")?.classList.add("active");
    if (tabName === "upload") document.getElementById("tab-btn-upload")?.classList.add("active");
    if (tabName === "questionbox") document.getElementById("tab-btn-questionbox")?.classList.add("active");

    const topTabs = document.getElementById("top-tabs");
    const header = document.querySelector(".header");
    const phaseTabs = document.getElementById("phase-tabs-container");

    const hideMainChrome = tabName === "profile" || tabName === "analysis";
    document.body.classList.toggle("board-hide-bottom-nav", hideMainChrome);

    if (topTabs) {
        topTabs.style.display = hideMainChrome ? "none" : "flex";
    }

    if (phaseTabs) {
        phaseTabs.style.display = tabName === "upload" || tabName === "profile" || tabName === "analysis" ? "none" : "flex";
    }

    if (header) {
        header.style.display = hideMainChrome ? "none" : "block";
    }

    renderVideos();
};

let currentPhase = "all";
let currentSortOrder = "newest";

window.filterByPhase = function (phase, element) {
    const tabs = document.querySelectorAll(".phase-tab");
    tabs.forEach((tab) => tab.classList.remove("active"));
    if (element) element.classList.add("active");

    currentPhase = phase;
    renderVideos();
};

window.sortVideos = function (order, element) {
    const btns = document.querySelectorAll(".sort-btn");
    btns.forEach((btn) => btn.classList.remove("active"));
    if (element) element.classList.add("active");

    currentSortOrder = order;
    renderVideos();
};

// --- 3. 投稿（Cloudinary + Supabase） ---
window.submitPost = async function () {
    const fileInput = document.getElementById("video-file-input");
    const phase = document.getElementById("sprint-phase").value;
    const personalBest = document.getElementById("personal-best").value;
    const question = document.getElementById("user-question").value;

    const {
        data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
        await Swal.fire({
            icon: "error",
            title: "ログインが必要です",
            text: "この機能を利用するにはログインしてください。",
            confirmButtonColor: "#2f8a96",
        });
        return;
    }

    if (!fileInput.files[0]) {
        await Swal.fire({
            icon: "warning",
            title: "動画を選択してください",
            text: "アップロードするファイルが選択されていません。",
            confirmButtonColor: "#f39c12",
        });
        return;
    }

    document.getElementById("submit-btn").disabled = true;
    document.getElementById("loading-msg").style.display = "block";

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("upload_preset", UPLOAD_PRESET);
    formData.append("tags", "auto_delete_90d");

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, {
            method: "POST",
            body: formData,
        });
        const data = await response.json();
        if (!response.ok || data.error) {
            throw new Error(data.error?.message || `Cloudinary: HTTP ${response.status}`);
        }

        const thumbUrl = data.secure_url ? data.secure_url.replace(/\.[^/.]+$/, ".jpg") : null;

        const { error: insErr } = await supabase.from("board_posts").insert({
            url: data.secure_url,
            title: `【${phase}】 ${new Date().toLocaleDateString()}`,
            personal_best: personalBest || "",
            question: question || "（質問なし）",
            user_id: user.id,
            user_name: displayNameFromUser(user),
            thumbnail_url: thumbUrl,
        });
        if (insErr) throw insErr;

        await Swal.fire({
            icon: "success",
            title: "投稿完了！",
            text: "動画をアップロードしました",
            timer: 2000,
            showConfirmButton: false,
        });

        document.getElementById("user-question").value = "";
        document.getElementById("video-file-input").value = "";
        const fileNameDisplay = document.getElementById("file-name-display");
        if (fileNameDisplay) fileNameDisplay.textContent = "選択されていません";
        document.getElementById("sprint-phase").value = "スタート";
        document.getElementById("personal-best").value = "";
        switchTab("home");
    } catch (e) {
        console.error(e);
        Swal.fire({
            icon: "error",
            title: "アップロード失敗",
            text: e.message || "ネットワーク環境などを確認してください。",
        });
    } finally {
        document.getElementById("submit-btn").disabled = false;
        document.getElementById("loading-msg").style.display = "none";
    }
};

function rowToPost(row) {
    return {
        id: row.id,
        url: row.url,
        title: row.title,
        personalBest: row.personal_best,
        question: row.question,
        userId: row.user_id,
        userName: row.user_name,
        createdAt: row.created_at,
        thumbnailUrl: row.thumbnail_url,
    };
}

// --- 4. 動画一覧 ---
export async function renderVideos() {
    const grid = document.getElementById("main-grid");
    const profGrid = document.getElementById("profile-video-list");

    const {
        data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (grid) grid.innerHTML = "<p>Loading...</p>";
    if (profGrid) profGrid.innerHTML = "";

    try {
        const ascending = currentSortOrder !== "newest";
        const { data: rows, error } = await supabase.from("board_posts").select("*").order("created_at", { ascending });
        if (error) throw error;

        if (grid) grid.innerHTML = "";

        const createVideoCardHTML = (post, phaseText, personalBest, thumbUrl) => {
            const template = document.getElementById("video-card-template");
            const clone = template.content.cloneNode(true);

            clone.querySelector(".video-thumbnail").src = thumbUrl;
            clone.querySelector(".phase-label").textContent = phaseText;

            const personalBestLabel = clone.querySelector(".personal-best-label");
            if (personalBest) {
                personalBestLabel.textContent = personalBest;
                personalBestLabel.style.display = "block";
            }

            clone.querySelector(".video-description").textContent = post.question;

            const wrapper = document.createElement("div");
            wrapper.appendChild(clone);
            return wrapper.innerHTML;
        };

        const checkVideoAuth = async function (event) {
            const video = event.target;

            if (!(await isSignedIn())) {
                video.pause();

                const result = await Swal.fire({
                    title: "ログインが必要です",
                    text: "動画を再生するにはログインしてください。",
                    icon: "info",
                    showCancelButton: true,
                    confirmButtonText: "ログインする",
                    cancelButtonText: "あとで",
                    confirmButtonColor: "#2f8a96",
                    cancelButtonColor: "#aaa",
                    allowOutsideClick: false,
                });

                if (result.isConfirmed) {
                    await promptLoginMethod();
                } else {
                    video.currentTime = 0;
                }
            }
        };

        const openAnalysis = (post, id) => {
            window.currentPostId = id;
            switchTab("analysis");

            document.getElementById("current-title").innerText = post.question;

            const video = document.getElementById("myVideo");
            video.src = post.url;
            video.load();

            video.removeEventListener("play", checkVideoAuth);
            video.addEventListener("play", checkVideoAuth);

            const reportBtn = document.getElementById("btn-report-video");
            if (reportBtn) {
                const currentUser = getCurrentUser();
                if (currentUser && post.userId !== currentUser.id) {
                    reportBtn.style.display = "inline-flex";
                } else {
                    reportBtn.style.display = "none";
                }
            }

            updateAnalysisVideoLoginOverlay();
            renderComments(id);
        };

        (rows || []).forEach((row) => {
            const post = rowToPost(row);
            const thumbUrl = post.thumbnailUrl || post.url.replace(/\.[^/.]+$/, ".jpg");

            const match = post.title ? post.title.match(/【(.*?)】/) : null;
            const phaseText = match ? match[1] : "(質問なし)";
            const personalBest = post.personalBest || "";

            if (currentPhase !== "all" && phaseText !== currentPhase) {
                return;
            }

            const homeCard = document.createElement("div");
            homeCard.className = "video-card";
            homeCard.innerHTML = createVideoCardHTML(post, phaseText, personalBest, thumbUrl);

            homeCard.onclick = () => openAnalysis(post, post.id);

            if (grid) grid.appendChild(homeCard);

            if (profGrid && user && post.userId === user.id) {
                const profCard = document.createElement("div");
                profCard.className = "video-card";
                profCard.innerHTML = createVideoCardHTML(post, phaseText, personalBest, thumbUrl);

                profCard.onclick = () => openAnalysis(post, post.id);

                const delBtn = document.createElement("button");
                delBtn.className = "del-btn";
                delBtn.innerHTML = "×";
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    deleteVideo(post.id);
                };

                const thumbnailWrapper = profCard.querySelector(".video-thumbnail-wrapper");
                thumbnailWrapper.appendChild(delBtn);
                profGrid.appendChild(profCard);
            }
        });

        if (typeof lucide !== "undefined") {
            lucide.createIcons();
        }

        updateAnalysisVideoLoginOverlay();
    } catch (e) {
        console.error("表示エラー:", e);
        if (grid) grid.innerHTML = "<p>読み込みに失敗しました。board_posts と RLS（supabase-board-schema.sql）を確認してください。</p>";
    }
}

window.reportVideo = async function (postId) {
    const {
        data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
        Swal.fire("ログインが必要", "通報するにはログインしてください", "error");
        return;
    }

    const { value: reason } = await Swal.fire({
        title: "動画の通報",
        input: "select",
        inputOptions: {
            不適切なコンテンツ: "不適切なコンテンツ",
            著作権侵害: "著作権侵害",
            その他: "その他",
        },
        inputPlaceholder: "理由を選択してください",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        inputValidator: (value) => !value && "理由を選択してください！",
    });

    if (reason) {
        try {
            const { error } = await supabase.from("board_video_reports").insert({
                post_id: postId,
                reporter_id: user.id,
                reason: reason,
                status: "pending",
            });
            if (error) throw error;
            Swal.fire("報告済み", "動画の通報を受理しました。", "success");
        } catch (e) {
            Swal.fire("エラー", "送信に失敗しました。", "error");
        }
    }
};

window.deleteVideo = async function (id) {
    const result = await Swal.fire({
        title: "動画を削除しますか？",
        text: "この操作は取り消せません！",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#aaa",
        confirmButtonText: "削除する",
        cancelButtonText: "キャンセル",
    });

    if (!result.isConfirmed) return;

    try {
        const { error } = await supabase.from("board_posts").delete().eq("id", id);
        if (error) throw error;

        await Swal.fire({
            icon: "success",
            title: "削除完了",
            text: "動画を削除しました",
            timer: 1500,
            showConfirmButton: false,
        });

        renderVideos();
    } catch (e) {
        console.error(e);
        Swal.fire({
            icon: "error",
            title: "削除に失敗しました",
            text: "しばらく経ってから再度お試しください。",
        });
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    const oauthErr = consumeOAuthRedirectErrorFromUrl();
    if (oauthErr) {
        const hint = getOAuthRedirectTo();
        await Swal.fire({
            icon: "error",
            title: "ログインできませんでした",
            text: hint
                ? `${oauthErr}\n\nSupabase の Authentication → URL Configuration → Redirect URLs に次を追加してください:\n${hint}`
                : oauthErr,
            confirmButtonColor: "#2f8a96",
        });
    }
    await ensureSessionOnStartup();
    await initSupabaseAuthCache();
    hideLoginModalIfSignedIn(getCurrentUser());
    updateAuthButtonLabel();
    const tabParam = new URLSearchParams(location.search).get("tab");
    if (tabParam !== "upload" && typeof window.switchTab === "function") {
        await window.switchTab("home");
    }
    await renderVideos();
    updateAnalysisVideoLoginOverlay();
});

supabase.auth.onAuthStateChange((_event, session) => {
    const isSignedOut = !session?.user;
    if (!isSignedOut) {
        hideLoginModalIfSignedIn(session.user);
    } else if (isProtectedTabVisible()) {
        switchTab("home");
        Swal.fire({
            icon: "info",
            title: "セッションが切れました",
            text: "もう一度ログインしてください。",
            confirmButtonColor: "#2f8a96",
        });
    }
    updateAuthButtonLabel();
    renderVideos().then(() => updateAnalysisVideoLoginOverlay());
});
