from services.email import (
    render_email_body,
    render_email_layout,
    render_question_preview,
)


def test_render_email_layout_uses_explicit_html_files():
    body_html = render_email_body(
        "assignment_email.html",
        student_name="Alice",
        coach_name="Minh Dong",
        lesson_title="Reading Practice 1",
        lesson_type="reading",
    )

    html = render_email_layout(
        body_html,
        link="https://minhdong-edu.io.vn",
    )

    assert "Hello Alice" in html
    assert "Reading Practice 1" in html
    assert "View on Dashboard" in html
    assert "<html>" in html


def test_render_question_preview_truncates_long_text():
    preview = render_question_preview("x" * 120)
    assert preview == ("x" * 100) + "..."
