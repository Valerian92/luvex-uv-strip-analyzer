import cv2
import numpy as np
from PIL import Image
import logging

logger = logging.getLogger(__name__)

class StripDetector:
    """Universeller UV-Strip Detektor mit konfigurierbaren Parametern"""
    
    def __init__(self):
        # Konfigurierbare Parameter für Strip-Erkennung
        self.config = {
            "min_area_percent": 2,      # Min. 2% der Bildfläche
            "max_area_percent": 40,     # Max. 40% der Bildfläche
            "min_aspect_ratio": 1.5,    # Min. Seitenverhältnis (länglich)
            "max_aspect_ratio": 8.0,    # Max. Seitenverhältnis
            "canny_low": 50,            # Canny Edge Detection - unterer Schwellwert
            "canny_high": 150,          # Canny Edge Detection - oberer Schwellwert
            "min_contour_area": 500,    # Minimale Kontur-Fläche
            "gaussian_blur": (5, 5),    # Gaussian Blur Kernel
            "morphology_kernel": 3      # Morphology Kernel Größe
        }
    
    def detect_strip(self, image: Image.Image) -> Image.Image:
        """
        Erkennt UV-Strip im Bild und gibt die Strip-Region zurück
        
        Args:
            image: PIL Image mit UV-Strip
            
        Returns:
            PIL Image der erkannten Strip-Region
        """
        try:
            # 1. Preprocessing
            cv_image = self._preprocess_image(image)
            
            # 2. Strip-Kandidaten finden
            candidates = self._find_strip_candidates(cv_image)
            
            # 3. Besten Kandidaten auswählen
            best_strip = self._select_best_strip(candidates, cv_image.shape)
            
            # 4. Strip-Region extrahieren
            if best_strip is not None:
                strip_region = self._extract_strip_region(image, best_strip)
                logger.info(f"Strip erkannt: {best_strip}")
                return strip_region
            else:
                logger.warning("Kein Strip erkannt, verwende Fallback")
                return self._fallback_extraction(image)
                
        except Exception as e:
            logger.error(f"Strip-Erkennung fehlgeschlagen: {e}")
            return self._fallback_extraction(image)
    
    def _preprocess_image(self, image: Image.Image) -> np.ndarray:
        """Bereitet das Bild für die Strip-Erkennung vor"""
        # PIL zu OpenCV konvertieren
        cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Graustufen-Konvertierung
        gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY)
        
        # Gaussian Blur zur Rauschreduzierung
        blurred = cv2.GaussianBlur(gray, self.config["gaussian_blur"], 0)
        
        # Morphologische Operationen zur Strukturverbesserung
        kernel = np.ones((self.config["morphology_kernel"], self.config["morphology_kernel"]), np.uint8)
        processed = cv2.morphologyEx(blurred, cv2.MORPH_CLOSE, kernel)
        
        return processed
    
    def _find_strip_candidates(self, processed_image: np.ndarray) -> list:
        """Findet potentielle Strip-Kandidaten mittels Kontur-Erkennung"""
        # Canny Edge Detection
        edges = cv2.Canny(processed_image, self.config["canny_low"], self.config["canny_high"])
        
        # Konturen finden
        contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        candidates = []
        image_area = processed_image.shape[0] * processed_image.shape[1]
        
        for contour in contours:
            # Bounding Rectangle berechnen
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            
            # Grundfilter anwenden
            if area < self.config["min_contour_area"]:
                continue
                
            # Flächenfilter (relativ zur Bildgröße)
            area_percent = (area / image_area) * 100
            if not (self.config["min_area_percent"] <= area_percent <= self.config["max_area_percent"]):
                continue
            
            # Seitenverhältnis prüfen (sowohl w/h als auch h/w)
            aspect_ratio = max(w, h) / min(w, h)
            if not (self.config["min_aspect_ratio"] <= aspect_ratio <= self.config["max_aspect_ratio"]):
                continue
            
            # Rechteck-Score berechnen (wie gut passt die Kontur zu einem Rechteck)
            rect_score = self._calculate_rectangle_score(contour, (x, y, w, h))
            
            candidates.append({
                "bbox": (x, y, w, h),
                "area": area,
                "area_percent": area_percent,
                "aspect_ratio": aspect_ratio,
                "rect_score": rect_score,
                "contour": contour
            })
        
        return candidates
    
    def _calculate_rectangle_score(self, contour, bbox) -> float:
        """Berechnet, wie gut eine Kontur zu einem Rechteck passt (0-1)"""
        x, y, w, h = bbox
        
        # Verhältnis der Kontur-Fläche zur Bounding-Box-Fläche
        contour_area = cv2.contourArea(contour)
        bbox_area = w * h
        
        if bbox_area == 0:
            return 0.0
            
        area_ratio = contour_area / bbox_area
        
        # Rechteck-Approximation
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # Score basierend auf Anzahl der Eckpunkte (4 = perfektes Rechteck)
        corner_score = max(0, 1 - abs(len(approx) - 4) * 0.1)
        
        # Kombinierter Score
        total_score = (area_ratio * 0.7) + (corner_score * 0.3)
        
        return min(1.0, total_score)
    
    def _select_best_strip(self, candidates: list, image_shape: tuple) -> dict:
        """Wählt den besten Strip-Kandidaten aus"""
        if not candidates:
            return None
        
        # Score für jeden Kandidaten berechnen
        for candidate in candidates:
            # Verschiedene Faktoren gewichten
            area_score = min(1.0, candidate["area_percent"] / 20)  # Optimal bei ~20%
            aspect_score = min(1.0, candidate["aspect_ratio"] / 4)  # Optimal bei ~4:1
            rect_score = candidate["rect_score"]
            
            # Position-Score (zentralere Strips bevorzugen)
            x, y, w, h = candidate["bbox"]
            center_x = x + w/2
            center_y = y + h/2
            img_center_x = image_shape[1] / 2
            img_center_y = image_shape[0] / 2
            
            distance_from_center = np.sqrt((center_x - img_center_x)**2 + (center_y - img_center_y)**2)
            max_distance = np.sqrt(img_center_x**2 + img_center_y**2)
            position_score = 1 - (distance_from_center / max_distance)
            
            # Gesamtscore berechnen
            total_score = (
                rect_score * 0.4 +           # Rechteckigkeit ist wichtig
                area_score * 0.3 +           # Angemessene Größe
                aspect_score * 0.2 +         # Richtiges Seitenverhältnis
                position_score * 0.1         # Zentrale Position
            )
            
            candidate["total_score"] = total_score
        
        # Besten Kandidaten zurückgeben
        best_candidate = max(candidates, key=lambda x: x["total_score"])
        
        logger.info(f"Bester Strip-Kandidat: Score={best_candidate['total_score']:.3f}, "
                   f"Area={best_candidate['area_percent']:.1f}%, "
                   f"Ratio={best_candidate['aspect_ratio']:.1f}")
        
        return best_candidate
    
    def _extract_strip_region(self, image: Image.Image, strip_data: dict) -> Image.Image:
        """Extrahiert die Strip-Region aus dem Original-Bild"""
        x, y, w, h = strip_data["bbox"]
        
        # Padding hinzufügen (5% der Strip-Größe)
        padding_x = max(5, int(w * 0.05))
        padding_y = max(5, int(h * 0.05))
        
        x1 = max(0, x - padding_x)
        y1 = max(0, y - padding_y)
        x2 = min(image.width, x + w + padding_x)
        y2 = min(image.height, y + h + padding_y)
        
        return image.crop((x1, y1, x2, y2))
    
    def _fallback_extraction(self, image: Image.Image) -> Image.Image:
        """Fallback-Methode wenn kein Strip erkannt wird"""
        logger.info("Verwende Fallback: Mittlerer Bildbereich")
        w, h = image.size
        
        # Mittleres Drittel des Bildes
        x1 = w // 4
        y1 = h // 3
        x2 = 3 * w // 4
        y2 = 2 * h // 3
        
        return image.crop((x1, y1, x2, y2))
    
    def get_debug_info(self, image: Image.Image) -> dict:
        """Gibt Debug-Informationen für die Strip-Erkennung zurück"""
        try:
            cv_image = self._preprocess_image(image)
            candidates = self._find_strip_candidates(cv_image)
            best_strip = self._select_best_strip(candidates, cv_image.shape)
            
            return {
                "candidates_found": len(candidates),
                "best_candidate": best_strip,
                "all_candidates": candidates[:5]  # Top 5 für Debug
            }
        except Exception as e:
            return {"error": str(e)}