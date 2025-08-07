#!/usr/bin/env python3
"""
Enhanced UV Strip Test Image Generator
Erstellt realistische Testbilder für beide Modi der UV Strip Analyzer App
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import random
import json
from datetime import datetime
import cv2

class EnhancedUVStripGenerator:
    """Erweiterte UV-Strip Test-Bild Generierung"""
    
    def __init__(self, output_dir="test_images"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(os.path.join(output_dir, "mode1_combined"), exist_ok=True)
        os.makedirs(os.path.join(output_dir, "mode2_strip_only"), exist_ok=True)
        os.makedirs(os.path.join(output_dir, "reference_scales"), exist_ok=True)
        
        # Erweiterte UV-Strip Kalibrierung basierend auf eurem Code
        self.strip_types = {
            "standard": {
                "name": "Standard UV-Strip",
                "range": "0-500 J/cm²",
                "baseline_rgb": [245, 240, 235],
                "dose_points": [
                    {"dose": 0, "rgb": [245, 240, 235], "label": "Unbelichtet"},
                    {"dose": 50, "rgb": [220, 200, 180], "label": "Niedrig"},
                    {"dose": 150, "rgb": [180, 150, 120], "label": "Mittel"},
                    {"dose": 300, "rgb": [140, 100, 80], "label": "Hoch"},
                    {"dose": 500, "rgb": [100, 60, 40], "label": "Extrem"}
                ]
            },
            "uvc": {
                "name": "UVC-Strip",
                "range": "0-100 J/cm²",
                "baseline_rgb": [240, 235, 245],
                "dose_points": [
                    {"dose": 0, "rgb": [240, 235, 245], "label": "Unbelichtet"},
                    {"dose": 20, "rgb": [210, 190, 220], "label": "Niedrig"},
                    {"dose": 50, "rgb": [170, 140, 190], "label": "Mittel"},
                    {"dose": 80, "rgb": [130, 90, 160], "label": "Hoch"},
                    {"dose": 100, "rgb": [100, 50, 130], "label": "Extrem"}
                ]
            },
            "uva": {
                "name": "UVA-Strip",
                "range": "0-1000 J/cm²",
                "baseline_rgb": [250, 245, 200],
                "dose_points": [
                    {"dose": 0, "rgb": [250, 245, 200], "label": "Unbelichtet"},
                    {"dose": 200, "rgb": [230, 210, 150], "label": "Niedrig"},
                    {"dose": 500, "rgb": [200, 160, 100], "label": "Mittel"},
                    {"dose": 750, "rgb": [170, 120, 70], "label": "Hoch"},
                    {"dose": 1000, "rgb": [140, 80, 40], "label": "Extrem"}
                ]
            }
        }
    
    def interpolate_color(self, color1, color2, factor):
        """Interpoliert zwischen zwei Farben"""
        factor = max(0.0, min(1.0, factor))
        return tuple(int(c1 + (c2 - c1) * factor) for c1, c2 in zip(color1, color2))
    
    def add_realistic_effects(self, image, noise_level=8, lighting_variation=0.15):
        """Fügt realistische Effekte hinzu"""
        # Rauschen
        img_array = np.array(image)
        noise = np.random.normal(0, noise_level, img_array.shape)
        noisy_image = img_array + noise
        noisy_image = np.clip(noisy_image, 0, 255).astype(np.uint8)
        image = Image.fromarray(noisy_image)
        
        # Beleuchtungsvariation
        enhancer = ImageEnhance.Brightness(image)
        brightness_factor = 1.0 + random.uniform(-lighting_variation, lighting_variation)
        image = enhancer.enhance(brightness_factor)
        
        # Leichte Unschärfe
        if random.random() < 0.3:  # 30% Chance auf leichte Unschärfe
            image = image.filter(ImageFilter.GaussianBlur(radius=0.5))
        
        return image
    
    def create_reference_scale(self, strip_type, width=800, height=150):
        """Erstellt eine Referenzskala für einen Strip-Typ"""
        image = Image.new('RGB', (width, height), (250, 250, 250))
        draw = ImageDraw.Draw(image)
        
        strip_data = self.strip_types[strip_type]
        dose_points = strip_data["dose_points"]
        
        # Zeichne Referenz-Rechtecke
        rect_width = width // len(dose_points)
        for i, point in enumerate(dose_points):
            x1 = i * rect_width
            x2 = (i + 1) * rect_width
            y1 = 20
            y2 = height - 60
            
            # Farbe mit Variation
            base_color = point["rgb"]
            varied_color = [max(0, min(255, c + random.randint(-8, 8))) for c in base_color]
            
            draw.rectangle([x1, y1, x2, y2], fill=tuple(varied_color), outline=(100, 100, 100))
            
            # Beschriftung
            try:
                # Versuche eine bessere Schrift zu laden
                font = ImageFont.truetype("arial.ttf", 12)
            except:
                font = ImageFont.load_default()
            
            text = f"{point['dose']} J/cm²"
            text_bbox = draw.textbbox((0, 0), text, font=font)
            text_width = text_bbox[2] - text_bbox[0]
            text_x = x1 + (rect_width - text_width) // 2
            text_y = y2 + 10
            
            draw.text((text_x, text_y), text, fill=(50, 50, 50), font=font)
        
        # Titel
        try:
            title_font = ImageFont.truetype("arial.ttf", 16)
        except:
            title_font = ImageFont.load_default()
        
        title = f"{strip_data['name']} ({strip_data['range']})"
        title_bbox = draw.textbbox((0, 0), title, font=title_font)
        title_width = title_bbox[2] - title_bbox[0]
        title_x = (width - title_width) // 2
        draw.text((title_x, 5), title, fill=(50, 50, 50), font=title_font)
        
        return image
    
    def create_combined_image(self, strip_type, dose_value, width=1200, height=800):
        """Erstellt ein kombiniertes Bild (Strip + Referenz) für Modus 1"""
        image = Image.new('RGB', (width, height), (245, 245, 245))
        
        # Bestimme Strip-Farbe basierend auf Dosis
        strip_data = self.strip_types[strip_type]
        dose_points = strip_data["dose_points"]
        
        # Finde passende Farbinterpolation
        strip_color = dose_points[0]["rgb"]  # Fallback
        for i in range(len(dose_points) - 1):
            if dose_points[i]["dose"] <= dose_value <= dose_points[i + 1]["dose"]:
                factor = (dose_value - dose_points[i]["dose"]) / (dose_points[i + 1]["dose"] - dose_points[i]["dose"])
                strip_color = self.interpolate_color(dose_points[i]["rgb"], dose_points[i + 1]["rgb"], factor)
                break
        
        # Füge Farbvariation hinzu
        strip_color = [max(0, min(255, c + random.randint(-12, 12))) for c in strip_color]
        
        # Zeichne den UV-Strip
        strip_x, strip_y = 100, 200
        strip_width, strip_height = 300, 80
        
        draw = ImageDraw.Draw(image)
        draw.rectangle([strip_x, strip_y, strip_x + strip_width, strip_y + strip_height], 
                      fill=tuple(strip_color), outline=(80, 80, 80), width=2)
        
        # Füge Strip-Label hinzu
        try:
            font = ImageFont.truetype("arial.ttf", 14)
        except:
            font = ImageFont.load_default()
        
        label = f"UV Strip - {dose_value} J/cm²"
        draw.text((strip_x, strip_y - 25), label, fill=(50, 50, 50), font=font)
        
        # Erstelle und platziere Referenzskala
        ref_scale = self.create_reference_scale(strip_type, width=800, height=120)
        image.paste(ref_scale, (200, 400))
        
        # Füge realistische Effekte hinzu
        image = self.add_realistic_effects(image)
        
        return image
    
    def create_strip_only_image(self, strip_type, dose_value, width=600, height=400):
        """Erstellt ein Bild nur mit UV-Strip für Modus 2"""
        image = Image.new('RGB', (width, height), (240, 240, 240))
        
        # Bestimme Strip-Farbe
        strip_data = self.strip_types[strip_type]
        dose_points = strip_data["dose_points"]
        
        strip_color = dose_points[0]["rgb"]
        for i in range(len(dose_points) - 1):
            if dose_points[i]["dose"] <= dose_value <= dose_points[i + 1]["dose"]:
                factor = (dose_value - dose_points[i]["dose"]) / (dose_points[i + 1]["dose"] - dose_points[i]["dose"])
                strip_color = self.interpolate_color(dose_points[i]["rgb"], dose_points[i + 1]["rgb"], factor)
                break
        
        # Farbvariation
        strip_color = [max(0, min(255, c + random.randint(-10, 10))) for c in strip_color]
        
        # Zeichne UV-Strip zentriert
        strip_width, strip_height = 200, 60
        strip_x = (width - strip_width) // 2
        strip_y = (height - strip_height) // 2
        
        draw = ImageDraw.Draw(image)
        draw.rectangle([strip_x, strip_y, strip_x + strip_width, strip_y + strip_height], 
                      fill=tuple(strip_color), outline=(100, 100, 100), width=1)
        
        # Label
        try:
            font = ImageFont.truetype("arial.ttf", 12)
        except:
            font = ImageFont.load_default()
        
        label = f"{strip_data['name']}"
        label_bbox = draw.textbbox((0, 0), label, font=font)
        label_width = label_bbox[2] - label_bbox[0]
        label_x = (width - label_width) // 2
        draw.text((label_x, strip_y - 25), label, fill=(60, 60, 60), font=font)
        
        # Realistische Effekte
        image = self.add_realistic_effects(image, noise_level=6)
        
        return image
    
    def generate_test_dataset(self):
        """Generiert kompletten Testdatensatz für beide Modi"""
        metadata = {
            "generated_at": datetime.now().isoformat(),
            "generator_version": "2.0",
            "description": "Test images for LUVEX UV Strip Analyzer",
            "modes": {
                "mode1_combined": "Strip + Reference scale in same image",
                "mode2_strip_only": "Strip only, requires saved reference",
                "reference_scales": "Reference scales for calibration"
            },
            "images": []
        }
        
        print("🎨 Generiere Testbilder für UV Strip Analyzer...")
        print("=" * 60)
        
        # 1. Erstelle Referenzskalen
        print("\n📏 Erstelle Referenzskalen...")
        for strip_type in self.strip_types.keys():
            ref_image = self.create_reference_scale(strip_type, width=1000, height=200)
            filename = f"reference_{strip_type}.jpg"
            filepath = os.path.join(self.output_dir, "reference_scales", filename)
            ref_image.save(filepath, "JPEG", quality=95)
            
            metadata["images"].append({
                "filename": filename,
                "type": "reference_scale",
                "strip_type": strip_type,
                "mode": "reference",
                "path": f"reference_scales/{filename}"
            })
            print(f"✅ {filename}")
        
        # 2. Generiere Modus 1 Bilder (Combined)
        print("\n🖼️ Generiere Modus 1 Bilder (Strip + Referenz)...")
        image_id = 1
        
        for strip_type in self.strip_types.keys():
            strip_data = self.strip_types[strip_type]
            dose_points = [p["dose"] for p in strip_data["dose_points"]]
            
            # Füge Zwischenwerte hinzu
            all_doses = dose_points.copy()
            for i in range(len(dose_points) - 1):
                mid_dose = (dose_points[i] + dose_points[i + 1]) / 2
                all_doses.append(mid_dose)
            all_doses.sort()
            
            for dose in all_doses:
                for variant in range(2):  # 2 Varianten pro Dosis
                    combined_image = self.create_combined_image(strip_type, dose)
                    filename = f"combined_{strip_type}_{dose:05.1f}J_{variant+1:02d}.jpg"
                    filepath = os.path.join(self.output_dir, "mode1_combined", filename)
                    combined_image.save(filepath, "JPEG", quality=92)
                    
                    metadata["images"].append({
                        "id": image_id,
                        "filename": filename,
                        "type": "combined",
                        "strip_type": strip_type,
                        "dose_jcm2": dose,
                        "variant": variant + 1,
                        "mode": "withReference",
                        "path": f"mode1_combined/{filename}"
                    })
                    
                    print(f"✅ {filename} ({dose} J/cm²)")
                    image_id += 1
        
        # 3. Generiere Modus 2 Bilder (Strip only)
        print("\n🎯 Generiere Modus 2 Bilder (nur Strip)...")
        
        for strip_type in self.strip_types.keys():
            strip_data = self.strip_types[strip_type]
            dose_points = [p["dose"] for p in strip_data["dose_points"]]
            
            for dose in dose_points:
                for variant in range(3):  # 3 Varianten pro Dosis
                    strip_image = self.create_strip_only_image(strip_type, dose)
                    filename = f"strip_{strip_type}_{dose:05.1f}J_{variant+1:02d}.jpg"
                    filepath = os.path.join(self.output_dir, "mode2_strip_only", filename)
                    strip_image.save(filepath, "JPEG", quality=92)
                    
                    metadata["images"].append({
                        "id": image_id,
                        "filename": filename,
                        "type": "strip_only",
                        "strip_type": strip_type,
                        "dose_jcm2": dose,
                        "variant": variant + 1,
                        "mode": "savedReference",
                        "path": f"mode2_strip_only/{filename}"
                    })
                    
                    print(f"✅ {filename} ({dose} J/cm²)")
                    image_id += 1
        
        # Speichere Metadaten
        metadata_file = os.path.join(self.output_dir, "test_images_metadata.json")
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        # Erstelle Testplan
        self.create_test_plan(metadata)
        
        print(f"\n🎉 Testbilder-Generierung abgeschlossen!")
        print(f"📁 Ausgabe: {self.output_dir}/")
        print(f"📊 Gesamt: {len(metadata['images'])} Bilder")
        print(f"📋 Metadaten: {metadata_file}")
        print(f"🧪 Testplan: {self.output_dir}/test_plan.md")
        
        return metadata
    
    def create_test_plan(self, metadata):
        """Erstellt einen strukturierten Testplan"""
        test_plan = f"""# Testplan für UV Strip Analyzer

**Generiert am:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**Gesamt Bilder:** {len(metadata['images'])}

## 🎯 Testziele

1. **Funktionalität beider Modi testen**
   - Modus 1: Strip + Referenz im gleichen Bild
   - Modus 2: Nur Strip mit gespeicherter Referenz

2. **Genauigkeit der Dosisberechnung validieren**
   - Vergleich der berechneten vs. erwarteten UV-Dosis
   - Bewertung der Konfidenz-Scores

3. **UI/UX Testing**
   - Drag & Drop Funktionalität
   - Modal-Dialoge
   - Responsive Design

## 📂 Ordnerstruktur

```
test_images/
├── mode1_combined/        # Bilder für "Referenz im Bild" Modus
├── mode2_strip_only/      # Bilder für "Gespeicherte Referenz" Modus  
├── reference_scales/      # Referenzskalen für Kalibrierung
└── test_images_metadata.json
```

## 🧪 Testszenarien

### Szenario 1: Modus 1 Testing (Referenz im Bild)
1. App starten und Modus "Referenz im Bild" wählen
2. Testbilder aus `mode1_combined/` hochladen
3. Analyse starten und Ergebnisse prüfen
4. Messungen speichern und Historie testen

**Erwartete Dosis-Bereiche:**
- Standard: 0-500 J/cm²
- UVC: 0-100 J/cm²  
- UVA: 0-1000 J/cm²

### Szenario 2: Modus 2 Testing (Gespeicherte Referenz)
1. Referenzbibliothek mit Standard-Referenzen testen
2. Custom Referenzen hinzufügen (aus `reference_scales/`)
3. Strip-Bilder aus `mode2_strip_only/` hochladen
4. Verschiedene Referenzen auswählen und analysieren

### Szenario 3: Edge Cases
- Sehr große Bilddateien (>10MB)
- Unsupported Dateiformate
- Leere/invalide Uploads
- Backend offline Szenario

## ✅ Akzeptanzkriterien

### Technische Anforderungen
- [ ] Alle Uploads funktionieren (Drag & Drop + Click)
- [ ] Backend-Kommunikation stabil
- [ ] Dosisberechnung innerhalb ±15% Toleranz
- [ ] Responsive Design auf verschiedenen Bildschirmgrößen

### UX Anforderungen  
- [ ] Intuitive Bedienung ohne Anleitung
- [ ] Klare Fehlermeldungen
- [ ] Schnelle Ladezeiten (<3 Sekunden)
- [ ] Modal-Dialoge funktionieren einwandfrei

## 📊 Testdaten-Übersicht

{self._generate_test_data_table()}

## 🔧 Setup & Verwendung

### 1. Testbilder generieren
```bash
cd scripts/
python generate_test_images.py
```

### 2. App testen
```bash
# Backend starten
cd backend/api
python main.py

# Frontend starten  
cd ../../
npm start
```

### 3. Testdurchlauf
1. **Modus 1 Tests**: Alle Bilder aus `mode1_combined/` testen
2. **Modus 2 Tests**: Alle Bilder aus `mode2_strip_only/` mit verschiedenen Referenzen testen
3. **Edge Cases**: Invalide Dateien, große Dateien, etc.

## 🚨 Bekannte Limitationen

- Testbilder sind synthetisch generiert
- Echte UV-Strips können abweichen
- Beleuchtung in realen Fotos variiert stärker
- Kamera-Qualität beeinflusst Ergebnisse

## 📝 Test-Protokoll

Verwende diese Checkliste beim Testen:

### Modus 1 (Referenz im Bild)
- [ ] Upload funktioniert (Drag & Drop)
- [ ] Upload funktioniert (Click)  
- [ ] Bildvorschau wird angezeigt
- [ ] Analyse läuft durch
- [ ] Ergebnisse sind plausibel
- [ ] Messung kann gespeichert werden
- [ ] Historie zeigt gespeicherte Messungen

### Modus 2 (Gespeicherte Referenz)
- [ ] Modus-Wechsel funktioniert
- [ ] Referenz-Dropdown verfügbar
- [ ] Standard-Referenzen vorhanden
- [ ] Custom Referenz hinzufügen funktioniert
- [ ] Custom Referenz löschen funktioniert
- [ ] Analyse mit verschiedenen Referenzen

### Responsive Design
- [ ] Desktop (>1200px) Layout korrekt
- [ ] Tablet (768px-1200px) Layout korrekt  
- [ ] Mobile (<768px) Layout korrekt
- [ ] Touch-Bedienung funktioniert

### Fehlerbehandlung
- [ ] Große Dateien (>10MB) werden abgelehnt
- [ ] Nicht-Bild-Dateien werden abgelehnt
- [ ] Backend offline wird erkannt
- [ ] Fehlermeldungen sind verständlich

---

**Status:** 🟡 Bereit zum Testen
**Nächster Schritt:** Vollständige Testdurchführung und Bugfixes
"""
        
        with open(os.path.join(self.output_dir, "test_plan.md"), 'w', encoding='utf-8') as f:
            f.write(test_plan)
    
    def _generate_test_data_table(self):
        """Generiert eine Übersichtstabelle der Testdaten"""
        table = "| Strip-Typ | Anzahl Bilder | Dosis-Bereiche | Modi |\n"
        table += "|-----------|---------------|----------------|------|\n"
        
        for strip_type, data in self.strip_types.items():
            dose_range = data["range"]
            # Annahme: 5 Dosis-Punkte × 2-3 Varianten pro Modus
            count_mode1 = len(data["dose_points"]) * 2 + (len(data["dose_points"]) - 1) * 2  # Mit Zwischenwerten
            count_mode2 = len(data["dose_points"]) * 3
            total_count = count_mode1 + count_mode2 + 1  # +1 für Referenzskala
            
            table += f"| {data['name']} | {total_count} | {dose_range} | Beide |\n"
        
        return table

if __name__ == "__main__":
    print("🚀 LUVEX UV Strip Test Image Generator v2.0")
    print("=" * 60)
    
    generator = EnhancedUVStripGenerator()
    metadata = generator.generate_test_dataset()
    
    print(f"\n🎉 Generation completed successfully!")
    print(f"📁 Output directory: {generator.output_dir}")
    print(f"📊 Total images: {len(metadata['images'])}")
    print(f"📋 Test plan: {generator.output_dir}/test_plan.md")
    print(f"🧪 Ready for testing the UV Strip Analyzer!")