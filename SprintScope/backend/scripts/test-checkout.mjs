/**
 * 決済フローの疎通確認（backend/.env を使用、秘密情報は出力しない）
 * 使い方:
 *   cd backend/scripts && npm install && npm run test-checkout
 */
import { config } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(scriptDir, "../.env") });

const apiBase = (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 8080}`).replace(/\/$/, "");
const testRef = `QB-TEST-${Date.now().toString(36)}`;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を backend/.env に設定してください");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, ""),
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  console.log("[1/4] Health check...");
  const health = await fetch(`${apiBase}/healthz`);
  const healthJson = await health.json();
  console.log("  OK:", healthJson.status);

  console.log("[2/4] Insert test question...");
  const { data: row, error } = await supabase
    .from("questions")
    .insert({
      tier: "standard",
      format: "text",
      question_text: "決済テスト用（自動削除可）",
      amount_yen: 100,
      payment_ref: testRef,
      questioner_uid: "payment-test-script",
      payment_status: "pending",
    })
    .select("id,payment_ref,amount_yen")
    .single();

  if (error) {
    console.error("  FAILED:", error.message);
    if (error.message.includes("payment_status")) {
      console.error("  → Supabase で supabase_questions.sql の payment カラム追加を実行してください");
    }
    process.exit(1);
  }
  console.log("  OK: ref =", row.payment_ref);

  console.log("[3/4] Checkout redirect (KOMOJU session)...");
  const checkoutUrl = `${apiBase}/api/checkout/komoju?ref=${encodeURIComponent(testRef)}&amount=100&tier=standard&format=text&payment_method=card`;
  const checkoutRes = await fetch(checkoutUrl, { redirect: "manual" });

  if (checkoutRes.status === 302 || checkoutRes.status === 301) {
    const location = checkoutRes.headers.get("location") || "";
    const isKomoju = location.includes("komoju.com");
    console.log("  OK: redirect to KOMOJU =", isKomoju);
    if (isKomoju) {
      console.log("  URL prefix:", location.slice(0, 60) + "...");
    } else {
      console.log("  Location:", location);
    }
  } else {
    const text = await checkoutRes.text();
    console.error("  FAILED: HTTP", checkoutRes.status);
    console.error("  ", text.slice(0, 200));
    process.exit(1);
  }

  console.log("[4/4] Cleanup test row...");
  await supabase.from("questions").delete().eq("payment_ref", testRef);
  console.log("  OK: deleted");

  console.log("\n✓ 決済周りの疎通確認に成功しました");
  console.log("  ブラウザでの確認: http://127.0.0.1:5500/question-box/pages/questioner.html");
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
