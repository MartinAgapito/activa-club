import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const kms = new KMSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
const ses = new SESClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

interface CognitoCustomEmailEvent {
  triggerSource: string;
  region: string;
  userPoolId: string;
  userName: string;
  request: {
    userAttributes: Record<string, string>;
    code: string;
  };
}

export const handler = async (event: CognitoCustomEmailEvent): Promise<void> => {
  const { triggerSource, request } = event;
  const { userAttributes, code: encryptedCode } = request;

  const email = userAttributes.email;
  const name = userAttributes.name || email;

  // Debug: log event shape to understand what Cognito is sending
  console.log('[email-sender] triggerSource:', triggerSource);
  console.log('[email-sender] code length:', encryptedCode?.length);
  console.log('[email-sender] code prefix:', encryptedCode?.substring(0, 40));
  console.log('[email-sender] full event keys:', JSON.stringify(Object.keys(event)));
  console.log('[email-sender] request keys:', JSON.stringify(Object.keys(request)));

  // Decrypt the code that Cognito encrypted with KMS.
  // EncryptionContext is intentionally omitted: testing whether Cognito encrypts
  // without one. If it does, providing a context would cause InvalidCiphertextException.
  const decryptResponse = await kms.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedCode, 'base64'),
    }),
  );
  const decryptedCode = Buffer.from(decryptResponse.Plaintext!).toString('utf-8');

  const fromEmail = process.env.SES_FROM_EMAIL!;
  const frontendUrl = process.env.FRONTEND_URL!;

  if (
    triggerSource === 'CustomEmailSender_SignUp' ||
    triggerSource === 'CustomEmailSender_ResendCode'
  ) {
    // Verification link email (registration)
    const verifyUrl = `${frontendUrl}/auth/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(decryptedCode)}`;

    await ses.send(
      new SendEmailCommand({
        Source: `Activa Club <${fromEmail}>`,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: 'Verificá tu cuenta — Activa Club', Charset: 'UTF-8' },
          Body: {
            Html: { Data: buildVerificationEmailHtml(name, verifyUrl), Charset: 'UTF-8' },
            Text: {
              Data: `Verificá tu cuenta en Activa Club haciendo clic en este link: ${verifyUrl}\n\nEl link vence en 24 horas.`,
              Charset: 'UTF-8',
            },
          },
        },
      }),
    );
  } else if (triggerSource === 'CustomEmailSender_Authentication') {
    // OTP email (login MFA)
    await ses.send(
      new SendEmailCommand({
        Source: `Activa Club <${fromEmail}>`,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: 'Tu código de acceso — Activa Club', Charset: 'UTF-8' },
          Body: {
            Html: { Data: buildOtpEmailHtml(name, decryptedCode), Charset: 'UTF-8' },
            Text: {
              Data: `Tu código de acceso a Activa Club es: ${decryptedCode}\n\nEste código vence en 3 minutos. No lo compartas con nadie.`,
              Charset: 'UTF-8',
            },
          },
        },
      }),
    );
  }
};

function buildVerificationEmailHtml(name: string, verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificá tu cuenta — Activa Club</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Activa Club</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:600;">¡Bienvenido/a, ${name}!</h2>
              <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
                Gracias por registrarte en Activa Club. Para activar tu cuenta y comenzar a disfrutar de todos los beneficios, hacé clic en el botón a continuación.
              </p>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${verifyUrl}" style="display:inline-block;background-color:#0f172a;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;">
                      Verificar mi cuenta
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;">
                Si el botón no funciona, copiá y pegá este link en tu navegador:
              </p>
              <p style="margin:0 0 24px;word-break:break-all;">
                <a href="${verifyUrl}" style="color:#0f172a;font-size:13px;">${verifyUrl}</a>
              </p>
              <p style="margin:0;color:#94a3b8;font-size:13px;">
                Este link vence en <strong>24 horas</strong>. Si no creaste esta cuenta, podés ignorar este email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f5f9;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:13px;">
                © ${new Date().getFullYear()} Activa Club · Todos los derechos reservados
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOtpEmailHtml(name: string, code: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu código de acceso — Activa Club</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Activa Club</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;font-weight:600;">Código de acceso</h2>
              <p style="margin:0 0 32px;color:#475569;font-size:15px;line-height:1.6;">
                Hola ${name}, usá el siguiente código para completar tu inicio de sesión.
              </p>
              <!-- OTP Code Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 32px;">
                    <div style="display:inline-block;background-color:#f1f5f9;border:2px solid #e2e8f0;border-radius:12px;padding:20px 40px;">
                      <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#0f172a;font-family:'Courier New',monospace;">${code}</span>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;color:#ef4444;font-size:14px;font-weight:500;text-align:center;">
                ⏱ Este código vence en <strong>3 minutos</strong>
              </p>
              <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">
                Si no intentaste iniciar sesión, ignorá este email. Nunca te pediremos este código por teléfono o chat.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f5f9;padding:24px 40px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:13px;">
                © ${new Date().getFullYear()} Activa Club · Todos los derechos reservados
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
