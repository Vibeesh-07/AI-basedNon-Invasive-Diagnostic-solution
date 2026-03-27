"""
Flask API Backend for Sentinel 3 — AI-based Non-Invasive Diagnostic Solution

Models:
  1. Brain Tumor  — HuggingFace: Saitama30/brain_tumor_model.h5  (TensorFlow/Keras)
     Input: (None, 128, 128, 3)
     Endpoint: POST /predict/brain

  2. Skin Cancer  — Local: Models/cnn_fc_model.h5  (Custom 5-block CNN)
     Input: (None, 160, 160, 3)  |  9 HAM10000 classes
     Endpoint: POST /predict/skin

  3. Alzheimer Detection — Local: Models/alzheimers_mobilenet_v2.h5 (EfficientNetV2B0)
     Input: (None, 224, 224, 3) | 4 Classes | Dense(128) head
     Endpoint: POST /predict/alzheimer

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
SKIN_MODEL_PATH = os.path.join(BASE_DIR, "..", "Models", "cnn_fc_model.h5")
ALZHEIMER_MODEL_PATH = os.path.join(BASE_DIR, "..", "Models", "alzheimers_mobilenet_v2.h5")

# ─── Model registry ───────────────────────────────────────────────────────────
brain_model     = None
skin_model      = None
alzheimer_model = None

BRAIN_LABELS = ["Glioma Tumor", "Meningioma Tumor", "No Tumor", "Pituitary Tumor"]

# HAM10000 9-class labels (confirmed from model output shape and layer structure)
SKIN_LABELS = [
    "Actinic Keratosis",
    "Basal Cell Carcinoma",
    "Benign Keratosis",
    "Dermatofibroma",
    "Melanocytic Nevi",
    "Melanoma",
    "Squamous Cell Carcinoma",
    "Vascular Lesion",
    "Unknown"
]

SKIN_HIGH_RISK = {"Melanoma", "Basal Cell Carcinoma", "Actinic Keratosis", "Squamous Cell Carcinoma"}

# Alzheimer 4-class labels (Standard MRI Dataset)
ALZHEIMER_LABELS = [
    "Mild Demented",
    "Moderate Demented",
    "Non Demented",
    "Very Mild Demented"
]

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
    """Build cnn_fc_model architecture and load weights (weights-only .h5 file)."""
    global skin_model
    if skin_model is not None:
        return skin_model
    import tensorflow as tf
    abs_path = os.path.abspath(SKIN_MODEL_PATH)
    logger.info(f"Building CNN architecture and loading weights from: {abs_path}")

    inputs = tf.keras.Input(shape=(160, 160, 3))
    x = tf.keras.layers.Rescaling(1./255)(inputs)
    x = tf.keras.layers.Conv2D(32, 3, padding='same', activation='relu', name='conv2d_10')(x)
    x = tf.keras.layers.MaxPooling2D(name='max_pooling2d_10')(x)
    x = tf.keras.layers.Conv2D(64, 3, padding='same', activation='relu', name='conv2d_11')(x)
    x = tf.keras.layers.MaxPooling2D(name='max_pooling2d_11')(x)
    x = tf.keras.layers.Conv2D(128, 3, padding='same', activation='relu', name='conv2d_12')(x)
    x = tf.keras.layers.MaxPooling2D(name='max_pooling2d_12')(x)
    x = tf.keras.layers.Conv2D(256, 3, padding='same', activation='relu', name='conv2d_13')(x)
    x = tf.keras.layers.MaxPooling2D(name='max_pooling2d_13')(x)
    x = tf.keras.layers.Conv2D(512, 3, padding='same', activation='relu', name='conv2d_14')(x)
    x = tf.keras.layers.MaxPooling2D(name='max_pooling2d_14')(x)
    x = tf.keras.layers.Flatten(name='flatten_2')(x)
    x = tf.keras.layers.Dropout(0.3, name='dropout_3')(x)
    x = tf.keras.layers.Dense(1024, activation='relu', name='dense_4')(x)
    x = tf.keras.layers.Dropout(0.3, name='dropout_4')(x)
    x = tf.keras.layers.Dense(9, activation='softmax', name='dense_5')(x)
    m = tf.keras.Model(inputs, x)
    m.load_weights(abs_path, by_name=True)
    skin_model = m
    logger.info(f"Skin model loaded. Input: {m.input_shape}, Output: {m.output_shape}")
    return skin_model


def load_alzheimer_model():
    """Build EfficientNetV2B0 + Dense(128) + Dense(4) head, load weights by name."""
    global alzheimer_model
    if alzheimer_model is not None:
        return alzheimer_model
    import tensorflow as tf
    abs_path = os.path.abspath(ALZHEIMER_MODEL_PATH)
    logger.info(f"Building EfficientNetV2B0 architecture and loading weights from: {abs_path}")
    base = tf.keras.applications.EfficientNetV2B0(
        include_top=False, weights=None, input_shape=(224, 224, 3)
    )
    x = base.output
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dense(128, activation='relu', name='dense')(x)
    x = tf.keras.layers.Dense(4, activation='softmax', name='dense_1')(x)
    m = tf.keras.Model(base.input, x)
    m.load_weights(abs_path, by_name=True)
    alzheimer_model = m
    logger.info(f"Alzheimer model loaded. Input: {m.input_shape}, Output: {m.output_shape}")
    return alzheimer_model


# ─── Grad-CAM Helpers ─────────────────────────────────────────────────────────

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


# ─── Inference Helpers ────────────────────────────────────────────────────────

def run_skin_inference(image_bytes: bytes):
    """Preprocess to 160×160, run CNN, return prediction + Grad-CAM."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((160, 160), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)   # Rescaling layer handles /255 internally
    input_tensor = np.expand_dims(arr, axis=0)

    m = load_skin_model()
    preds = m.predict(input_tensor, verbose=0)[0]
    idx   = int(np.argmax(preds))
    conf  = float(preds[idx]) * 100
    label = SKIN_LABELS[idx] if idx < len(SKIN_LABELS) else f"Class {idx}"
    requires_attention = label in SKIN_HIGH_RISK

    # Grad-CAM needs normalised tensor
    norm_tensor = input_tensor / 255.0
    heatmap = generate_gradcam(m, norm_tensor, idx)

    return {
        "prediction":        label,
        "confidence":        round(conf, 2),
        "class_index":       idx,
        "all_probabilities": {
            (SKIN_LABELS[i] if i < len(SKIN_LABELS) else f"Class {i}"): round(float(preds[i]) * 100, 2)
            for i in range(len(preds))
        },
        "requires_attention": requires_attention,
        "heatmap":           heatmap
    }


def run_alzheimer_inference(image_bytes: bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((224, 224), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    input_tensor = np.expand_dims(arr, axis=0)
    m = load_alzheimer_model()
    preds = m.predict(input_tensor, verbose=0)[0]
    idx   = int(np.argmax(preds))
    conf  = float(preds[idx]) * 100
    label = ALZHEIMER_LABELS[idx] if idx < len(ALZHEIMER_LABELS) else f"Class {idx}"
    heatmap = generate_gradcam(m, input_tensor, idx)
    return {
        "prediction":        label,
        "confidence":        round(conf, 2),
        "class_index":       idx,
        "all_probabilities": {
            (ALZHEIMER_LABELS[i] if i < len(ALZHEIMER_LABELS) else f"Class {i}"): round(float(preds[i]) * 100, 2)
            for i in range(len(preds))
        },
        "requires_attention": label != "Non Demented",
        "heatmap":           heatmap
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":              "ok",
        "brain_model_loaded":  brain_model is not None,
        "skin_model_loaded":   skin_model is not None,
        "alzheimer_model_loaded": alzheimer_model is not None,
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
        return jsonify(run_skin_inference(request.files["file"].read()))
    except Exception as e:
        logger.exception("Skin prediction error")
        return jsonify({"error": str(e)}), 500


@app.route("/predict/alzheimer", methods=["POST"])
def predict_alzheimer():
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({"error": "No file provided."}), 400
    try:
        return jsonify(run_alzheimer_inference(request.files["file"].read()))
    except Exception as e:
        logger.exception("Alzheimer prediction error")
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
        load_alzheimer_model()
    except Exception as e:
        logger.warning(f"Pre-load warning: {e}")
    app.run(host="0.0.0.0", port=5000, debug=False)
