// ============================================================
// BARKMEDIA LOCAL VISIBILITY SCORECARD — VERCEL API
// ============================================================
// File path in your Vercel repo: /api/scorecard.js
//
// Required environment variables (set in Vercel dashboard):
//   RESEND_API_KEY          - Your Resend API key
//   NOTIFY_EMAIL            - Where you want lead notifications sent (e.g. hello@barkmediasolutions.com)
//   FROM_EMAIL              - Verified sender (e.g. scorecard@barkmediasolutions.com)
//   CALENDLY_URL            - Your booking URL (https://barkmediasolutions.com/intro)
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

function buildNotificationEmail(payload) {
    const { contact, score, tier, answers, submittedAt } = payload;
    const tierLabels = {
        beSeen: 'BE SEEN (0–4)',
        getLeads: 'GET LEADS (5–7)',
        dominate: 'DOMINATE LOCALLY (8–10)'
    };

    const answerRows = Object.values(answers).map(a => `
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; vertical-align: top; font-size: 14px; color: #6b7280; width: 50%;">
                ${escapeHtml(a.question)}
            </td>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; vertical-align: top; font-size: 14px; color: #171717; font-weight: 500;">
                ${escapeHtml(a.answer)}
            </td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
    <div style="max-width: 640px; margin: 0 auto; background: white; padding: 32px;">
        <div style="background: linear-gradient(135deg, #2563eb, #ec4899); color: white; padding: 28px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.9; margin-bottom: 8px;">New Scorecard Submission</div>
            <div style="font-size: 36px; font-weight: 800; line-height: 1;">${score} / 10</div>
            <div style="font-size: 14px; opacity: 0.95; margin-top: 8px;">Tier: ${tierLabels[tier] || tier}</div>
        </div>

        <h2 style="margin: 0 0 16px; font-size: 18px; color: #171717;">Lead Info</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #fafafa; border-radius: 8px; overflow: hidden;">
            <tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280; width: 30%;">Name</td><td style="padding: 12px 16px; font-size: 14px; font-weight: 600;">${escapeHtml(contact.name)}</td></tr>
            <tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Email</td><td style="padding: 12px 16px; font-size: 14px;"><a href="mailto:${escapeHtml(contact.email)}" style="color: #2563eb;">${escapeHtml(contact.email)}</a></td></tr>
            <tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Company</td><td style="padding: 12px 16px; font-size: 14px; font-weight: 600;">${escapeHtml(contact.company)}</td></tr>
            ${contact.phone ? `<tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Phone</td><td style="padding: 12px 16px; font-size: 14px;"><a href="tel:${escapeHtml(contact.phone)}" style="color: #2563eb;">${escapeHtml(contact.phone)}</a></td></tr>` : ''}
            <tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Submitted</td><td style="padding: 12px 16px; font-size: 14px;">${new Date(submittedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' })} CT</td></tr>
        </table>

        <h2 style="margin: 24px 0 16px; font-size: 18px; color: #171717;">Their Answers</h2>
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
            ${answerRows}
        </table>

        <div style="margin-top: 28px; padding: 20px; background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 8px;">
            <div style="font-size: 14px; color: #1e40af; font-weight: 600; margin-bottom: 8px;">Recommended next step:</div>
            <div style="font-size: 14px; color: #171717; line-height: 1.6;">
                Reach out within 24 hours. Reference their score and the gaps in their answers — don't pitch generically.
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

function buildProspectEmail(payload) {
    const { contact, score, tier } = payload;
    const calendlyUrl = process.env.CALENDLY_URL || 'https://barkmediasolutions.com/intro';

    const tierData = {
        beSeen: {
            tierName: "Let's Get You Seen!",
            tagline: "You're ready to start showing up online—we've got the blueprint.",
            headerColor: 'linear-gradient(135deg, #ec4899, #db2777)',
            keyGaps: [
                'Inactive or incomplete Google Business Profile',
                'No regular organic content',
                'No ad strategy in place',
                'Unclear brand messaging'
            ],
            quickWins: [
                'Fully claim and optimize your Google Business Profile',
                'Post 2–3 times per week on Facebook & Instagram',
                "Stay consistent — don't overcomplicate it"
            ],
            differentiator: [
                "Get visible in AI search (ChatGPT, Perplexity, Google AI Overviews) where most agencies aren't even looking",
                'Track your local visibility, calls, and rankings in a live dashboard'
            ],
            ctaTitle: 'Ready for support?',
            ctaText: 'Our BE SEEN package helps you get visible, fast — without the overwhelm.'
        },
        getLeads: {
            tierName: "Let's Get You Leads!",
            tagline: "Your foundation is set — now let's turn that into consistent growth.",
            headerColor: 'linear-gradient(135deg, #2563eb, #1e40af)',
            whatWeSee: [
                'Some social content, but not yet driving results',
                'Google Business Profile needs strategy',
                'Ads are running, but ROI is unclear',
                'Brand exists, but lacks standout identity'
            ],
            nextSteps: [
                'Launch Google LSA or Google Ads with clear targeting',
                'Add retargeting to stay top-of-mind',
                'Use Reels, TikTok, or Shorts to drive engagement',
                "Set up proper tracking to see what's actually working"
            ],
            differentiator: [
                'Show up in AI search results (ChatGPT, Perplexity, Google AI Overviews) — not just traditional Google',
                'See every call, lead, and ad dollar in a live dashboard updated daily',
                'Get full call tracking and recording across every channel'
            ],
            ctaTitle: 'Ready to grow?',
            ctaText: "Our GET LEADS package is designed to do exactly that. We'll guide you through it — no pressure."
        },
        dominate: {
            tierName: 'Dominate Your Market!',
            tagline: "You've built momentum — now it's time to take over locally.",
            headerColor: 'linear-gradient(135deg, #171717, #2a2a2a)',
            whatWeSee: [
                'Solid digital presence, but growth has plateaued',
                'Ads are live, but not fully optimized for local wins',
                'Brand is known, but not fully set apart',
                'Few systems in place to scale efficiently'
            ],
            nextSteps: [
                'Create searchable content with high-impact, scroll-stopping videos and SEO-rich posts',
                'Run advanced retargeting on Google & Facebook',
                'Incorporate UGC and customer stories for trust',
                'Set up an automated review system to boost social proof'
            ],
            differentiator: [
                'Own AI search visibility (ChatGPT, Perplexity, Google AI Overviews) before competitors catch on',
                'Live performance dashboard — every channel, every call, every dollar in one place',
                'Full call tracking, recording, and attribution across digital and offline media'
            ],
            ctaTitle: 'Want to dominate your market?',
            ctaText: "Our DOMINATE LOCALLY package is built to scale aggressively. Book a free growth call — we'll show you how."
        }
    };

    const data = tierData[tier];
    const firstName = contact.name.split(' ')[0];

    const renderList = (items) => items.map(item => `
        <li style="padding: 8px 0 8px 28px; position: relative; font-size: 15px; line-height: 1.55; color: #374151;">
            <span style="position: absolute; left: 0; color: #2563eb; font-weight: 700;">→</span>
            ${escapeHtml(item)}
        </li>
    `).join('');

    let sectionsHtml = '';

    if (tier === 'beSeen') {
        sectionsHtml = `
            <div style="background: #fafafa; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #171717;">Key Gaps</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">${renderList(data.keyGaps)}</ul>
            </div>
            <div style="background: #fafafa; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #171717;">Quick Wins</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">${renderList(data.quickWins)}</ul>
            </div>
            <div style="background: linear-gradient(135deg, #eff6ff, #fef3f8); border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #dbeafe;">
                <h3 style="margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #1e40af;">What BARKmedia Brings</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">${renderList(data.differentiator)}</ul>
            </div>
        `;
    } else {
        sectionsHtml = `
            <div style="background: #fafafa; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #171717;">What We're Seeing</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">${renderList(data.whatWeSee)}</ul>
            </div>
            <div style="background: #fafafa; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
                <h3 style="margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #171717;">Smart Next Steps</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">${renderList(data.nextSteps)}</ul>
            </div>
            <div style="background: linear-gradient(135deg, #eff6ff, #fef3f8); border-radius: 12px; padding: 24px; margin-bottom: 16px; border: 1px solid #dbeafe;">
                <h3 style="margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #1e40af;">What BARKmedia Brings</h3>
                <ul style="list-style: none; padding: 0; margin: 0;">${renderList(data.differentiator)}</ul>
            </div>
        `;
    }

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <div style="padding: 32px 32px 0;">
            <p style="font-size: 16px; color: #171717; margin: 0 0 24px;">Hi ${escapeHtml(firstName)},</p>
            <p style="font-size: 16px; color: #374151; margin: 0 0 24px; line-height: 1.6;">Thanks for taking the Local Visibility Scorecard. Here's where you stand and what we'd recommend next.</p>
        </div>

        <div style="background: ${data.headerColor}; color: white; padding: 36px 32px; text-align: center;">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.9; margin-bottom: 8px;">Your Score</div>
            <div style="font-size: 48px; font-weight: 800; line-height: 1; margin-bottom: 12px;">${score} / 10</div>
            <h2 style="font-size: 24px; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.01em;">${escapeHtml(data.tierName)}</h2>
            <p style="font-size: 16px; opacity: 0.95; margin: 0; line-height: 1.5;">${escapeHtml(data.tagline)}</p>
        </div>

        <div style="padding: 28px 32px;">
            ${sectionsHtml}

            <div style="background: #171717; color: white; padding: 28px; border-radius: 12px; text-align: center; margin-top: 20px;">
                <h3 style="font-size: 18px; font-weight: 700; margin: 0 0 10px; color: white;">${escapeHtml(data.ctaTitle)}</h3>
                <p style="opacity: 0.9; margin: 0 0 20px; font-size: 15px; line-height: 1.5;">${escapeHtml(data.ctaText)}</p>
                <a href="${escapeHtml(calendlyUrl)}" style="display: inline-block; background: #ec4899; color: white; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 15px;">Schedule a Free Call →</a>
            </div>

            <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #e5e5e5; font-size: 14px; color: #6b7280; line-height: 1.6;">
                <p style="margin: 0 0 8px;">Questions? Just reply to this email — it goes straight to us.</p>
                <p style="margin: 0;">— Jared & Angela Barker, BARKmedia Solutions</p>
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

        const payload = req.body;

        // Honeypot check — bots fill this, humans don't
        if (payload.honeypot && payload.honeypot.trim() !== '') {
            // Silently accept, don't send emails
            return res.status(200).json({ success: true });
        }

        // Basic validation
        if (!payload.contact || !payload.contact.email || !payload.contact.name || !payload.contact.company) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(payload.contact.email)) {
            return res.status(400).json({ error: 'Invalid email' });
        }

        if (typeof payload.score !== 'number' || !payload.tier) {
            return res.status(400).json({ error: 'Missing score or tier' });
        }

        const fromEmail = process.env.FROM_EMAIL || 'scorecard@barkmediasolutions.com';
        const notifyEmail = process.env.NOTIFY_EMAIL || 'jared@barkmediasolutions.com';

        // Send notification to BARKmedia
        const notificationPromise = resend.emails.send({
            from: `BARKmedia Scorecard <${fromEmail}>`,
            to: notifyEmail,
            replyTo: payload.contact.email,
            subject: `New Scorecard: ${payload.contact.name} (${payload.contact.company}) — Score ${payload.score}/10`,
            html: buildNotificationEmail(payload)
        });

        // Send results to prospect
        const prospectPromise = resend.emails.send({
            from: `Jared & Angela at BARKmedia <${fromEmail}>`,
            to: payload.contact.email,
            replyTo: notifyEmail,
            subject: `Your Local Visibility Scorecard Results: ${payload.score}/10`,
            html: buildProspectEmail(payload)
        });

        // Send both in parallel
        const [notifyResult, prospectResult] = await Promise.allSettled([
            notificationPromise,
            prospectPromise
        ]);

        // Log any errors but don't fail the whole request — at least one email might have gone through
        if (notifyResult.status === 'rejected') {
            console.error('Notification email failed:', notifyResult.reason);
        }
        if (prospectResult.status === 'rejected') {
            console.error('Prospect email failed:', prospectResult.reason);
        }

        // If both failed, return error
        if (notifyResult.status === 'rejected' && prospectResult.status === 'rejected') {
            return res.status(500).json({ error: 'Email delivery failed' });
        }

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('Scorecard handler error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
