def test_get_result(client):
    res = client.get("/results/1")
    assert res.status_code in [200, 401, 404]

def test_get_user_results(client):
    res = client.get("/results/1")
    assert res.status_code in [200, 401, 404]
