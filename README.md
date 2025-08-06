# \# LUVEX UV Strip Analyzer

# 

# Eine professionelle Electron-basierte Desktop-Anwendung zur Analyse von UV-Dosimeter-Streifen.

# 

# \## 🚀 Features

# 

# \- \*\*Automatische Strip-Erkennung\*\*: KI-basierte Erkennung von UV-Streifen in Bildern

# \- \*\*Präzise Farbanalyse\*\*: Hochgenaue Analyse der Farbveränderungen  

# \- \*\*UV-Dosis-Berechnung\*\*: Berechnung der empfangenen UV-Strahlung in J/cm²

# \- \*\*Expositionsbewertung\*\*: Automatische Einstufung in Risikokategorien

# \- \*\*LUVEX Corporate Design\*\*: Professionelles Branding und UI

# \- \*\*Drag \& Drop Interface\*\*: Intuitive Bedienung

# \- \*\*Echtzeit-Verarbeitung\*\*: Schnelle Analyseergebnisse

# 

# \## 🏗️ Projektstruktur

# 

# ```

# uv-strip-analyzer/

# ├── src/

# │   ├── electron/

# │   │   └── main.js              # Electron Hauptprozess

# │   └── frontend/

# │       └── index.html           # Frontend mit integriertem JavaScript

# ├── backend/

# │   └── api/

# │       └── main.py              # FastAPI Backend Server

# ├── package.json                 # Node.js Dependencies

# ├── requirements.txt             # Python Dependencies

# └── README.md

# ```

# 

# \## 🛠️ Installation \& Setup

# 

# \### 1. Repository klonen

# 

# ```bash

# git clone <repository-url>

# cd uv-strip-analyzer

# ```

# 

# \### 2. Frontend (Electron) Setup

# 

# ```bash

# \# Node.js Dependencies installieren

# npm install

# 

# \# Oder setup script verwenden

# npm run setup

# ```

# 

# \### 3. Backend (Python) Setup

# 

# ```bash

# \# Python Virtual Environment erstellen (empfohlen)

# python -m venv venv

# 

# \# Virtual Environment aktivieren

# \# Windows:

# venv\\Scripts\\activate

# \# macOS/Linux:

# source venv/bin/activate

# 

# \# Python Dependencies installieren

# pip install -r requirements.txt

# ```

# 

# \## 🚀 Anwendung starten

# 

# \### 1. Backend starten

# 

# ```bash

# \# In einem Terminal:

# cd backend/api

# python main.py

# ```

# 

# Das Backend läuft dann auf: `http://localhost:8000`

# 

# \### 2. Frontend starten

# 

# ```bash

# \# In einem neuen Terminal:

# npm start

# ```

# 

# Die Electron-App startet automatisch.

# 

# \## 🔧 API Endpoints

# 

# \### Hauptfunktionen

# 

# \- `GET /` - API Status

# \- `GET /health` - Health Check

# \- `POST /analyze` - UV-Strip Analyse (Hauptfunktion)

# \- `GET /strip-types` - Unterstützte Strip-Typen

# 

# \### Beispiel API-Aufruf

# 

# ```bash

# curl -X POST "http://localhost:8000/analyze" \\

# &nbsp;    -H "Content-Type: multipart/form-data" \\

# &nbsp;    -F "file=@uv\_strip\_image.jpg"

# ```

# 

# \## 📊 Analyseergebnisse

# 

# Die Analyse liefert folgende Daten zurück:

# 

# ```json

# {

# &nbsp; "success": true,

# &nbsp; "uv\_dose": "125.5",

# &nbsp; "exposure\_level": "medium", 

# &nbsp; "color\_change": "23.4",

# &nbsp; "confidence": "87.2%",

# &nbsp; "recommendation": "Mittlere UV-Exposition (125.5 J/cm²)...",

# &nbsp; "processed\_image": "base64\_encoded\_image",

# &nbsp; "technical\_data": {

# &nbsp;   "avg\_rgb": \[180, 150, 120],

# &nbsp;   "color\_distance": 45.2

# &nbsp; }

# }

# ```

# 

# \## 🎯 Verwendung

# 

# 1\. \*\*App starten\*\*: Beide Services (Backend + Frontend) starten

# 2\. \*\*Bild laden\*\*: UV-Strip Bild per Drag \& Drop oder Klick hochladen

# 3\. \*\*Analysieren\*\*: "Bild analysieren" Button klicken  

# 4\. \*\*Ergebnisse\*\*: UV-Dosis, Expositionslevel und Empfehlungen erhalten

# 

# \## 🔬 Technische Details

# 

# \### Frontend

# \- \*\*Electron 27.x\*\* - Desktop App Framework

# \- \*\*HTML/CSS/JavaScript\*\* - UI und Logik

# \- \*\*LUVEX Design System\*\* - Corporate Identity

# 

# \### Backend  

# \- \*\*FastAPI\*\* - Modern Python Web Framework

# \- \*\*OpenCV\*\* - Computer Vision für Bildverarbeitung

# \- \*\*Pillow (PIL)\*\* - Bildmanipulation

# \- \*\*NumPy\*\* - Numerische Berechnungen

# 

# \### Bildanalyse-Pipeline

# 1\. \*\*Vorverarbeitung\*\*: Größenanpassung, Schärfung

# 2\. \*\*Strip-Extraktion\*\*: Kantenerkennung und ROI-Bestimmung  

# 3\. \*\*Farbanalyse\*\*: RGB-Durchschnittswerte und Farbdistanz

# 4\. \*\*Dosis-Berechnung\*\*: Lineare Interpolation basierend auf Kalibrierung

# 5\. \*\*Bewertung\*\*: Risiko-Kategorisierung und Empfehlungen

# 

# \## 🧪 Development

# 

# \### Backend erweitern

# 

# ```python

# \# Neue Analysefunktion hinzufügen

# @app.post("/custom-analysis")

# async def custom\_analysis(file: UploadFile = File(...)):

# &nbsp;   # Implementierung hier

# &nbsp;   pass

# ```

# 

# \### Frontend anpassen

# 

# Das JavaScript ist direkt in `src/frontend/index.html` eingebettet. Für größere Änderungen sollte es in separate Dateien ausgelagert werden.

# 

# \## 📝 TODO / Roadmap

# 

# \- \[ ] \*\*Datenbankintegration\*\*: SQLite für Analyseverlauf

# \- \[ ] \*\*Kalibrierungssystem\*\*: Custom Strip-Typen trainieren  

# \- \[ ] \*\*Batch-Verarbeitung\*\*: Multiple Bilder gleichzeitig

# \- \[ ] \*\*Export-Funktionen\*\*: PDF/CSV Reports

# \- \[ ] \*\*Web-Version\*\*: Deploy auf Google Cloud VM

# \- \[ ] \*\*Machine Learning\*\*: Verbesserte Dosis-Schätzung mit ML

# 

# \## 🐛 Troubleshooting

# 

# \### Backend startet nicht

# \- Python Virtual Environment aktiviert?

# \- Alle Dependencies installiert? (`pip install -r requirements.txt`)

# \- Port 8000 bereits belegt?

# 

# \### Frontend kann Backend nicht erreichen

# \- Backend läuft auf Port 8000?  

# \- CORS-Einstellungen korrekt?

# \- Firewall blockiert Verbindung?

# 

# \### Bildanalyse schlägt fehl

# \- Bild unter 10MB?

# \- Unterstütztes Format? (JPG, PNG, GIF)

# \- Gültiges UV-Strip Bild?

# 

# \## 📞 Support

# 

# Bei Fragen oder Problemen:

# \- Issue auf GitHub erstellen

# \- Logs der Konsole prüfen (`F12` im Frontend)

# \- Backend-Logs im Terminal prüfen

# 

# \## 📄 License

# 

# Dieses Projekt ist proprietäre Software von LUVEX.

# 

# ---

# 

# \*\*Entwickelt mit ❤️ für präzise UV-Dosimetrie\*\*

