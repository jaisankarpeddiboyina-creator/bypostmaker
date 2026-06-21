import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const COMPANY = 'PostMaker'
const DOMAIN  = 'bypostamaker.com'
const EMAIL   = 'support@bypostamaker.com'
const UPDATED = 'June 2025'

const CONTENT: Record<string, { title: string; body: string }> = {
  privacy: {
    title: 'Privacy Policy',
    body: `
Last updated: ${UPDATED}

## What We Collect

When you sign in with Google, we receive your name, email address, and profile photo. We store these to create and identify your account. We do not receive or store your Google password.

When you use PostMaker, we store the prompts you submit, the content generated for your campaigns, your platform selections, and your subscription and usage data.

We do not store uploaded images or videos. These are used only to generate and package your content kit and are discarded immediately after.

## How We Use It

We use your data to operate PostMaker — to generate content, track your usage against your plan limits, process your subscription, and send you transactional emails (welcome, receipts, usage alerts).

We do not sell your data. We do not share your data with third parties for advertising purposes.

## Third-Party Services

PostMaker uses the following services that may process your data:

- **Cloudflare** — infrastructure, security, and edge computing
- **Groq / Google Gemini** — AI text generation (your prompts are sent to these APIs)
- **Razorpay** — payment processing (we never see or store your card details)
- **Resend** — transactional email delivery
- **PostHog** — product analytics (anonymised usage events)
- **Sentry** — error monitoring (no personal data in error reports)

## Data Retention

We retain your account data for as long as your account is active. If you delete your account, all your data is permanently deleted within 24 hours.

Campaign content is retained according to your plan: 7 days (Free), 30 days (Starter), 90 days (Pro), 1 year (Business).

## Your Rights

You can export or delete your data at any time from Settings → Account. You can also email ${EMAIL} and we will respond within 7 days.

If you are in the European Economic Area, you have rights under GDPR including the right to access, rectify, erase, restrict, and port your data. If you are in India, you have rights under the Digital Personal Data Protection Act 2023.

## Cookies

We use one functional cookie (pm_session) to keep you signed in. See our Cookie Policy for details.

## Contact

${EMAIL}
    `,
  },

  terms: {
    title: 'Terms of Service',
    body: `
Last updated: ${UPDATED}

## Acceptance

By using PostMaker, you agree to these terms. If you do not agree, do not use the service.

## What PostMaker Does

PostMaker is an AI-powered tool that generates social media content based on prompts you provide. You are responsible for reviewing all generated content before publishing it. We make no guarantees about the accuracy, quality, or suitability of AI-generated content.

## Your Account

You must be 18 or older to use PostMaker. You are responsible for keeping your account credentials secure. You may not share your account or use PostMaker to create content on behalf of others without their knowledge.

## Acceptable Use

You may not use PostMaker to generate content that is illegal, defamatory, harassing, fraudulent, or that infringes the intellectual property rights of others. We reserve the right to suspend accounts that violate these terms.

## Subscriptions and Billing

Subscriptions are billed monthly in advance. Your plan automatically renews unless you cancel before the renewal date. Cancellation takes effect at the end of the current billing period — you retain access until then.

## Refunds

We do not offer refunds. If you cancel mid-period, you keep access until the period ends. If you believe there has been a billing error, contact ${EMAIL} within 7 days.

## Intellectual Property

Content you generate using PostMaker is yours. PostMaker retains no rights to your generated content. The PostMaker platform, its design, and its underlying code are owned by PostMaker and may not be copied or reproduced.

## Limitation of Liability

PostMaker is provided as-is. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability is limited to the amount you paid in the 3 months preceding the claim.

## Changes

We may update these terms. We will notify you by email if changes are material. Continued use after changes constitutes acceptance.

## Governing Law

These terms are governed by the laws of India. Disputes shall be resolved in the courts of Bangalore, Karnataka.

## Contact

${EMAIL}
    `,
  },

  refund: {
    title: 'Refund Policy',
    body: `
Last updated: ${UPDATED}

## No Refunds

PostMaker does not offer refunds on subscription payments.

When you subscribe to a paid plan, you are billed immediately for the current month. If you cancel, your plan remains active until the end of that billing period. We do not issue partial or pro-rated refunds for unused time.

## Exceptions

We will issue a refund if:
- You were charged twice for the same period due to a technical error
- You were charged after cancelling and the cancellation was confirmed by us

To request a refund under these exceptions, email ${EMAIL} within 7 days of the charge with your payment reference number.

## Billing Errors

If you believe you have been incorrectly charged, email ${EMAIL} and we will investigate and respond within 3 business days.

## Free Plan

PostMaker offers a free plan with 5 generations per month. You can evaluate the service before committing to a paid plan.

## Contact

${EMAIL}
    `,
  },

  cookies: {
    title: 'Cookie Policy',
    body: `
Last updated: ${UPDATED}

## Cookies We Use

PostMaker uses a minimal number of cookies to operate.

### Functional Cookies (Required)

**pm_session** — This cookie keeps you signed in to PostMaker. It stores a secure, encrypted token that identifies your session. Without this cookie, you would be signed out on every page load. This cookie is httpOnly (cannot be accessed by JavaScript), Secure (only sent over HTTPS), and expires after 30 days.

### Analytics Cookies (Optional)

PostMaker uses PostHog for product analytics. PostHog may set cookies to track usage patterns such as which features are used and where users encounter issues. This data is anonymised and used only to improve the product. No personal data is included in analytics events.

PostHog cookies: **ph_** prefixed cookies — session and distinct ID for event tracking.

### Error Monitoring

PostMaker uses Sentry for error monitoring. Sentry does not set persistent cookies but may use session storage to track error context within a single browser session.

## What We Don't Do

We do not use advertising cookies. We do not use third-party tracking cookies. We do not sell cookie data. We do not use cookies to build advertising profiles.

## Managing Cookies

You can clear cookies from your browser at any time. Clearing the pm_session cookie will sign you out of PostMaker.

To opt out of PostHog analytics, you can use a browser extension that blocks tracking scripts, or contact ${EMAIL} to request your data be excluded from analytics.

## Contact

${EMAIL}
    `,
  },
}

export default function LegalPage({ page }: { page: 'privacy' | 'terms' | 'refund' | 'cookies' }) {
  const navigate = useNavigate()
  const content = CONTENT[page]
  if (!content) return null

  // Parse simple markdown: ## heading, **bold**, \n\n paragraphs
  const renderBody = (text: string) => {
    return text.trim().split('\n\n').map((block, i) => {
      if (block.startsWith('## ')) {
        return <h2 key={i} className="legal-h2">{block.slice(3)}</h2>
      }
      // Inline bold
      const parts = block.split(/\*\*(.*?)\*\*/g)
      return (
        <p key={i} className="legal-p">
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
        </p>
      )
    })
  }

  return (
    <div className="legal-page">
      <nav className="legal-nav">
        <div className="legal-nav-inner">
          <button className="legal-back" onClick={() => navigate('/')}>
            <ArrowLeft size={14} /> Back
          </button>
          <span className="legal-logo">Post<span>Maker</span></span>
        </div>
      </nav>

      <div className="legal-body">
        <div className="legal-inner">
          <h1 className="legal-title">{content.title}</h1>
          <div className="legal-content">{renderBody(content.body)}</div>

          <div className="legal-footer-links">
            {[
              { path: '/privacy', label: 'Privacy' },
              { path: '/terms', label: 'Terms' },
              { path: '/refund', label: 'Refund' },
              { path: '/cookies', label: 'Cookies' },
            ].map(l => (
              <a key={l.path} href={l.path} className={page === l.path.slice(1) ? 'active' : ''}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .legal-page { min-height: 100vh; background: var(--bg); }
        .legal-nav { border-bottom: 1px solid var(--border); padding: 0 24px; }
        .legal-nav-inner { max-width: 720px; margin: 0 auto; height: 52px; display: flex; align-items: center; justify-content: space-between; }
        .legal-back { display: flex; align-items: center; gap: 6px; background: none; border: none; color: var(--text-3); cursor: pointer; font-size: 13px; font-family: var(--font-body); transition: color var(--transition); }
        .legal-back:hover { color: var(--text-1); }
        .legal-logo { font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--text-1); letter-spacing: -0.04em; }
        .legal-logo span { color: var(--accent); }
        .legal-body { padding: 48px 24px 80px; }
        .legal-inner { max-width: 720px; margin: 0 auto; }
        .legal-title { font-family: var(--font-display); font-size: 36px; font-weight: 700; color: var(--text-1); letter-spacing: -0.03em; margin-bottom: 40px; }
        .legal-content { display: flex; flex-direction: column; gap: 16px; }
        .legal-h2 { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--text-1); margin-top: 16px; letter-spacing: -0.02em; }
        .legal-p { font-size: 15px; color: var(--text-2); line-height: 1.8; }
        .legal-p strong { color: var(--text-1); }
        .legal-footer-links { display: flex; gap: 20px; margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--border); flex-wrap: wrap; }
        .legal-footer-links a { font-size: 13px; color: var(--text-3); text-decoration: none; }
        .legal-footer-links a:hover, .legal-footer-links a.active { color: var(--accent); }
      `}</style>
    </div>
  )
}
