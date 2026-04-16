import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
from pathlib import Path

from core.config import settings

TEMPLATE_DIR = Path(__file__).resolve().parent / "email_templates"


def _read_template(template_name: str) -> str:
    return (TEMPLATE_DIR / template_name).read_text(encoding="utf-8")


def render_email_body(template_name: str, **context: str) -> str:
    return _read_template(template_name).format(**context)


def render_email_layout(content: str, *, link: str) -> str:
    return _read_template("base.html").format(content=content, link=link)


def render_question_preview(question_text: str) -> str:
    if len(question_text) <= 100:
        return question_text
    return question_text[:100] + "..."


def send_email(to_email: str, subject: str, html_body: str):
    if not to_email or not settings.EMAIL_USERNAME or not settings.EMAIL_PASSWORD:
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_USERNAME}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(settings.EMAIL_USERNAME, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_USERNAME, to_email, msg.as_string())
    except Exception as exc:
        print(f"Failed to send email to {to_email}: {exc}")


def send_assignment_email(
    student_email: str, student_name: str, lesson_title: str, lesson_type: str
):
    body_html = render_email_body(
        "assignment_email.html",
        student_name=escape(student_name),
        coach_name=escape(settings.EMAIL_COACH_NAME),
        lesson_title=escape(lesson_title),
        lesson_type=escape(lesson_type),
    )
    html_body = render_email_layout(body_html, link=settings.PLATFORM_URL)
    send_email(student_email, f"📚 New Test Assigned: {lesson_title}", html_body)


def send_chat_reply_email(student_email: str, student_name: str):
    body_html = render_email_body(
        "chat_reply_email.html",
        student_name=escape(student_name),
        coach_name=escape(settings.EMAIL_COACH_NAME),
    )
    html_body = render_email_layout(body_html, link=f"{settings.PLATFORM_URL}/chat")
    send_email(student_email, "💬 New Message from Coach Minh Dong", html_body)


def send_question_reply_email(
    student_email: str, student_name: str, question_text: str
):
    body_html = render_email_body(
        "question_reply_email.html",
        student_name=escape(student_name),
        coach_name=escape(settings.EMAIL_COACH_NAME),
        question_preview=escape(render_question_preview(question_text)),
    )
    html_body = render_email_layout(body_html, link=f"{settings.PLATFORM_URL}/hub")
    send_email(student_email, "📝 Coach answered your question", html_body)


def send_feedback_email(student_email: str, student_name: str, test_title: str):
    body_html = render_email_body(
        "feedback_email.html",
        student_name=escape(student_name),
        coach_name=escape(settings.EMAIL_COACH_NAME),
        test_title=escape(test_title),
    )
    html_body = render_email_layout(body_html, link=settings.PLATFORM_URL)
    send_email(student_email, f"✅ Test Graded: {test_title}", html_body)
