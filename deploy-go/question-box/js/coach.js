import { qbEnsureSignedIn, QB_AUTH_REDIRECTING } from "./qb_shared_auth.js";
import { apiFetch, apiUploadVideo } from "../../api-client.js";

/** questioner-app / qb-data.js の COACHES と同じ id（プレミアム指定表示用） */
const COACH_ID_LABEL = {
    c1: "田中 翔",
    c2: "佐藤 凛",
    c3: "鈴木 大輔"
};

let currentFilter = "all";
/** all | standard | premium — 既定は all（タブ違いで0件に見えるのを防ぐ） */
let currentPlan = "all";
let allQuestions = [];
/** 分析画面で編集中の質問行 */
let activeQuestion = null;

function questionIsAnswered(q) {
    const t = (q.coach_advice_text || "").trim();
    const v = (q.coach_advice_video_url || "").trim();
    return Boolean(t || v);
}

/** Cloudinary 動画 URL から先頭フレームの JPG サムネイル URL を生成 */
function videoUrlToThumbnail(url) {
    if (!url || typeof url !== "string") return "";
    const u = url.trim();
    if (u.includes("/video/upload/")) {
        const withTransform = u.replace("/upload/", "/upload/f_jpg,so_0/");
        return withTransform.replace(/\.(mp4|webm|mov|mkv)(\?.*)?$/i, ".jpg$2");
    }
    return u.replace(/\.(mp4|webm|mov|mkv)(\?.*)?$/i, ".jpg$2");
}

function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
}

document.addEventListener("DOMContentLoaded", async () => {
    const ok = await qbEnsureSignedIn({
        title: "ログインが必要です",
        text: "コーチダッシュボードを利用するにはログインしてください。",
        confirmButtonText: "ログイン"
    });
    if (ok === QB_AUTH_REDIRECTING) return;
    if (!ok) {
        const grid = document.getElementById("coach-main-grid");
        if (grid) {
            grid.innerHTML =
                "<p class=\"coach-grid-empty\">ログインできないと一覧を表示できません。ページを再読み込みしてログインしてください。</p>";
        }
        return;
    }

    await loadQuestions();
    updateMonthlyStats();
    updateNotificationCount();
});

async function loadQuestions() {
    const grid = document.getElementById("coach-main-grid");
    grid.innerHTML = "<p>読み込み中...</p>";

    try {
        allQuestions = (await apiFetch("/api/questions")) || [];
        renderQuestions();
    } catch (e) {
        console.error("質問読み込みエラー:", e);
        const msg = [e.message, e.details, e.hint].filter(Boolean).join(" — ") || String(e);
        grid.innerHTML = `
            <p class="coach-load-error">読み込みエラー: ${escapeHtml(msg)}</p>
            <p class="coach-load-hint">Supabase の SQL Editor で <code>question-box/sql/supabase_questions.sql</code> の <strong>questions_select_anon</strong>（<code>questions</code> の SELECT を anon に許可）を実行済みか確認してください。未実行だと行は保存されていても一覧は空になります。</p>`;
    }
}

function filterQuestionsArray() {
    let filtered = [...allQuestions];

    filtered = filtered.filter((q) => {
        if (currentPlan === "all") return true;
        if (currentPlan === "standard") return q.tier === "standard";
        if (currentPlan === "premium") return q.tier === "premium";
        return true;
    });

    if (currentFilter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filtered = filtered.filter((q) => {
            const d = new Date(q.created_at);
            return !Number.isNaN(d.getTime()) && d >= today;
        });
    } else if (currentFilter === "plus") {
        filtered = filtered.filter((q) => q.format === "plus");
    } else if (currentFilter === "text") {
        filtered = filtered.filter((q) => q.format === "text");
    }

    return filtered;
}

function renderQuestions() {
    const grid = document.getElementById("coach-main-grid");
    grid.innerHTML = "";

    const list = filterQuestionsArray();

    if (list.length === 0) {
        if (allQuestions.length > 0) {
            grid.innerHTML =
                `<p class="coach-grid-empty">Supabase から <strong>${allQuestions.length}件</strong> 読み込み済みですが、いまのプラン・フィルターに合う質問がありません。「すべて」プラン・「すべて」種類に切り替えてください。</p>`;
        } else {
            grid.innerHTML =
                "<p class=\"coach-grid-empty\">まだ1件も取得できていません。質問者側で送信が成功しているか、Supabase の Table Editor で <code>questions</code> に行が入っているか確認してください。</p>";
        }
        return;
    }

    list.forEach((q) => {
        grid.appendChild(createQuestionCard(q));
    });

    if (typeof lucide !== "undefined") {
        lucide.createIcons();
    }
}

function createQuestionCard(q) {
    const template = document.getElementById("coach-video-card-template");
    const clone = template.content.cloneNode(true);

    const img = clone.querySelector(".coach-qb-thumb-img");
    const placeholder = clone.querySelector(".coach-qb-thumb-placeholder");

    const hasVideo = q.format === "plus" && q.video_storage_path;

    if (hasVideo) {
        img.src = videoUrlToThumbnail(q.video_storage_path);
        img.alt = "動画サムネイル";
        img.hidden = false;
        if (placeholder) placeholder.hidden = true;
    } else {
        img.removeAttribute("src");
        img.alt = "";
        img.hidden = true;
        if (placeholder) placeholder.hidden = false;
    }

    clone.querySelector(".phase-label").textContent = q.format === "plus" ? "動画付き" : "テキスト";

    const planBadge = clone.querySelector(".plan-badge");
    if (q.tier === "premium") {
        planBadge.textContent = "プレミアム";
        planBadge.className = "plan-badge plan-premium";
    } else {
        planBadge.textContent = "スタンダード";
        planBadge.className = "plan-badge plan-standard";
    }

    const statusBadge = clone.querySelector(".status-badge");
    if (questionIsAnswered(q)) {
        statusBadge.textContent = "回答済";
        statusBadge.className = "status-badge status-answered";
    } else {
        statusBadge.textContent = "未回答";
        statusBadge.className = "status-badge status-pending";
    }

    const yen = q.amount_yen != null ? Number(q.amount_yen) : null;
    clone.querySelector(".question-count").textContent =
        yen != null && !Number.isNaN(yen) ? `¥${yen.toLocaleString("ja-JP")}` : "";

    const desc = (q.question_text || "").trim() || "（本文なし）";
    const descEl = clone.querySelector(".video-description");
    descEl.textContent = desc.length > 140 ? `${desc.slice(0, 140)}…` : desc;

    const coachLine = q.coach_id
        ? `指定: ${COACH_ID_LABEL[q.coach_id] || q.coach_id}`
        : "コーチ自動割当";
    clone.querySelector(".user-name").textContent = coachLine;

    const dateEl = clone.querySelector(".post-date");
    dateEl.textContent = q.created_at
        ? new Date(q.created_at).toLocaleString("ja-JP", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
          })
        : "";

    const root = document.createElement("div");
    root.className = "video-card coach-qb-card";
    root.appendChild(clone);
    root.onclick = () => openCoachAnalysis(q);

    return root;
}

function openCoachAnalysis(q) {
    activeQuestion = q;
    const shell = document.getElementById("coach-dashboard-shell");
    const screen = document.getElementById("coach-analysis-screen");
    if (!shell || !screen) return;

    shell.hidden = true;
    screen.hidden = false;

    const heading = document.getElementById("coach-analysis-heading");
    if (heading) {
        heading.textContent =
            q.format === "plus" ? "動画付き質問への回答" : "テキスト質問への回答";
    }

    const player = document.getElementById("coach-player-block");
    const video = document.getElementById("coach-analysis-video");
    const speedRow = document.getElementById("coach-analysis-speed-row");
    const hasAthleteVideo = q.format === "plus" && q.video_storage_path;

    if (hasAthleteVideo && video && player) {
        player.hidden = false;
        video.src = q.video_storage_path;
        video.load();
        if (speedRow) speedRow.hidden = false;
    } else {
        if (video) {
            video.pause();
            video.removeAttribute("src");
            video.load();
        }
        if (player) player.hidden = true;
        if (speedRow) speedRow.hidden = true;
    }

    const qt = document.getElementById("coach-analysis-question-text");
    if (qt) {
        qt.textContent = (q.question_text || "").trim() || "（本文なし）";
    }

    const hint = document.getElementById("coach-advice-format-hint");
    const videoBlock = document.getElementById("coach-advice-video-block");
    const ta = document.getElementById("coach-advice-textarea");
    const fileInput = document.getElementById("coach-advice-video-input");
    const fileName = document.getElementById("coach-advice-video-name");

    if (q.format === "plus") {
        if (hint) {
            hint.textContent =
                "動画付きの質問です。テキストと、必要なら回答用の動画を添付できます（テキストまたは動画のどちらか一方以上）。";
        }
        if (videoBlock) videoBlock.hidden = false;
    } else {
        if (hint) {
            hint.textContent = "テキストのみの質問です。回答もテキストのみです。";
        }
        if (videoBlock) videoBlock.hidden = true;
        if (fileInput) fileInput.value = "";
        if (fileName) fileName.textContent = "未選択";
    }

    if (ta) ta.value = (q.coach_advice_text || "").trim();
    if (fileInput) fileInput.value = "";
    if (fileName) fileName.textContent = "未選択";

    document.querySelectorAll("#coach-analysis-speed-row .btn-speed").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-speed") === "1");
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeCoachAnalysis() {
    const video = document.getElementById("coach-analysis-video");
    if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
    }
    activeQuestion = null;
    const shell = document.getElementById("coach-dashboard-shell");
    const screen = document.getElementById("coach-analysis-screen");
    if (shell) shell.hidden = false;
    if (screen) screen.hidden = true;
}

async function uploadCoachResponseVideo(file) {
    const data = await apiUploadVideo(file, "auto_delete_90d");
    return data.secure_url || null;
}

async function submitCoachAdvice() {
    if (!activeQuestion) return;

    const ta = document.getElementById("coach-advice-textarea");
    const fileInput = document.getElementById("coach-advice-video-input");
    const text = (ta && ta.value ? ta.value : "").trim();
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    const isPlus = activeQuestion.format === "plus";
    const hadVideo = !!(activeQuestion.coach_advice_video_url || "").trim();

    if (!isPlus) {
        if (!text) {
            Swal.fire({
                icon: "warning",
                title: "テキストを入力してください",
                confirmButtonColor: "#2f8a96"
            });
            return;
        }
    } else if (!text && !file && !hadVideo) {
        Swal.fire({
            icon: "warning",
            title: "回答を入力してください",
            text: "テキストまたは回答用動画のどちらかを入力してください。",
            confirmButtonColor: "#2f8a96"
        });
        return;
    }

    const btn = document.getElementById("coach-btn-submit-advice");
    const prev = btn ? btn.textContent : "";
    if (btn) {
        btn.disabled = true;
        btn.textContent = "送信中…";
    }

    try {
        let coach_advice_video_url = (activeQuestion.coach_advice_video_url || "").trim() || null;
        if (isPlus && file) {
            coach_advice_video_url = await uploadCoachResponseVideo(file);
        }

        const payload = {
            coach_advice_text: text || null,
            coach_advice_video_url: coach_advice_video_url || null
        };

        await apiFetch(`/api/questions/${encodeURIComponent(activeQuestion.id)}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });

        const idx = allQuestions.findIndex((x) => x.id === activeQuestion.id);
        if (idx !== -1) {
            allQuestions[idx] = { ...allQuestions[idx], ...payload };
        }

        await Swal.fire({
            icon: "success",
            title: "送信しました",
            confirmButtonColor: "#2f8a96",
            timer: 1600,
            showConfirmButton: true
        });

        closeCoachAnalysis();
        renderQuestions();
        updateMonthlyStats();
    } catch (e) {
        console.error(e);
        Swal.fire({
            icon: "error",
            title: "保存に失敗しました",
            html: `${escapeHtml(e.message || String(e))}`,
            confirmButtonColor: "#2f8a96"
        });
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = prev;
        }
    }
}

function updateMonthlyStats() {
    const monthlyAnswersElement = document.getElementById("monthly-answers");
    const monthlyRevenueElement = document.getElementById("monthly-revenue");
    const avgRatingElement = document.getElementById("avg-rating");

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    let count = 0;
    let revenue = 0;

    for (const q of allQuestions) {
        const d = new Date(q.created_at);
        if (!Number.isNaN(d.getTime()) && d >= firstDay) {
            count++;
            revenue += Number(q.amount_yen) || 0;
        }
    }

    monthlyAnswersElement.textContent = count;
    monthlyRevenueElement.textContent = `¥${revenue.toLocaleString("ja-JP")}`;
    avgRatingElement.textContent = "—";
}

async function updateNotificationCount() {
    const notificationCount = document.getElementById("notification-count");
    let count = 0;

    try {
        count = 3;
    } catch (e) {
        console.error("通知数取得エラー:", e);
    }

    notificationCount.textContent = count;
    notificationCount.style.display = count === 0 ? "none" : "flex";
}

async function showFeedbackNotifications() {
    const feedbacks = [
        {
            userName: "田中選手",
            rating: 5,
            comment: "非常に丁寧なアドバイスで、フォームが改善されました！",
            date: "2024/04/05"
        },
        {
            userName: "鈴木選手",
            rating: 4,
            comment: "分かりやすい説明でありがとうございます。",
            date: "2024/04/04"
        }
    ];

    let html = '<div style="max-height: 400px; overflow-y: auto;">';

    feedbacks.forEach((feedback) => {
        const stars = "⭐".repeat(feedback.rating) + "☆".repeat(5 - feedback.rating);
        html += `
                <div style="border-bottom: 1px solid #e5e7eb; padding: 1rem 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <strong>${feedback.userName}</strong>
                        <span style="color: #64748b; font-size: 0.9rem;">${feedback.date}</span>
                    </div>
                    <div style="color: #f59e0b; margin-bottom: 0.5rem;">${stars}</div>
                    <div style="color: #374151;">${feedback.comment}</div>
                </div>
            `;
    });

    html += "</div>";

    await Swal.fire({
        title: "🔔 フィードバック一覧",
        html: html,
        confirmButtonText: "閉じる",
        confirmButtonColor: "#2f8a96",
        width: "600px"
    });

    updateNotificationCount();
}

function switchPlan(plan, element) {
    currentPlan = plan;
    document.querySelectorAll(".plan-tab").forEach((tab) => {
        tab.classList.remove("active");
    });
    element.classList.add("active");
    renderQuestions();
}

function filterVideos(filter, element) {
    currentFilter = filter;
    document.querySelectorAll(".filter-section .filter-tab").forEach((tab) => {
        tab.classList.remove("active");
    });
    element.classList.add("active");
    renderQuestions();
}

async function reloadDashboard() {
    await loadQuestions();
    updateMonthlyStats();
    updateNotificationCount();
}

function wireCoachChrome() {
    document.querySelector(".plan-tabs")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button.plan-tab");
        if (!btn || btn.dataset.plan === undefined) return;
        switchPlan(btn.dataset.plan, btn);
    });

    document.querySelector(".filter-section")?.addEventListener("click", (e) => {
        const btn = e.target.closest("button.filter-tab");
        if (!btn || btn.dataset.filter === undefined) return;
        filterVideos(btn.dataset.filter, btn);
    });

    document.getElementById("coach-feedback-btn")?.addEventListener("click", () => {
        showFeedbackNotifications();
    });

    document.getElementById("coach-btn-back")?.addEventListener("click", () => {
        closeCoachAnalysis();
    });

    document.getElementById("coach-btn-submit-advice")?.addEventListener("click", () => {
        submitCoachAdvice();
    });

    document.getElementById("coach-analysis-speed-row")?.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-speed]");
        if (!b) return;
        const video = document.getElementById("coach-analysis-video");
        if (video) {
            video.playbackRate = parseFloat(b.getAttribute("data-speed")) || 1;
        }
        document.querySelectorAll("#coach-analysis-speed-row .btn-speed").forEach((x) => {
            x.classList.remove("active");
        });
        b.classList.add("active");
    });

    document.getElementById("coach-advice-video-input")?.addEventListener("change", (e) => {
        const f = e.target.files && e.target.files[0];
        const el = document.getElementById("coach-advice-video-name");
        if (el) el.textContent = f ? f.name : "未選択";
    });
}

wireCoachChrome();

window.switchPlan = switchPlan;
window.filterVideos = filterVideos;
window.reloadDashboard = reloadDashboard;
window.showFeedbackNotifications = showFeedbackNotifications;

setInterval(() => {
    loadQuestions();
    updateMonthlyStats();
    updateNotificationCount();
}, 5 * 60 * 1000);
