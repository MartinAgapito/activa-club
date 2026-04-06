import * as crypto from 'crypto';

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
 * Cognito expects the following:
 *   - Salt: 16 random bytes, base64-encoded.
 *   - PasswordVerifier: g^x mod N, where x = H(Salt | H(DeviceGroupKey:DeviceKey:DevicePassword)),
 *     base64-encoded.
 *
 * This follows the standard SRP-6a protocol as implemented by the AWS Amplify SDK.
 * Reference: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-device-tracking.html
 *
 * @param deviceGroupKey - The device group key from Cognito NewDeviceMetadata.
 * @param deviceKey      - The device key from Cognito NewDeviceMetadata.
 * @param devicePassword - A random password generated for this device (32 hex bytes).
 * @returns DeviceSrpVerifier containing passwordVerifier, salt, and devicePassword.
 */
export function generateDeviceSrpVerifier(
  deviceGroupKey: string,
  deviceKey: string,
  devicePassword: string,
): DeviceSrpVerifier {
  // ── SRP-6a parameters (same N and g used by Cognito) ─────────────────────
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

  const g = BigInt(2);
  const N = BigInt(`0x${N_HEX}`);

  // ── Generate a random 16-byte salt ────────────────────────────────────────
  // Cognito rejects salts/verifiers whose first byte >= 0x80 (interpreted as
  // negative in two's complement). Pad with 0x00 to ensure a positive value.
  const saltRaw = crypto.randomBytes(16);
  const saltBytes = saltRaw[0] >= 0x80 ? Buffer.concat([Buffer.alloc(1), saltRaw]) : saltRaw;
  const salt = saltBytes.toString('base64');

  // ── Compute x = H(salt || H(deviceGroupKey:deviceKey:devicePassword)) ────
  // Inner hash: SHA-256 of "deviceGroupKey:deviceKey:devicePassword"
  const innerHash = crypto
    .createHash('sha256')
    .update(`${deviceGroupKey}:${deviceKey}:${devicePassword}`)
    .digest();

  // Outer hash: SHA-256 of (saltBytes || innerHash)
  const xHash = crypto
    .createHash('sha256')
    .update(Buffer.concat([saltBytes, innerHash]))
    .digest('hex');

  const x = BigInt(`0x${xHash}`);

  // ── Compute verifier v = g^x mod N ────────────────────────────────────────
  const v = modPow(g, x, N);

  // Encode verifier as base64. If the first byte >= 0x80 Cognito rejects it as
  // "negative", so prepend a 0x00 byte to guarantee a positive big-endian integer.
  const vHex = v.toString(16);
  const vHexEven = vHex.length % 2 === 0 ? vHex : `0${vHex}`;
  const vBuf = Buffer.from(vHexEven, 'hex');
  const vPadded = vBuf[0] >= 0x80 ? Buffer.concat([Buffer.alloc(1), vBuf]) : vBuf;
  const passwordVerifier = vPadded.toString('base64');

  return { passwordVerifier, salt, devicePassword };
}

/**
 * Modular exponentiation: base^exp mod mod.
 * BigInt native exponentiation is used to handle the 2048-bit prime.
 */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = BigInt(1);
  let b = base % mod;
  let e = exp;

  while (e > BigInt(0)) {
    if (e % BigInt(2) === BigInt(1)) {
      result = (result * b) % mod;
    }
    e = e / BigInt(2);
    b = (b * b) % mod;
  }

  return result;
}
