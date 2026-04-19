import { qbEnsureSignedIn, getQbUid, QB_AUTH_REDIRECTING } from "./qb_shared_auth.js";

const COACHES = [
    { id: "c1", name: "田中 翔", bio: "短距離・スタートを専門に、フォームを丁寧にフィードバック。" },
    { id: "c2", name: "佐藤 凛", bio: "中間加速やピッチなど、走りの細部までアドバイス。" },
    { id: "c3", name: "鈴木 大輔", bio: "ラストスパートとメンタル面の両方をサポート。" }
];

function coachNameFromId(cid) {
    if (!cid) return "コーチ";
    const c = COACHES.find((x) => x.id === cid);
    return c ? c.name : cid;
}

function esc(s) {
    if (s == null || s === "") return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function hasCoachReply(row) {
    const t = (row.coach_advice_text || "").trim();
    const v = (row.coach_advice_video_url || "").trim();
    return Boolean(t || v);
}

function renderCoachList() {
    const listEl = document.getElementById("qb-hub-coach-list");
    if (!listEl) return;
    listEl.innerHTML = COACHES.map(
        (c) =>
            `<li class="qb-hub-coach-item"><span class="qb-hub-coach-name">${esc(c.name)}</span>` +
            `<span class="qb-hub-coach-bio">${esc(c.bio)}</span></li>`
    ).join("");
}

function renderReplies(rows) {
    const el = document.getElementById("qb-hub-replies");
    if (!el) return;

    if (!rows.length) {
        el.innerHTML =
            '<p class="qb-hub-replies-empty">まだ質問を送っていません。下のボタンから送ると、同じ Google アカウントでログインした端末からいつでも回答を確認できます。</p>';
        return;
    }

    el.innerHTML = rows
        .map((q) => {
            const dateStr = q.created_at
                ? new Date(q.created_at).toLocaleString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                  })
                : "";
            const coachLabel = coachNameFromId(q.coach_id);
            let qPreview = (q.question_text || "").trim();
            if (qPreview.length > 72) qPreview = `${qPreview.slice(0, 72)}…`;

            const waiting = !hasCoachReply(q);
            let replyBits = "";

            if (waiting) {
                replyBits =
                    '<p class="qb-hub-receipt-wait">コーチの回答を準備中です。しばらくしてから再度開いてください。</p>';
            } else {
                if ((q.coach_advice_text || "").trim()) {
                    replyBits += `<p class="qb-hub-receipt-advice">${esc(q.coach_advice_text.trim())}</p>`;
                }
                if ((q.coach_advice_video_url || "").trim()) {
                    replyBits += `<video class="qb-hub-reply-video" controls playsinline preload="metadata" src="${esc(
                        q.coach_advice_video_url.trim()
                    )}"></video>`;
                }
            }

            return (
                `<article class="qb-hub-receipt">` +
                `<div class="qb-hub-receipt-meta">` +
                `<span class="qb-hub-receipt-date">${esc(dateStr)}</span>` +
                `<span class="qb-hub-receipt-badge">` +
                `${q.tier === "premium" ? "プレミアム" : "スタンダード"} · ` +
                `${q.format === "plus" ? "動画付き" : "テキスト"}` +
                `</span></div>` +
                `<p class="qb-hub-receipt-question"><span class="qb-hub-receipt-label">あなたの質問</span>${esc(
                    qPreview || "（なし）"
                )}</p>` +
                `<div class="qb-hub-receipt-from">回答: <strong>${esc(coachLabel)}</strong></div>` +
                `<div class="qb-hub-receipt-body">${replyBits}</div>` +
                `</article>`
            );
        })
        .join("");
}

async function loadMyReplies(uid) {
    const el = document.getElementById("qb-hub-replies");
    const client = window.qbSupabase;

    if (!client) {
        if (el) el.innerHTML = '<p class="qb-hub-replies-empty">Supabase に接続できません。</p>';
        return;
    }

    if (!uid) {
        if (el) {
            el.innerHTML =
                '<p class="qb-hub-replies-empty">ログインすると、あなたの質問への回答が表示されます。</p>';
        }
        return;
    }

    if (el) el.innerHTML = '<p class="qb-hub-replies-loading">読み込み中…</p>';

    try {
        const res = await client
            .from("questions")
            .select("*")
            .eq("questioner_uid", uid)
            .order("created_at", { ascending: false })
            .limit(50);

        if (res.error) throw res.error;
        renderReplies(res.data || []);
    } catch (e) {
        console.error(e);
        if (el) {
            el.innerHTML =
                '<p class="qb-hub-replies-empty">読み込みに失敗しました。<code>questioner_uid</code> カラムと RLS（SELECT）を確認してください。</p>';
        }
    }
}

async function init() {
    renderCoachList();

    const ok = await qbEnsureSignedIn({
        title: "ログインが必要です",
        text: "質問を送るにはログインしてください。",
        confirmButtonText: "ログイン"
    });

    if (ok === QB_AUTH_REDIRECTING) return;

    if (!ok) {
        const el = document.getElementById("qb-hub-replies");
        if (el) {
            el.innerHTML =
                '<p class="qb-hub-replies-empty">ログインすると、あなたの質問への回答が表示されます。</p>';
        }
        return;
    }

    const hintEl = document.getElementById("qb-hub-replies-hint");
    if (hintEl) hintEl.hidden = true;

    await loadMyReplies(getQbUid());
}

document.addEventListener("DOMContentLoaded", init);
