#!/usr/bin/env node

const crypto = require("node:crypto");

const RETENTION_DAYS = 90;
const TARGET_TAG = "auto_delete_90d";
const MAX_RESULTS = 500;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function buildSignature(params, apiSecret) {
  const payload = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

async function cloudinaryPostJson(url, params, creds) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildSignature({ ...params, timestamp }, creds.apiSecret);
  const body = {
    ...params,
    api_key: creds.apiKey,
    timestamp,
    signature,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok || data.error) {
    const message = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Cloudinary API error: ${message}`);
  }
  return data;
}

function buildCutoffIso(days) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return cutoff.toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function listTargetPublicIds(creds, cutoffIso) {
  const endpoint = `https://api.cloudinary.com/v1_1/${creds.cloudName}/resources/search`;
  const expression = `resource_type:video AND tags=${TARGET_TAG} AND created_at<${cutoffIso}`;
  const ids = [];
  let nextCursor = null;

  do {
    const data = await cloudinaryPostJson(
      endpoint,
      {
        expression,
        max_results: MAX_RESULTS,
        next_cursor: nextCursor || undefined,
      },
      creds
    );

    for (const resource of data.resources || []) {
      if (resource.public_id) ids.push(resource.public_id);
    }
    nextCursor = data.next_cursor || null;
  } while (nextCursor);

  return ids;
}

async function deleteByPublicIds(creds, publicIds) {
  if (!publicIds.length) return { deleted_counts: 0 };

  const endpoint = `https://api.cloudinary.com/v1_1/${creds.cloudName}/resources/video/upload`;
  let deleted = 0;

  for (let i = 0; i < publicIds.length; i += 100) {
    const chunk = publicIds.slice(i, i + 100);
    const data = await cloudinaryPostJson(
      endpoint,
      {
        public_ids: chunk.join(","),
        invalidate: true,
      },
      creds
    );
    deleted += Object.keys(data.deleted || {}).length;
  }

  return { deleted_counts: deleted };
}

async function main() {
  const creds = {
    cloudName: requiredEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: requiredEnv("CLOUDINARY_API_KEY"),
    apiSecret: requiredEnv("CLOUDINARY_API_SECRET"),
  };

  const cutoffIso = buildCutoffIso(RETENTION_DAYS);
  console.log(`Searching Cloudinary videos with tag "${TARGET_TAG}" older than ${cutoffIso}`);

  const targetIds = await listTargetPublicIds(creds, cutoffIso);
  console.log(`Found ${targetIds.length} candidate video(s)`);

  if (!targetIds.length) {
    console.log("No old tagged videos to delete.");
    return;
  }

  const result = await deleteByPublicIds(creds, targetIds);
  console.log(`Deleted ${result.deleted_counts} video(s).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
