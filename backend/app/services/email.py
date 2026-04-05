import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import ssl

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
# Read from env. Fallback just in case, though they should be present
SENDER_EMAIL = os.getenv("EMAIL_USERNAME", "minhdong20499@gmail.com")
SENDER_PASSWORD = os.getenv("EMAIL_PASSWORD", "mzcwgfbksmvtgqbh")  # fallback to the supplied valid cred

def send_email(to_email: str, subject: str, html_body: str):
    """
    Sends an HTML email using Gmail SMTP.
    Used by BackgroundTasks.
    """
    if not to_email or not SENDER_PASSWORD:
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Minh Dong IELTS <{SENDER_EMAIL}>"
    msg["To"] = to_email

    part = MIMEText(html_body, "html")
    msg.attach(part)

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

# ─── EMAIL TEMPLATES ─────────────────────────────────────────────────────────────

BASE_HTML = """
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: 'Inter', sans-serif, Arial;
            background-color: #f8fafc;
            margin: 0;
            padding: 30px;
            color: #334155;
        }}
        .container {{
            max-width: 600px;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            margin: 0 auto;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }}
        .header {{
            background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            letter-spacing: 0.5px;
        }}
        .content {{
            padding: 40px 30px;
            line-height: 1.6;
        }}
        h2 {{
            color: #0d9488;
            font-size: 20px;
            margin-top: 0;
        }}
        .highlight-box {{
            background: #f0fdfa;
            border-left: 4px solid #14b8a6;
            padding: 15px 20px;
            border-radius: 0 8px 8px 0;
            margin: 20px 0;
        }}
        .btn {{
            display: inline-block;
            background: #0d9488;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
            text-align: center;
        }}
        .footer {{
            background: #f1f5f9;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SIT. Steps to IELTS</h1>
        </div>
        <div class="content">
            {content}
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="{link}" class="btn">View on Dashboard</a>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message from the Minh Dong IELTS Learning Platform.</p>
            <p>&copy; 2024 SIT Platform. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
"""

def send_assignment_email(student_email: str, student_name: str, lesson_title: str, lesson_type: str):
    content = f"""
    <h2>Hello {student_name},</h2>
    <p>Your coach <strong>Minh Dong</strong> has just assigned a new test for you to complete.</p>
    
    <div class="highlight-box">
        <p style="margin: 0;"><strong>Test Title:</strong> {lesson_title}</p>
        <p style="margin: 5px 0 0 0;"><strong>Type:</strong> {lesson_type}</p>
    </div>
    
    <p>Please log in to your dashboard to complete it at your earliest convenience.</p>
    """
    html_body = BASE_HTML.format(content=content, link="https://minhdong-edu.io.vn")
    send_email(student_email, f"📚 New Test Assigned: {lesson_title}", html_body)

def send_chat_reply_email(student_email: str, student_name: str):
    content = f"""
    <h2>Hello {student_name},</h2>
    <p>Your coach <strong>Minh Dong</strong> has just sent you a new message in the Chat Hub.</p>
    
    <div class="highlight-box">
        <p style="margin: 0;">You have an unread message waiting! Log in to view it and reply.</p>
    </div>
    """
    html_body = BASE_HTML.format(content=content, link="https://minhdong-edu.io.vn/chat")
    send_email(student_email, "💬 New Message from Coach Minh Dong", html_body)

def send_question_reply_email(student_email: str, student_name: str, question_text: str):
    content = f"""
    <h2>Hello {student_name},</h2>
    <p>Your coach <strong>Minh Dong</strong> has answered a question you asked via the AI Assistant.</p>
    
    <div class="highlight-box">
        <p style="margin: 0; font-style: italic;">"{question_text[:100]}{'...' if len(question_text) > 100 else ''}"</p>
    </div>
    
    <p>Log in to view the detailed answer from your coach.</p>
    """
    html_body = BASE_HTML.format(content=content, link="https://minhdong-edu.io.vn/hub")
    send_email(student_email, "📝 Coach answered your question", html_body)

def send_feedback_email(student_email: str, student_name: str, test_title: str):
    content = f"""
    <h2>Hello {student_name},</h2>
    <p>Great news! Your coach <strong>Minh Dong</strong> has finished grading and reviewed your test.</p>
    
    <div class="highlight-box">
        <p style="margin: 0;"><strong>Test:</strong> {test_title}</p>
    </div>
    
    <p>Detailed feedback, marks, and grammar corrections are now available for you to review.</p>
    """
    html_body = BASE_HTML.format(content=content, link="https://minhdong-edu.io.vn")
    send_email(student_email, f"✅ Test Graded: {test_title}", html_body)
