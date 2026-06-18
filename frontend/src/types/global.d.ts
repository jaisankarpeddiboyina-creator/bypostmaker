interface RazorpayOptions {
  key: string
  subscription_id: string
  name: string
  description: string
  theme?: { color?: string }
  handler?: (response: unknown) => void
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open(): void
  close(): void
}

interface Window {
  Razorpay: new (options: RazorpayOptions) => RazorpayInstance
}
