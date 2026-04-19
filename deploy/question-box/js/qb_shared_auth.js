import {
    supabase,
    getCurrentUser,
    initSupabaseAuthCache,
    signInWithGoogleOAuth,
    consumeOAuthRedirectErrorFromUrl,
    getOAuthRedirectTo,
} from "../../supabase-client.js";

void initSupabaseAuthCache();

/** Google OAuth 開始直後（リダイレクト前）。呼び出し側はエラー表示せず return すること */
export const QB_AUTH_REDIRECTING = "qb_auth_redirecting";

export function getQbUid() {
    return getCurrentUser()?.id ?? null;
}

/** SweetAlert2 が html/body に残した overflow:hidden を、モーダルが無いときだけ外す（モバイルでスクロール不能になるのを防ぐ） */
export function qbUnlockDocumentScroll() {
    const run = () => {
        const Swal = typeof window !== "undefined" ? window.Swal : null;
        if (Swal && typeof Swal.isVisible === "function" && Swal.isVisible()) return;
        document.documentElement.style.removeProperty("overflow");
        document.body.style.removeProperty("overflow");
        document.documentElement.style.removeProperty("padding-right");
        document.body.style.removeProperty("padding-right");
    };
    requestAnimationFrame(run);
    setTimeout(run, 150);
}

/**
 * 掲示板と同じ Supabase セッションを利用（Google OAuth はリダイレクト方式）
 * @param {{ title?: string, text?: string, confirmButtonText?: string }} opts
 * @returns {Promise<boolean>}
 */
export async function qbEnsureSignedIn(opts = {}) {
    await initSupabaseAuthCache();
    const { data: s1 } = await supabase.auth.getSession();
    if (s1.session?.user) return true;

    const SwalGlobal = typeof window !== "undefined" ? window.Swal : null;
    if (!SwalGlobal) {
        console.warn("SweetAlert2 が未読込のためログインできません");
        return false;
    }
    try {
        await SwalGlobal.fire({
            title: opts.title ?? "ログインが必要です",
            text: opts.text ?? "続行するには Google でログインしてください。",
            icon: "info",
            confirmButtonText: opts.confirmButtonText ?? "ログイン",
            confirmButtonColor: "#2f8a96",
        });
        const { error } = await signInWithGoogleOAuth();
        if (error) {
            console.error(error);
            await SwalGlobal.fire("エラー", error.message || "ログインに失敗しました", "error");
            return false;
        }
        return QB_AUTH_REDIRECTING;
    } finally {
        qbUnlockDocumentScroll();
    }
}

if (typeof window !== "undefined") {
    window.qbGetUid = () => getQbUid();
    window.qbEnsureSignedIn = (o) => qbEnsureSignedIn(o);
    window.QB_AUTH_REDIRECTING = QB_AUTH_REDIRECTING;
    window.qbUnlockDocumentScroll = qbUnlockDocumentScroll;

    window.addEventListener("DOMContentLoaded", () => {
        const oauthErr = consumeOAuthRedirectErrorFromUrl();
        if (!oauthErr) return;
        const hint = getOAuthRedirectTo();
        const text = hint
            ? `${oauthErr}\n\nSupabase の Authentication → URL Configuration → Redirect URLs に次を追加してください:\n${hint}`
            : oauthErr;
        const SwalGlobal = window.Swal;
        if (SwalGlobal?.fire) {
            void SwalGlobal.fire({
                icon: "error",
                title: "ログインできませんでした",
                text,
                confirmButtonColor: "#2f8a96",
            });
        } else {
            console.error(text);
        }
    });

    window.addEventListener("pageshow", (ev) => {
        if (ev.persisted) qbUnlockDocumentScroll();
    });
}
