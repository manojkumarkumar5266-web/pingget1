import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "PingGet <noreply@pingget.com>";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, subject, html, text, type, data } = await req.json();

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "to and subject are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build email content based on type
    let emailHtml = html;
    let emailText = text;

    if (!emailHtml && type) {
      const templates: Record<string, { subject: string; html: string; text: string }> = {
        welcome: {
          subject: "Welcome to PingGet!",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f4f7ee;border-radius:16px;overflow:hidden">
            <div style="background:#1c2a14;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:24px">Welcome to PingGet!</h1></div>
            <div style="padding:24px"><p style="color:#333;font-size:16px">Hi ${data?.name || 'there'},</p>
            <p style="color:#555;font-size:14px;line-height:1.6">Your PingGet account has been created successfully. ${data?.role === 'dp' ? 'Your delivery partner application is pending admin approval. You will be notified once approved.' : 'You can now start placing delivery requests.'}</p>
            <a href="${data?.app_url || 'https://pingget.app'}" style="display:inline-block;background:#556d34;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">Open PingGet</a>
            <p style="color:#999;font-size:12px;margin-top:24px">PingGet - Delivery, Get It!</p></div></div>`,
          text: `Welcome to PingGet! Hi ${data?.name || 'there'}, your account has been created.`,
        },
        dp_approved: {
          subject: "Your PingGet DP Account is Approved!",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f4f7ee;border-radius:16px;overflow:hidden">
            <div style="background:#1c2a14;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">You're Approved!</h1></div>
            <div style="padding:24px"><p style="color:#333;font-size:16px">Hi ${data?.name || 'Partner'},</p>
            <p style="color:#555;font-size:14px;line-height:1.6">Congratulations! Your delivery partner account has been approved. You can now go online and start accepting delivery requests.</p>
            <a href="${data?.app_url || 'https://pingget.app'}" style="display:inline-block;background:#556d34;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">Start Delivering</a></div></div>`,
          text: `Hi ${data?.name || 'Partner'}, your DP account is approved! You can now go online and start accepting requests.`,
        },
        dp_rejected: {
          subject: "PingGet DP Application Update",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f4f7ee;border-radius:16px;overflow:hidden">
            <div style="background:#1c2a14;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Application Update</h1></div>
            <div style="padding:24px"><p style="color:#333;font-size:16px">Hi ${data?.name || 'Partner'},</p>
            <p style="color:#555;font-size:14px;line-height:1.6">Unfortunately, your delivery partner application was not approved at this time. ${data?.reason ? `Reason: ${data.reason}` : 'Please contact support for more details.'}</p></div></div>`,
          text: `Hi ${data?.name || 'Partner'}, your DP application was not approved. Please contact support.`,
        },
        request_accepted: {
          subject: "Your Delivery Request was Accepted!",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f4f7ee;border-radius:16px;overflow:hidden">
            <div style="background:#1c2a14;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Request Accepted!</h1></div>
            <div style="padding:24px"><p style="color:#333;font-size:16px">Hi ${data?.name || 'there'},</p>
            <p style="color:#555;font-size:14px;line-height:1.6">${data?.dp_name || 'A delivery partner'} accepted your request "${data?.title || ''}". Open the app to chat with your delivery partner.</p>
            <a href="${data?.app_url || 'https://pingget.app'}" style="display:inline-block;background:#556d34;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">Open Chat</a></div></div>`,
          text: `Your request "${data?.title || ''}" was accepted by ${data?.dp_name || 'a delivery partner'}.`,
        },
        quotation_received: {
          subject: "New Quotation Received",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f4f7ee;border-radius:16px;overflow:hidden">
            <div style="background:#1c2a14;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Quotation Received</h1></div>
            <div style="padding:24px"><p style="color:#333;font-size:16px">Hi ${data?.name || 'there'},</p>
            <p style="color:#555;font-size:14px;line-height:1.6">${data?.dp_name || 'Your delivery partner'} sent you a quotation. Item cost: ${data?.item_cost || 'N/A'}, Delivery charge: ${data?.delivery_charge || 'N/A'}. Open the app to accept or reject.</p></div></div>`,
          text: `Quotation from ${data?.dp_name || 'DP'}: Item ${data?.item_cost || 'N/A'}, Delivery ${data?.delivery_charge || 'N/A'}.`,
        },
        order_completed: {
          subject: "Order Completed - Rate Your Experience",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f4f7ee;border-radius:16px;overflow:hidden">
            <div style="background:#1c2a14;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Order Completed!</h1></div>
            <div style="padding:24px"><p style="color:#333;font-size:16px">Hi ${data?.name || 'there'},</p>
            <p style="color:#555;font-size:14px;line-height:1.6">Your delivery has been completed. Please rate your experience with ${data?.dp_name || 'your delivery partner'}.</p></div></div>`,
          text: `Your order is completed. Please rate your delivery partner.`,
        },
        password_reset: {
          subject: "PingGet Password Reset",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f4f7ee;border-radius:16px;overflow:hidden">
            <div style="background:#1c2a14;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Password Reset</h1></div>
            <div style="padding:24px"><p style="color:#333;font-size:16px">Hi ${data?.name || 'there'},</p>
            <p style="color:#555;font-size:14px;line-height:1.6">We received a request to reset your PingGet password. Click the button below to set a new password. This link will expire in 1 hour.</p>
            <a href="${data?.reset_url || ''}" style="display:inline-block;background:#556d34;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">Reset Password</a>
            <p style="color:#999;font-size:12px;margin-top:16px">If you didn't request this, you can safely ignore this email. Your password remains unchanged.</p></div></div>`,
          text: `Reset your PingGet password: ${data?.reset_url || 'Contact support'}`,
        },
        account_status: {
          subject: `PingGet Account - ${data?.status || 'Update'}`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#f4f7ee;border-radius:16px;overflow:hidden">
            <div style="background:#1c2a14;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:22px">Account Update</h1></div>
            <div style="padding:24px"><p style="color:#333;font-size:16px">Hi ${data?.name || 'there'},</p>
            <p style="color:#555;font-size:14px;line-height:1.6">Your PingGet account status has been updated to: <strong>${data?.status || 'updated'}</strong>. ${data?.status === 'suspended' ? 'You will not be able to sign in until this is resolved.' : data?.status === 'banned' ? 'Your account has been permanently banned.' : 'Your account is now active again.'}</p></div></div>`,
          text: `Your account status is now: ${data?.status || 'updated'}.`,
        },
      };

      const template = templates[type];
      if (template) {
        emailHtml = template.html;
        if (!text) emailText = template.text;
      }
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!resendResponse.ok) {
      const err = await resendResponse.text();
      console.error("Resend API error:", err);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resendResponse.json();
    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
