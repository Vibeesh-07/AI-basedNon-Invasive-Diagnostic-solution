"""
Flask API Backend for Sentinel 3 — AI-based Non-Invasive Diagnostic Solution

Models:
  1. Brain Tumor  — HuggingFace: Saitama30/brain_tumor_model.h5  (TensorFlow/Keras)
     Input: (None, 128, 128, 3)
     Endpoint: POST /predict/brain

  2. Skin Cancer  — Local: Models/ham10000.pt  (Ultralytics YOLO segmentation)
     Task: Segmentation  |  Classes: {0: 'cancer'}  |  Input: 640x640
     Endpoint: POST /predict/skin

Shared Endpoints:
  GET /health  — status of all loaded models
"""

import os
import io
import base64
import logging
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
SKIN_MODEL_PATH = os.path.join(BASE_DIR, "..", "Models", "ham10000.pt")

# ─── Model registry ───────────────────────────────────────────────────────────
brain_model = None
skin_yolo   = None

BRAIN_LABELS = ["Glioma Tumor", "Meningioma Tumor", "No Tumor", "Pituitary Tumor"]


# ─── Loaders ──────────────────────────────────────────────────────────────────

def load_brain_model():
    global brain_model
    if brain_model is not None:
        return brain_model
    import tensorflow as tf
    from huggingface_hub import hf_hub_download
    logger.info("Downloading brain tumor model from HuggingFace Hub...")
    path = hf_hub_download(repo_id="Saitama30/brain_tumor_model.h5", filename="brain_tumor_model.h5")
    brain_model = tf.keras.models.load_model(path, compile=False)
    logger.info(f"Brain model loaded. Input: {brain_model.input_shape}")
    return brain_model


def load_skin_model():
    global skin_yolo
    if skin_yolo is not None:
        return skin_yolo
    from ultralytics import YOLO
    abs_path = os.path.abspath(SKIN_MODEL_PATH)
    logger.info(f"Loading YOLO skin cancer model from: {abs_path}")
    skin_yolo = YOLO(abs_path)
    logger.info(f"Skin model loaded. Task: {skin_yolo.task} | Classes: {skin_yolo.names}")
    return skin_yolo


# ─── Brain helpers ────────────────────────────────────────────────────────────

def preprocess_brain(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((128, 128), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


def generate_gradcam(m, input_tensor: np.ndarray, class_index: int):
    try:
        import tensorflow as tf
        import cv2
        import matplotlib.cm as cm

        last_conv = None
        for layer in reversed(m.layers):
            if isinstance(layer, tf.keras.layers.Conv2D):
                last_conv = layer.name
                break
        if not last_conv:
            return None

        grad_model = tf.keras.models.Model(
            inputs=m.inputs,
            outputs=[m.get_layer(last_conv).output, m.output]
        )
        tensor = tf.cast(input_tensor, tf.float32)
        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model(tensor)
            loss = predictions[:, class_index]
        grads = tape.gradient(loss, conv_outputs)
        if grads is None:
            return None

        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_out = conv_outputs[0]
        heatmap = conv_out @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-8)
        heatmap = heatmap.numpy()

        h, w = 224, 224
        heatmap_resized = cv2.resize(heatmap, (w, h))
        heatmap_colored = cm.jet(heatmap_resized)[:, :, :3]
        heatmap_colored = np.uint8(255 * heatmap_colored)
        orig = np.uint8(input_tensor[0] * 255)
        orig_resized = cv2.resize(orig, (w, h))
        overlay = cv2.addWeighted(orig_resized, 0.6, heatmap_colored, 0.4, 0)

        buf = io.BytesIO()
        Image.fromarray(overlay).save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        logger.warning(f"Grad-CAM failed: {e}")
        return None


# ─── Skin (YOLO) helper ───────────────────────────────────────────────────────

def run_skin_inference(image_bytes: bytes):
    """
    Run YOLO segmentation on skin lesion image.
    Returns prediction, confidence, detection_count, annotated image.
    """
    import cv2

    model = load_skin_model()

    np_arr = np.frombuffer(image_bytes, np.uint8)
    img_cv = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

    results = model(img_cv, imgsz=640, conf=0.25, verbose=False)
    result  = results[0]

    detections = []
    if result.boxes is not None and len(result.boxes) > 0:
        for box in result.boxes:
            conf = float(box.conf[0])
            cls  = int(box.cls[0])
            detections.append({"class": model.names[cls], "confidence": round(conf * 100, 2)})

    detections.sort(key=lambda x: x["confidence"], reverse=True)

    detection_count   = len(detections)
    top_confidence    = detections[0]["confidence"] if detections else 0.0
    prediction        = "Cancer Detected" if detection_count > 0 else "No Cancer Detected"
    requires_attention = detection_count > 0

    # Annotated segmentation image
    annotated_bgr = result.plot()
    annotated_rgb = cv2.cvtColor(annotated_bgr, cv2.COLOR_BGR2RGB)
    buf = io.BytesIO()
    Image.fromarray(annotated_rgb).save(buf, format="PNG")
    annotated_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

    return {
        "prediction":         prediction,
        "confidence":         top_confidence,
        "detection_count":    detection_count,
        "detections":         detections,
        "requires_attention": requires_attention,
        "heatmap":            annotated_b64
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":             "ok",
        "brain_model_loaded": brain_model is not None,
        "skin_model_loaded":  skin_yolo is not None,
    })


@app.route("/predict/brain", methods=["POST"])
def predict_brain():
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({"error": "No file provided."}), 400
    try:
        image_bytes  = request.files["file"].read()
        m            = load_brain_model()
        input_tensor = preprocess_brain(image_bytes)
        preds        = m.predict(input_tensor, verbose=0)[0]
        idx          = int(np.argmax(preds))
        conf         = float(preds[idx]) * 100
        label        = BRAIN_LABELS[idx]
        heatmap      = generate_gradcam(m, input_tensor, idx)
        return jsonify({
            "prediction":        label,
            "confidence":        round(conf, 2),
            "class_index":       idx,
            "all_probabilities": {BRAIN_LABELS[i]: round(float(preds[i]) * 100, 2) for i in range(len(preds))},
            "requires_attention": label != "No Tumor",
            "heatmap":           heatmap
        })
    except Exception as e:
        logger.exception("Brain prediction error")
        return jsonify({"error": str(e)}), 500


@app.route("/predict/skin", methods=["POST"])
def predict_skin():
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({"error": "No file provided."}), 400
    try:
        result = run_skin_inference(request.files["file"].read())
        return jsonify(result)
    except Exception as e:
        logger.exception("Skin prediction error")
        return jsonify({"error": str(e)}), 500


# Backward-compat alias
@app.route("/predict", methods=["POST"])
def predict_legacy():
    return predict_brain()


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        load_brain_model()
        load_skin_model()
    except Exception as e:
        logger.warning(f"Pre-load warning: {e}")
    app.run(host="0.0.0.0", port=5000, debug=False)
