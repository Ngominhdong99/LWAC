def test_get_vocab(client):
    res = client.get("/vocab/2")
    assert res.status_code in [200, 401]

def test_add_vocab(client):
    res = client.post("/vocab/2", json={
        "word": "hello",
        "meaning": "salutation"
    })
    assert res.status_code in [200, 401, 422]

def test_review_vocab(client):
    res = client.post("/vocab/2/bulk", json=[])
    assert res.status_code in [200, 401, 422]
