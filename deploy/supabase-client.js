import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://wircqvnrumxbmnzonrxe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_piYc7qWxu6xunoxXWakh6Q_jB96-FIE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

let cachedUser = null;

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
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo,
        },
    });
    if (error) return { error };
    if (data?.url) {
        if (shouldUseTapToContinueGoogleOAuth()) {
            const SwalGlobal = typeof window !== "undefined" ? window.Swal : null;
            if (SwalGlobal?.fire) {
                const safeUrl = escapeHtmlAttr(data.url);
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
        window.location.assign(data.url);
        return { error: null };
    }
    return { error: new Error("Google ログイン用の URL が取得できませんでした。Supabase の Google プロバイダ設定を確認してください。") };
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
    const { error } = await supabase.auth.signInWithOtp({
        email,
    });
    return { error };
}

/**
 * 受け取った6桁コード（OTP）を検証してログインする。
 */
export async function verifyEmailOtp(email, token) {
    console.log("検証開始:", { email, token });

    const firstTry = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup",
    });
    if (!firstTry.error) return firstTry;

    const secondTry = await supabase.auth.verifyOtp({
        email,
        token,
        type: "magiclink",
    });
    if (!secondTry.error) return secondTry;

    const error = secondTry.error || firstTry.error;
    console.error("OTP検証失敗:", error);
    return { data: null, error };
}
