import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Issues one-time signed upload URLs for the public 'reels' bucket (social media video hosting).
// Auth: x-reels-token header whose SHA-256 must match TOKEN_SHA256. Service key never leaves the function.
const TOKEN_SHA256 = "9bfd179449bd4e15233c95db823c6a115265b0fcd4c8ab052c0e802f6c547a56";
const BUCKET = "reels";
const PATH_RE = /^[a-z0-9][a-z0-9_\-]{0,60}\/[A-Za-z0-9_\-]{1,80}\.(mp4|jpg|png)$/;

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const tok = req.headers.get("x-reels-token") ?? "";
  if (!tok || (await sha256(tok)) !== TOKEN_SHA256) return new Response("unauthorized", { status: 401 });
  let body: { path?: string };
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const path = body.path ?? "";
  if (!PATH_RE.test(path)) return new Response("bad path", { status: 400 });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: b } = await sb.storage.getBucket(BUCKET);
  if (!b) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 52428800, allowedMimeTypes: ["video/mp4", "image/jpeg", "image/png"] });
    if (error) return new Response("bucket: " + error.message, { status: 500 });
  }
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error) return new Response("sign: " + error.message, { status: 500 });
  const publicUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return Response.json({ signedUrl: data.signedUrl, publicUrl });
});
