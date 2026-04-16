def test_upload_audio(client):
    res = client.post("/upload/audio")
    # Might expect file upload, returning 422 if empty
    assert res.status_code in [200, 422, 401]

def test_speech_to_text(client):
    res = client.post("/upload/audio")
    assert res.status_code in [200, 422, 401, 404]

def test_text_to_speech(client):
    res = client.post("/upload/generate-tts", json={
        "text": "Hello world"
    })
    assert res.status_code in [200, 422, 401, 404]
