import type { Env } from '../../../config/ai'

type EmailType =
  | 'welcome'
  | 'upgrade_success'
  | 'subscription_cancelled'
  | 'payment_failed'
  | 'usage_80'
  | 'usage_100'
  | 'account_deleted'
  | 'verify_email'
  | 'reset_password'

const FROM_NAME = 'PostMaker'
const FROM_EMAIL = 'team@bypostamaker.com'
const REPLY_TO = 'support@bypostamaker.com'

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
}

const PLAN_LIMITS: Record<string, number> = {
  starter: 50,
  pro: 200,
  business: -1,
}

export async function sendEmail(
  env: Env,
  type: EmailType,
  toEmail: string,
  toName: string,
  data: Record<string, string | number>
): Promise<void> {
  const template = buildTemplate(type, toName, data, env)
  if (!template) return

  if (env.ENVIRONMENT === 'development') {
    console.log(`[DEVELOPMENT EMAIL] to: ${toEmail}, subject: ${template.subject}`)
    console.log(`[DEVELOPMENT EMAIL] body:`, template.html)
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [toEmail],
        reply_to: REPLY_TO,
        subject: template.subject,
        html: template.html,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`Email send failed [${type}]:`, err)
    }
  } catch (err) {
    console.error(`Email service error [${type}]:`, err)
  }
}

function buildTemplate(
  type: EmailType,
  name: string,
  data: Record<string, string | number>,
  env: Env
): { subject: string; html: string } | null {
  const protocol = env.ENVIRONMENT === 'development' ? 'http' : 'https'
  const appUrl = `${protocol}://${env.DOMAIN}`
  const firstName = name.split(' ')[0]

  const wrap = (subject: string, body: string) => ({
    subject,
    html: baseTemplate(body, appUrl),
  })

  switch (type) {
    case 'verify_email':
      return wrap(
        'Verify your email for PostMaker',
        `<p>Hey ${firstName},</p>
         <p>Please verify your email address to activate your PostMaker account.</p>
         <a href="${appUrl}/api/auth/email/verify?token=${data.token}&email=${data.email}" class="btn">Verify Email →</a>
         <p>If you did not request this, please ignore this email.</p>`
      )

    case 'reset_password':
      return wrap(
        'Reset your PostMaker password',
        `<p>Hey ${firstName},</p>
         <p>We received a request to reset your password. Click the link below to set a new password:</p>
         <a href="${appUrl}/reset-password?token=${data.token}&email=${data.email}" class="btn">Reset Password →</a>
         <p>This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.</p>`
      )

    case 'welcome':
      return wrap(
        'Welcome to PostMaker 👋',
        `<p>Hey ${firstName},</p>
         <p>Your PostMaker account is ready. You've got <strong>5 free generations</strong> to get started — no credit card needed.</p>
         <p>Pick your platforms, drop your prompt, and download your content kit in seconds.</p>
         <a href="${appUrl}/app" class="btn">Start creating →</a>
         <p>If you hit a wall or have a question, just reply to this email.</p>`
      )

    case 'upgrade_success': {
      const plan = PLAN_LABELS[data.plan as string] ?? String(data.plan)
      const limit = PLAN_LIMITS[data.plan as string]
      return wrap(
        `You're on ${plan} ✓`,
        `<p>Hey ${firstName},</p>
         <p>You're now on the <strong>${plan} plan</strong>. ${limit === -1 ? 'Unlimited generations, all platforms — no limits.' : `${limit} generations/month, unlocked and ready.`}</p>
         <a href="${appUrl}/app" class="btn">Start creating →</a>
         <p>Manage your subscription anytime in <a href="${appUrl}/app/settings">Settings</a>.</p>`
      )
    }

    case 'subscription_cancelled':
      return wrap(
        'Your PostMaker subscription has been cancelled',
        `<p>Hey ${firstName},</p>
         <p>Your subscription has been cancelled. You'll keep access until the end of your current billing period.</p>
         <p>After that, your account moves to the free plan (5 generations/month).</p>
         <p>Changed your mind? <a href="${appUrl}/app/settings">Resubscribe anytime.</a></p>`
      )

    case 'payment_failed':
      return wrap(
        'Action needed: PostMaker payment failed',
        `<p>Hey ${firstName},</p>
         <p>We couldn't process your last payment. Your account is currently on hold.</p>
         <p>Please update your payment method to restore full access.</p>
         <a href="${appUrl}/app/settings" class="btn">Update payment →</a>
         <p>If you keep having trouble, reply to this email and we'll sort it out.</p>`
      )

    case 'usage_80': {
      const used = data.used as number
      const limit = data.limit as number
      return wrap(
        `You've used ${used}/${limit} generations this month`,
        `<p>Hey ${firstName},</p>
         <p>You've used <strong>${used} of ${limit} generations</strong> this month. ${limit - used} remaining.</p>
         <p>Upgrade to keep creating without limits.</p>
         <a href="${appUrl}/app/settings" class="btn">Upgrade plan →</a>`
      )
    }

    case 'usage_100': {
      const limit = data.limit as number
      return wrap(
        "You've hit your generation limit",
        `<p>Hey ${firstName},</p>
         <p>You've used all <strong>${limit} generations</strong> for this month.</p>
         <p>Upgrade now to keep going, or wait until your limit resets on the 1st.</p>
         <a href="${appUrl}/app/settings" class="btn">Upgrade plan →</a>`
      )
    }

    case 'account_deleted':
      return wrap(
        'Your PostMaker account has been deleted',
        `<p>Hey ${firstName},</p>
         <p>Your PostMaker account and all associated data have been permanently deleted.</p>
         <p>If this was a mistake or you'd like to start fresh, you can always <a href="${appUrl}">create a new account</a>.</p>
         <p>Thanks for using PostMaker.</p>`
      )

    default:
      return null
  }
}

function baseTemplate(body: string, appUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0a0a0a; color: #e5e5e5; }
  .wrapper { max-width: 560px; margin: 40px auto; padding: 0 20px; }
  .card { background: #141414; border: 1px solid #262626; border-radius: 12px;
          padding: 40px; }
  .logo { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 32px;
          letter-spacing: -0.5px; }
  .logo span { color: #7c3aed; }
  p { font-size: 15px; line-height: 1.7; color: #a3a3a3; margin-bottom: 16px; }
  p strong { color: #e5e5e5; }
  a { color: #7c3aed; text-decoration: none; }
  .btn { display: inline-block; background: #7c3aed; color: #ffffff !important;
         padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;
         margin: 8px 0 24px; text-decoration: none; }
  .footer { margin-top: 32px; font-size: 12px; color: #525252; text-align: center; }
  .footer a { color: #525252; }
  hr { border: none; border-top: 1px solid #262626; margin: 24px 0; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="logo">Post<span>Maker</span></div>
    ${body}
    <hr>
    <div class="footer">
      <a href="${appUrl}">bypostamaker.com</a> ·
      <a href="${appUrl}/app/settings">Settings</a> ·
      <a href="mailto:support@bypostamaker.com">Support</a>
    </div>
  </div>
</div>
</body>
</html>`
}
