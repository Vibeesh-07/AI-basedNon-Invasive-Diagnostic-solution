"""
Flask API Backend for Brain Tumor Diagnosis
Uses the TensorFlow/Keras model from HuggingFace:
  Saitama30/brain_tumor_model.h5

Endpoints:
  GET  /health          -> health check
  POST /predict         -> accepts image file, returns prediction + confidence
"""

import os
import io
import json
import base64
import logging
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Allow React frontend (localhost:5173) to call this API

# ─── Model & Labels Config ────────────────────────────────────────────────────

MODEL_INPUT_SIZE = (224, 224)  # Standard VGG16 input size
CLASS_LABELS = ["Glioma Tumor", "Meningioma Tumor", "No Tumor", "Pituitary Tumor"]

model = None  # lazy-loaded on first request

def load_model_once():
    """Download model from HuggingFace and load it once."""
    global model
    if model is not None:
        return model
    try:
        import tensorflow as tf
        from huggingface_hub import hf_hub_download

        logger.info("Downloading brain tumor model from HuggingFace Hub...")
        model_path = hf_hub_download(
            repo_id="Saitama30/brain_tumor_model.h5",
            filename="brain_tumor_model.h5"
        )
        logger.info(f"Model downloaded to: {model_path}")
        model = tf.keras.models.load_model(model_path, compile=False)
        logger.info("Model loaded successfully.")
        return model
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """Resize image and normalise to [0, 1]."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    image = image.resize(MODEL_INPUT_SIZE)
    arr = np.array(image, dtype=np.float32) / 255.0
    return np.expand_dims(arr, axis=0)  # Shape: (1, 224, 224, 3)


def generate_gradcam(m, input_tensor: np.ndarray, class_index: int):
    """
    Generate Grad-CAM heatmap overlay (same logic as multi_disease_diagnosis.py).
    Returns a base64-encoded PNG string, or None on failure.
    """
    try:
        import tensorflow as tf
        import cv2
        import matplotlib.cm as cm

        # Find last conv layer
        last_conv_layer = None
        for layer in reversed(m.layers):
            if isinstance(layer, (tf.keras.layers.Conv2D, tf.keras.layers.DepthwiseConv2D)):
                last_conv_layer = layer.name
                break
        if not last_conv_layer:
            return None

        grad_model = tf.keras.models.Model(
            inputs=m.inputs,
            outputs=[m.get_layer(last_conv_layer).output, m.output]
        )

        tensor = tf.cast(input_tensor, tf.float32)
        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model(tensor)
            loss = predictions[:, class_index]

        grads = tape.gradient(loss, conv_outputs)
        if grads is None:
            return None

        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0]
        heatmap = conv_outputs @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + tf.keras.backend.epsilon())
        heatmap = heatmap.numpy()

        # Resize and colourize
        h, w = MODEL_INPUT_SIZE
        heatmap_resized = cv2.resize(heatmap, (w, h))
        heatmap_colored = cm.jet(heatmap_resized)[:, :, :3]
        heatmap_colored = np.uint8(255 * heatmap_colored)

        # Overlay on original image
        original = np.uint8(255 * input_tensor[0])
        overlay = cv2.addWeighted(original, 0.6, heatmap_colored, 0.4, 0)

        # Convert to base64 PNG
        pil_overlay = Image.fromarray(overlay)
        buf = io.BytesIO()
        pil_overlay.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode()
        return f"data:image/png;base64,{b64}"
    except Exception as e:
        logger.warning(f"Grad-CAM failed: {e}")
        return None


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": model is not None})


@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No file provided. Use multipart/form-data with key 'file'."}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename."}), 400

    try:
        image_bytes = file.read()
        m = load_model_once()
        input_tensor = preprocess_image(image_bytes)

        preds = m.predict(input_tensor)[0]
        class_index = int(np.argmax(preds))
        confidence = float(preds[class_index]) * 100
        predicted_label = CLASS_LABELS[class_index]
        requires_attention = predicted_label != "No Tumor"

        heatmap_b64 = generate_gradcam(m, input_tensor, class_index)

        return jsonify({
            "prediction": predicted_label,
            "confidence": round(confidence, 2),
            "class_index": class_index,
            "all_probabilities": {
                CLASS_LABELS[i]: round(float(preds[i]) * 100, 2)
                for i in range(len(CLASS_LABELS))
            },
            "requires_attention": requires_attention,
            "heatmap": heatmap_b64   # base64 PNG or null
        })

    except Exception as e:
        logger.exception("Prediction error")
        return jsonify({"error": str(e)}), 500


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Pre-load model at startup
    try:
        load_model_once()
    except Exception as e:
        logger.warning(f"Could not pre-load model: {e}")

    app.run(host="0.0.0.0", port=5000, debug=False)
