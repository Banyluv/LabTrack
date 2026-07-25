import os
import smtplib
import re
from email.mime.text import MIMEText


def _from_addr():
    return os.environ.get("SMTP_FROM") or "noreply@labtrack.com"


def _frontend_url():
    return os.environ.get("FRONTEND_URL") or "http://localhost:5173"


def send_email(to, subject, html):
    host = os.environ.get("SMTP_HOST")
    port = int(os.environ.get("SMTP_PORT") or 587)
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASS")

    if not host or not user or not password:
        stripped = re.sub(r"<[^>]+>", " ", html)[:200]
        print(f"[Email] TO: {to} | SUBJECT: {subject}")
        print(f"[Email] BODY: {stripped}...")
        return

    try:
        msg = MIMEText(html, "html")
        msg["Subject"] = subject
        msg["From"] = _from_addr()
        msg["To"] = to

        if port == 465:
            with smtplib.SMTP_SSL(host, port) as server:
                server.login(user, password)
                server.sendmail(_from_addr(), [to], msg.as_string())
        else:
            with smtplib.SMTP(host, port) as server:
                server.starttls()
                server.login(user, password)
                server.sendmail(_from_addr(), [to], msg.as_string())
        print(f'[Email] Sent "{subject}" -> {to}')
    except Exception as err:
        print(f"[Email] Failed to send to {to}: {err}")


def send_approved_email(email, name, consumable_name, quantity, unit, approved_quantity, admin_comment, request_id):
    qty = approved_quantity or quantity
    is_partial = approved_quantity and approved_quantity < quantity
    subject = f"LabTrack: Your request #{request_id} has been approved"
    partial_badge = (
        ' <span style="font-size:11px;color:#d97706;background:#fef3c7;padding:2px 8px;border-radius:10px">Partial</span>'
        if is_partial
        else ""
    )
    comment_row = (
        f"""
          <tr>
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568">Reason</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c"><em>"{admin_comment}"</em></td>
          </tr>
        """
        if admin_comment
        else ""
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:24px 32px">
        <h2 style="margin:0;font-size:20px">Request Approved</h2>
        <p style="margin:8px 0 0;opacity:0.9;font-size:14px">Request #{request_id}</p>
      </div>
      <div style="padding:24px 32px">
        <p style="font-size:16px;margin:0 0 16px">Hello <strong>{name}</strong>,</p>
        <p style="font-size:14px;color:#4a5568;margin:0 0 20px">Your consumable request has been <strong style="color:#059669">approved</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr style="background:#f7fafc">
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568;width:150px">Consumable</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c">{consumable_name}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568">Quantity Requested</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c">{quantity} {unit}</td>
          </tr>
          <tr style="background:#f7fafc">
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568">Quantity Approved</td>
            <td style="padding:10px 14px;font-size:14px;color:#059669;font-weight:700">{qty} {unit}{partial_badge}</td>
          </tr>
          {comment_row}
        </table>
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin-bottom:20px">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#065f46">Delivery Note Available</p>
          <p style="margin:0;font-size:13px;color:#047857">A delivery note has been generated for this dispatch. <a href="{_frontend_url()}/request-consumables" style="color:#059669;font-weight:600">View in LabTrack</a></p>
        </div>
        <p style="font-size:13px;color:#a0aec0;margin:24px 0 0">This is an automated message from LabTrack.</p>
      </div>
    </div>
    """
    send_email(email, subject, html)


def send_rejected_email(email, name, consumable_name, quantity, unit, admin_comment, request_id):
    subject = f"LabTrack: Your request #{request_id} has been rejected"
    comment_row = (
        f"""
          <tr style="background:#fef2f2">
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#991b1b">Reason</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c"><em>"{admin_comment}"</em></td>
          </tr>
        """
        if admin_comment
        else ""
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;padding:24px 32px">
        <h2 style="margin:0;font-size:20px">Request Rejected</h2>
        <p style="margin:8px 0 0;opacity:0.9;font-size:14px">Request #{request_id}</p>
      </div>
      <div style="padding:24px 32px">
        <p style="font-size:16px;margin:0 0 16px">Hello <strong>{name}</strong>,</p>
        <p style="font-size:14px;color:#4a5568;margin:0 0 20px">Your consumable request has been <strong style="color:#dc2626">rejected</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
          <tr style="background:#f7fafc">
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568;width:150px">Consumable</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c">{consumable_name}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:600;font-size:13px;color:#4a5568">Quantity Requested</td>
            <td style="padding:10px 14px;font-size:14px;color:#1a202c">{quantity} {unit}</td>
          </tr>
          {comment_row}
        </table>
        <p style="font-size:13px;color:#a0aec0;margin:24px 0 0">This is an automated message from LabTrack.</p>
      </div>
    </div>
    """
    send_email(email, subject, html)
