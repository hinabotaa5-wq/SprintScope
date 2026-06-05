import { supabase } from "./supabase-client.js";

const API_BASE = window.SPRINT_API_BASE || "http://localhost:8080";

async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

async function authHeaderOnly() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

export async function apiFetch(path, options = {}) {
    const headers = await authHeaders();
    const method = options.method || "GET";
    const merged = { ...options, headers: { ...headers, ...(options.headers || {}) } };
    const res = await fetch(`${API_BASE}${path}`, merged);
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }
    if (!res.ok) {
        const message = json?.message || `HTTP ${res.status}`;
        console.error("[apiFetch] request failed", {
            method,
            path,
            status: res.status,
            responseBody: text,
        });
        const err = new Error(message);
        err.status = res.status;
        err.body = text;
        throw err;
    }
    return json;
}

export async function apiUploadVideo(file, tags = "auto_delete_90d") {
    const headers = await authHeaderOnly();
    const form = new FormData();
    form.append("file", file);
    form.append("tags", tags);
    const res = await fetch(`${API_BASE}/api/uploads/video`, {
        method: "POST",
        headers,
        body: form,
    });
    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }
    if (!res.ok) {
        console.error("[apiUploadVideo] request failed", {
            status: res.status,
            responseBody: text,
        });
        throw new Error(json?.message || `HTTP ${res.status}`);
    }
    return json;
}
