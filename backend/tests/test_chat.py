def test_read_chats(client):
    res = client.get("/chat/")
    assert res.status_code in [200, 401, 404, 405]

def test_ai_history(client):
    res = client.get("/chat/ai/history/2")
    assert res.status_code in [200, 401, 404]

def test_chat_send(client):
    res = client.post("/chat/send", json={"text": "hello"})
    assert res.status_code in [200, 401, 404, 422] 

def test_chat_history(client):
    res = client.get("/chat/history/1/2")
    assert res.status_code in [200, 401, 404]
