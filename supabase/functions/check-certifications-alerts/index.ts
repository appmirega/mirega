import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: checklists, error: checklistsError } = await supabaseClient
      .from("mnt_checklists")
      .select(`
        id,
        next_certification_date,
        certification_not_legible,
        clients (
          business_name,
          profiles (
            id,
            full_name
          )
        ),
        elevators (
          brand,
          model,
          serial_number
        )
      `)
      .not("next_certification_date", "is", null)
      .eq("certification_not_legible", false);

    if (checklistsError) throw checklistsError;

    const today = new Date();
    const alertsToCreate: any[] = [];

    const uniqueElevators = new Map();
    checklists?.forEach((checklist: any) => {
      const elevatorId = checklist.elevators?.id;
      if (!elevatorId) return;

      const existing = uniqueElevators.get(elevatorId);
      if (!existing || (checklist.next_certification_date &&
          (!existing.next_certification_date ||
           new Date(checklist.next_certification_date) > new Date(existing.next_certification_date)))) {
        uniqueElevators.set(elevatorId, checklist);
      }
    });

    Array.from(uniqueElevators.values()).forEach((checklist: any) => {
      if (!checklist.next_certification_date) return;

      const nextDate = new Date(checklist.next_certification_date);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      const alertThresholds = [120, 90, 30, 7];
      const matchingThreshold = alertThresholds.find(
        (threshold) => diffDays <= threshold && diffDays > threshold - 1
      );

      if (matchingThreshold) {
        const elevator = `${checklist.elevators?.brand} ${checklist.elevators?.model} (S/N: ${checklist.elevators?.serial_number})`;
        const client = checklist.clients?.business_name || "Cliente";

        const { data: existingNotification } = supabaseClient
          .from("notifications")
          .select("id")
          .eq("user_id", checklist.clients?.profiles?.id)
          .eq("type", "warning")
          .gte("created_at", new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString())
          .like("title", `%Certificación%${matchingThreshold}%`);

        if (!existingNotification || existingNotification.length === 0) {
          let message = "";
          let urgency = "warning";

          if (diffDays <= 0) {
            message = `La certificación del ascensor ${elevator} ha VENCIDO. Debe renovarse inmediatamente.`;
            urgency = "error";
          } else if (diffDays <= 7) {
            message = `URGENTE: La certificación del ascensor ${elevator} vence en ${diffDays} día(s). Coordine la renovación de inmediato.`;
            urgency = "error";
          } else if (diffDays <= 30) {
            message = `La certificación del ascensor ${elevator} vence en ${diffDays} días. Por favor coordine la renovación pronto.`;
          } else {
            message = `La certificación del ascensor ${elevator} vence en ${diffDays} días. Es recomendable comenzar a coordinar la renovación.`;
          }

          const profiles = checklist.clients?.profiles || [];
          if (Array.isArray(profiles)) {
            profiles.forEach((profile: any) => {
              alertsToCreate.push({
                user_id: profile.id,
                type: urgency,
                title: `Certificación: Faltan ${diffDays} días`,
                message: message,
                link: "certifications",
                read: false,
              });
            });
          } else if (profiles.id) {
            alertsToCreate.push({
              user_id: profiles.id,
              type: urgency,
              title: `Certificación: Faltan ${diffDays} días`,
              message: message,
              link: "certifications",
              read: false,
            });
          }
        }
      }
    });

    if (alertsToCreate.length > 0) {
      const { error: insertError } = await supabaseClient
        .from("notifications")
        .insert(alertsToCreate);

      if (insertError) {
        console.error("Error inserting notifications:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alertsCreated: alertsToCreate.length,
        message: `Created ${alertsToCreate.length} certification alerts`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in check-certifications-alerts function:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});