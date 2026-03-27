"""
Flask API Backend for Sentinel 3 — AI-based Non-Invasive Diagnostic Solution

Models:
  1. Brain Tumor  — HuggingFace: Saitama30/brain_tumor_model.h5  (TensorFlow/Keras)
     Input: (None, 128, 128, 3)
     Endpoint: POST /predict/brain

  2. Skin Cancer  — Local: Models/ham10000.pt  (Ultralytics YOLO segmentation)
     Task: Segmentation  |  Classes: {0: 'cancer'}  |  Input: 640x640
     Endpoint: POST /predict/skin

  3. Skin Cancer v2 — Local: Models/cnn_fc_model.h5  (Custom 5-block CNN)
     Input: (None, 160, 160, 3)  |  9 HAM10000 classes
     Endpoint: POST /predict/skin2

  4. Alzheimer Detection — Local: Models/Osteoporosis_Model_binary.h5 (CNN)
     Input: (None, 224, 224, 3) | 4 Classes
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
SKIN_MODEL_PATH = os.path.join(BASE_DIR, "..", "Models", "ham10000.pt")
SKIN2_MODEL_PATH = os.path.join(BASE_DIR, "..", "Models", "cnn_fc_model.h5")
ALZHEIMER_MODEL_PATH = os.path.join(BASE_DIR, "..", "Models", "Osteoporosis_Model_binary.h5")

# ─── Model registry ───────────────────────────────────────────────────────────
brain_model   = None
skin_yolo     = None
skin2_model   = None
alzheimer_model = None

BRAIN_LABELS = ["Glioma Tumor", "Meningioma Tumor", "No Tumor", "Pituitary Tumor"]

# HAM10000 9-class labels (confirmed from model output shape and layer structure)
SKIN2_LABELS = [
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

SKIN2_HIGH_RISK = {"Melanoma", "Basal Cell Carcinoma", "Actinic Keratosis", "Squamous Cell Carcinoma"}

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
    global skin_yolo
    if skin_yolo is not None:
        return skin_yolo
    from ultralytics import YOLO
    abs_path = os.path.abspath(SKIN_MODEL_PATH)
    logger.info(f"Loading YOLO skin cancer model from: {abs_path}")
    skin_yolo = YOLO(abs_path)
    logger.info(f"Skin model loaded. Task: {skin_yolo.task} | Classes: {skin_yolo.names}")
    return skin_yolo


def load_skin2_model():
    """Build cnn_fc_model architecture and load weights (weights-only .h5 file)."""
    global skin2_model
    if skin2_model is not None:
        return skin2_model
    import tensorflow as tf
    abs_path = os.path.abspath(SKIN2_MODEL_PATH)
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
    skin2_model = m
    logger.info(f"Skin v2 model loaded. Input: {m.input_shape}, Output: {m.output_shape}")
    return skin2_model


def load_alzheimer_model():
    global alzheimer_model
    if alzheimer_model is not None:
        return alzheimer_model
    import tensorflow as tf
    abs_path = os.path.abspath(ALZHEIMER_MODEL_PATH)
    logger.info(f"Loading Alzheimer model from: {abs_path}")
    alzheimer_model = tf.keras.models.load_model(abs_path, compile=False)
    logger.info(f"Alzheimer model loaded. Input: {alzheimer_model.input_shape}, Output: {alzheimer_model.output_shape}")
    return alzheimer_model


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


# ─── Skin v1 (YOLO) helper ────────────────────────────────────────────────────

def run_skin_inference(image_bytes: bytes):
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

    annotated_bgr = result.plot()
    annotated_rgb = cv2.cvtColor(annotated_bgr, cv2.COLOR_BGR2RGB)
    buf = io.BytesIO()
    Image.fromarray(annotated_rgb).save(buf, format="PNG")

    return {
        "prediction":         prediction,
        "confidence":         top_confidence,
        "detection_count":    detection_count,
        "detections":         detections,
        "requires_attention": detection_count > 0,
        "heatmap":            "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    }


# ─── Skin v2 (CNN) helper ─────────────────────────────────────────────────────

def run_skin2_inference(image_bytes: bytes):
    """Preprocess to 160×160, run CNN, return prediction + Grad-CAM."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((160, 160), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)   # Rescaling layer handles /255 internally
    input_tensor = np.expand_dims(arr, axis=0)

    m = load_skin2_model()
    preds = m.predict(input_tensor, verbose=0)[0]
    idx   = int(np.argmax(preds))
    conf  = float(preds[idx]) * 100
    label = SKIN2_LABELS[idx] if idx < len(SKIN2_LABELS) else f"Class {idx}"
    requires_attention = label in SKIN2_HIGH_RISK

    # Grad-CAM needs normalised tensor
    norm_tensor = input_tensor / 255.0
    heatmap = generate_gradcam(m, norm_tensor, idx)

    return {
        "prediction":        label,
        "confidence":        round(conf, 2),
        "class_index":       idx,
        "all_probabilities": {
            (SKIN2_LABELS[i] if i < len(SKIN2_LABELS) else f"Class {i}"): round(float(preds[i]) * 100, 2)
            for i in range(len(preds))
        },
        "requires_attention": requires_attention,
        "heatmap":           heatmap
    }


# ─── Alzheimer helper ─────────────────────────────────────────────────────────

def run_alzheimer_inference(image_bytes: bytes):
    """Preprocess to 224x224, run CNN, return prediction + Grad-CAM."""
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((224, 224), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    input_tensor = np.expand_dims(arr, axis=0)

    m = load_alzheimer_model()
    preds = m.predict(input_tensor, verbose=0)[0]
    idx   = int(np.argmax(preds))
    conf  = float(preds[idx]) * 100
    label = ALZHEIMER_LABELS[idx] if idx < len(ALZHEIMER_LABELS) else f"Class {idx}"
    requires_attention = label != "Non Demented"

    heatmap = generate_gradcam(m, input_tensor, idx)

    return {
        "prediction":        label,
        "confidence":        round(conf, 2),
        "class_index":       idx,
        "all_probabilities": {
            (ALZHEIMER_LABELS[i] if i < len(ALZHEIMER_LABELS) else f"Class {i}"): round(float(preds[i]) * 100, 2)
            for i in range(len(preds))
        },
        "requires_attention": requires_attention,
        "heatmap":           heatmap
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status":              "ok",
        "brain_model_loaded":  brain_model is not None,
        "skin_model_loaded":   skin_yolo is not None,
        "skin2_model_loaded":  skin2_model is not None,
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
        logger.exception("Skin v1 prediction error")
        return jsonify({"error": str(e)}), 500


@app.route("/predict/skin2", methods=["POST"])
def predict_skin2():
    if "file" not in request.files or request.files["file"].filename == "":
        return jsonify({"error": "No file provided."}), 400
    try:
        return jsonify(run_skin2_inference(request.files["file"].read()))
    except Exception as e:
        logger.exception("Skin v2 prediction error")
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
        load_skin2_model()
        load_alzheimer_model()
    except Exception as e:
        logger.warning(f"Pre-load warning: {e}")
    app.run(host="0.0.0.0", port=5000, debug=False)
