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
 * Device SRP helper — AC-010.
 *
 * Provides the SRP verifier generation required by Cognito ConfirmDevice,
 * called from verify-otp.handler.ts when rememberDevice=true.
 *
 * Note: DEVICE_SRP_AUTH challenge functions have been removed. AC-010 session
 * persistence now uses the refresh token flow (POST /v1/auth/refresh).
 */

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
  // Salt must have first byte < 0x80 so Cognito stores it as-is and returns it
  // as hex without stripping a leading 0x00. If we added a 0x00 prefix to force
  // positivity, Cognito would strip that byte when returning SALT in the challenge,
  // making the stored x unreproducible. Regenerate until first byte is safe.
  let saltRaw: Buffer;
  do {
    saltRaw = crypto.randomBytes(16);
  } while (saltRaw[0] >= 0x80);
  const saltBytes = saltRaw;
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

  return { passwordVerifier, salt, devicePassword };
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
