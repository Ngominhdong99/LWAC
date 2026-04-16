def test_student_total(client):
    res = client.get("/rewards/total/2")
    assert res.status_code in [200, 401]

def test_student_history(client):
    res = client.get("/rewards/history/2")
    assert res.status_code in [200, 401]

def test_qr(client):
    res = client.get("/rewards/qr/2")
    assert res.status_code in [200, 401, 404]

def test_leaderboard(client):
    res = client.get("/rewards/requests")
    assert res.status_code in [200, 401]
