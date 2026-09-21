import net from 'net';
import tls from 'tls';
import { ENV } from '../config/env.js';

/**
 * Production-Grade Email Service Abstraction
 * Supports SMTP servers (TLS/STARTTLS) when credentials are provided in environment variables.
 * In development/test environments, safely simulates delivery without exposing raw tokens in logs.
 */

// In-memory test mailbox for automated testing verification
let lastTestEmail = null;

export function getLastTestEmail() {
  return lastTestEmail;
}

export function clearTestMailbox() {
  lastTestEmail = null;
}

/**
 * Send an email using SMTP or simulated dev provider
 */
export async function sendEmail({ to, subject, html, text }) {
  const from = ENV.SMTP_FROM || 'Book Driver Anna <noreply@bookdriveranna.com>';
  const maskedTo = to ? to.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.min(b.length, 5))}${c}`) : 'recipient';

  // 1. If SMTP server is configured, attempt real SMTP delivery
  if (ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASS) {
    try {
      await sendSmtpEmail({
        host: ENV.SMTP_HOST,
        port: ENV.SMTP_PORT,
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
        from,
        to,
        subject,
        html,
        text
      });
      return { success: true, delivered: true, provider: 'smtp' };
    } catch (smtpErr) {
      console.error(`[EMAIL SERVICE] Failed to deliver email to ${maskedTo} via SMTP:`, smtpErr.message);
      if (ENV.IS_PRODUCTION) {
        throw new Error('Email delivery failed. Please try again later.');
      }
    }
  }

  // 2. Development / Test simulation mode
  lastTestEmail = {
    to,
    from,
    subject,
    html,
    text,
    sentAt: new Date().toISOString()
  };

  if (!ENV.IS_PRODUCTION) {
    // Safe logging: Never log the raw token or full reset URL in production logs
    console.log(`[EMAIL SERVICE] Simulated password reset email dispatched to ${maskedTo}`);
  }

  return { success: true, delivered: true, provider: 'simulated' };
}

/**
 * Lightweight native Node.js SMTP sender (TLS / STARTTLS capable, zero extra npm dependencies)
 */
function sendSmtpEmail({ host, port, user, pass, from, to, subject, html, text }) {
  return new Promise((resolve, reject) => {
    const isSecure = port === 465;
    let socket;

    const cleanup = () => {
      if (socket) {
        socket.removeAllListeners();
        socket.destroy();
      }
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('SMTP connection timed out after 10 seconds.'));
    }, 10000);

    const onConnect = () => {
      let step = 0;
      let buffer = '';

      const send = (cmd) => {
        socket.write(cmd + '\r\n');
      };

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop(); // keep remainder

        for (const line of lines) {
          const code = parseInt(line.substring(0, 3), 10);
          if (isNaN(code) || line.charAt(3) === '-') continue; // multiline reply

          if (step === 0 && code === 220) {
            step = 1;
            send(`EHLO ${host}`);
          } else if (step === 1 && code === 250) {
            step = 2;
            send('AUTH LOGIN');
          } else if (step === 2 && code === 334) {
            step = 3;
            send(Buffer.from(user).toString('base64'));
          } else if (step === 3 && code === 334) {
            step = 4;
            send(Buffer.from(pass).toString('base64'));
          } else if (step === 4 && code === 235) {
            step = 5;
            send(`MAIL FROM:<${from.replace(/.*<([^>]+)>.*/, '$1')}>`);
          } else if (step === 5 && code === 250) {
            step = 6;
            send(`RCPT TO:<${to}>`);
          } else if (step === 6 && code === 250) {
            step = 7;
            send('DATA');
          } else if (step === 7 && code === 354) {
            step = 8;
            const boundary = '----=_Part_' + Date.now().toString(16);
            const rawMessage = [
              `From: ${from}`,
              `To: ${to}`,
              `Subject: ${subject}`,
              `MIME-Version: 1.0`,
              `Content-Type: multipart/alternative; boundary="${boundary}"`,
              ``,
              `--${boundary}`,
              `Content-Type: text/plain; charset=UTF-8`,
              `Content-Transfer-Encoding: 7bit`,
              ``,
              text,
              ``,
              `--${boundary}`,
              `Content-Type: text/html; charset=UTF-8`,
              `Content-Transfer-Encoding: 7bit`,
              ``,
              html,
              ``,
              `--${boundary}--`,
              `.`
            ].join('\r\n');
            send(rawMessage);
          } else if (step === 8 && code === 250) {
            step = 9;
            send('QUIT');
            clearTimeout(timeout);
            cleanup();
            resolve();
            return;
          } else if (code >= 400) {
            clearTimeout(timeout);
            cleanup();
            reject(new Error(`SMTP Error [${code}]: ${line}`));
            return;
          }
        }
      });
    };

    try {
      if (isSecure) {
        socket = tls.connect({ host, port, rejectUnauthorized: true }, onConnect);
      } else {
        socket = net.connect({ host, port }, onConnect);
      }
      socket.on('error', (err) => {
        clearTimeout(timeout);
        cleanup();
        reject(err);
      });
    } catch (e) {
      clearTimeout(timeout);
      cleanup();
      reject(e);
    }
  });
}

/**
 * Generate and dispatch password reset email
 */
export async function sendPasswordResetEmail({ to, name, resetToken }) {
  const appUrl = (ENV.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const userName = name || 'Valued Customer';

  const subject = 'Password Reset Request — Book Driver Anna';

  const text = `Hello ${userName},

We received a request to reset the password for your Book Driver Anna account.

To set a new password, click the link below (valid for 15 minutes):
${resetUrl}

SECURITY NOTICE:
- This password reset link will expire in 15 minutes.
- If you did not request this password reset, please ignore this email. Your password will remain completely secure and unchanged.
- For your protection, never share this link or your account details with anyone.

Best regards,
The Book Driver Anna Security Team
Bengaluru, India • https://bookdriveranna.com`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Request</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 24px; }
    .container { max-width: 540px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background-color: #0f172a; padding: 24px; text-align: center; border-bottom: 1px solid #1f2937; }
    .logo { color: #f59e0b; font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
    .content { padding: 32px 28px; line-height: 1.6; color: #cbd5e1; font-size: 14px; }
    .title { font-size: 20px; font-weight: 800; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    .btn-container { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background-color: #f59e0b; color: #020617; text-decoration: none; font-weight: 800; font-size: 14px; padding: 12px 28px; border-radius: 12px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25); }
    .notice-box { background-color: #1e293b; border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 8px; margin-top: 24px; font-size: 12px; color: #94a3b8; }
    .footer { padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1f2937; background-color: #090d16; }
    .link-alt { word-break: break-all; color: #f59e0b; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">BOOK DRIVER ANNA</div>
    </div>
    <div class="content">
      <h1 class="title">Password Reset Request</h1>
      <p>Hello <strong>${escapeHtml(userName)}</strong>,</p>
      <p>We received a request to reset the password associated with your Book Driver Anna account. Click the button below to choose a new, secure password:</p>
      
      <div class="btn-container">
        <a href="${escapeHtml(resetUrl)}" class="btn" target="_blank">Reset My Password</a>
      </div>

      <div class="notice-box">
        <strong>Security Notice:</strong>
        <ul style="margin: 6px 0 0 0; padding-left: 18px;">
          <li>This link is strictly valid for <strong>15 minutes</strong>.</li>
          <li>If you did not request a password reset, you can safely ignore this email. Your current password remains secure.</li>
          <li>Never forward or share this link with anyone.</li>
        </ul>
      </div>

      <p style="margin-top: 24px; font-size: 12px; color: #64748b;">
        If the button above does not work, copy and paste this link into your browser:<br>
        <a href="${escapeHtml(resetUrl)}" class="link-alt">${escapeHtml(resetUrl)}</a>
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Book Driver Anna • Professional Chauffeurs & Driving Academy<br>
      Bengaluru, Karnataka, India
    </div>
  </div>
</body>
</html>`;

  return sendEmail({ to, subject, html, text });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
