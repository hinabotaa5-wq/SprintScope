import { qbEnsureSignedIn, getQbUid, QB_AUTH_REDIRECTING } from "./qb_shared_auth.js";
import { apiFetch, apiUploadVideo } from "../../api-client.js";

const API_BASE = window.SPRINT_API_BASE || "http://localhost:8080";
const CHECKOUT_BASE_URL = window.SPRINT_CHECKOUT_BASE_URL || `${API_BASE}/api/checkout/komoju`;
const PRICES = {
  standard: { text: 100, plus: 150 },
  premium: { text: 200, plus: 250 },
};
const COACHES = [
  { id: "c1", name: "田中 翔", bio: "短距離・スタートを専門に、フォームを丁寧にフィードバック。" },
  { id: "c2", name: "佐藤 凛", bio: "中間加速やピッチなど、走りの細部までアドバイス。" },
  { id: "c3", name: "鈴木 大輔", bio: "ラストスパートとメンタル面の両方をサポート。" },
];

let currentStep = 1;
let pendingCheckoutRef = "";

function qbSwalFire(...args) {
  const p = Swal.fire(...args);
  if (p && typeof p.finally === "function") {
    p.finally(() => {
      if (typeof window.qbUnlockDocumentScroll === "function") window.qbUnlockDocumentScroll();
    });
  }
  return p;
}

function getTier() {
  const el = document.querySelector('input[name="tier"]:checked');
  return el ? el.value : "standard";
}

function getFormat() {
  const el = document.querySelector('input[name="format"]:checked');
  return el ? el.value : "text";
}

function getPriceYen() {
  const tier = getTier();
  const format = getFormat();
  return PRICES[tier][format];
}

function getPaymentMethod() {
  const el = document.querySelector('input[name="payment-method"]:checked');
  return el ? el.value : "card";
}

function paymentMethodLabel(method) {
  if (method === "applepay") return "Apple Pay";
  if (method === "paypay") return "PayPay";
  return "クレジットカード";
}

function formatYen(n) {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function updateFormatPrices() {
  const tier = getTier();
  document.querySelectorAll(".format-price").forEach((el) => {
    const std = el.getAttribute("data-price-standard");
    const prem = el.getAttribute("data-price-premium");
    const v = tier === "premium" ? prem : std;
    el.textContent = formatYen(parseInt(v, 10));
  });
  const legend = document.getElementById("price-legend");
  if (legend) {
    const t = tier === "premium" ? "プレミアム" : "スタンダード";
    legend.textContent = `表示中の料金は「${t}」です（税込の目安）`;
  }
}

function updateVideoVisibility() {
  const block = document.getElementById("video-block");
  const input = document.getElementById("coach-video-input");
  const nameEl = document.getElementById("coach-video-name");
  const isPlus = getFormat() === "plus";
  if (!block) return;
  block.hidden = !isPlus;
  if (!isPlus) {
    if (input) input.value = "";
    if (nameEl) nameEl.textContent = "未選択";
  }
}

function setStepIndicator(step) {
  document.querySelectorAll(".stepper-item").forEach((item) => {
    const n = Number(item.getAttribute("data-step-indicator"), 10);
    item.classList.toggle("active", n === step);
    item.classList.toggle("done", n < step);
  });
}

function goStep(n) {
  if (n === 4 && !validateStep3()) return;
  currentStep = n;
  document.querySelectorAll(".flow-step").forEach((el) => {
    el.classList.toggle("active", Number(el.getAttribute("data-step"), 10) === n);
  });
  setStepIndicator(n);
  if (n === 2) updateFormatPrices();
  if (n === 3) updateVideoVisibility();
  if (n === 5) fillSummary();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function validateStep3() {
  const q = (document.getElementById("question-body") || {}).value || "";
  if (!q.trim()) {
    qbSwalFire({
      icon: "warning",
      title: "質問内容を入力してください",
      text: "コーチへ送る文章が空のままです。",
      confirmButtonColor: "#2f8a96",
    });
    return false;
  }
  if (getFormat() === "plus") {
    const fileInput = document.getElementById("coach-video-input");
    if (!fileInput || !fileInput.files || !fileInput.files[0]) {
      qbSwalFire({
        icon: "warning",
        title: "動画を選択してください",
        text: "プラスプランでは動画の添付が必要です。",
        confirmButtonColor: "#d97706",
      });
      return false;
    }
  }
  return true;
}

function getSelectedCoachId() {
  const checked = document.querySelector('input[name="coach"]:checked');
  return checked ? checked.value : "";
}

function renderCoachGrid() {
  const grid = document.getElementById("coach-grid");
  if (!grid) return;
  grid.innerHTML = COACHES.map(
    (c, i) => `
    <label class="coach-option">
      <input type="radio" name="coach" value="${c.id}" ${i === 0 ? "checked" : ""}>
      <div class="coach-meta">
        <div class="coach-name">${c.name}</div>
        <div class="coach-bio">${c.bio}</div>
      </div>
    </label>
  `
  ).join("");
}

function fillSummary() {
  const tier = getTier();
  const format = getFormat();
  const price = getPriceYen();

  document.getElementById("summary-tier").textContent =
    tier === "premium" ? "プレミアム" : "スタンダード";
  document.getElementById("summary-format").textContent =
    format === "plus" ? "プラス（テキスト＋動画）" : "テキストのみ";

  const fileInput = document.getElementById("coach-video-input");
  const hasFile = fileInput && fileInput.files && fileInput.files[0];
  document.getElementById("summary-video").textContent =
    format === "plus"
      ? hasFile
        ? fileInput.files[0].name
        : "（未選択）"
      : "なし（テキストのみ）";

  document.getElementById("summary-question").textContent =
    (document.getElementById("question-body") || {}).value.trim() || "—";
  document.getElementById("summary-price").textContent = formatYen(price);
  document.getElementById("summary-payment-method").textContent = paymentMethodLabel(getPaymentMethod());

  const coachRow = document.getElementById("summary-coach-row");
  const coachPanel = document.getElementById("premium-coach-panel");
  const summaryCoach = document.getElementById("summary-coach");

  if (tier === "premium") {
    renderCoachGrid();
    coachRow.hidden = false;
    coachPanel.hidden = false;
    const cid = getSelectedCoachId();
    const c = COACHES.find((x) => x.id === cid);
    summaryCoach.textContent = c ? `${c.name}` : "—";
  } else {
    coachRow.hidden = true;
    coachPanel.hidden = true;
  }

  document.querySelectorAll('input[name="coach"]').forEach((radio) => {
    radio.removeEventListener("change", onCoachChange);
    radio.addEventListener("change", onCoachChange);
  });
}

function onCoachChange() {
  const summaryCoach = document.getElementById("summary-coach");
  const cid = getSelectedCoachId();
  const c = COACHES.find((x) => x.id === cid);
  if (summaryCoach) summaryCoach.textContent = c ? c.name : "—";
}

async function submitToCoach() {
  const tier = getTier();
  if (tier === "premium" && !getSelectedCoachId()) {
    qbSwalFire({
      icon: "info",
      title: "コーチを選択してください",
      text: "プレミアムでは、コーチの指定が必要です。",
      confirmButtonColor: "#2f8a96",
    });
    return;
  }
  if (!validateStep3()) {
    goStep(3);
    return;
  }

  let questioner_uid = getQbUid();
  if (!questioner_uid) {
    const signedIn = await qbEnsureSignedIn({
      title: "ログインが必要です",
      text: "質問を送るには Google でログインしてください。ハブでは同じアカウントで回答を確認できます。",
      confirmButtonText: "ログイン",
    });
    if (signedIn === QB_AUTH_REDIRECTING) return;
    if (!signedIn) return;
    questioner_uid = getQbUid();
    if (!questioner_uid) return;
  }

  const btn = document.getElementById("btn-send-coach");
  const prevLabel = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "保存中…";
  }

  pendingCheckoutRef = `QB-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const questionText = (document.getElementById("question-body") || {}).value.trim();
  const fileInput = document.getElementById("coach-video-input");
  const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
  const format = getFormat();

  let video_storage_path = null;
  if (format === "plus" && file) {
    try {
      const data = await apiUploadVideo(file, "auto_delete_90d");
      video_storage_path = data.secure_url || null;
    } catch (e) {
      console.error(e);
      pendingCheckoutRef = "";
      if (btn) {
        btn.disabled = false;
        btn.textContent = prevLabel;
      }
      qbSwalFire({
        icon: "error",
        title: "動画のアップロードに失敗しました",
        text: e.message || String(e),
        confirmButtonColor: "#2f8a96",
      });
      return;
    }
  }

  const row = {
    tier,
    format,
    question_text: questionText,
    coach_id: tier === "premium" ? getSelectedCoachId() : null,
    amount_yen: getPriceYen(),
    payment_ref: pendingCheckoutRef,
    video_filename: file ? file.name : null,
    video_storage_path,
    questioner_uid,
  };

  try {
    await apiFetch("/api/questions", {
      method: "POST",
      body: JSON.stringify(row),
    });

    document.getElementById("payment-price").textContent = formatYen(getPriceYen());
    document.getElementById("payment-ref").textContent = pendingCheckoutRef;

    goStep(6);
  } catch (e) {
    console.error(e);
    pendingCheckoutRef = "";
    qbSwalFire({
      icon: "error",
      title: "保存に失敗しました",
      html: e.message || String(e),
      confirmButtonColor: "#2f8a96",
    });
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevLabel;
    }
  }
}

function goCheckout() {
  const amount = getPriceYen();
  const params = new URLSearchParams({
    ref: pendingCheckoutRef,
    amount: String(amount),
    tier: getTier(),
    format: getFormat(),
    payment_method: getPaymentMethod(),
  });
  if (getTier() === "premium") {
    params.set("coach", getSelectedCoachId());
  }

  const url = CHECKOUT_BASE_URL.includes("?")
    ? `${CHECKOUT_BASE_URL}&${params}`
    : `${CHECKOUT_BASE_URL}?${params}`;
  window.location.href = url;
}

function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  if (!payment) return;

  const ref = params.get("ref") || "";
  window.history.replaceState({}, "", window.location.pathname);

  if (payment === "success") {
    qbSwalFire({
      icon: "success",
      title: "お支払いが完了しました",
      html: `<p style="text-align:left;font-size:0.9rem;color:#44403c;line-height:1.55">ご質問を受け付けました。コーチからの回答はマイページで確認できます。</p>
        <p style="text-align:left;font-size:0.85rem;color:#78716c;margin-top:0.75rem"><strong>お問い合わせ番号:</strong> ${ref}</p>`,
      confirmButtonColor: "#2f8a96",
    });
    return;
  }

  if (payment === "already_paid") {
    qbSwalFire({
      icon: "info",
      title: "すでにお支払い済みです",
      text: ref ? `お問い合わせ番号: ${ref}` : "",
      confirmButtonColor: "#2f8a96",
    });
    return;
  }

  if (payment === "cancelled") {
    qbSwalFire({
      icon: "warning",
      title: "決済がキャンセルされました",
      text: "もう一度お試しください。",
      confirmButtonColor: "#2f8a96",
    });
    return;
  }

  qbSwalFire({
    icon: "info",
    title: "決済を確認中です",
    text: "反映に時間がかかる場合があります。しばらくしてからマイページをご確認ください。",
    confirmButtonColor: "#2f8a96",
  });
}

function initListeners() {
  document.querySelectorAll('input[name="tier"]').forEach((r) => {
    r.addEventListener("change", () => {
      updateFormatPrices();
    });
  });
  document.querySelectorAll('input[name="format"]').forEach((r) => {
    r.addEventListener("change", () => {
      updateFormatPrices();
      updateVideoVisibility();
    });
  });
}

window.goStep = goStep;
window.submitToCoach = submitToCoach;
window.goCheckout = goCheckout;

document.addEventListener("DOMContentLoaded", () => {
  updateFormatPrices();
  updateVideoVisibility();
  setStepIndicator(1);
  initListeners();
  handlePaymentReturn();
});
