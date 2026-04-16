def test_daily_quiz_uses_master_vocabulary_entries_with_vietnamese_meaning(
    client, auth_headers
):
    res = client.get("/daily_quiz/questions/2", headers=auth_headers)

    assert res.status_code == 200
    data = res.json()
    assert data["completed"] is False
    assert len(data["questions"]) == 20
    assert any(
        any(ch in question["meaning"] for ch in "ăâđêôơưÁÀẢÃẠáàảãạ")
        for question in data["questions"]
    )


def test_get_daily_quiz(client):
    res = client.get("/daily_quiz/questions/2")
    assert res.status_code in [200, 401, 404]

def test_submit_daily_quiz(client):
    res = client.post("/daily_quiz/submit", json={
        "user_id": 2,
        "answers": {"1": "test"}
    })
    assert res.status_code in [200, 401, 404, 422]
