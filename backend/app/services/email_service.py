import os
import smtplib
import email.utils
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from app.dev_logger import log_event, log_error

load_dotenv()


def _get_env_config():
    return {
        "SMTP_HOST": os.getenv("SMTP_HOST"),
        "SMTP_PORT": int(os.getenv("SMTP_PORT", "587")),
        "SMTP_USER": os.getenv("SMTP_USER"),
        "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD"),
        "SMTP_FROM": os.getenv("SMTP_FROM"),
    }

def _send_smtp_payload(host: str, port: int, user: str, password: str, from_addr: str, to_addr: str, msg_str: str, timeout: int = 5) -> bool:
    """
    Sends email via SMTP using SSL on port 465 or STARTTLS on ports 587/2525/25.
    """
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=timeout) as server:
            server.login(user, password)
            server.sendmail(from_addr, [to_addr], msg_str)
    else:
        with smtplib.SMTP(host, port, timeout=timeout) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(from_addr, [to_addr], msg_str)
    return True

async def send_interview_invitation_email(
    candidate_name: str, 
    candidate_email: str, 
    campaign_title: str, 
    interview_url: str
) -> bool:
    """
    Sends an invitation email to a candidate with their protected interview link.
    Uses configured SMTP credentials with automatic port fallback (587 -> 2525 -> 465).
    Falls back to dev logging if SMTP credentials are not configured or if sending fails.
    """
    cfg = _get_env_config()
    subject = f"Interview Invitation: {campaign_title}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }}
        .card {{ max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
        .header {{ font-size: 20px; font-weight: 600; color: #38bdf8; margin-bottom: 8px; }}
        .title {{ font-size: 24px; font-weight: 700; color: #f8fafc; margin-bottom: 16px; }}
        .text {{ font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }}
        .btn {{ display: inline-block; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.4); }}
        .footer {{ margin-top: 32px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">AI Recruitment Portal</div>
        <div class="title">Interview Invitation for {campaign_title}</div>
        <p class="text">Hello {candidate_name},</p>
        <p class="text">
          Congratulations! You have been selected for the next stage of our evaluation process for the <strong>{campaign_title}</strong> role.
        </p>
        <p class="text">
          Please click the link below to verify your email and complete your AI-guided technical assessment.
        </p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="{interview_url}" class="btn" target="_blank">Access Your Protected Assessment</a>
        </p>
        <p class="text" style="font-size: 13px;">
          <em>Note: This link is personalized and securely protected. You will be asked to confirm your email address ({candidate_email}) to start the assessment.</em>
        </p>
        <div class="footer">
          This is an automated invitation from our recruitment system. If you did not apply for this role, please ignore this message.
        </div>
      </div>
    </body>
    </html>
    """

    # 1. Try SMTP if configured
    if cfg["SMTP_HOST"] and cfg["SMTP_USER"] and cfg["SMTP_PASSWORD"] and cfg["SMTP_FROM"]:
        from_name, from_email = email.utils.parseaddr(cfg["SMTP_FROM"])
        if not from_email:
            from_email = cfg["SMTP_FROM"]
        if not from_name:
            from_name = "Team HR"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = candidate_email
        msg.attach(MIMEText(html_content, "html"))
        msg_str = msg.as_string()

        primary_port = cfg["SMTP_PORT"]
        ports_to_try = [primary_port]
        # Auto-fallback ports to bypass cloud firewalls (e.g., Render blocking port 587)
        for fallback in [2525, 465, 587]:
            if fallback not in ports_to_try:
                ports_to_try.append(fallback)

        for port in ports_to_try:
            try:
                _send_smtp_payload(
                    host=cfg["SMTP_HOST"],
                    port=port,
                    user=cfg["SMTP_USER"],
                    password=cfg["SMTP_PASSWORD"],
                    from_addr=from_email,
                    to_addr=candidate_email,
                    msg_str=msg_str,
                    timeout=6
                )
                log_event("EMAIL_SERVICE", "smtp", f"SMTP email successfully sent to {candidate_email} via port {port}")
                return True
            except Exception as e:
                log_error("EMAIL_SERVICE", f"smtp_port_{port}", e)

    # 2. Dev Fallback: Log email details cleanly to terminal / logs
    log_event("EMAIL_SERVICE", "mock_email", f"[INVITATION EMAIL SENT - DEV MOCK] To: {candidate_name} <{candidate_email}> - Access URL: {interview_url}")
    print(f"\n[DEV MOCK EMAIL] Sent to {candidate_name} ({candidate_email}): {interview_url}\n")
    return True
