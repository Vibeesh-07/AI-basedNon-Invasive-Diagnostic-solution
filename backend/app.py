"""
Flask API Backend for Sentinel 3 — AI-based Non-Invasive Diagnostic Solution

Models:
  1. Brain Tumor — HuggingFace: Saitama30/brain_tumor_model.h5
     Input: (None, 128, 128, 3)
     Endpoint: POST /predict/brain

  2. Skin Cancer — Local: Models/Skin Cancer.h5
     Input: (None, 28, 28, 3)   [auto-resized from any uploaded image]
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

# ─── Model registry ───────────────────────────────────────────────────────────

brain_model = None           # lazy-loaded
skin_model = None            # lazy-loaded
skin_class_labels = None     # resolved at load time from model output shape

BRAIN_LABELS  = ["Glioma Tumor", "Meningioma Tumor", "No Tumor", "Pituitary Tumor"]

# HAM10000 7-class labels (most common for 28×28 skin models)
SKIN_LABELS_7 = [
    "Actinic Keratosis",
    "Basal Cell Carcinoma",
    "Benign Keratosis",
    "Dermatofibroma",
    "Melanoma",
    "Melanocytic Nevi",
    "Vascular Lesion"
]
# Fallback: binary
SKIN_LABELS_2  = ["Benign", "Malignant"]

SKIN_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "Models", "Skin Cancer.h5")


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
    global skin_model, skin_class_labels
    if skin_model is not None:
        return skin_model
    import tensorflow as tf
    abs_path = os.path.abspath(SKIN_MODEL_PATH)
    logger.info(f"Loading skin cancer model from: {abs_path}")
    skin_model = tf.keras.models.load_model(abs_path, compile=False)
    num_classes = skin_model.output_shape[-1]
    logger.info(f"Skin model loaded. Input: {skin_model.input_shape}, Classes: {num_classes}")
    # Resolve labels based on output size
    if num_classes == 7:
        skin_class_labels = SKIN_LABELS_7
    elif num_classes == 2:
        skin_class_labels = SKIN_LABELS_2
    else:
        skin_class_labels = [f"Class {i}" for i in range(num_classes)]
    return skin_model


# ─── Preprocessing ────────────────────────────────────────────────────────────

def preprocess(image_bytes: bytes, size: tuple) -> np.ndarray:
    """Resize image to target size, normalise to [0,1], return (1, H, W, 3)."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize(size, Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)


# ─── Grad-CAM ─────────────────────────────────────────────────────────────────

def generate_gradcam(m, input_tensor: np.ndarray, class_index: int, display_size: tuple):
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

        h, w = display_size
        heatmap_resized = cv2.resize(heatmap, (w, h))
        heatmap_colored = cm.jet(heatmap_resized)[:, :, :3]
        heatmap_colored = np.uint8(255 * heatmap_colored)

        # Scale original back to display size for overlay
        orig = np.uint8(input_tensor[0] * 255)
        orig_resized = cv2.resize(orig, (w, h))
        overlay = cv2.addWeighted(orig_resized, 0.6, heatmap_colored, 0.4, 0)

        buf = io.BytesIO()
        Image.fromarray(overlay).save(buf, format="PNG")
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception as e:
        logger.warning(f"Grad-CAM failed: {e}")
        return None


# ─── Shared prediction helper ─────────────────────────────────────────────────

def run_prediction(image_bytes, model, labels, input_size, safe_label=None):
    tensor = preprocess(image_bytes, input_size)
    preds  = model.predict(tensor, verbose=0)[0]
    idx    = int(np.argmax(preds))
    conf   = float(preds[idx]) * 100
    label  = labels[idx]
    requires_attention = label != safe_label if safe_label else True
    heatmap = generate_gradcam(model, tensor, idx, display_size=(224, 224))
    return {
        "prediction": label,
        "confidence": round(conf, 2),
        "class_index": idx,
        "all_probabilities": {
            labels[i]: round(float(preds[i]) * 100, 2)
            for i in range(len(preds))
        },
        "requires_attention": requires_attention,
        "heatmap": heatmap
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "brain_model_loaded": brain_model is not None,
        "skin_model_loaded": skin_model is not None,
    })


@app.route("/predict/brain", methods=["POST"])
def predict_brain():
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({"error": "No file provided."}), 400
    try:
        m = load_brain_model()
        result = run_prediction(
            request.files["file"].read(), m, BRAIN_LABELS,
            input_size=(128, 128), safe_label="No Tumor"
        )
        return jsonify(result)
    except Exception as e:
        logger.exception("Brain prediction error")
        return jsonify({"error": str(e)}), 500


@app.route("/predict/skin", methods=["POST"])
def predict_skin():
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({"error": "No file provided."}), 400
    try:
        m = load_skin_model()
        result = run_prediction(
            request.files["file"].read(), m, skin_class_labels,
            input_size=(28, 28), safe_label=None   # All skin findings are clinically relevant
        )
        return jsonify(result)
    except Exception as e:
        logger.exception("Skin prediction error")
        return jsonify({"error": str(e)}), 500


# Backward-compat alias → old /predict now calls brain endpoint
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
