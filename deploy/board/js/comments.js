import { supabase, getCurrentUser, displayNameFromUser } from "../../supabase-client.js";

window.changeSpeed = function (s, el) {
    document.getElementById("myVideo").playbackRate = s;
    document.querySelectorAll(".btn-speed").forEach((b) => b.classList.remove("active"));
    el.classList.add("active");
};

window.postAdvice = async function () {
    const text = document.getElementById("advise-input").value;
    const user = getCurrentUser();
    const postId = window.currentPostId;

    if (!user) {
        await Swal.fire({
            icon: "info",
            title: "ログインが必要です",
            text: "コメントをするにはログインしてください",
            confirmButtonColor: "#2f8a96",
        });
        return;
    }

    if (!text) {
        await Swal.fire({
            icon: "warning",
            title: "入力してください",
            text: "空欄のままでは送信できません",
            confirmButtonColor: "#f39c12",
        });
        return;
    }

    try {
        const { error } = await supabase.from("board_comments").insert({
            post_id: postId,
            text: text,
            user_id: user.id,
            user_name: displayNameFromUser(user),
        });
        if (error) throw error;

        document.getElementById("advise-input").value = "";

        Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "アドバイスを送信しました！",
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
        });

        renderComments(postId);
    } catch (e) {
        console.error(e);
        Swal.fire({
            icon: "error",
            title: "送信に失敗しました",
            text: "ネットワークの状態を確認して、もう一度お試しください。",
        });
    }
};

function formatCommentDate(iso) {
    if (!iso) return "送信中...";
    try {
        return new Date(iso).toLocaleString("ja-JP");
    } catch {
        return String(iso);
    }
}

export async function renderComments(postId) {
    const commentList = document.getElementById("comment-list");
    const user = getCurrentUser();
    if (!commentList) return;

    commentList.innerHTML = "読み込み中...";

    try {
        const { data: comments, error } = await supabase
            .from("board_comments")
            .select("*")
            .eq("post_id", postId)
            .order("created_at", { ascending: false });
        if (error) throw error;

        commentList.innerHTML = "";

        const template = document.getElementById("comment-card-template");

        (comments || []).forEach((comment) => {
            const commentId = comment.id;

            const date = formatCommentDate(comment.created_at);

            const fragment = template.content.cloneNode(true);
            const cardEl = fragment.querySelector(".comment-card");

            cardEl.querySelector(".comment-date").textContent = date;

            const replyIndicator = cardEl.querySelector(".reply-indicator");
            const replyToOriginal = cardEl.querySelector(".reply-to-original");

            if (comment.reply_to) {
                replyIndicator.style.display = "inline";
                replyToOriginal.style.display = "block";
                const orig = comment.reply_to.originalText || "";
                replyToOriginal.querySelector(".original-comment div:last-child").textContent =
                    orig.length > 60 ? `${orig.substring(0, 60)}...` : orig;
            }

            cardEl.querySelector(".comment-body").textContent = comment.text;

            const actionsContainer = cardEl.querySelector(".comment-actions");

            const replyBtn = document.createElement("button");
            replyBtn.className = "btn-comment-reply";
            replyBtn.textContent = "返信";
            replyBtn.addEventListener("click", () => {
                replyToComment(postId, commentId, comment.user_name || "", comment.text || "");
            });
            actionsContainer.appendChild(replyBtn);

            if (user && comment.user_id === user.id) {
                const editBtn = document.createElement("button");
                editBtn.className = "btn-comment-edit";
                editBtn.textContent = "編集";
                editBtn.addEventListener("click", () => {
                    editComment(postId, commentId, comment.text || "");
                });
                actionsContainer.appendChild(editBtn);

                const deleteBtn = document.createElement("button");
                deleteBtn.className = "btn-comment-delete";
                deleteBtn.textContent = "削除";
                deleteBtn.addEventListener("click", () => {
                    deleteComment(postId, commentId);
                });
                actionsContainer.appendChild(deleteBtn);
            } else {
                const reportBtn = document.createElement("button");
                reportBtn.className = "btn-comment-report";
                reportBtn.textContent = "通報";
                reportBtn.addEventListener("click", () => {
                    reportComment(postId, commentId, comment.text || "");
                });
                actionsContainer.appendChild(reportBtn);
            }

            commentList.appendChild(cardEl);
        });
    } catch (e) {
        console.error("コメント読み込みエラー:", e);
        commentList.innerHTML = "コメントの読み込みに失敗しました。";
    }
}

window.reportComment = async function (postId, commentId, commentText) {
    if (!getCurrentUser()) {
        Swal.fire({
            icon: "error",
            title: "ログインが必要です",
            text: "通報するにはログインしてください。",
            confirmButtonColor: "#2f8a96",
        });
        return;
    }

    const { value: reason } = await Swal.fire({
        title: "通報の理由",
        input: "select",
        inputOptions: {
            誹謗中傷: "不適切な言葉・誹謗中傷",
            スパム: "スパム・広告",
            その他: "その他",
        },
        inputPlaceholder: "理由を選択してください",
        showCancelButton: true,
        confirmButtonText: "報告する",
        cancelButtonText: "キャンセル",
        confirmButtonColor: "#ef4444",
        inputValidator: (value) => {
            if (!value) return "理由を選択してください！";
        },
    });

    if (reason) {
        try {
            const { error } = await supabase.from("board_comment_reports").insert({
                post_id: postId,
                comment_id: commentId,
                comment_text: commentText,
                reason: reason,
                reporter_id: getCurrentUser().id,
                status: "pending",
            });
            if (error) throw error;

            Swal.fire({
                icon: "success",
                title: "報告を送信しました",
                text: "ご協力ありがとうございます。",
                timer: 2000,
                showConfirmButton: false,
            });
        } catch (e) {
            Swal.fire("エラー", "送信に失敗しました", "error");
        }
    }
};

window.editComment = async function (postId, commentId, currentText) {
    const { value: newText } = await Swal.fire({
        title: "アドバイスを編集",
        input: "textarea",
        inputValue: currentText,
        showCancelButton: true,
        confirmButtonText: "保存",
        cancelButtonText: "キャンセル",
        confirmButtonColor: "#2f8a96",
        inputValidator: (value) => !value.trim() && "入力してください！",
    });

    if (newText && newText !== currentText) {
        try {
            const { error } = await supabase
                .from("board_comments")
                .update({
                    text: newText,
                    updated_at: new Date().toISOString(),
                })
                .eq("id", commentId)
                .eq("post_id", postId);
            if (error) throw error;
            Swal.fire({
                toast: true,
                position: "top-end",
                icon: "success",
                title: "編集しました",
                showConfirmButton: false,
                timer: 1500,
            });
            renderComments(postId);
        } catch (e) {
            Swal.fire("エラー", "編集に失敗しました", "error");
        }
    }
};

window.deleteComment = async function (postId, commentId) {
    const result = await Swal.fire({
        title: "アドバイスを削除しますか？",
        text: "この操作は取り消せません",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#aaa",
        confirmButtonText: "削除する",
        cancelButtonText: "キャンセル",
    });

    if (!result.isConfirmed) return;

    try {
        const { error } = await supabase.from("board_comments").delete().eq("id", commentId).eq("post_id", postId);
        if (error) throw error;

        Swal.fire({
            toast: true,
            position: "top-end",
            icon: "success",
            title: "削除しました",
            showConfirmButton: false,
            timer: 1500,
        });

        renderComments(postId);
    } catch (e) {
        console.error(e);
        Swal.fire({
            icon: "error",
            title: "削除に失敗しました",
            text: "もう一度お試しください",
        });
    }
};

window.replyToComment = async function (postId, commentId, replyToUser, originalText) {
    if (!getCurrentUser()) {
        await Swal.fire({
            icon: "info",
            title: "ログインが必要です",
            text: "返信するにはログインしてください",
            confirmButtonColor: "#2f8a96",
        });
        return;
    }

    const shortOriginal = originalText.length > 40 ? `${originalText.substring(0, 40)}...` : originalText;

    const { value: replyText } = await Swal.fire({
        title: "コメントに返信",
        html: `
            <div style="text-align: left; margin-bottom: 15px;">
                <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 4px solid #10b981;">
                    <div style="font-size: 0.85em; color: #64748b; margin-bottom: 4px;">元のコメント:</div>
                    <div style="font-style: italic; color: #334155;">"${shortOriginal}"</div>
                </div>
            </div>
        `,
        input: "textarea",
        inputPlaceholder: "返信内容を入力してください...",
        inputAttributes: {
            style: "min-height: 100px; resize: vertical;",
            rows: "4",
        },
        showCancelButton: true,
        confirmButtonText: "返信を投稿",
        cancelButtonText: "キャンセル",
        confirmButtonColor: "#10b981",
        preConfirm: (value) => {
            if (!value || !value.trim()) {
                Swal.showValidationMessage("返信内容を入力してください");
                return false;
            }
            return value.trim();
        },
    });

    if (replyText) {
        try {
            const u = getCurrentUser();
            const { error } = await supabase.from("board_comments").insert({
                post_id: postId,
                text: replyText,
                user_id: u.id,
                user_name: displayNameFromUser(u),
                reply_to: {
                    commentId: commentId,
                    userName: replyToUser,
                    originalText: originalText,
                },
            });
            if (error) throw error;

            Swal.fire({
                toast: true,
                position: "top-end",
                icon: "success",
                title: "返信を投稿しました！",
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true,
            });

            renderComments(postId);
        } catch (e) {
            console.error(e);
            Swal.fire({
                icon: "error",
                title: "投稿に失敗しました",
                text: "ネットワークの状態を確認して、もう一度お試しください。",
            });
        }
    }
};

window.openInquiry = async function () {
    if (!getCurrentUser()) {
        await Swal.fire({
            icon: "info",
            title: "ログインが必要です",
            text: "問い合わせを送るにはログインしてください。",
            confirmButtonColor: "#2f8a96",
        });
        return;
    }

    const { value: inquiryText } = await Swal.fire({
        title: "問い合わせ",
        input: "textarea",
        inputPlaceholder: "お問い合わせ内容を入力してください...",
        inputAttributes: {
            style: "min-height: 120px; resize: vertical;",
            rows: "5",
        },
        showCancelButton: true,
        confirmButtonText: "送信する",
        cancelButtonText: "キャンセル",
        confirmButtonColor: "#6366f1",
        preConfirm: (value) => {
            if (!value || !value.trim()) {
                Swal.showValidationMessage("お問い合わせ内容を入力してください");
                return false;
            }
            return value.trim();
        },
    });

    if (inquiryText) {
        try {
            const u = getCurrentUser();
            const { error } = await supabase.from("board_inquiries").insert({
                text: inquiryText,
                user_id: u.id,
                user_name: displayNameFromUser(u),
                status: "pending",
            });
            if (error) throw error;

            Swal.fire({
                toast: true,
                position: "top-end",
                icon: "success",
                title: "お問い合わせを送信しました！",
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
            });
        } catch (e) {
            console.error(e);
            Swal.fire({
                icon: "error",
                title: "送信に失敗しました",
                text: "ネットワークの状態を確認して、もう一度お試しください。",
            });
        }
    }
};
