# Testplan für UV Strip Analyzer

**Generiert am:** 2025-08-08 01:17:33
**Gesamt Bilder:** 102

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

| Strip-Typ | Anzahl Bilder | Dosis-Bereiche | Modi |
|-----------|---------------|----------------|------|
| Standard UV-Strip | 34 | 0-500 J/cm² | Beide |
| UVC-Strip | 34 | 0-100 J/cm² | Beide |
| UVA-Strip | 34 | 0-1000 J/cm² | Beide |


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
