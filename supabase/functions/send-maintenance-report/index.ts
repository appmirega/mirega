import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  clientName: string;
  elevatorInfo: string;
  period: string;
  folio: number;
  pdfBase64: string;
  fileName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const requestData: EmailRequest = await req.json();
    const { to, clientName, elevatorInfo, period, folio, pdfBase64, fileName } = requestData;

    if (!to || !clientName || !pdfBase64 || !fileName) {
      return new Response(
        JSON.stringify({ error: "Faltan datos requeridos" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Email request received:", {
      to,
      clientName,
      elevatorInfo,
      period,
      folio,
      fileName,
      pdfSize: pdfBase64.length,
    });

    // OPCIÓN 1: Usar Resend (Recomendado - más fácil)
    /*
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "MIREGA Ascensores <noreply@tudominio.com>",
        to: [to],
        subject: `Informe de Mantenimiento - Folio ${folio}`,
        html: `
          <h2>Informe de Mantenimiento de Ascensor</h2>
          <p>Estimado/a <strong>${clientName}</strong>,</p>
          <p>Adjunto encontrará el informe de mantenimiento correspondiente a:</p>
          <ul>
            <li><strong>Ascensor:</strong> ${elevatorInfo}</li>
            <li><strong>Periodo:</strong> ${period}</li>
            <li><strong>Folio:</strong> ${folio}</li>
          </ul>
          <p>Cualquier consulta, no dude en contactarnos.</p>
          <p>Saludos cordiales,<br/><strong>MIREGA Ascensores</strong></p>
        `,
        attachments: [{
          filename: fileName,
          content: pdfBase64,
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Error al enviar correo: ${await response.text()}`);
    }
    */

    // OPCIÓN 2: Usar SendGrid
    /*
    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: "noreply@tudominio.com", name: "MIREGA Ascensores" },
        subject: `Informe de Mantenimiento - Folio ${folio}`,
        content: [{
          type: "text/html",
          value: `
            <h2>Informe de Mantenimiento de Ascensor</h2>
            <p>Estimado/a <strong>${clientName}</strong>,</p>
            <p>Adjunto encontrará el informe de mantenimiento correspondiente a:</p>
            <ul>
              <li><strong>Ascensor:</strong> ${elevatorInfo}</li>
              <li><strong>Periodo:</strong> ${period}</li>
              <li><strong>Folio:</strong> ${folio}</li>
            </ul>
            <p>Cualquier consulta, no dude en contactarnos.</p>
            <p>Saludos cordiales,<br/><strong>MIREGA Ascensores</strong></p>
          `,
        }],
        attachments: [{
          content: pdfBase64,
          filename: fileName,
          type: "application/pdf",
          disposition: "attachment",
        }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Error al enviar correo: ${await response.text()}`);
    }
    */

    await new Promise(resolve => setTimeout(resolve, 1000));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Correo registrado exitosamente (modo demo)",
        note: "Configure un servicio de correo para envíos reales",
        details: {
          to,
          fileName,
          folio,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in send-maintenance-report function:", error);
    return new Response(
      JSON.stringify({
        error: "Error al procesar la solicitud",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
