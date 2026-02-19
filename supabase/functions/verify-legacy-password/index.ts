import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// WordPress phpass portable hash verification
// Implements the iterated MD5 scheme used by WordPress ($P$ / $H$ prefix)
const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

async function md5Binary(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("MD5", data);
  return new Uint8Array(hash);
}

function encodePhpass(input: Uint8Array, count: number): string {
  let output = "";
  let i = 0;
  do {
    let value = input[i++];
    output += ITOA64[value & 0x3f];
    if (i < count) value |= input[i] << 8;
    output += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) value |= input[i] << 16;
    output += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    output += ITOA64[(value >> 18) & 0x3f];
  } while (i < count);
  return output;
}

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function checkPhpassHash(password: string, storedHash: string): Promise<boolean> {
  // WordPress uses $P$ or $H$ prefix
  if (!storedHash.startsWith("$P$") && !storedHash.startsWith("$H$")) {
    return false;
  }

  const countLog2 = ITOA64.indexOf(storedHash[3]);
  if (countLog2 < 7 || countLog2 > 30) return false;

  let count = 1 << countLog2;
  const salt = storedHash.substring(4, 12);

  const passwordBytes = textToBytes(password);
  const saltBytes = textToBytes(salt);

  let hash = await md5Binary(concatBytes(saltBytes, passwordBytes));
  do {
    hash = await md5Binary(concatBytes(hash, passwordBytes));
  } while (--count > 0);

  const encoded = "$P$" + storedHash[3] + salt + encodePhpass(hash, 16);
  
  // Constant-time comparison
  if (encoded.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < encoded.length; i++) {
    diff |= encoded.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Find profile with legacy hash
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("user_id, legacy_password_hash")
      .eq("email", email.toLowerCase().trim())
      .not("legacy_password_hash", "is", null)
      .single();

    if (profileError || !profile || !profile.legacy_password_hash) {
      return new Response(
        JSON.stringify({ verified: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify against WordPress hash
    const isValid = await checkPhpassHash(password, profile.legacy_password_hash);

    if (!isValid) {
      return new Response(
        JSON.stringify({ verified: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Password matches! Update the auth user's password to the new one
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      profile.user_id,
      { password }
    );

    if (updateError) {
      console.error("Failed to migrate password:", updateError.message);
      return new Response(
        JSON.stringify({ verified: false, error: "Migration failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clear the legacy hash since password is now migrated
    await adminClient
      .from("profiles")
      .update({ legacy_password_hash: null })
      .eq("user_id", profile.user_id);

    return new Response(
      JSON.stringify({ verified: true, migrated: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
