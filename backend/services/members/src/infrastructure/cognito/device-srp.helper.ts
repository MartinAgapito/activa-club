import * as crypto from 'crypto';

// ── SRP-6a parameters (same N and g used by Cognito) ──────────────────────────
// 2048-bit prime N as defined in RFC 5054 Appendix A.
const N_HEX =
  'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1' +
  '29024E088A67CC74020BBEA63B139B22514A08798E3404DD' +
  'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245' +
  'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
  'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D' +
  'C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F' +
  '83655D23DCA3AD961C62F356208552BB9ED529077096966D' +
  '670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
  'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9' +
  'DE2BCBF6955817183995497CEA956AE515D2261898FA0510' +
  '15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64' +
  'ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7' +
  'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6B' +
  'F12FFA06D98A0864D87602733EC86A64521F2B18177B200C' +
  'BBE117577A615D6C770988C0BAD946E208E24FA074E5AB31' +
  '43DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF';

const N = BigInt(`0x${N_HEX}`);
const g = BigInt(2);

/**
 * Device SRP verifier config as expected by Cognito ConfirmDevice.
 */
export interface DeviceSrpVerifier {
  /** Base64-encoded SRP password verifier. */
  passwordVerifier: string;
  /** Base64-encoded SRP salt. */
  salt: string;
  /** The random device password used to derive the verifier (must be stored client-side). */
  devicePassword: string;
}

/**
 * SRP ephemeral key pair for DEVICE_SRP_AUTH challenge.
 */
export interface SrpEphemeral {
  /** Private ephemeral (random secret). */
  a: bigint;
  /** Public ephemeral A = g^a mod N, as hex string (sent to Cognito as SRP_A). */
  AHex: string;
}

/**
 * Generates the SRP verifier configuration required by Cognito ConfirmDevice.
 *
 * Cognito expects:
 *   - Salt: 16 random bytes, base64-encoded.
 *   - PasswordVerifier: g^x mod N, where x = H(Salt | H(DeviceGroupKey:DeviceKey:DevicePassword)).
 *
 * @param deviceGroupKey - From Cognito NewDeviceMetadata.
 * @param deviceKey      - From Cognito NewDeviceMetadata.
 * @param devicePassword - Random password (32 hex bytes) generated for this device.
 */
export function generateDeviceSrpVerifier(
  deviceGroupKey: string,
  deviceKey: string,
  devicePassword: string,
): DeviceSrpVerifier {
  // Cognito rejects salts/verifiers whose first byte >= 0x80 (interpreted as
  // negative in two's complement). Pad with 0x00 to ensure a positive value.
  const saltRaw = crypto.randomBytes(16);
  const saltBytes = saltRaw[0] >= 0x80 ? Buffer.concat([Buffer.alloc(1), saltRaw]) : saltRaw;
  const salt = saltBytes.toString('base64');

  const innerHash = crypto
    .createHash('sha256')
    .update(`${deviceGroupKey}:${deviceKey}:${devicePassword}`)
    .digest();

  const xHash = crypto
    .createHash('sha256')
    .update(Buffer.concat([saltBytes, innerHash]))
    .digest('hex');

  const x = BigInt(`0x${xHash}`);
  const v = modPow(g, x, N);

  const vHex = v.toString(16);
  const vHexEven = vHex.length % 2 === 0 ? vHex : `0${vHex}`;
  const vBuf = Buffer.from(vHexEven, 'hex');
  const vPadded = vBuf[0] >= 0x80 ? Buffer.concat([Buffer.alloc(1), vBuf]) : vBuf;
  const passwordVerifier = vPadded.toString('base64');

  console.log('[VERIFIER-TRACE] saltBytes.length=', saltBytes.length, 'saltHex=', saltBytes.toString('hex'));
  console.log('[VERIFIER-TRACE] devicePassword=', devicePassword);
  console.log('[VERIFIER-TRACE] x(first16)=', xHash.slice(0, 16));
  console.log('[VERIFIER-TRACE] vPadded.length=', vPadded.length, 'vPadded.first byte=', vPadded[0]);

  return { passwordVerifier, salt, devicePassword };
}

/**
 * Generates a random SRP ephemeral key pair for the DEVICE_SRP_AUTH challenge.
 * The public half (AHex) is sent to Cognito as SRP_A.
 * The private half (a) must be kept in memory until the DEVICE_PASSWORD_VERIFIER step.
 */
export function generateSrpEphemeral(): SrpEphemeral {
  const aBytes = crypto.randomBytes(32);
  const a = BigInt(`0x${aBytes.toString('hex')}`);
  const A = modPow(g, a, N);
  const AHex = A.toString(16);
  return { a, AHex };
}

/**
 * Computes the PASSWORD_CLAIM_SIGNATURE for Cognito's DEVICE_PASSWORD_VERIFIER challenge.
 *
 * This follows the SRP-6a protocol:
 *   u = H(A | B)
 *   x = H(SALT | H(deviceGroupKey:deviceKey:devicePassword))
 *   S = (B - k * g^x)^(a + u*x) mod N
 *   K = H(S)
 *   signature = HMAC-SHA256(K, deviceGroupKey | deviceKey | SECRET_BLOCK | timestamp)
 *
 * @param params.a                  - Private ephemeral from generateSrpEphemeral.
 * @param params.AHex               - Public ephemeral hex from generateSrpEphemeral.
 * @param params.BHex               - SRP_B from Cognito challenge params (hex string).
 * @param params.saltBase64         - SALT from Cognito challenge params (base64).
 * @param params.secretBlockBase64  - SECRET_BLOCK from Cognito challenge params (base64).
 * @param params.deviceGroupKey     - Stored alongside deviceKey after ConfirmDevice.
 * @param params.deviceKey          - Stored device key.
 * @param params.devicePassword     - Stored random device password from ConfirmDevice.
 * @param params.timestamp          - UTC timestamp string (from generateCognitoTimestamp).
 */
export function computeDevicePasswordClaim(params: {
  a: bigint;
  AHex: string;
  BHex: string;
  /** SALT from Cognito DEVICE_PASSWORD_VERIFIER challenge — hex-encoded string. */
  saltHex: string;
  secretBlockBase64: string;
  deviceGroupKey: string;
  deviceKey: string;
  devicePassword: string;
  timestamp: string;
}): { signature: string } {
  const { a, AHex, BHex, saltHex, secretBlockBase64, deviceGroupKey, deviceKey, devicePassword, timestamp } = params;

  const B = BigInt(`0x${BHex}`);
  // Cognito returns SALT as a BigInteger hex string (no leading zeros).
  // If the hex has odd length (e.g. "116691c0..."), Buffer.from(...,'hex') would silently
  // drop the last nibble, producing wrong bytes. Pad to even length first.
  const saltHexEven = saltHex.length % 2 === 0 ? saltHex : `0${saltHex}`;
  const saltBytes = Buffer.from(saltHexEven, 'hex');
  const secretBlock = Buffer.from(secretBlockBase64, 'base64');

  // k = H(padHex(N) | padHex(g))
  // Uses minimal padding (same as Amplify padHex): even-length hex + 0x00 prefix if high bit set.
  // g=2 → "02" → 1 byte. Using bigintToFixedBuffer(g, 256) would pad g to 256 bytes, giving a wrong k.
  const NBuf = hexToPositiveBuffer(N.toString(16));
  const gBuf = hexToPositiveBuffer(g.toString(16));
  const k = BigInt(
    `0x${crypto.createHash('sha256').update(Buffer.concat([NBuf, gBuf])).digest('hex')}`,
  );

  // u = H(pad(A) | pad(B))
  const ABuf = hexToPositiveBuffer(AHex);
  const BBuf = hexToPositiveBuffer(BHex);
  const u = BigInt(
    `0x${crypto.createHash('sha256').update(Buffer.concat([ABuf, BBuf])).digest('hex')}`,
  );

  // x = H(SALT | H(deviceGroupKey:deviceKey:devicePassword))
  const innerHash = crypto
    .createHash('sha256')
    .update(`${deviceGroupKey}:${deviceKey}:${devicePassword}`)
    .digest();
  const x = BigInt(
    `0x${crypto.createHash('sha256').update(Buffer.concat([saltBytes, innerHash])).digest('hex')}`,
  );

  // S = (B - k * g^x)^(a + u*x) mod N  —  ensure positive via ((x % N) + N) % N
  const kgx = (k * modPow(g, x, N)) % N;
  const base = ((B - kgx) % N + N) % N;
  const exp = a + u * x;
  const S = modPow(base, exp, N);

  // K = HKDF-like derivation matching Amplify's AuthenticationHelper.computehkdf exactly:
  //   PRK = HMAC-SHA256(salt=pad(u), IKM=pad(S))       ← Extract
  //   K   = HMAC-SHA256(PRK, "Caldera Derived Key\x01")[:16]  ← Expand (single block, counter pre-included)
  // Amplify's custom HKDF does NOT use crypto.hkdfSync (RFC 5869) — it manually runs
  // the two HMAC steps above. Using hkdfSync caused a double \x01 suffix mismatch.
  const SBuf = hexToPositiveBuffer(S.toString(16));
  const uBuf = hexToPositiveBuffer(u.toString(16));
  const prk = crypto.createHmac('sha256', uBuf).update(SBuf).digest();
  const K = crypto
    .createHmac('sha256', prk)
    .update(Buffer.concat([Buffer.from('Caldera Derived Key', 'utf8'), Buffer.alloc(1, 1)]))
    .digest()
    .subarray(0, 16);

  console.log('[SRP-MATH] NBuf.length=', NBuf.length, 'gBuf.length=', gBuf.length);
  console.log('[SRP-MATH] k(hex)=', k.toString(16).slice(0, 16) + '...');
  console.log('[SRP-MATH] u(hex)=', u.toString(16).slice(0, 16) + '...');
  console.log('[SRP-MATH] x(hex)=', x.toString(16).slice(0, 16) + '...');
  console.log('[SRP-MATH] B-kgx positive=', ((B - kgx) % N + N) % N > 0n);
  console.log('[SRP-MATH] S(hex,first16)=', S.toString(16).slice(0, 16) + '...');
  console.log('[SRP-MATH] SBuf.length=', SBuf.length, 'first byte=', SBuf[0]);
  console.log('[SRP-MATH] uBuf.length=', uBuf.length, 'first byte=', uBuf[0]);
  console.log('[SRP-MATH] K(hex)=', K.toString('hex'));

  // signature = HMAC-SHA256(K, deviceGroupKey | deviceKey | SECRET_BLOCK | timestamp)
  const msg = Buffer.concat([
    Buffer.from(deviceGroupKey, 'utf8'),
    Buffer.from(deviceKey, 'utf8'),
    secretBlock,
    Buffer.from(timestamp, 'utf8'),
  ]);
  const signature = crypto.createHmac('sha256', K).update(msg).digest('base64');

  return { signature };
}

/**
 * Returns the current UTC time in the format Cognito expects for SRP signatures:
 * "Mon Apr  6 12:34:56 UTC 2026"  (day is space-padded, not zero-padded)
 */
export function generateCognitoTimestamp(): string {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const day = DAYS[now.getUTCDay()];
  const month = MONTHS[now.getUTCMonth()];
  const date = String(now.getUTCDate()).padStart(2, ' ');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${day} ${month} ${date} ${hh}:${mm}:${ss} UTC ${now.getUTCFullYear()}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Modular exponentiation: base^exp mod modulus (BigInt).
 */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = BigInt(1);
  let b = base % mod;
  let e = exp;
  while (e > BigInt(0)) {
    if (e % BigInt(2) === BigInt(1)) result = (result * b) % mod;
    e = e / BigInt(2);
    b = (b * b) % mod;
  }
  return result;
}

/**
 * Converts a BigInt to a fixed-length Buffer (big-endian), padding with leading zeros.
 * Prepends 0x00 if the high bit of the first byte is set.
 */
function bigintToFixedBuffer(value: bigint, length: number): Buffer {
  const hex = value.toString(16).padStart(length * 2, '0');
  const buf = Buffer.from(hex.length % 2 === 0 ? hex : `0${hex}`, 'hex');
  return buf[0] >= 0x80 ? Buffer.concat([Buffer.alloc(1), buf]) : buf;
}

/**
 * Converts a hex string to a Buffer, ensuring even length and positive sign (no high bit).
 */
function hexToPositiveBuffer(hex: string): Buffer {
  const even = hex.length % 2 === 0 ? hex : `0${hex}`;
  const buf = Buffer.from(even, 'hex');
  return buf[0] >= 0x80 ? Buffer.concat([Buffer.alloc(1), buf]) : buf;
}
