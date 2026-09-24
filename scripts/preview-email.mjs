/* Render an email template to an HTML file. Sends nothing.
 *
 * The endpoint rate-limits at five submissions per IP per hour, and every
 * real submission also emails hello@ and angela@. So iterate here instead:
 * this imports the template builders, feeds them a representative payload,
 * and writes the HTML to disk for opening in a browser.
 *
 *   node scripts/preview-email.mjs              -> both, into preview/
 *   node scripts/preview-email.mjs prospect     -> just the prospect one
 *   node scripts/preview-email.mjs notification -> just the internal one
 *
 * Nothing here is wired into the deployed function. It exists only so the
 * templates can be looked at without spending a submission.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const OUT = join(root, 'preview');

/* api/scorecard.js imports 'resend', which is not installed locally and is
 * not needed to render a string. It is stubbed in a temp copy so the
 * builders can be loaded without the real file being touched. */
const src = readFileSync(join(root, 'api', 'scorecard.js'), 'utf8');
const stubbed = src.replace(
  /^import \{ Resend \} from 'resend';$/m,
  'class Resend { constructor(){ this.emails = { send: async () => ({}) }; } }',
);
if (stubbed === src) throw new Error('could not stub the resend import - has it changed?');

mkdirSync(OUT, { recursive: true });
const tmp = join(OUT, '.template-source.mjs');
/* Export the builders, which the deployed file keeps module-private. */
writeFileSync(tmp, stubbed + '\nexport { buildProspectEmail, buildNotificationEmail };\n');

const mod = await import('file://' + tmp);

/* Shaped like a real payload, and chosen to exercise every section: a
 * decimal score, several strengths, gaps, and fixes. */
const payload = {
  contact: {
    name: 'PREVIEW ONLY Sample Contractor',
    email: 'preview@example.com',
    company: 'PREVIEW Sample Plumbing',
    phone: '',
  },
  score: 6.4,
  route: 'growth',
  demand: 'demand',
  capacity: 'room',
  strengths: [
    'Your Google Business Profile is active, which is the single biggest local visibility asset you own.',
    'New leads get a response immediately, even after hours. Most of your competitors cannot say that.',
    'You check your numbers weekly, which puts you ahead of most owners in your trade.',
  ],
  gaps: [
    'You do not believe customers can find you on Google. That instinct is usually right and it is usually fixable.',
    'Your posts are not following a plan, so the effort scatters instead of compounding.',
  ],
  fixes: [
    'Search your own trade plus your town in an incognito window. Write down who shows up above you.',
    'Reply to every review from the last ninety days, including the bad ones.',
  ],
  submittedAt: '2026-01-01T00:00:00.000Z',
  /* The notification email renders a row per answer, and it is the
     largest part of that template. Without these the preview shows an
     empty table and hides most of what there is to look at. Both a
     scored answer and a routing-only one are included, because the
     routing ones render a "(routing)" marker the scored ones do not. */
  answers: {
    r1_demand: {
      question: 'Which sounds more like your business right now?',
      answer: 'We need new customers every week',
      value: 'demand',
      scoring: false,
    },
    q1_gbp: {
      question: 'Is your Google Business Profile up to date and active?',
      answer: 'Yes, we post regularly and respond to reviews',
      value: 'active',
      scoring: true,
    },
    q3_visibility: {
      question: 'How confident are you that customers in your area can find you on Google?',
      answer: '4 / 10',
      value: 4,
      scoring: true,
    },
    q11_followup: {
      question: 'When a new lead comes in after hours, what happens?',
      answer: 'It waits until someone sees it',
      value: 'none',
      scoring: true,
    },
  },
};

const which = process.argv[2];
const jobs = [];
if (!which || which === 'prospect') jobs.push(['prospect-email.html', mod.buildProspectEmail(payload)]);
if (!which || which === 'notification') jobs.push(['notification-email.html', mod.buildNotificationEmail(payload)]);

for (const [name, html] of jobs) {
  const path = join(OUT, name);
  writeFileSync(path, html);
  console.log(`  wrote ${path}`);
}
console.log('\n  Nothing was sent. Open the file(s) above in a browser.\n');
