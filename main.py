import torch
import torch.nn as nn
from torchvision import transforms
from PIL import Image
import io
from pathlib import Path
import os
from typing import Any, Dict
import json
import google.generativeai as genai
import numpy as np
import requests
import joblib
from fastapi.responses import FileResponse
from fastapi import FastAPI,File,UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer
)

from reportlab.lib.styles import (
    getSampleStyleSheet
)

from reportlab.lib.pagesizes import letter
# =========================
# DEVICE CONFIG
# =========================

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print(f"\nUsing Device: {device}")

# =========================
# CNN MODEL
# =========================

class PlantDiseaseCNN(nn.Module):

    def __init__(self):

        super(PlantDiseaseCNN, self).__init__()

        self.conv_layers = nn.Sequential(

            nn.Conv2d(3, 32, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2),

            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(2)
        )

        self.fc_layers = nn.Sequential(

            nn.Flatten(),

            nn.Linear(128 * 28 * 28, 512),

            nn.ReLU(),

            nn.Dropout(0.5),

            nn.Linear(512, 5)
        )

    def forward(self, x):

        x = self.conv_layers(x)

        x = self.fc_layers(x)

        return x

# =========================
# LOAD MODEL
# =========================

model = PlantDiseaseCNN().to(device)

model.load_state_dict(
    torch.load(
        "models/plant_disease_cnn.pth",
        map_location=device
    )
)

model.eval()

print("Plant Disease Model Loaded ✅")

# =========================
# IMAGE TRANSFORM
# =========================

transform = transforms.Compose([

    transforms.Resize((224, 224)),

    transforms.ToTensor()
])

# =========================
# CLASS LABELS
# =========================

classes = [

    "early_blight",

    "healthy",

    "late_blight",

    "leaf_mold",

    "yellow_leaf_curl"
]

# =========================
# CONFIG
# =========================
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(
    api_key=GEMINI_API_KEY
)

gemini_model = genai.GenerativeModel(
    "gemini-2.0-flash"
)

APP_DIR = Path(__file__).parent
MODELS_DIR = APP_DIR / "models"

# =========================
# FASTAPI APP
# =========================
app = FastAPI(
    title="AgroOrbitz Backend",
    version="1.0.0"
)

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# STATIC FILES
# =========================
if MODELS_DIR.exists():

    app.mount(
        "/static",
        StaticFiles(directory=str(MODELS_DIR)),
        name="static"
    )

# =========================
# MODEL STORE
# =========================
class ModelStore:

    knn_model: Any = None
    knn_scaler: Any = None
    label_encoders: Any = None

    soil_model: Any = None
    soil_scaler: Any = None

    yield_model: Any = None
    yield_scaler: Any = None


store = ModelStore()

# =========================
# SAFE MODEL LOAD
# =========================
def safe_load(path: Path):

    if not path.exists():

        print(f"[WARN] Missing file: {path}")

        return None

    try:

        return joblib.load(path)

    except Exception as e:

        print(f"[WARN] Failed loading {path.name}: {e}")

        return None

# =========================
# STARTUP
# =========================
@app.on_event("startup")
def load_models():

    store.knn_model = safe_load(
        MODELS_DIR / "knn_agri_model.pkl"
    )

    store.knn_scaler = safe_load(
        MODELS_DIR / "scaler.pkl"
    )

    store.label_encoders = safe_load(
        MODELS_DIR / "label_encoders.pkl"
    )

    store.soil_model = safe_load(
        MODELS_DIR / "soil_condition_model.pkl"
    )

    store.soil_scaler = safe_load(
        MODELS_DIR / "soil_condition_scaler.pkl"
    )

    store.yield_model = safe_load(
        MODELS_DIR / "cabbage_yield_model.pkl"
    )

    store.yield_scaler = safe_load(
        MODELS_DIR / "cabbage_yield_scaler.pkl"
    )

    print("[OK] Models loaded:")

    print(
        " - KNN:",
        store.knn_model is not None
    )

    print(
        " - Soil:",
        store.soil_model is not None
    )

    print(
        " - Yield:",
        store.yield_model is not None
    )

# =========================
# HEALTH CHECK
# =========================
@app.get("/api/health")
def health():

    return {

        "status": "ok",

        "models": {

            "knn":
                store.knn_model is not None,

            "soil":
                store.soil_model is not None,

            "yield":
                store.yield_model is not None,
        },
    }

# =========================
# WEATHER & AQI
# =========================
@app.get("/api/weather")
def get_weather(city: str = "Delhi"):

    if not OPENWEATHER_API_KEY:

        return {
            "temp": 28,
            "humidity": 65,
            "wind": 10,
            "rainProb": 20,
            "aqi": 3,
        }

    try:

        # =========================
        # WEATHER API
        # =========================
        weather_url = (
            "https://api.openweathermap.org/data/2.5/weather"
        )

        # =========================
        # CITY NORMALIZATION
        # =========================
        city_map = {

            "kashmir": "Srinagar",

            "dharamshala": "Dharamshala,IN",

            "himachal": "Shimla",

            "punjab": "Chandigarh",

            "delhi": "New Delhi",

            "bangalore": "Bengaluru",

            "bombay": "Mumbai",
        }

        normalized_city = city_map.get(
            city.lower(),
            city
        )

        # =========================
        # TRY NORMAL CITY SEARCH
        # =========================
        wres = requests.get(
            weather_url,
            params={
                "q": normalized_city,
                "appid": OPENWEATHER_API_KEY,
                "units": "metric",
            },
            timeout=20,
        )

        # =========================
        # FALLBACK FOR INDIAN CITIES
        # =========================
        if wres.status_code != 200:

            wres = requests.get(
                weather_url,
                params={
                    "q": f"{normalized_city},IN",
                    "appid": OPENWEATHER_API_KEY,
                    "units": "metric",
                },
                timeout=20,
            )

        # =========================
        # FINAL CHECK
        # =========================
        wres.raise_for_status()

        # =========================
        # WEATHER JSON
        # =========================
        w = wres.json()

        temp = (
            w.get("main", {})
             .get("temp")
        )

        humidity = (
            w.get("main", {})
             .get("humidity")
        )

        wind_ms = (
            w.get("wind", {})
             .get("speed", 0.0)
        )

        wind_kmh = round(
            float(wind_ms) * 3.6,
            1
        )

        rain_prob = 0

        if w.get("rain"):
            rain_prob = 60

        # =========================
        # COORDS
        # =========================
        coord = w.get("coord", {})

        lat = coord.get("lat")

        lon = coord.get("lon")

        # =========================
        # AQI API
        # =========================
        aqi_url = (
            "https://api.openweathermap.org/data/2.5/air_pollution"
        )

        ares = requests.get(
            aqi_url,
            params={
                "lat": lat,
                "lon": lon,
                "appid": OPENWEATHER_API_KEY,
            },
            timeout=20,
        )

        ares.raise_for_status()

        aj = ares.json()

        aqi_val = (
            aj.get("list", [{}])[0]
              .get("main", {})
              .get("aqi", 3)
        )

        # =========================
        # RESPONSE
        # =========================
        return {

            "temp": temp,

            "humidity": humidity,

            "wind": wind_kmh,

            "rainProb": rain_prob,

            "aqi": aqi_val,

            "city": normalized_city,
        }

    except Exception as e:

        print(
            f"[WARN] Weather fetch failed: {e}"
        )

        return {

            "temp": "--",

            "humidity": "--",

            "wind": "--",

            "rainProb": "--",

            "aqi": "--",

            "city": city,
        }

# =========================
# SATELLITE METRICS
# =========================
@app.get("/api/satellite/metrics")
def satellite_metrics():

    pred_path = MODELS_DIR / "prediction.json"

    heatmap_path = MODELS_DIR / "heatmap.png"

    ndvi = 0.65

    rmse = None

    if pred_path.exists():

        pj = json.loads(
            pred_path.read_text()
        )

        if pj.get("prediction") is not None:

            ndvi = float(
                pj["prediction"]
            )

        rmse = pj.get("rmse")

    soil_cover = int(
        round(ndvi * 100)
    )

    return {

        "ndvi":
            round(ndvi, 3),

        "soilCoverPercent":
            soil_cover,

        "rmse":
            rmse,

        "heatmapUrl":
            "/static/heatmap.png"
            if heatmap_path.exists()
            else None,
    }

# =========================
# SOIL ANALYZER
# =========================
@app.post("/api/soil/analyze")
def soil_analyze(payload: Dict[str, Any]):

    feats = (
        payload.get("features")
        or [30, 20, 4, 2]
    )

    moisture, nitrogen, om, compaction = map(
        float,
        feats[:4]
    )

    risks = {

        "moisture":
            "Low"
            if moisture >= 35
            else "Medium"
            if moisture >= 20
            else "High",

        "nitrogen":
            "Low"
            if nitrogen >= 25
            else "Medium"
            if nitrogen >= 15
            else "High",

        "om":
            "Low"
            if om >= 5
            else "Medium"
            if om >= 3
            else "High",

        "compaction":
            "Low"
            if compaction <= 2
            else "Medium"
            if compaction <= 4
            else "High",
    }

    return {

        "moisture":
            round(moisture, 1),

        "nitrogen":
            round(nitrogen, 1),

        "organicMatter":
            round(om, 1),

        "compactionRisk":
            round(compaction, 1),

        "risks":
            risks,
    }

# =========================
# CROP RECOMMENDATION
# =========================
@app.post("/api/crop/recommend")
def crop_recommend(payload: Dict[str, Any]):

    previous = (
        payload.get("previousCrop")
        or "wheat"
    ).lower()

    fallback_map = {

        "wheat": "Corn",

        "maize": "Soybean",

        "rice": "Wheat",

        "corn": "Soybean",

        "soybean": "Wheat",
    }

    recommended = fallback_map.get(
        previous,
        "Soybean"
    )

    return {

        "recommendedNext":
            recommended,

        "note":
            f"Rotation based on previous crop: {previous}.",
    }

# =========================
# YIELD PREDICTION
# =========================
@app.post("/api/yield/predict")
def yield_predict(payload: Dict[str, Any]):

    feats = (
        payload.get("features")
        or []
    )

    if (
        len(feats) == 0
        or store.yield_model is None
    ):

        return {

            "yield": 18.2,

            "unit": "t/ha",
        }

    try:

        X = np.array(
            [list(map(float, feats))],
            dtype=float
        )

        if store.yield_scaler is not None:

            X = store.yield_scaler.transform(X)

        y = store.yield_model.predict(X)[0]

        return {

            "yield":
                float(np.round(y, 2)),

            "unit":
                "t/ha",
        }

    except Exception as e:

        print(
            f"[WARN] Yield inference failed: {e}"
        )

        return {

            "yield": 18.2,

            "unit": "t/ha",
        }
    # =========================
# AI FARMER CHATBOT
# =========================
# =========================
# AI FARMER CHATBOT
# =========================
@app.post("/api/chat")
def chat_ai(payload: Dict[str, Any]):

    try:

        message = (
            payload.get("message", "")
            .lower()
            .strip()
        )

        if not message:

            return {
                "reply":
                "Please ask a farming question."
            }

        # =========================
        # OFFLINE SMART RESPONSES
        # =========================

        if "best crop after rice" in message:

            return {
                "reply":
                "Wheat, mustard, and chickpea are excellent rotational crops after rice because they improve soil balance and reduce pest cycles."
            }

        elif "yellow leaves" in message:

            return {
                "reply":
                "Yellow leaves are commonly caused by nitrogen deficiency, overwatering, poor drainage, or fungal infection."
            }

        elif "irrigation" in message:

            return {
                "reply":
                "Drip irrigation is one of the most efficient irrigation methods because it saves water and improves root absorption."
            }

        elif "fertility" in message:

            return {
                "reply":
                "You can improve soil fertility using compost, crop rotation, organic manure, and balanced NPK fertilizers."
            }

        elif "wheat" in message:

            return {
                "reply":
                "Wheat grows best in cool climates with well-drained loamy soil and moderate irrigation."
            }

        elif "soil" in message:

            return {
                "reply":
                "Healthy soil should have balanced moisture, proper nitrogen levels, organic matter, and low compaction."
            }

        elif "weather" in message:

            return {
                "reply":
                "Weather conditions like rainfall, humidity, and temperature strongly affect crop growth and irrigation planning."
            }

        # =========================
        # GEMINI FALLBACK
        # =========================

        try:

            prompt = f"""
            You are AgroOrbitz AI,
            an intelligent agriculture assistant.

            Answer farming questions simply
            and professionally.

            User Question:
            {message}
            """

            response = gemini_model.generate_content(
                prompt
            )

            answer = response.text.strip()

            return {
                "reply": answer
            }

        except Exception:

            return {
                "reply":
                "AgroAI recommends monitoring soil moisture, weather conditions, and crop health regularly for better farming decisions."
            }

    except Exception as e:

        return {
            "reply":
            f"System Error: {str(e)}"
        }
    # =========================
# PDF FARM REPORT
# =========================
@app.post("/api/report")
def generate_report(payload: Dict[str, Any]):

    try:

        city = payload.get("city", "Unknown")

        weather = payload.get(
            "weather", {}
        )

        soil = payload.get(
            "soil", {}
        )

        irrigation = payload.get(
            "irrigation", {}
        )

        crop = payload.get(
            "crop", {}
        )

        report_path = "farm_report.pdf"

        # =========================
        # PDF
        # =========================
        doc = SimpleDocTemplate(
            report_path,
            pagesize=letter
        )

        styles = getSampleStyleSheet()

        elements = []

        # TITLE
        elements.append(
            Paragraph(
                "AgroOrbitz Farm Report",
                styles["Title"]
            )
        )

        elements.append(
            Spacer(1, 20)
        )

        # CITY
        elements.append(
            Paragraph(
                f"<b>City:</b> {city}",
                styles["BodyText"]
            )
        )

        elements.append(
            Spacer(1, 12)
        )

        # WEATHER
        elements.append(
            Paragraph(
                "<b>Weather Information</b>",
                styles["Heading2"]
            )
        )

        elements.append(
            Paragraph(
                f"""
                Temperature:
                {weather.get('temp', '--')} °C
                <br/>
                Humidity:
                {weather.get('humidity', '--')} %
                <br/>
                Wind:
                {weather.get('wind', '--')} km/h
                <br/>
                Rain Probability:
                {weather.get('rainProb', '--')} %
                <br/>
                AQI:
                {weather.get('aqi', '--')}
                """,
                styles["BodyText"]
            )
        )

        elements.append(
            Spacer(1, 16)
        )

        # SOIL
        elements.append(
            Paragraph(
                "<b>Soil Analysis</b>",
                styles["Heading2"]
            )
        )

        elements.append(
            Paragraph(
                f"""
                Moisture:
                {soil.get('moisture', '--')}
                <br/>
                Nitrogen:
                {soil.get('nitrogen', '--')}
                <br/>
                Organic Matter:
                {soil.get('organicMatter', '--')}
                <br/>
                Compaction Risk:
                {soil.get('compactionRisk', '--')}
                """,
                styles["BodyText"]
            )
        )

        elements.append(
            Spacer(1, 16)
        )

        # IRRIGATION
        elements.append(
            Paragraph(
                "<b>Irrigation Advice</b>",
                styles["Heading2"]
            )
        )

        elements.append(
            Paragraph(
                irrigation.get(
                    "status",
                    "--"
                ),
                styles["BodyText"]
            )
        )

        elements.append(
            Spacer(1, 16)
        )

        # CROP
        elements.append(
            Paragraph(
                "<b>Crop Recommendation</b>",
                styles["Heading2"]
            )
        )

        elements.append(
            Paragraph(
                crop.get(
                    "recommendedNext",
                    "--"
                ),
                styles["BodyText"]
            )
        )

        # BUILD PDF
        doc.build(elements)

        return FileResponse(
            report_path,
            media_type="application/pdf",
            filename="AgroOrbitz_Report.pdf"
        )

    except Exception as e:

        return {
            "error": str(e)
        }
    # =========================
# AI PLANT DISEASE PREDICTION
# =========================

@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    try:

        image_bytes = await file.read()

        image = Image.open(
            io.BytesIO(image_bytes)
        ).convert("RGB")

        image = transform(image)

        image = image.unsqueeze(0).to(device)

        with torch.no_grad():

            outputs = model(image)

            _, predicted = torch.max(outputs, 1)

            probabilities = torch.nn.functional.softmax(
                outputs,
                dim=1
            )

            confidence = (
                probabilities[0][predicted]
                .item() * 100
            )

        disease = classes[
            predicted.item()
        ]

        return {

            "disease": disease,

            "confidence": round(
                confidence,
                2
            )
        }

    except Exception as e:

        return {
            "error": str(e)
        }