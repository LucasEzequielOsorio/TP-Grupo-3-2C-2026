import './config.js';
import nodemailer from 'nodemailer';
const appUrl = new URL(process.env.APP_URL || 'http://127.0.0.1:4200');
const localHosts = ['127.0.0.1', 'localhost', '[::1]'];
if (
  appUrl.username ||
  appUrl.password ||
  appUrl.search ||
  appUrl.hash ||
  appUrl.pathname !== '/' ||
  (appUrl.protocol !== 'https:' &&
    !(appUrl.protocol === 'http:' && localHosts.includes(appUrl.hostname)))
)
  throw new Error('APP_URL debe ser el origen HTTPS de la tienda (HTTP solo para localhost)');
export const publicOrigin = appUrl.origin;
const host = process.env.SMTP_HOST || '127.0.0.1';
const local = localHosts.includes(host);
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.APP_URL ||
    appUrl.protocol !== 'https:' ||
    !process.env.SMTP_HOST ||
    local ||
    !process.env.MAIL_FROM)
) {
  throw new Error('Producción requiere APP_URL HTTPS, SMTP_HOST remoto y MAIL_FROM autorizado');
}
const port = Number(process.env.SMTP_PORT || (local ? 1025 : 587));
export const mailTransport = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: !local && port !== 465,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  disableFileAccess: true,
  disableUrlAccess: true,
});
export async function sendAccountMail(to, kind, token) {
  const resetUrl = publicOrigin + '/bienvenido/restablecer#token=' + token;
  const recovery = kind === 'recuperacion';
  const result = await mailTransport.sendMail({
    from: process.env.MAIL_FROM || 'TRAMA <no-reply@tienda.local>',
    to,
    subject: recovery ? 'Recuperá tu contraseña de TRAMA' : 'Se actualizó tu contraseña de TRAMA',
    text: recovery
      ? 'Recibimos una solicitud para restablecer tu contraseña de TRAMA.\n\nAbrí este enlace:\n' +
        resetUrl +
        '\n\nVence en 15 minutos y se puede usar una sola vez. Si pediste varios, usá el último. Si no lo solicitaste, ignorá este correo: tu contraseña sigue igual.'
      : 'Tu contraseña de TRAMA se actualizó y se cerraron las sesiones anteriores. Si no hiciste este cambio, recuperá tu cuenta desde ' +
        publicOrigin +
        '/bienvenido/recuperar',
  });
  console.info(`Correo de cuenta aceptado por SMTP (código ${/^\d{3}/.exec(result.response || '')?.[0] || 'sin código'}).`);
  return result;
}
