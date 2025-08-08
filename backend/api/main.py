from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import numpy as np
from PIL import Image, ImageEnhance
import io
import base64
import cv2
from typing import Dict, Any
import logging
from strip_detector import StripDetector

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="LUVEX UV Strip Analyzer API",
    description="Professional UV dosimetry analysis system",
    version="1.0.0"
)

# CORS middleware für Frontend-Backend Kommunikation
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Production: spezifische Origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UVStripAnalyzer:
    """Hauptklasse für UV-Strip Analyse"""
    
    def __init__(self):
        # Referenzwerte für verschiedene UV-Strip Typen (verbesserte Kalibrierung)
        self.strip_calibration = {
            "standard": {
                "baseline_rgb": [245, 240, 235],  # Unbelichtete Referenzfarbe
                "dose_levels": {
                    "low": {"rgb_range": [220, 200, 180], "dose": 50},
                    "medium": {"rgb_range": [180, 150, 120], "dose": 150},
                    "high": {"rgb_range": [140, 100, 80], "dose": 300},
                    "extreme": {"rgb_range": [100, 60, 40], "dose": 500}
                }
            }
        }
    
    def preprocess_image(self, image: Image.Image) -> Image.Image:
        """Bildvorverarbeitung für bessere Analyse"""
        # Konvertiere zu RGB falls nötig
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Größe normalisieren (falls sehr groß)
        max_size = 1024
        if image.width > max_size or image.height > max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Schärfe leicht erhöhen
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(1.2)
        
        return image
    
    def extract_strip_region(self, image: Image.Image) -> Image.Image:
        """Extrahiert die UV-Strip Region aus dem Bild"""
        try:
            # Konvertiere PIL zu OpenCV Format
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Einfache Kantendetection für Strip-Erkennung
            gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            
            # Finde Konturen
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                # Größte rechteckige Kontur finden (vermutlich der Strip)
                largest_contour = max(contours, key=cv2.contourArea)
                x, y, w, h = cv2.boundingRect(largest_contour)
                
                # Strip-Region extrahieren (mit etwas Padding)
                padding = 10
                x1 = max(0, x - padding)
                y1 = max(0, y - padding)
                x2 = min(image.width, x + w + padding)
                y2 = min(image.height, y + h + padding)
                
                # Zurück zu PIL Image
                strip_region = image.crop((x1, y1, x2, y2))
                return strip_region
        except Exception as e:
            logger.warning(f"Strip-Erkennung fehlgeschlagen: {e}, verwende Fallback")
        
        # Fallback: Mittlerer Bereich des Bildes
        w, h = image.size
        crop_box = (w//4, h//3, 3*w//4, 2*h//3)
        return image.crop(crop_box)
    
    def analyze_color_change(self, strip_image: Image.Image) -> Dict[str, Any]:
        """Analysiert die Farbveränderung des UV-Strips"""
        # Konvertiere zu numpy array für Farbanalyse
        img_array = np.array(strip_image)
        
        # Berechne durchschnittliche RGB-Werte
        avg_rgb = np.mean(img_array.reshape(-1, 3), axis=0)
        
        # Referenzwerte (unbelichteter Strip)
        baseline_rgb = np.array(self.strip_calibration["standard"]["baseline_rgb"])
        
        # Farbveränderung berechnen (Distanz im RGB-Raum)
        color_distance = np.linalg.norm(avg_rgb - baseline_rgb)
        
        # Prozentuale Veränderung
        max_possible_change = np.linalg.norm([255, 255, 255])
        color_change_percent = min(100, (color_distance / max_possible_change) * 100)
        
        return {
            "avg_rgb": avg_rgb.tolist(),
            "color_distance": float(color_distance),
            "color_change_percent": float(color_change_percent)
        }
    
    def estimate_uv_dose(self, color_data: Dict[str, Any]) -> Dict[str, Any]:
        """Schätzt die UV-Dosis basierend auf Farbveränderung (verbesserte Kalibrierung)"""
        color_distance = color_data["color_distance"]
        
        # Verbesserte Kalibrierungskurve basierend auf Demo-Bildern
        if color_distance < 25:
            level = "low"
            estimated_dose = max(0, color_distance * 2.0)  # 0-50 J/cm²
        elif color_distance < 50:
            level = "medium"
            estimated_dose = 50 + (color_distance - 25) * 4.0  # 50-150 J/cm²
        elif color_distance < 80:
            level = "high" 
            estimated_dose = 150 + (color_distance - 50) * 5.0  # 150-300 J/cm²
        else:
            level = "extreme"
            estimated_dose = 300 + min(200, (color_distance - 80) * 2.5)  # 300-500+ J/cm²
        
        # Confidence scoring basierend auf Farbdistanz
        if color_distance < 15:
            confidence = 60  # Wenig Änderung = unsicher
        elif color_distance < 100:
            confidence = 85  # Deutliche Änderung = sehr sicher
        else:
            confidence = 75  # Extreme Änderung = wieder weniger sicher
        
        return {
            "estimated_dose": round(estimated_dose, 1),
            "exposure_level": level,
            "confidence": min(100, confidence)
        }
    
    def generate_recommendation(self, dose_data: Dict[str, Any]) -> str:
        """Generiert Empfehlungen basierend auf UV-Exposition"""
        level = dose_data["exposure_level"]
        dose = dose_data["estimated_dose"]
        
        recommendations = {
            "low": f"Niedrige UV-Exposition ({dose:.1f} J/cm²). Normalbereich für kurze Sonneneinstrahlung. Kein direkter Handlungsbedarf.",
            "medium": f"Mittlere UV-Exposition ({dose:.1f} J/cm²). Entspricht etwa 2-4 Stunden Sommersonne. Regelmäßige Kontrolle empfohlen.",
            "high": f"Hohe UV-Exposition ({dose:.1f} J/cm²). Vorsicht bei längeren Aufenthalten im Freien! Zusätzlicher Sonnenschutz erforderlich.",
            "extreme": f"Extreme UV-Exposition ({dose:.1f} J/cm²). Sofortiger Sonnenschutz erforderlich! Arbeitsplatz-Sicherheitsmaßnahmen prüfen."
        }
        
        return recommendations.get(level, "Unbekannte Expositionsstufe.")
    
    def create_processed_image(self, original: Image.Image, strip_region: Image.Image) -> str:
        """Erstellt ein verarbeitetes Bild mit Markierungen"""
        # Kopie des Originalbilds
        processed = original.copy()
        
        # Konvertiere zu base64 für Frontend
        buffer = io.BytesIO()
        processed.save(buffer, format='JPEG', quality=85)
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return img_str

# Globale Analyzer-Instanz
analyzer = UVStripAnalyzer()
strip_detector = StripDetector()

@app.get("/")
async def root():
    return {
        "message": "LUVEX UV Strip Analyzer API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": ["/health", "/analyze", "/strip-types"]
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "UV Strip Analyzer",
        "analyzer_ready": True
    }

@app.post("/analyze")
async def analyze_uv_strip(file: UploadFile = File(...)):
    """Hauptendpoint für UV-Strip Analyse"""
    
    try:
        # Datei-Validierung
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Datei muss ein Bild sein")
        
        # Bild laden
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        logger.info(f"Analysiere Bild: {file.filename} ({image.size})")
        
        # Bildvorverarbeitung
        processed_image = analyzer.preprocess_image(image)
        
        # Strip-Region extrahieren
        strip_region = strip_detector.detect_strip(processed_image)
        
        # Farbanalyse
        color_data = analyzer.analyze_color_change(strip_region)
        
        # UV-Dosis schätzen
        dose_data = analyzer.estimate_uv_dose(color_data)
        
        # Empfehlung generieren
        recommendation = analyzer.generate_recommendation(dose_data)
        
        # Verarbeitetes Bild erstellen
        processed_img_b64 = analyzer.create_processed_image(processed_image, strip_region)
        
        # Ergebnisse zusammenstellen
        results = {
            "success": True,
            "filename": file.filename,
            "image_size": processed_image.size,
            "uv_dose": f"{dose_data['estimated_dose']:.1f}",
            "exposure_level": dose_data["exposure_level"],
            "color_change": f"{color_data['color_change_percent']:.1f}",
            "confidence": f"{dose_data['confidence']:.1f}%",
            "recommendation": recommendation,
            "processed_image": processed_img_b64,
            "technical_data": {
                "avg_rgb": color_data["avg_rgb"],
                "color_distance": color_data["color_distance"],
                "baseline_rgb": analyzer.strip_calibration["standard"]["baseline_rgb"]
            }
        }
        
        logger.info(f"Analyse erfolgreich: {dose_data['exposure_level']} ({dose_data['estimated_dose']:.1f} J/cm²)")
        return JSONResponse(content=results)
        
    except Exception as e:
        logger.error(f"Analysefehler: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysefehler: {str(e)}")

@app.get("/strip-types")
async def get_supported_strip_types():
    """Liefert unterstützte UV-Strip Typen"""
    return {
        "supported_types": list(analyzer.strip_calibration.keys()),
        "default": "standard",
        "calibration_info": analyzer.strip_calibration["standard"]["dose_levels"]
    }

if __name__ == "__main__":
    logger.info("🚀 Starte LUVEX UV Strip Analyzer Backend...")
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_level="info"
    )