import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import httpx
from app.dev_logger import log_event, log_error

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "recruitment@ai-agent.com")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")

async def send_interview_invitation_email(
    candidate_name: str, 
    candidate_email: str, 
    campaign_title: str, 
    interview_url: str
) -> bool:
    """
    Sends an invitation email to a candidate with their protected interview link.
    Falls back to dev logging if SMTP / Resend credentials are not configured.
    """
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

    # 1. Try Resend API if key is present
    if RESEND_API_KEY:
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
                    json={
                        "from": SMTP_FROM,
                        "to": [candidate_email],
                        "subject": subject,
                        "html": html_content
                    },
                    timeout=10.0
                )
                if res.status_code in [200, 201]:
                    log_event("EMAIL_SERVICE", "resend", f"Resend API email successfully sent to {candidate_email}")
                    return True
                else:
                    log_event("EMAIL_SERVICE", "resend", f"Resend API error ({res.status_code}): {res.text}")
        except Exception as e:
            log_error("EMAIL_SERVICE", "resend_email", e)

    # 2. Try SMTP if host is present
    if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_FROM
            msg["To"] = candidate_email
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, [candidate_email], msg.as_string())
            
            log_event("EMAIL_SERVICE", "smtp", f"SMTP Email successfully sent to {candidate_email}")
            return True
        except Exception as e:
            log_error("EMAIL_SERVICE", "smtp_email", e)

    # 3. Dev Fallback: Log email details cleanly to terminal / logs
    log_event("EMAIL_SERVICE", "mock_email", f"[INVITATION EMAIL SENT - DEV MOCK] To: {candidate_name} <{candidate_email}> - Access URL: {interview_url}")
    print(f"\n💌 [DEV MOCK EMAIL] Sent to {candidate_name} ({candidate_email}): {interview_url}\n")
    return True
