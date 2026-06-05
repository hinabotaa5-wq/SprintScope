import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

console.log("supabase-client loaded", window.location.pathname);

const SUPABASE_URL = "https://wircqvnrumxbmnzonrxe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_piYc7qWxu6xunoxXWakh6Q_jB96-FIE";
const API_BASE = window.SPRINT_API_BASE || "http://localhost:8080";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

let cachedUser = null;

if (typeof window !== "undefined") {
    window.supabase = supabase;
    console.log("[supabase-client] window.supabase ready", Boolean(window.supabase));
}

supabase.auth.onAuthStateChange((_event, session) => {
    cachedUser = session?.user ?? null;
});

/** 初期セッションを取り込む（初回描画の取りこぼし防止） */
export async function initSupabaseAuthCache() {
    const { data } = await supabase.auth.getSession();
    cachedUser = data.session?.user ?? null;
}

export function getCurrentUser() {
    return cachedUser;
}

/**
 * デバッグ用: 現在のアクセストークンで Go API /api/me を叩く。
 * 必ず console に開始/終了を出す。
 */
export async function debugFetchMe() {
    console.log("[debugFetchMe] start");
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        console.error("[debugFetchMe] getSession error:", error);
        return null;
    }
    const token = data.session?.access_token;
    if (!token) {
        console.warn("[debugFetchMe] no access token (not signed in?)");
        return null;
    }

    const res = await fetch(`${API_BASE}/api/me`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    console.log("[debugFetchMe] status:", res.status);
    console.log("[debugFetchMe] body:", text);
    return { status: res.status, body: text };
}

if (typeof window !== "undefined") {
    window.debugFetchMe = debugFetchMe;
    window.addEventListener("DOMContentLoaded", () => {
        console.log("[supabase-client] DOMContentLoaded");
        // ページ読込時に一度だけ自動実行して、Network/Consoleで必ず確認できるようにする
        void debugFetchMe().catch((e) => {
            console.error("[debugFetchMe] failed:", e);
        });
    });
}

export function displayNameFromUser(user) {
    if (!user) return "";
    const meta = user.user_metadata || {};
    return meta.full_name || meta.name || meta.user_name || user.email?.split("@")[0] || "ユーザー";
}

/**
 * Supabase の Redirect URLs と一致させやすい URL（# や ? を含めない）。
 * 末尾スラッシュだけの URL と index.html 付きで二重登録しなくてよいよう、
 * ディレクトリ URL は常に index.html へ正規化する。
 */
export function getOAuthRedirectTo() {
    if (!/^https?:$/i.test(window.location.protocol)) {
        return "";
    }
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";
    let path = url.pathname;
    if (path.endsWith("/") && path.length > 1) {
        path = `${path}index.html`;
    } else {
        const last = path.split("/").filter(Boolean).pop() ?? "";
        if (last && !last.includes(".")) {
            path = `${path.replace(/\/?$/, "")}/index.html`;
        }
    }
    return `${url.origin}${path}`;
}

/**
 * Google OAuth 失敗時など、リダイレクト先に付く error / error_description を1回だけ取り出して URL から除去する。
 * 成功時のセッション用ハッシュは error が無い限り変更しない。
 */
export function consumeOAuthRedirectErrorFromUrl() {
    if (typeof window === "undefined") return null;
    const hashRaw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hashRaw);
    const searchParams = new URLSearchParams(window.location.search);
    const err = hashParams.get("error") || searchParams.get("error");
    if (!err) return null;

    const rawDesc =
        hashParams.get("error_description") ||
        searchParams.get("error_description") ||
        err;
    let readable = String(rawDesc);
    try {
        readable = decodeURIComponent(readable.replace(/\+/g, " "));
    } catch {
        /* keep raw */
    }

    const u = new URL(window.location.href);
    u.hash = "";
    ["error", "error_description", "error_code"].forEach((k) => u.searchParams.delete(k));
    const next = `${u.pathname}${u.search}${u.hash}`;
    window.history.replaceState(null, "", next);

    return readable;
}

function escapeHtmlAttr(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;");
}

/** iOS 等では await 後の location 遷移がユーザ操作と切り離されブロックされることがあるため、タップで開くリンクを挟む */
function shouldUseTapToContinueGoogleOAuth() {
    if (typeof navigator === "undefined" || typeof window === "undefined") return false;
    const coarse = window.matchMedia?.("(pointer: coarse)")?.matches === true;
    const ua = navigator.userAgent || "";
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isIPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return coarse || isIOS || isIPadOS;
}

function isLikelyInAppBrowser() {
    const ua = navigator.userAgent || "";
    return /Instagram|FBAN|FBAV|FB_IAB|Line\/|Twitter|Snapchat|TikTok|musical_ly|wv\)/i.test(ua);
}

/**
 * Google OAuth 開始。一部ブラウザ／SDKの組み合わせで自動リダイレクトしないため、
 * 返却された URL があれば必ず遷移する。
 */
export async function signInWithGoogleOAuth() {
    const redirectTo = getOAuthRedirectTo();
    if (!redirectTo) {
        return {
            error: new Error(
                "Google ログインは http(s) の URL で開いてください（file:// では利用できません）。",
            ),
        };
    }
    const startURL = `${API_BASE}/api/auth/google/start?redirect_to=${encodeURIComponent(redirectTo)}`;
    if (shouldUseTapToContinueGoogleOAuth()) {
        const SwalGlobal = typeof window !== "undefined" ? window.Swal : null;
        if (SwalGlobal?.fire) {
            const safeUrl = escapeHtmlAttr(startURL);
            const inAppHint = isLikelyInAppBrowser()
                ? '<p style="margin:0 0 0.75rem;font-size:0.85rem;line-height:1.45;color:#64748b;text-align:left;">LINE・Instagram などのアプリ内ブラウザでは Google ログインできないことがあります。Safari や Chrome でこのページを開き直してください。</p>'
                : "";
            await SwalGlobal.fire({
                title: "Googleでログイン",
                html: `${inAppHint}<p style="margin:0 0 1rem;font-size:0.95rem;line-height:1.45;">次のボタンをタップすると Google の画面に移動します。</p><p style="margin:0;"><a href="${safeUrl}" class="swal2-confirm swal2-styled" style="display:inline-block;text-decoration:none;box-sizing:border-box;padding:0.625em 1.1em;">Googleで続行</a></p>`,
                showConfirmButton: false,
                showCancelButton: true,
                cancelButtonText: "キャンセル",
                cancelButtonColor: "#94a3b8",
            });
            return { error: null };
        }
    }
    window.location.assign(startURL);
    return { error: null };
}

/**
 * メールアドレス宛に6桁コード（OTP）を送信する。
 *
 * 「Token has expired or is invalid」が出る場合の確認:
 * Supabase ダッシュボード → Authentication → Email Templates で、
 * 該当テンプレートに {{ .ConfirmationURL }} が残っているとリンク用フローと混ざりやすいです。
 * まず本文を {{ .Token }}（6桁）中心にし、リンク用の行は外して試してください。
 */
export async function sendEmailOtp(email) {
    const res = await fetch(`${API_BASE}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) {
        const t = await res.text();
        return { error: new Error(t || `HTTP ${res.status}`) };
    }
    return { error: null };
}

/**
 * 受け取った6桁コード（OTP）を検証してログインする。
 */
export async function verifyEmailOtp(email, token) {
    console.log("検証開始:", { email, token });
    const res = await fetch(`${API_BASE}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token }),
    });
    const raw = await res.text();
    let data = null;
    try {
        data = raw ? JSON.parse(raw) : null;
    } catch {
        data = null;
    }
    if (!res.ok) {
        const error = new Error(data?.message || raw || `HTTP ${res.status}`);
        console.error("OTP検証失敗:", error);
        return { data: null, error };
    }
    const accessToken = data?.access_token;
    const refreshToken = data?.refresh_token;
    if (accessToken && refreshToken) {
        const sessionRes = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
        if (sessionRes.error) {
            return sessionRes;
        }
        return sessionRes;
    }
    const fallbackError = new Error("アクセストークンが取得できませんでした");
    console.error("OTP検証失敗:", fallbackError);
    return { data: null, error: fallbackError };
}
