import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface UpdatePasswordRequest {
  user_id: string;
  new_password: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: currentUser }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !currentUser) {
      throw new Error("Unauthorized");
    }

    const { data: currentProfile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (!currentProfile || currentProfile.role !== "developer") {
      throw new Error("Insufficient permissions - Developer role required");
    }

    const requestData: UpdatePasswordRequest = await req.json();

    const { data, error: updateError } = await supabaseClient.auth.admin.updateUserById(
      requestData.user_id,
      { password: requestData.new_password }
    );

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contraseña actualizada exitosamente",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("Error updating password:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});