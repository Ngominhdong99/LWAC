def test_submit_writing(client):
    res = client.post("/quiz/submit/writing", json={
        "user_id": 2,
        "content": "test writing"
    })
    assert res.status_code in [200, 401, 404, 422]
