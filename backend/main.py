import logging
import io
import base64
from typing import List, Dict, Any
from datetime import datetime

import uvicorn
import numpy as np
from PIL import Image, ImageEnhance
import cv2

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# --- Datenbank-Imports ---
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base

from strip_detector import StripDetector

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Datenbank-Konfiguration ---
DATABASE_URL = "sqlite:///./analyzer.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- Datenbank-Modell für eine Messung ---
class Measurement(Base):
    __tablename__ = "measurements"
    id = Column(Integer, primary_key=True, index=True)
    # user_id = Column(Integer, index=True) # Platzhalter für spätere WordPress-Anbindung
    name = Column(String, index=True)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    filename = Column(String)
    uv_dose = Column(Float)
    exposure_level = Column(String)
    confidence = Column(Float)
    recommendation = Column(Text) # Empfehlung auch in DB speichern

# Erstellt die Datenbank-Tabelle, falls sie nicht existiert.
Base.metadata.create_all(bind=engine)

# --- Funktion, um eine Datenbank-Sitzung zu bekommen ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- FastAPI App-Initialisierung ---
app = FastAPI(
    title="LUVEX UV Strip Analyzer API",
    description="Professional UV dosimetry analysis system with database support.",
    version="2.0.0"
)

# CORS Konfiguration
origins = [
    "http://localhost", "http://localhost:8080", "http://127.0.0.1",
    "http://analyzer.luvex.tech", "https://analyzer.luvex.tech",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


# --- VOLLSTÄNDIGE Analyzer-Logik ---
class UVStripAnalyzer:
    def __init__(self):
        self.strip_calibration = {
            "standard": {
                "baseline_rgb": [245, 240, 235],
                "dose_levels": {
                    "low": {"rgb_range": [220, 200, 180], "dose": 50},
                    "medium": {"rgb_range": [180, 150, 120], "dose": 150},
                    "high": {"rgb_range": [140, 100, 80], "dose": 300},
                    "extreme": {"rgb_range": [100, 60, 40], "dose": 500}
                }
            }
        }
    
    def preprocess_image(self, image: Image.Image) -> Image.Image:
        if image.mode != 'RGB':
            image = image.convert('RGB')
        max_size = 1024
        if image.width > max_size or image.height > max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        enhancer = ImageEnhance.Sharpness(image)
        return enhancer.enhance(1.2)

    def analyze_color_change(self, strip_image: Image.Image) -> Dict[str, Any]:
        img_array = np.array(strip_image)
        avg_rgb = np.mean(img_array.reshape(-1, 3), axis=0)
        baseline_rgb = np.array(self.strip_calibration["standard"]["baseline_rgb"])
        color_distance = np.linalg.norm(avg_rgb - baseline_rgb)
        max_possible_change = np.linalg.norm([255, 255, 255])
        color_change_percent = min(100, (color_distance / max_possible_change) * 100)
        return {
            "avg_rgb": avg_rgb.tolist(),
            "color_distance": float(color_distance),
            "color_change_percent": float(color_change_percent)
        }
    
    def estimate_uv_dose(self, color_data: Dict[str, Any]) -> Dict[str, Any]:
        color_distance = color_data["color_distance"]
        if color_distance < 25:
            level = "low"
            estimated_dose = max(0, color_distance * 2.0)
        elif color_distance < 50:
            level = "medium"
            estimated_dose = 50 + (color_distance - 25) * 4.0
        elif color_distance < 80:
            level = "high" 
            estimated_dose = 150 + (color_distance - 50) * 5.0
        else:
            level = "extreme"
            estimated_dose = 300 + min(200, (color_distance - 80) * 2.5)
        
        if color_distance < 15:
            confidence = 60
        elif color_distance < 100:
            confidence = 85
        else:
            confidence = 75
        
        return {
            "estimated_dose": round(estimated_dose, 1),
            "exposure_level": level,
            "confidence": min(100, confidence)
        }

    def generate_recommendation(self, dose_data: Dict[str, Any]) -> str:
        level = dose_data["exposure_level"]
        dose = dose_data["estimated_dose"]
        recommendations = {
            "low": f"Niedrige UV-Exposition ({dose:.1f} J/cm²). Normalbereich für kurze Sonneneinstrahlung. Kein direkter Handlungsbedarf.",
            "medium": f"Mittlere UV-Exposition ({dose:.1f} J/cm²). Entspricht etwa 2-4 Stunden Sommersonne. Regelmäßige Kontrolle empfohlen.",
            "high": f"Hohe UV-Exposition ({dose:.1f} J/cm²). Vorsicht bei längeren Aufenthalten im Freien! Zusätzlicher Sonnenschutz erforderlich.",
            "extreme": f"Extreme UV-Exposition ({dose:.1f} J/cm²). Sofortiger Sonnenschutz erforderlich! Arbeitsplatz-Sicherheitsmaßnahmen prüfen."
        }
        return recommendations.get(level, "Unbekannte Expositionsstufe.")
    
    def create_processed_image(self, original: Image.Image) -> str:
        processed = original.copy()
        buffer = io.BytesIO()
        processed.save(buffer, format='JPEG', quality=85)
        return base64.b64encode(buffer.getvalue()).decode()

# Globale Instanzen
analyzer = UVStripAnalyzer()
strip_detector = StripDetector()


# --- API Endpunkte ---

@app.get("/")
async def root():
    return {"message": "LUVEX UV Strip Analyzer API v2", "database_status": "connected"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}

@app.post("/analyze", summary="Führt eine komplette UV-Strip Analyse durch")
async def analyze_uv_strip(file: UploadFile = File(...)):
    try:
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        processed_image = analyzer.preprocess_image(image)
        strip_region = strip_detector.detect_strip(processed_image)
        color_data = analyzer.analyze_color_change(strip_region)
        dose_data = analyzer.estimate_uv_dose(color_data)
        recommendation = analyzer.generate_recommendation(dose_data)
        processed_img_b64 = analyzer.create_processed_image(processed_image)
        
        results = {
            "success": True,
            "filename": file.filename,
            "uv_dose": f"{dose_data['estimated_dose']:.1f}",
            "exposure_level": dose_data["exposure_level"],
            "confidence": f"{dose_data['confidence']:.1f}%",
            "recommendation": recommendation,
            "processed_image": processed_img_b64, # Bild wird wieder mitgeschickt
        }
        
        logger.info(f"Analyse erfolgreich: {dose_data['exposure_level']} ({dose_data['estimated_dose']:.1f} J/cm²)")
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.error(f"Analysefehler: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysefehler: {str(e)}")

@app.get("/strip-types", summary="Liefert unterstützte UV-Strip Typen")
async def get_supported_strip_types():
    return {
        "supported_types": list(analyzer.strip_calibration.keys()),
        "default": "standard",
    }

# --- API Endpunkte für Messungen ---

@app.post("/measurements", summary="Speichert eine neue Messung in der Datenbank")
async def create_measurement(data: dict, db: Session = Depends(get_db)):
    try:
        new_measurement = Measurement(
            name=data.get("name"),
            notes=data.get("notes"),
            filename=data.get("filename"),
            uv_dose=float(data.get("results", {}).get("uv_dose")),
            exposure_level=data.get("results", {}).get("exposure_level"),
            confidence=float(data.get("results", {}).get("confidence", "0").replace('%','')),
            recommendation=data.get("results", {}).get("recommendation")
        )
        db.add(new_measurement)
        db.commit()
        db.refresh(new_measurement)
        logger.info(f"Messung '{new_measurement.name}' mit ID {new_measurement.id} gespeichert.")
        return {"success": True, "id": new_measurement.id}
    except Exception as e:
        logger.error(f"Fehler beim Speichern der Messung: {e}")
        raise HTTPException(status_code=500, detail="Fehler beim Speichern der Messung.")

@app.get("/measurements", response_model=List[Dict[str, Any]], summary="Holt alle Messungen aus der Datenbank")
async def get_all_measurements(db: Session = Depends(get_db)):
    measurements = db.query(Measurement).order_by(Measurement.timestamp.desc()).all()
    return [{
        "id": m.id,
        "name": m.name,
        "notes": m.notes,
        "timestamp": m.timestamp.isoformat(),
        "filename": m.filename,
        "results": {
            "uv_dose": m.uv_dose,
            "exposure_level": m.exposure_level,
            "confidence": f"{m.confidence}%",
            "recommendation": m.recommendation
        }
    } for m in measurements]




# Zu main.py hinzufügen (nach den anderen /measurements Endpunkten):

@app.delete("/measurements/{measurement_id}", summary="Löscht eine spezifische Messung")
async def delete_measurement(measurement_id: int, db: Session = Depends(get_db)):
    try:
        measurement = db.query(Measurement).filter(Measurement.id == measurement_id).first()
        if not measurement:
            raise HTTPException(status_code=404, detail="Messung nicht gefunden")
        
        measurement_name = measurement.name
        db.delete(measurement)
        db.commit()
        
        logger.info(f"Messung '{measurement_name}' (ID: {measurement_id}) gelöscht.")
        return {"success": True, "message": f"Messung '{measurement_name}' gelöscht"}
        
    except Exception as e:
        logger.error(f"Fehler beim Löschen der Messung {measurement_id}: {e}")
        raise HTTPException(status_code=500, detail="Fehler beim Löschen der Messung")

@app.delete("/measurements", summary="Löscht alle Messungen (VORSICHT!)")
async def delete_all_measurements(db: Session = Depends(get_db)):
    try:
        count = db.query(Measurement).count()
        db.query(Measurement).delete()
        db.commit()
        
        logger.info(f"Alle {count} Messungen gelöscht.")
        return {"success": True, "message": f"{count} Messungen gelöscht", "deleted_count": count}
        
    except Exception as e:
        logger.error(f"Fehler beim Löschen aller Messungen: {e}")
        raise HTTPException(status_code=500, detail="Fehler beim Löschen aller Messungen")

# Dieser Teil ist wichtig, damit das Skript gestartet werden kann.
if __name__ == "__main__":
    logger.info("🚀 Starte LUVEX UV Strip Analyzer Backend v2...")
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8001,
        log_level="info"
    )


