function bufToHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = bufToHex(salt)
  
  const pwEncoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    pwEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256 // length in bits (32 bytes)
  )
  
  const hashHex = bufToHex(new Uint8Array(derivedBits))
  return `pbkdf2:100000:${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  
  const iterations = parseInt(parts[1], 10)
  const saltHex = parts[2]
  const hashHex = parts[3]
  
  const salt = hexToBuf(saltHex)
  const pwEncoder = new TextEncoder()
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    pwEncoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  )
  
  const verifyHashHex = bufToHex(new Uint8Array(derivedBits))
  
  // Timing-safe comparison using native WebCrypto verify API
  try {
    const keyA = await crypto.subtle.importKey(
      'raw',
      hexToBuf(hashHex),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify']
    )
    const dummyPayload = new TextEncoder().encode('verification')
    const signature = await crypto.subtle.sign('HMAC', keyA, dummyPayload)
    
    const keyB = await crypto.subtle.importKey(
      'raw',
      hexToBuf(verifyHashHex),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    
    return await crypto.subtle.verify('HMAC', keyB, signature, dummyPayload)
  } catch (err) {
    console.error('Password timing-safe comparison failed:', err)
    return false
  }
}
