// ============================================================
// BARKMEDIA CONTACT FORM — VERCEL API
// ============================================================
// File path in your Vercel repo: /api/contact.js
//
// Receives submissions from the Squarespace contact form and:
//   1. Emails the submission to BARKmedia (NOTIFY_EMAIL)
//   2. Sends the submitter a confirmation auto-reply
//
// Required environment variables (set in Vercel dashboard):
//   RESEND_API_KEY          - Your Resend API key
//   NOTIFY_EMAIL            - Where you want contact notifications sent (e.g. hello@barkmediasolutions.com)
//   FROM_EMAIL              - Verified sender (e.g. scorecard@barkmediasolutions.com)
//
// Optional:
//   ALLOWED_ORIGIN          - For CORS (default: https://barkmediasolutions.com)
// ============================================================

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Simple in-memory rate limit (per-IP).
// For production scale, swap for Vercel KV or Upstash Redis.
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // max 5 submissions per IP per hour

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

    if (now > entry.resetAt) {
        // Window expired, reset
        entry.count = 1;
        entry.resetAt = now + RATE_LIMIT_WINDOW_MS;
    } else {
        entry.count++;
    }

    rateLimitMap.set(ip, entry);

    // Cleanup old entries occasionally
    if (rateLimitMap.size > 1000) {
        for (const [key, val] of rateLimitMap.entries()) {
            if (now > val.resetAt) rateLimitMap.delete(key);
        }
    }

    return entry.count <= RATE_LIMIT_MAX;
}

// HTML escape helper for email bodies
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ============================================================
// EMAIL TEMPLATES
// ============================================================

function buildNotificationEmail(data) {
    const { name, email, phone, company, website, subject, message, submittedAt } = data;

    const row = (label, value, isLink) => {
        if (!value) return '';
        const cell = isLink === 'email'
            ? `<a href="mailto:${escapeHtml(value)}" style="color: #2563eb;">${escapeHtml(value)}</a>`
            : isLink === 'tel'
                ? `<a href="tel:${escapeHtml(value)}" style="color: #2563eb;">${escapeHtml(value)}</a>`
                : isLink === 'url'
                    ? `<a href="${escapeHtml(value)}" style="color: #2563eb;">${escapeHtml(value)}</a>`
                    : escapeHtml(value);
        return `<tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280; width: 30%; vertical-align: top;">${escapeHtml(label)}</td><td style="padding: 12px 16px; font-size: 14px; font-weight: 500; color: #171717;">${cell}</td></tr>`;
    };

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
    <div style="max-width: 640px; margin: 0 auto; background: white; padding: 32px;">
        <div style="background: linear-gradient(135deg, #2563eb, #ec4899); color: white; padding: 28px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.9; margin-bottom: 8px;">New Contact Form Submission</div>
            <div style="font-size: 22px; font-weight: 800; line-height: 1.2;">${escapeHtml(subject || 'General enquiry')}</div>
        </div>

        <h2 style="margin: 0 0 16px; font-size: 18px; color: #171717;">Contact Details</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #fafafa; border-radius: 8px; overflow: hidden;">
            ${row('Name', name)}
            ${row('Email', email, 'email')}
            ${row('Phone', phone, 'tel')}
            ${row('Company', company)}
            ${row('Website', website, 'url')}
            ${row('Subject', subject)}
            ${row('Submitted', submittedAt ? new Date(submittedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' }) + ' CT' : '')}
        </table>

        ${message ? `
        <h2 style="margin: 24px 0 12px; font-size: 18px; color: #171717;">Message</h2>
        <div style="padding: 18px 20px; background: white; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 15px; line-height: 1.6; color: #171717; white-space: pre-wrap;">${escapeHtml(message)}</div>
        ` : ''}

        <div style="margin-top: 28px; padding: 20px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 8px;">
            <div style="font-size: 14px; color: #1e40af; font-weight: 600; margin-bottom: 8px;">Recommended next step:</div>
            <div style="font-size: 14px; color: #171717; line-height: 1.6;">
                Reply within one business day — that's what the form promises them.
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

function buildConfirmationEmail(data) {
    const { name } = data;
    const firstName = (name || '').split(' ')[0] || 'there';

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#2563eb" align="center" style="background-color: #2563eb; padding: 36px 32px;">
                <div style="font-size: 22px; font-weight: 800; color: #ffffff;">Thanks for reaching out.</div>
            </td></tr>
        </table>
        <div style="padding: 32px;">
            <p style="font-size: 16px; color: #171717; margin: 0 0 20px;">Hi ${escapeHtml(firstName)},</p>
            <p style="font-size: 16px; color: #374151; margin: 0 0 20px; line-height: 1.65;">Thanks for getting in touch with BARKmedia. We've received your message and one of us — Jared or Angela — will get back to you within one business day.</p>
            <p style="font-size: 16px; color: #374151; margin: 0 0 20px; line-height: 1.65;">If it's easier to just grab a time to talk, you can book a call here:</p>
            <p style="margin: 0 0 28px;"><a href="https://calendly.com/barkmediasolutions/discovery" style="display: inline-block; background: #ec4899; color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 15px;">Book a Call &rarr;</a></p>
            <div style="padding-top: 24px; border-top: 1px solid #e5e5e5; font-size: 14px; color: #6b7280; line-height: 1.6;">
                <p style="margin: 0 0 8px;">Talk soon,</p>
                <p style="margin: 0;">&mdash; Jared &amp; Angela Barker, BARKmedia Solutions</p>
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://barkmediasolutions.com';

    // CORS
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get IP for rate limiting
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
                || req.headers['x-real-ip']
                || 'unknown';

        if (!checkRateLimit(ip)) {
            return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
        }

        const payload = req.body || {};

        // Honeypot check — bots fill this, humans don't
        if (payload.honeypot && payload.honeypot.trim() !== '') {
            // Silently accept, don't send emails
            return res.status(200).json({ success: true });
        }

        const name = (payload.name || '').trim();
        const email = (payload.email || '').trim();
        const company = (payload.company || '').trim();
        const subject = (payload.subject || '').trim();
        const phone = (payload.phone || '').trim();
        const website = (payload.website || '').trim();
        const message = (payload.message || '').trim();

        // Basic validation — mirror the front-end's required fields
        if (!name || !email || !company || !subject) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email' });
        }

        const fromEmail = process.env.FROM_EMAIL || 'scorecard@barkmediasolutions.com';
        const notifyEmail = process.env.NOTIFY_EMAIL || 'hello@barkmediasolutions.com';

        const data = { name, email, phone, company, website, subject, message, submittedAt: new Date().toISOString() };

        // Send notification to BARKmedia
        const notificationPromise = resend.emails.send({
            from: `BARKmedia Contact <${fromEmail}>`,
            to: notifyEmail,
            replyTo: email,
            subject: `New Contact: ${name}${company ? ` (${company})` : ''} — ${subject}`,
            html: buildNotificationEmail(data)
        });

        // Send confirmation to the submitter
        const confirmationPromise = resend.emails.send({
            from: `Jared & Angela at BARKmedia <${fromEmail}>`,
            to: email,
            replyTo: notifyEmail,
            subject: `Thanks for reaching out to BARKmedia`,
            html: buildConfirmationEmail(data)
        });

        // Send both in parallel
        const [notifyResult, confirmResult] = await Promise.allSettled([
            notificationPromise,
            confirmationPromise
        ]);

        // Log any errors but don't fail the whole request — at least one email might have gone through
        if (notifyResult.status === 'rejected') {
            console.error('Contact notification email failed:', notifyResult.reason);
        }
        if (confirmResult.status === 'rejected') {
            console.error('Contact confirmation email failed:', confirmResult.reason);
        }

        // If the notification to us failed, treat it as an error — that's the one that matters most
        if (notifyResult.status === 'rejected') {
            return res.status(500).json({ error: 'Email delivery failed' });
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('Contact handler error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
