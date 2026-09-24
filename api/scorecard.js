// ============================================================
// BARKMEDIA LOCAL VISIBILITY SCORECARD: VERCEL API
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
//   ALLOWED_ORIGIN          - For CORS. One origin, or several separated by commas.
//                             (default: https://barkmediasolutions.com)
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

// One short paragraph per route. Selected by the payload's `route` value.
// Wording is kept identical to the scorecard widget's routeCopy object so the
// on-screen results and the emailed results always say the same thing.
const routeParagraphs = {
    'foundation-then-growth': 'A few fundamentals are working against you right now, and pouring advertising on top of them wastes money. We would fix the foundation first: the website, the Google listing, and tracking so you can see what is actually happening. Once that is solid, the Growth System takes over and goes after the next customer every week.',
    'growth': 'Your fundamentals are in reasonable shape, which means the work is growth, not repair. That is what the Growth System does: get found by nearby customers, give them a reason to choose you, stay visible in the neighborhoods you want, and track which of it actually turns into booked jobs.',
    'foundation-then-care': 'You are not short on work, so you do not need lead generation. What you do have is a few things online that are working against the reputation you have already built. We would fix those once, then keep your Google listing, reviews, and website current so the business always looks as good as it is.',
    'care': 'Referrals are carrying you and the fundamentals are in decent shape, so aggressive lead generation would be selling you something you do not need. What makes sense here is keeping your online presence active and accurate so that when someone gets your name from a neighbor and looks you up, everything they find backs up what they heard.'
};

// ============================================================
// EMAIL TEMPLATES
// ============================================================

function buildNotificationEmail(payload) {
    const { contact, score, route, demand, capacity, answers, submittedAt } = payload;

    const qualifyCell = (label, value) => `
                <td width="33.33%" style="padding: 14px 12px; background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; text-align: center; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px;">${escapeHtml(label)}</div>
                    <div style="font-size: 15px; font-weight: 700; color: #171717; word-break: break-word;">${escapeHtml(value || 'n/a')}</div>
                </td>`;

    const answerRows = Object.values(answers || {}).map(a => `
        <tr>
            <td style="padding: 12px 16px; border-bottom: 1px solid #e5e5e5; vertical-align: top; font-size: 14px; color: #6b7280; width: 50%;">
                ${escapeHtml(a.question)}${a && a.scoring === false ? ' <span style="color:#9ca3af; font-size:12px;">(routing)</span>' : ''}
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
<body style="margin:0; padding:0; font-family: 'Familjen Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
    <div style="max-width: 640px; margin: 0 auto; background: white; padding: 32px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
            <tr><td bgcolor="#171717" align="center" style="background-color: #171717; padding: 24px; border-radius: 12px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #d5d5d5; margin-bottom: 8px;">New Scorecard Submission</div>
                <div style="font-size: 36px; font-weight: 800; line-height: 1; color: #ffffff;">${escapeHtml(String(score))} / 10</div>
            </td></tr>
        </table>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; border-collapse: separate; border-spacing: 8px 0;">
            <tr>
                ${qualifyCell('Route', route)}
                ${qualifyCell('Demand', demand)}
                ${qualifyCell('Capacity', capacity)}
            </tr>
        </table>

        <h2 style="margin: 0 0 16px; font-size: 18px; color: #171717;">Lead Info</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #fafafa; border-radius: 8px; overflow: hidden;">
            <tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280; width: 30%;">Name</td><td style="padding: 12px 16px; font-size: 14px; font-weight: 600;">${escapeHtml(contact.name)}</td></tr>
            <tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Email</td><td style="padding: 12px 16px; font-size: 14px;"><a href="mailto:${escapeHtml(contact.email)}" style="color: #1268b4;">${escapeHtml(contact.email)}</a></td></tr>
            <tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Company</td><td style="padding: 12px 16px; font-size: 14px; font-weight: 600;">${escapeHtml(contact.company)}</td></tr>
            ${contact.phone ? `<tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Phone</td><td style="padding: 12px 16px; font-size: 14px;"><a href="tel:${escapeHtml(contact.phone)}" style="color: #1268b4;">${escapeHtml(contact.phone)}</a></td></tr>` : ''}
            ${submittedAt ? `<tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Submitted</td><td style="padding: 12px 16px; font-size: 14px;">${escapeHtml(new Date(submittedAt).toLocaleString('en-US', { timeZone: 'America/Chicago' }))} CT</td></tr>` : ''}
        </table>

        <h2 style="margin: 24px 0 16px; font-size: 18px; color: #171717;">Their Answers</h2>
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden;">
            ${answerRows}
        </table>

        <div style="margin-top: 28px; padding: 20px; background: #e9f4fe; border-left: 4px solid #1268b4; border-radius: 8px;">
            <div style="font-size: 14px; color: #1268b4; font-weight: 600; margin-bottom: 8px;">Recommended next step:</div>
            <div style="font-size: 14px; color: #171717; line-height: 1.6;">
                Reach out within one business day. Reference their score and the specific gaps in their answers, and skip the generic pitch.
            </div>
        </div>
    </div>
</body>
</html>
    `;
}

function buildProspectEmail(payload) {
    const { contact, score, route, resendNote } = payload;
    const strengths = Array.isArray(payload.strengths) ? payload.strengths : [];
    const gaps = Array.isArray(payload.gaps) ? payload.gaps : [];
    const fixes = Array.isArray(payload.fixes) ? payload.fixes : [];
    const calendlyUrl = process.env.CALENDLY_URL || 'https://barkmediasolutions.com/intro';
    const firstName = contact.name.split(' ')[0];

    // Optional note banner shown at the very top. Used when manually re-sending
    // results that may not have reached the recipient the first time.
    const resendBanner = resendNote ? `
            <div style="margin: 0 0 24px; padding: 16px 18px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; font-size: 15px; color: #9a3412; line-height: 1.6;">
                ${escapeHtml(typeof resendNote === 'string' ? resendNote : "A quick note before your results: we originally sent this scorecard earlier, but it looks like it did not reach you. We wanted to make sure you got it, so here it is again.")}
            </div>` : '';

    const bulletList = (items) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map(item => `
                <tr><td style="padding: 6px 0; font-size: 15px; line-height: 1.55; color: #374151;"><span style="color: #1268b4; font-weight: 700;">&rarr;</span>&nbsp;&nbsp;${escapeHtml(item)}</td></tr>`).join('')}
            </table>`;

    const numberedList = (items) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items.map((item, i) => `
                <tr>
                    <td valign="top" style="padding: 6px 0; font-size: 15px; line-height: 1.55; color: #1268b4; font-weight: 700; width: 26px;">${i + 1}.</td>
                    <td valign="top" style="padding: 6px 0; font-size: 15px; line-height: 1.55; color: #374151;">${escapeHtml(item)}</td>
                </tr>`).join('')}
            </table>`;

    const card = (bg, border, titleColor, title, inner) => `
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
                <tr><td bgcolor="${bg}" style="background-color: ${bg}; border: 1px solid ${border}; border-radius: 12px; padding: 24px;">
                    <div style="margin: 0 0 14px; font-size: 16px; font-weight: 700; color: ${titleColor};">${title}</div>
                    ${inner}
                </td></tr>
            </table>`;

    const strengthsSection = strengths.length
        ? card('#f1f7f5', '#cde3db', '#1a7f5a', 'What is already working', bulletList(strengths))
        : '';

    const gapsSection = gaps.length
        ? card('#faf3f2', '#eed2d0', '#b4342a', 'What is costing you customers', bulletList(gaps))
        : '';

    const fixesSection = fixes.length
        ? card('#e9f4fe', '#cbdeee', '#1268b4', 'Do these first. They are free.',
            numberedList(fixes) +
            '<div style="margin-top: 14px; font-size: 14px; color: #6b7280; line-height: 1.6;">These are worth doing whether or not you ever work with us.</div>')
        : '';

    const routeParagraph = routeParagraphs[route] || '';
    const routeSection = routeParagraph
        ? card('#f6f9fc', '#e3e9f0', '#171717', 'Where we would start with you',
            `<div style="font-size: 15px; line-height: 1.65; color: #374151;">${escapeHtml(routeParagraph)}</div>`)
        : '';

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; font-family: 'Familjen Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
    <div style="max-width: 640px; margin: 0 auto; background: white;">
        <div style="padding: 32px 32px 0;">
            ${resendBanner}
            <p style="font-size: 16px; color: #171717; margin: 0 0 24px;">Hi ${escapeHtml(firstName)},</p>
            <p style="font-size: 16px; color: #374151; margin: 0 0 24px; line-height: 1.6;">Thanks for taking the Local Visibility Scorecard. Here is what we found and where we would start.</p>
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td bgcolor="#1e90f0" align="center" style="background-color: #1e90f0; padding: 36px 32px;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #ffffff; margin-bottom: 8px;">Your Score</div>
                <div style="font-size: 48px; font-weight: 800; line-height: 1; color: #ffffff; margin-bottom: 8px;">${escapeHtml(String(score))} / 10</div>
                <!-- 19px bold, not 15px: white on #1e90f0 is 3.33:1, which passes AA only
                     for large text. Large means 14pt bold = 18.67px, so 18px bold would
                     still be normal text and still fail. 19px bold is 14.2pt. The blue
                     stays because it is the brand and it matches the site header. -->
                <div style="font-size: 19px; font-weight: 700; color: #ffffff; line-height: 1.45;">Here is where your business stands online today.</div>
            </td></tr>
        </table>

        <div style="padding: 28px 32px;">
            ${strengthsSection}
            ${gapsSection}
            ${fixesSection}
            ${routeSection}

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 20px;">
                <tr><td bgcolor="#171717" align="center" style="background-color: #171717; padding: 32px; border-radius: 12px;">
                    <div style="font-size: 18px; font-weight: 700; margin: 0 0 14px; color: #ffffff;">Want a closer look?</div>
                    <div style="color: #e5e5e5; margin: 0 0 22px; font-size: 15px; line-height: 1.65;">A real business owner reviews every scorecard. If you want to talk through your results and which fixes matter most for your business, we are glad to help. No pressure and no sales pitch.</div>
                    <a href="${escapeHtml(calendlyUrl)}" style="display: inline-block; background: #ec4899; color: #ffffff; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 15px;">Schedule Your Free Scorecard Review &rarr;</a>
                </td></tr>
            </table>

            <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #e5e5e5; font-size: 14px; color: #6b7280; line-height: 1.6;">
                <p style="margin: 0 0 8px;">Questions? Just reply to this email. It goes straight to us.</p>
                <p style="margin: 0;">Jared and Angela Barker, BARKmedia Solutions</p>
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
    // CORS. ALLOWED_ORIGIN may name one origin or several, comma-separated.
    // The header itself accepts exactly one value - a list is invalid per
    // spec and browsers reject it - so the caller's own origin is echoed
    // back when it is allowed. With a single-value ALLOWED_ORIGIN and no
    // preview suffix this behaves exactly as it did before, which is why
    // it is safe to deploy ahead of changing the variable.
    const allowed = (process.env.ALLOWED_ORIGIN || 'https://barkmediasolutions.com')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    // TEMPORARY, FOR THE PRE-LAUNCH PREVIEW SITE. REMOVE AT CUTOVER.
    //
    // Cloudflare Pages gives every deploy its own alias under the project
    // domain - abc1234.barkmedia-site.pages.dev - so an exact allowlist
    // only ever matches whichever alias was pasted into the variable.
    // Matching the suffix instead lets any deploy of the project submit.
    //
    // BE CLEAR ABOUT WHAT THIS BROADENS: it trusts EVERY deploy of the
    // Pages project, not one reviewed build. That is acceptable only
    // because the project is ours and the window is short. It is not a
    // general-purpose wildcard - only Cloudflare can create a host under
    // this suffix, and only for this project, so no third party can mint
    // a matching origin.
    //
    // At DNS cutover: delete this constant and isPreviewOrigin, and trim
    // ALLOWED_ORIGIN back to the live domain alone. The preview site stops
    // needing to submit the moment it stops being the site.
    const PREVIEW_HOST = 'barkmedia-site.pages.dev';

    function isPreviewOrigin(origin) {
        if (!origin) return false;
        let url;
        try {
            url = new URL(origin);
        } catch {
            return false;
        }
        // The bare project host AND any deploy alias under it. Matching
        // only '.' + PREVIEW_HOST would miss the bare host, which is the
        // one the preview site actually runs on - caught in testing.
        //
        // Checked on the parsed hostname, and https only. A raw endsWith
        // on the header string would be looser than it looks: it would
        // accept barkmedia-site.pages.dev.evil.com, and a suffix sitting
        // in a path rather than the host.
        if (url.protocol !== 'https:') return false;
        return url.hostname === PREVIEW_HOST || url.hostname.endsWith('.' + PREVIEW_HOST);
    }

    const requestOrigin = req.headers.origin;
    const originAllowed = allowed.includes(requestOrigin) || isPreviewOrigin(requestOrigin);

    res.setHeader(
        'Access-Control-Allow-Origin',
        originAllowed ? requestOrigin : allowed[0]
    );

    // Required once the value varies by caller. Without it a cache or proxy
    // can serve one origin's header to another, which fails intermittently
    // and is miserable to diagnose.
    res.setHeader('Vary', 'Origin');
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

        // Honeypot check. Bots fill this, humans don't
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

        if (typeof payload.score !== 'number') {
            return res.status(400).json({ error: 'Missing score' });
        }

        const fromEmail = process.env.FROM_EMAIL || 'scorecard@barkmediasolutions.com';
        const notifyEmail = process.env.NOTIFY_EMAIL || 'jared@barkmediasolutions.com';

        // Send notification to BARKmedia
        const notificationPromise = resend.emails.send({
            from: `BARKmedia Scorecard <${fromEmail}>`,
            to: notifyEmail,
            replyTo: payload.contact.email,
            subject: `New Scorecard: ${payload.contact.name} (${payload.contact.company}), Score ${payload.score}/10`,
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

        // Log any errors but don't fail the whole request. At least one email might have gone through
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
