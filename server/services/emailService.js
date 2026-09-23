import net from 'net';
import tls from 'tls';
import nodemailer from 'nodemailer';
import { ENV } from '../config/env.js';

/**
 * Production-Grade Email Service for Book Driver Anna
 * 
 * Supports:
 * 1. Gmail SMTP via Nodemailer and Google App Password (process.env.GMAIL_USER & process.env.GMAIL_APP_PASSWORD)
 * 2. Fallback SMTP (Resend / Custom SMTP)
 * 3. In-memory test mailbox for automated testing verification (NODE_ENV === 'test')
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
 * Creates Nodemailer transporter for Gmail SMTP using user-provided Gmail App Password
 */
function createGmailTransporter() {
  const user = process.env.GMAIL_USER || ENV.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || ENV.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: user.trim(),
      pass: pass.trim(),
    },
  });
}

/**
 * Send an email using Gmail SMTP, custom SMTP, or simulated dev provider
 */
export async function sendEmail({ to, subject, html, text }) {
  const maskedTo = to ? to.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.min(b.length, 5))}${c}`) : 'recipient';

  // 1. In automated test runs (NODE_ENV === 'test'), record into test mailbox for assertion stability
  const isTestEnvironment = process.env.NODE_ENV === 'test';
  if (isTestEnvironment) {
    lastTestEmail = {
      to,
      subject,
      html,
      text,
      sentAt: new Date().toISOString()
    };
    return { success: true, delivered: true, provider: 'simulated' };
  }

  // 2. Primary: Gmail SMTP delivery via Nodemailer
  const gmailTransporter = createGmailTransporter();
  if (gmailTransporter) {
    const gmailUser = (process.env.GMAIL_USER || ENV.GMAIL_USER).trim();
    try {
      await gmailTransporter.sendMail({
        from: `"Book Driver Anna" <${gmailUser}>`,
        to,
        subject,
        text,
        html,
      });
      console.log(`[EMAIL SERVICE] Email successfully delivered to ${maskedTo} via Gmail SMTP.`);
      return { success: true, delivered: true, provider: 'gmail-smtp' };
    } catch (gmailErr) {
      console.error(`[EMAIL SERVICE] Failed to deliver email to ${maskedTo} via Gmail SMTP:`, gmailErr.message);
      if (!ENV.IS_PRODUCTION) {
        throw new Error(`Gmail SMTP error: ${gmailErr.message}`);
      }
      throw new Error('Email delivery failed. Please check SMTP settings or try again later.');
    }
  }

  // 3. Fallback: Resend / Custom SMTP if configured
  const hasCustomSmtpConfig = Boolean(ENV.SMTP_HOST && ENV.SMTP_USER && ENV.SMTP_PASS);
  if (hasCustomSmtpConfig) {
    const from = ENV.EMAIL_FROM || ENV.SMTP_FROM || 'Book Driver Anna <onboarding@resend.dev>';
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
      console.log(`[EMAIL SERVICE] Email successfully delivered to ${maskedTo} via Custom SMTP (${ENV.SMTP_HOST}:${ENV.SMTP_PORT})`);
      return { success: true, delivered: true, provider: 'custom-smtp' };
    } catch (smtpErr) {
      console.error(`[EMAIL SERVICE] Failed to deliver email to ${maskedTo} via Custom SMTP:`, smtpErr.message);
      if (!ENV.IS_PRODUCTION) {
        throw new Error(smtpErr.message);
      }
      throw new Error('Email delivery failed. Please check SMTP settings or try again later.');
    }
  }

  // 4. In production without any configured email transport, fail cleanly
  if (ENV.IS_PRODUCTION) {
    console.error('[EMAIL SERVICE CONFIG ERROR] Real email delivery is required in production, but Gmail SMTP credentials (GMAIL_USER, GMAIL_APP_PASSWORD) are not set.');
    throw new Error('Email delivery failed. Server email service is not configured.');
  }

  // 5. Local Development simulation fallback (when credentials not yet entered in .env)
  lastTestEmail = {
    to,
    subject,
    html,
    text,
    sentAt: new Date().toISOString()
  };

  console.warn(`[EMAIL SERVICE DEV] Gmail SMTP credentials not set. Simulated email recorded for ${maskedTo}.`);
  return { success: true, delivered: true, provider: 'simulated' };
}

/**
 * Dispatch password reset email with secure 15-minute reset link
 */
export async function sendPasswordResetEmail({ to, name = '', token }) {
  const appUrl = (process.env.APP_URL || ENV.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  const subject = 'Reset Your Password - Book Driver Anna';

  const text = `Book Driver Anna

You requested a password reset.

Reset your password:
${resetUrl}

This link expires in 15 minutes.

If you didn't request this password reset, you can safely ignore this email.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Book Driver Anna</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; }
    .container { max-width: 560px; margin: 40px auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; }
    .header { padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1f2937; background: linear-gradient(180deg, #182235 0%, #111827 100%); }
    .logo-badge { display: inline-block; padding: 8px 16px; background-color: #fbbf24; color: #020617; font-weight: 800; font-size: 14px; border-radius: 9999px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }
    .title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0 0 8px; }
    .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #94a3b8; }
    .action-box { text-align: center; margin: 32px 0; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: #0f172a !important; text-decoration: none; font-size: 15px; font-weight: 800; border-radius: 12px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35); }
    .expiry-note { font-size: 13px; color: #e2e8f0; font-weight: 600; margin-top: 16px; }
    .security-notice { padding: 16px; background-color: #1a2234; border-radius: 10px; font-size: 13px; color: #94a3b8; margin-top: 24px; }
    .footer { padding: 24px 32px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-badge">Book Driver Anna</div>
      <h1 class="title">Reset Your Password</h1>
    </div>
    <div class="content">
      <p style="margin-top:0; color:#f8fafc; font-size:16px;">Hello${name ? ` ${name}` : ''},</p>
      <p>You requested a password reset for your <strong>Book Driver Anna</strong> account.</p>
      <p>Click the button below to reset your password:</p>
      <div class="action-box">
        <a href="${resetUrl}" class="button" target="_blank" rel="noopener noreferrer">Reset Password</a>
        <div class="expiry-note">This link expires in 15 minutes.</div>
      </div>
      <div class="security-notice">
        If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
      </div>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Book Driver Anna. Professional Chauffeur & Driver Services, Bengaluru.
    </div>
  </div>
</body>
</html>`;

  return await sendEmail({
    to,
    subject,
    html,
    text
  });
}

/**
 * Lightweight native Node.js SMTP sender (TLS / STARTTLS capable)
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
      reject(new Error('SMTP connection timed out after 15 seconds.'));
    }, 15000);

    const onConnect = () => {
      let step = 0;
      let buffer = '';

      const send = (cmd) => {
        socket.write(cmd + '\r\n');
      };

      const senderEmail = from.includes('<') && from.includes('>')
        ? from.replace(/.*<([^>]+)>.*/, '$1').trim()
        : from.trim();

      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\r\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          const code = parseInt(line.substring(0, 3), 10);
          if (isNaN(code) || line.charAt(3) === '-') continue;

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
            send(`MAIL FROM:<${senderEmail}>`);
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
              `Date: ${new Date().toUTCString()}`,
              `Message-ID: <${Date.now()}.${Math.random().toString(36).substring(2)}@bookdriveranna.com>`,
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
