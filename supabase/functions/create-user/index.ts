// supabase/functions/create-user/index.ts

import { createClient } from "npm:@supabase/supabase-js@2";

// Helper para CORS
const buildHeaders = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = buildHeaders(origin);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers });
  }

  // Solo POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers },
    );
  }

  // LEER SECRETS (Edge Function Secrets en Supabase)
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Edge Function Secrets",
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: "Server configuration error",
      }),
      { status: 500, headers },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Leer body
  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    console.error("JSON inválido en create-user:", e);
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers },
    );
  }

  const { email, password, full_name, phone, role } = body || {};

  if (!email || !password) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "email y password son obligatorios",
      }),
      { status: 400, headers },
    );
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || "",
        phone: phone || "",
        role: role || "client",
      },
    });

    if (error || !data?.user) {
      console.error("Error creando usuario:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error?.message || "No se pudo crear el usuario",
        }),
        { status: 500, headers },
      );
    }

    return new Response(
      JSON.stringify({ success: true, user: data.user }),
      { status: 200, headers },
    );
  } catch (e) {
    console.error("Excepción en create-user:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unexpected server error",
      }),
      { status: 500, headers },
    );
  }
});

