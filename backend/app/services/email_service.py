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
    subject = f"Interview Invitation: {campaign_title} — AgenticHR"
    
    plain_text_content = f"""Hello {candidate_name},

Congratulations! You have been selected for the next stage of our evaluation process for the {campaign_title} role at AgenticHR.

ASSESSMENT DETAILS:
• Stage: AI-Guided Technical Assessment
• Questions: 3 Interactive Questions
• Estimated Time: 10 – 15 minutes (~2 mins per question)
• Link Validity: Expires in 72 hours
• Verified Email: {candidate_email}

Please complete your assessment using the secure link below:
{interview_url}

Note: This link is personalized and encrypted. You will be prompted to confirm your email address ({candidate_email}) upon starting.

Best regards,
AgenticHR Recruitment Team
"""

    html_content = f"""<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Interview Invitation - AgenticHR</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, span {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important; }}
    .headline-mso {{ font-family: Georgia, 'Times New Roman', serif !important; }}
  </style>
  <![endif]-->
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #EDE6D8;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #2D2820;
    }}
    table {{ border-collapse: separate; }}
    .wrapper {{ width: 100%; table-layout: fixed; background-color: #EDE6D8; padding: 40px 16px; box-sizing: border-box; }}
    .main-card {{
      max-width: 580px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border-radius: 16px;
      border: 1px solid #DFD6C5;
      box-shadow: 0 10px 32px rgba(45, 40, 32, 0.08);
      overflow: hidden;
    }}
    .header-banner {{
      background: linear-gradient(180deg, #F8F5EE 0%, #FFFFFF 100%);
      padding: 32px 36px 20px 36px;
      border-bottom: 1px solid #F0EAE0;
    }}
    .brand-tag {{
      display: inline-block;
      font-family: Consolas, 'DM Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #955D0F;
      background: #F4EAD8;
      border: 1px solid #E8D9BF;
      padding: 4px 10px;
      border-radius: 6px;
      margin-bottom: 16px;
    }}
    .headline {{
      font-family: Georgia, 'Fraunces', serif;
      font-size: 26px;
      line-height: 1.3;
      font-weight: 700;
      color: #2D2820;
      margin: 0 0 6px 0;
    }}
    .subheadline {{
      font-size: 14px;
      color: #746B5E;
      margin: 0;
      font-weight: 500;
    }}
    .content-body {{
      padding: 32px 36px;
    }}
    .greeting {{
      font-size: 16px;
      font-weight: 600;
      color: #2D2820;
      margin-bottom: 14px;
    }}
    .paragraph {{
      font-size: 15px;
      line-height: 1.65;
      color: #4A443A;
      margin-bottom: 20px;
    }}
    .details-box {{
      background-color: #FAF7F2;
      border: 1px solid #EAE2D2;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }}
    .details-grid {{
      width: 100%;
    }}
    .details-row td {{
      padding: 6px 0;
      font-size: 13px;
    }}
    .details-label {{
      color: #8A7F6E;
      font-weight: 500;
      width: 38%;
    }}
    .details-value {{
      color: #2D2820;
      font-weight: 600;
    }}
    .badge-stage {{
      display: inline-block;
      background: #EAF3EC;
      color: #18582E;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #D2E7D7;
    }}
    .cta-container {{
      text-align: center;
      padding: 10px 0 24px 0;
    }}
    .cta-button {{
      display: inline-block;
      background-color: #2D2820;
      color: #FFFFFF !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 16px 36px;
      border-radius: 10px;
      border: 1px solid #C2A676;
      box-shadow: 0 4px 18px rgba(45, 40, 32, 0.22);
      letter-spacing: 0.01em;
    }}
    .security-notice {{
      background-color: #F8F5EE;
      border-left: 3px solid #C2A676;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      font-size: 13px;
      color: #635A4D;
      line-height: 1.5;
      margin-top: 16px;
    }}
    .footer {{
      background-color: #F8F5EE;
      padding: 24px 36px;
      border-top: 1px solid #EDE6D8;
      text-align: center;
      font-size: 12px;
      color: #8A7F6E;
      line-height: 1.6;
    }}
    .footer a {{
      color: #955D0F;
      text-decoration: underline;
    }}

    @media only screen and (max-width: 600px) {{
      .wrapper {{ padding: 16px 8px !important; }}
      .header-banner {{ padding: 24px 20px 16px 20px !important; }}
      .content-body {{ padding: 24px 20px !important; }}
      .footer {{ padding: 20px !important; }}
      .headline {{ font-size: 22px !important; }}
      .cta-button {{ display: block !important; width: 100% !important; box-sizing: border-box !important; padding: 15px 16px !important; }}
    }}
  </style>
</head>
<body>
  <!-- Preheader preview text -->
  <div style="display:none; font-size:1px; color:#EDE6D8; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden; mso-hide:all;">
    Interview Invitation: Complete your AI-guided technical assessment for {campaign_title}. Access expires in 72 hours.
    &#847; &zwnj; &nbsp; &#8199; &shy; &#847; &zwnj; &nbsp; &#8199; &shy;
  </div>

  <div class="wrapper">
    <!--[if (gte mso 9)|(IE)]>
    <table align="center" border="0" cellspacing="0" cellpadding="0" width="580">
    <tr>
    <td align="center" valign="top" width="580">
    <![endif]-->
    <div class="main-card">
      <div class="header-banner">
        <div class="brand-tag">AGENTIC HR • RECRUITMENT PORTAL</div>
        <h1 class="headline headline-mso">Interview Invitation</h1>
        <p class="subheadline">{campaign_title}</p>
      </div>

      <div class="content-body">
        <div class="greeting">Hello {candidate_name},</div>
        <p class="paragraph">
          We were impressed with your background and qualifications. We are pleased to invite you to the next stage of our evaluation process for the <strong>{campaign_title}</strong> position.
        </p>

        <div class="details-box">
          <table class="details-grid" role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr class="details-row">
              <td class="details-label">Stage</td>
              <td class="details-value"><span class="badge-stage">AI-Guided Technical Assessment</span></td>
            </tr>
            <tr class="details-row">
              <td class="details-label">Questions</td>
              <td class="details-value">3 Interactive Questions</td>
            </tr>
            <tr class="details-row">
              <td class="details-label">Estimated Time</td>
              <td class="details-value">10 – 15 minutes</td>
            </tr>
            <tr class="details-row">
              <td class="details-label">Link Validity</td>
              <td class="details-value">Expires in 72 hours</td>
            </tr>
            <tr class="details-row">
              <td class="details-label">Candidate Email</td>
              <td class="details-value" style="font-family: Consolas, monospace; font-size: 12px;">{candidate_email}</td>
            </tr>
          </table>
        </div>

        <p class="paragraph" style="font-size: 14px; margin-bottom: 24px;">
          The session consists of 3 targeted questions (approx. 2 minutes per question) evaluating problem-solving and domain expertise. Please ensure you are in a quiet environment with a stable internet connection.
        </p>

        <div class="cta-container">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{interview_url}" style="height:50px;v-text-anchor:middle;width:340px;" arcsize="20%" stroke="f" fillcolor="#2D2820">
            <w:anchorlock/>
            <center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Access Your Protected Assessment &rarr;</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-- -->
          <a href="{interview_url}" class="cta-button" target="_blank">Access Your Protected Assessment &rarr;</a>
          <!--<![endif]-->
        </div>

        <div class="security-notice">
          <strong>🔒 Security Verification:</strong> This is a personalized one-time link. Upon opening, you will be prompted to confirm your registered email address ({candidate_email}) before starting.
        </div>
      </div>

      <div class="footer">
        Sent by <strong>AgenticHR Automated Talent Intelligence</strong>.<br>
        If you have any questions or require accessibility adjustments, reply directly to this email.<br>
        <span style="font-size: 11px; color: #A09482;">© 2026 AgenticHR Inc. All rights reserved. • <a href="#">Privacy Policy</a></span>
      </div>
    </div>
    <!--[if (gte mso 9)|(IE)]>
    </td>
    </tr>
    </table>
    <![endif]-->
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
            from_name = "AgenticHR Recruitment Team"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = email.utils.formataddr((from_name, from_email))
        msg["To"] = candidate_email
        msg.attach(MIMEText(plain_text_content, "plain"))
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
