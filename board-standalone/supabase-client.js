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
 * Supabase の Redirect URLs と一致させやすい URL（# や ? を含めない）
 * 例: http://127.0.0.1:5500/board/index.html
 */
export function getOAuthRedirectTo() {
    const { protocol, host, pathname } = window.location;
    return `${protocol}//${host}${pathname}`;
}

/**
 * Google OAuth 開始。一部ブラウザ／SDKの組み合わせで自動リダイレクトしないため、
 * 返却された URL があれば必ず遷移する。
 */
export async function signInWithGoogleOAuth() {
    const redirectTo = getOAuthRedirectTo();
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo,
        },
    });
    if (error) return { error };
    if (data?.url) {
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
