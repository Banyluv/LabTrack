const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[Email] SMTP not configured — emails will be logged only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  transporter.verify((err) => {
    if (err) console.warn('[Email] SMTP verification failed:', err.message);
    else console.log('[Email] SMTP ready');
  });

  return transporter;
}

const from = () => process.env.SMTP_FROM || 'noreply@labtrack.com';
const frontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Send email — falls back to console.log if SMTP not configured
 */
async function send(to, subject, html) {
  const t = getTransporter();
  if (!t) {
    console.log(`[Email] TO: ${to} | SUBJECT: ${subject}`);
    console.log(`[Email] BODY: ${html.replace(/<[^>]+>/g, ' ').substring(0, 200)}...`);
    return;
  }
  try {
    await t.sendMail({ from: from(), to, subject, html });
    console.log(`[Email] Sent "${subject}" → ${to}`);
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
  }
}

/**
 * Notify staff that their request was approved (includes delivery note link)
 */
async function sendApprovedEmail({ email, name, consumableName, quantity, unit, approvedQuantity, adminComment, requestId }) {
  const qty = approvedQuantity || quantity;
  const isPartial = approvedQuantity && approvedQuantity < quantity;
  const subject = `LabTrack: Your request #${requestId} has been approved`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:24px 32px">
        <h2 style="margin:0;font-size:20px">✅ Request Approved</h2>
        <p style="margin:8px 0 0;opacity:0.9;font-size:14px">Request #${requestId}</p>
      </div>
      <div style="padding:24px 32px">
        <p style="font-size:16px;margin:0 0 16px">Hello <strong>${name}</strong>,</p>
        <p style="font-size:14px;color:#4a5568;margin:0 0 20px">Your consumable request has been <strong style="color:#059669">approved</strong>.</p>
        
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr style="background:#f7fafc">
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568;width:150px">Consumable</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c">${consumableName}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568">Quantity Requested</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c">${quantity} ${unit}</td>
          </tr>
          <tr style="background:#f7fafc">
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568">Quantity Approved</td>
            <td style="padding:10px 14px;font-size:14px;color:#059669;font-weight:700">${qty} ${unit}${isPartial ? ` <span style="font-size:11px;color:#d97706;background:#fef3c7;padding:2px 8px;border-radius:10px">Partial</span>` : ''}</td>
          </tr>
          ${adminComment ? `
          <tr>
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568">Reason</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c"><em>"${adminComment}"</em></td>
          </tr>
          ` : ''}
        </table>

        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin-bottom:20px">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#065f46">📦 Delivery Note Available</p>
          <p style="margin:0;font-size:13px;color:#047857">A delivery note has been generated for this dispatch. <a href="${frontendUrl()}/request-consumables" style="color:#059669;font-weight:600">View in LabTrack</a></p>
        </div>

        <p style="font-size:13px;color:#a0aec0;margin:24px 0 0">This is an automated message from LabTrack.</p>
      </div>
    </div>
  `;
  await send(email, subject, html);
}

/**
 * Notify staff that their request was rejected
 */
async function sendRejectedEmail({ email, name, consumableName, quantity, unit, adminComment, requestId }) {
  const subject = `LabTrack: Your request #${requestId} has been rejected`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;padding:24px 32px">
        <h2 style="margin:0;font-size:20px">❌ Request Rejected</h2>
        <p style="margin:8px 0 0;opacity:0.9;font-size:14px">Request #${requestId}</p>
      </div>
      <div style="padding:24px 32px">
        <p style="font-size:16px;margin:0 0 16px">Hello <strong>${name}</strong>,</p>
        <p style="font-size:14px;color:#4a5568;margin:0 0 20px">Your consumable request has been <strong style="color:#dc2626">rejected</strong>.</p>
        
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr style="background:#f7fafc">
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568;width:150px">Consumable</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c">${consumableName}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568">Quantity Requested</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c">${quantity} ${unit}</td>
          </tr>
          ${adminComment ? `
          <tr style="background:#fef2f2">
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#991b1b">Reason</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c"><em>"${adminComment}"</em></td>
          </tr>
          ` : ''}
        </table>

        <p style="font-size:13px;color:#a0aec0;margin:24px 0 0">This is an automated message from LabTrack.</p>
      </div>
    </div>
  `;
  await send(email, subject, html);
}

module.exports = { sendApprovedEmail, sendRejectedEmail };