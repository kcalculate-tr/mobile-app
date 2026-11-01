// Uploads Instagram/Metricool images into the public-read `social-media` bucket.
// Auth: x-upload-token header whose SHA-256 must match TOKEN_SHA256. Only jpeg/png, max 8 MB,
// paths limited to [a-z0-9/_-] + .jpg/.jpeg/.png. Writes nowhere else.
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN_SHA256 = "715ace24f9e322ed3d58b45c84e7789ed26c0b24368de8b8aeca4a7296cf27d8";
const BUCKET = "social-media";
const MAX = 8 * 1024 * 1024;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  const token = req.headers.get("x-upload-token") ?? "";
  if (!token || (await sha256(token)) !== TOKEN_SHA256) return json(401, { error: "unauthorized" });

  const path = new URL(req.url).searchParams.get("path") ?? "";
  if (!/^[a-z0-9][a-z0-9/_-]{0,120}\.(jpg|jpeg|png)$/.test(path) || path.includes("..")) {
    return json(400, { error: "bad path" });
  }
  const type = req.headers.get("content-type") ?? "";
  if (type !== "image/jpeg" && type !== "image/png") return json(400, { error: "bad type" });

  const body = new Uint8Array(await req.arrayBuffer());
  if (body.length === 0 || body.length > MAX) return json(400, { error: "bad size" });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, { contentType: type, upsert: true });
  if (error) return json(500, { error: error.message });
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return json(200, { url: data.publicUrl });
});
