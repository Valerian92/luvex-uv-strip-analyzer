# Test-Data für UV Strip Analyzer

Dieser Ordner enthält alle Test- und Kalibrierungsdaten für die UV-Strip Analyse.

## 📁 Ordnerstruktur

```
test-data/
├── demo-images/          # Generierte Demo UV-Strips
├── reference-images/     # Kalibrierungsbilder  
├── real-samples/         # Echte UV-Strip Fotos
└── README.md            # Diese Datei
```

## 🖼️ Demo-Images

Die Demo-Bilder simulieren **realistische UV-Strip Dosimeter** mit bekannten UV-Dosiswerten:

| Datei | UV-Dosis | Expositionslevel | RGB-Referenz | Beschreibung |
|-------|----------|------------------|--------------|--------------|
| `uv-strip-0J.jpg` | 0 J/cm² | Unbelichtet | (245,240,235) | Fabrikneuer Strip, keine UV-Exposition |
| `uv-strip-50J.jpg` | 50 J/cm² | Niedrig | (220,200,180) | Kurze Sonneneinstrahlung (~1-2h) |
| `uv-strip-150J.jpg` | 150 J/cm² | Mittel | (180,150,120) | Normale Arbeitsschicht im Freien |
| `uv-strip-300J.jpg` | 300 J/cm² | Hoch | (140,100,80) | Ganztägige UV-Exposition |
| `uv-strip-500J.jpg` | 500 J/cm² | Extrem | (100,60,40) | Intensive UV-Belastung |

## 🎯 Verwendung für Kalibrierung

### 1. Algorithmus-Validierung
```python
# Erwartete vs. berechnete Werte vergleichen
expected_dose = 150  # J/cm²
calculated_dose = analyze_image("uv-strip-150J.jpg")
accuracy = abs(expected_dose - calculated_dose) / expected_dose * 100
```

### 2. Referenzwert-Bestimmung
- **Baseline-RGB:** (245,240,235) für unbelichteten Strip
- **Max-Change:** (100,60,40) für extreme Exposition
- **Lineare Interpolation** zwischen den Stufen

### 3. Test-Cases
```python
test_cases = [
    {"file": "uv-strip-0J.jpg", "expected_dose": 0, "tolerance": 5},
    {"file": "uv-strip-50J.jpg", "expected_dose": 50, "tolerance": 10},
    {"file": "uv-strip-150J.jpg", "expected_dose": 150, "tolerance": 15},
    {"file": "uv-strip-300J.jpg", "expected_dose": 300, "tolerance": 20},
    {"file": "uv-strip-500J.jpg", "expected_dose": 500, "tolerance": 25}
]
```

## 📊 Metadaten

Jedes generierte Demo-Bild hat zugehörige Metadaten in `demo_images_metadata.json`:

```json
{
  "uv-strip-150J.jpg": {
    "dose_jcm2": 150,
    "label": "Mittlere Exposition", 
    "expected_rgb": [180, 150, 120],
    "strip_dimensions": [300, 100],
    "strip_position": [50, 50, 350, 150]
  }
}
```

## 🧪 Realistisches Strip-Design

Die generierten Bilder simulieren:
- **Authentische Farbübergänge** basierend auf echten UV-Strips
- **Kamera-Rauschen** und leichte Unschärfe
- **Beleuchtungsvariationen** (0.8x - 1.2x Helligkeit)  
- **Textur-Variationen** im Strip-Material
- **Realistische Dimensionen** (3:1 Verhältnis)

## 🔬 Kalibrierungs-Workflow

1. **Demo-Bilder generieren:** `python scripts/generate_demo_images.py`
2. **In App testen:** Upload und Analyse aller Demo-Strips
3. **Ergebnisse validieren:** Vergleich mit erwarteten Werten
4. **Algorithmus justieren:** Basierend auf Abweichungen
5. **Wiederholungs-Test:** Erneute Validierung nach Änderungen

## 🎯 Qualitätsziele

**Ziel-Genauigkeit für Demo-Bilder:**
- **0-50 J/cm²:** ±5 J/cm² Abweichung
- **50-200 J/cm²:** ±10% Abweichung  
- **200-500 J/cm²:** ±15% Abweichung

**Bei größeren Abweichungen:**
- Kalibrierungskurve anpassen
- RGB-zu-Dosis Mapping überarbeiten
- Bildvorverarbeitung optimieren

---

**Status:** ✅ Demo-Bilder verfügbar für Algorithm-Testing  
**Nächster Schritt:** Validierung mit echten UV-Strip Samples