// ============================================================
// Razorpay Webhook Handler
// Cloudflare Workers + D1
// HMAC SHA256 Verified
// ============================================================
import type { Env } from '../../../config/ai'
import type { PlatformTier } from '../../../config/platforms'
import { generateId } from '../utils/id'
import { sendEmail } from '../services/email'
import { getCurrentPeriod } from '../utils/period'
export async function handleWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405
    })
  }
  const rawBody = await request.text()
  const signature =
    request.headers.get('x-razorpay-signature')
  if (!signature) {
    return new Response('Unauthorized', {
      status: 401
    })
  }
  const verified =
    await verifyRazorpaySignature(
      rawBody,
      signature,
      env.RAZORPAY_WEBHOOK_SECRET
    )
  if (!verified) {
    return new Response('Unauthorized', {
      status:401
    })
  }
  let event: RazorpayWebhookEvent
  try {
    event = JSON.parse(rawBody)
  }
  catch {
    return new Response('Invalid JSON',{
      status:400
    })
  }
  ctx.waitUntil(
    processWebhookEvent(event, env)
  )
  return new Response('OK')
}
async function processWebhookEvent(
  event: RazorpayWebhookEvent,
  env: Env
): Promise<void> {
switch(event.event){
case 'subscription.activated': {
const sub =
event.payload.subscription?.entity
if(!sub) return
const userId =
await getUserByRazorpaySubId(
 env.DB,
 sub.id
)
if(!userId) return
const plan =
getPlanFromRazorpayPlanId(
 sub.plan_id,
 env
)
const now =
Math.floor(Date.now()/1000)
const end =
sub.current_end ??
now + 30*24*60*60
await env.DB.batch([
env.DB.prepare(
`
UPDATE users
SET plan=?,
plan_status='active',
updated_at=unixepoch()
WHERE id=?
`
)
.bind(
 plan,
 userId
),
env.DB.prepare(
`
UPDATE subscriptions
SET status='active',
current_period_start=?,
current_period_end=?,
updated_at=unixepoch()
WHERE razorpay_sub_id=?
`
)
.bind(
 now,
 end,
 sub.id
),
])
const user =
await getUser(
 env.DB,
 userId
)
if(user){
await sendEmail(
 env,
 'upgrade_success',
 user.email,
 user.name,
 {plan}
)
}
break
}
case 'subscription.charged': {
const sub =
event.payload.subscription?.entity
if(!sub) return
const userId =
await getUserByRazorpaySubId(
 env.DB,
 sub.id
)
if(!userId) return
const plan =
getPlanFromRazorpayPlanId(
 sub.plan_id,
 env
)
const now =
Math.floor(Date.now()/1000)
const end =
sub.current_end ??
now+30*24*60*60
await env.DB.batch([
env.DB.prepare(
`
UPDATE users
SET plan=?,
plan_status='active',
updated_at=unixepoch()
WHERE id=?
`
)
.bind(
 plan,
 userId
),
env.DB.prepare(
`
UPDATE subscriptions
SET status='active',
current_period_start=?,
current_period_end=?,
updated_at=unixepoch()
WHERE razorpay_sub_id=?
`
)
.bind(
 now,
 end,
 sub.id
)
])
console.log(
`Renewal success ${userId}`
)
break
}
// ============================================================
// SUBSCRIPTION CANCELLED
// ============================================================
case 'subscription.cancelled': {
  const sub =
    event.payload.subscription?.entity
  if (!sub) return
  const userId =
    await getUserByRazorpaySubId(
      env.DB,
      sub.id
    )
  if (!userId) return
  const cancelledAt =
    Math.floor(Date.now() / 1000)
  const subscription =
    await env.DB.prepare(
`
SELECT current_period_end
FROM subscriptions
WHERE razorpay_sub_id=?
`
    )
    .bind(sub.id)
    .first<{
      current_period_end:number|null
    }>()
  const wasPaid =
    (subscription?.current_period_end ?? 0) > 0
  // User never paid, only abandoned checkout
  if (!wasPaid) {
    await env.DB.prepare(
`
UPDATE subscriptions
SET status='cancelled',
cancelled_at=?,
updated_at=unixepoch()
WHERE razorpay_sub_id=?
`
    )
    .bind(
      cancelledAt,
      sub.id
    )
    .run()
    console.log(
      `Cancelled unpaid subscription ${sub.id}`
    )
    return
  }
  // Paid subscription cancelled
  await env.DB.batch([
    env.DB.prepare(
`
UPDATE users
SET plan='free',
plan_status='cancelled',
updated_at=unixepoch()
WHERE id=?
`
    )
    .bind(userId),
    env.DB.prepare(
`
UPDATE subscriptions
SET status='cancelled',
cancelled_at=?,
updated_at=unixepoch()
WHERE razorpay_sub_id=?
`
    )
    .bind(
      cancelledAt,
      sub.id
    )
  ])
  const user =
    await getUser(
      env.DB,
      userId
    )
  if(user){
    await sendEmail(
      env,
      'subscription_cancelled',
      user.email,
      user.name,
      {}
    )
  }
  break
}
// ============================================================
// PAYMENT FAILED
// ============================================================
case 'subscription.halted': {
const sub =
event.payload.subscription?.entity
if(!sub) return
const userId =
await getUserByRazorpaySubId(
 env.DB,
 sub.id
)
if(!userId) return
await env.DB.batch([
env.DB.prepare(
`
UPDATE users
SET plan_status='past_due',
updated_at=unixepoch()
WHERE id=?
`
)
.bind(userId),
env.DB.prepare(
`
UPDATE subscriptions
SET status='halted',
updated_at=unixepoch()
WHERE razorpay_sub_id=?
`
)
.bind(sub.id)
])
const user =
await getUser(
 env.DB,
 userId
)
if(user){
await sendEmail(
 env,
 'payment_failed',
 user.email,
 user.name,
 {}
)
}
break
}
default:
console.log(
`Unhandled event: ${event.event}`
)
}
}
// ============================================================
// HMAC SHA256 SIGNATURE CHECK
// ============================================================
async function verifyRazorpaySignature(
 body:string,
 signature:string,
 secret:string
):Promise<boolean>{
const encoder =
new TextEncoder()
const key =
await crypto.subtle.importKey(
'raw',
encoder.encode(secret),
{
 name:'HMAC',
 hash:'SHA-256'
},
false,
['sign']
)
const hash =
await crypto.subtle.sign(
'HMAC',
key,
encoder.encode(body)
)
const expected =
Array.from(
new Uint8Array(hash)
)
.map(
b =>
b.toString(16)
.padStart(2,'0')
)
.join('')
return timingSafeEqual(
 expected,
 signature.trim()
)
}
function timingSafeEqual(
a:string,
b:string
):boolean{
if(a.length!==b.length)
return false
let result=0
for(let i=0;i<a.length;i++){
result |=
a.charCodeAt(i)
^
b.charCodeAt(i)
}
return result===0
}
// ============================================================
// DATABASE HELPERS
// ============================================================
async function getUserByRazorpaySubId(
db:D1Database,
subId:string
):Promise<string|null>{
const result =
await db.prepare(
`
SELECT user_id
FROM subscriptions
WHERE razorpay_sub_id=?
ORDER BY created_at DESC
LIMIT 1
`
)
.bind(subId)
.first<{
 user_id:string
}>()
return result?.user_id ?? null
}
async function getUser(
db:D1Database,
userId:string
):Promise<{
email:string,
name:string
}|null>{
return await db.prepare(
`
SELECT email,name
FROM users
WHERE id=?
`
)
.bind(userId)
.first<{
email:string,
name:string
}>()
}
// ============================================================
// PLAN MAPPING
// ============================================================
function getPlanFromRazorpayPlanId(
planId:string,
env:Env
):PlatformTier{
const map:
Record<string,PlatformTier>={
[env.RAZORPAY_PLAN_STARTER_USD]:
'starter',
[env.RAZORPAY_PLAN_STARTER_INR]:
'starter',
[env.RAZORPAY_PLAN_PRO_USD]:
'pro',
[env.RAZORPAY_PLAN_PRO_INR]:
'pro',
[env.RAZORPAY_PLAN_BUSINESS_USD]:
'business',
[env.RAZORPAY_PLAN_BUSINESS_INR]:
'business'
}
return map[planId] ?? 'starter'
}
// ============================================================
// TYPES
// ============================================================
interface RazorpayWebhookEvent {
event:string
payload:{
subscription?:{
entity:{
id:string
plan_id:string
status:string
current_start?:number
current_end?:number
}
}
payment?:{
entity:{
id:string
subscription_id?:string
}
}
}
}