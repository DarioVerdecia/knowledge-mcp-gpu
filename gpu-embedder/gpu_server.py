import os
from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer

app = Flask(__name__)

MODEL_ID = "BAAI/bge-small-en-v1.5"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_OV_PATH = os.path.join(SCRIPT_DIR, "ov_model_cache")
CACHE_MARKER = os.path.join(LOCAL_OV_PATH, "openvino", "openvino_model.xml")

if os.path.exists(CACHE_MARKER):
    print(f"Cache local encontrado. Cargando modelo OpenVINO ya exportado desde {LOCAL_OV_PATH} ...")
    model = SentenceTransformer(
        LOCAL_OV_PATH,
        backend="openvino",
        model_kwargs={"device": "GPU"}
    )
else:
    print("No hay cache local todavia. Exportando BGE-small-en-v1.5 a OpenVINO (unica vez)...")
    model = SentenceTransformer(
        MODEL_ID,
        backend="openvino",
        model_kwargs={"device": "GPU"}
    )
    print(f"Guardando modelo exportado en {LOCAL_OV_PATH} para arranques futuros...")
    os.makedirs(LOCAL_OV_PATH, exist_ok=True)
    model.save_pretrained(LOCAL_OV_PATH)

print("GPU Embedder listo.")

@app.post("/embed")
def embed():
    data = request.get_json()
    texts = data.get("texts", [])
    mode = data.get("mode", "document")

    if not texts:
        return jsonify({"embeddings": []})

    if mode == "query":
        embeddings = model.encode_query(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=False
        )
    else:
        embeddings = model.encode_document(
            texts,
            batch_size=32,
            normalize_embeddings=True,
            show_progress_bar=False
        )

    return jsonify({
        "embeddings": embeddings.tolist()
    })

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "device": "GPU"
    })

app.run(
    host="0.0.0.0",
    port=8090,
    threaded=True
)
