#!/usr/bin/env python3
"""
UV Strip Demo Image Generator
Erstellt realistische UV-Dosimeter Strip Bilder für Testing und Kalibrierung
"""

import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import random
import json

class UVStripGenerator:
    """Generiert realistische UV-Strip Demo-Bilder"""
    
    def __init__(self):
        # UV-Strip Dimensionen (in Pixel)
        self.strip_width = 300
        self.strip_height = 100
        self.image_width = 400  # Etwas Padding um den Strip
        self.image_height = 200
        
        # Bekannte UV-Dosis zu RGB-Mapping (basierend auf echten UV-Strips)
        self.dose_calibration = {
            0: {"rgb": (245, 240, 235), "label": "Unbelichtet"},
            50: {"rgb": (220, 200, 180), "label": "Niedrige Exposition"},  
            150: {"rgb": (180, 150, 120), "label": "Mittlere Exposition"},
            300: {"rgb": (140, 100, 80), "label": "Hohe Exposition"},
            500: {"rgb": (100, 60, 40), "label": "Extreme Exposition"}
        }
    
    def add_realistic_noise(self, image, noise_level=10):
        """Fügt realistisches Rauschen hinzu"""
        np_image = np.array(image)
        noise = np.random.normal(0, noise_level, np_image.shape)
        noisy_image = np_image + noise
        noisy_image = np.clip(noisy_image, 0, 255).astype(np.uint8)
        return Image.fromarray(noisy_image)
    
    def add_lighting_variation(self, image, brightness_factor=None):
        """Simuliert verschiedene Beleuchtungsbedingungen"""
        if brightness_factor is None:
            brightness_factor = random.uniform(0.8, 1.2)
        
        enhancer = ImageEnhance.Brightness(image)
        return enhancer.enhance(brightness_factor)
    
    def add_slight_blur(self, image, blur_radius=0.5):
        """Simuliert leichte Kamera-Unschärfe"""
        return image.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    
    def create_strip_gradient(self, base_color, variation=15):
        """Erstellt einen Strip mit leichten Farbvariationen (wie echter Strip)"""
        # Basis-Farbe mit Variationen
        r, g, b = base_color
        
        # Erstelle Gradient für realistischen Look
        gradient_image = Image.new('RGB', (self.strip_width, self.strip_height))
        pixels = []
        
        for y in range(self.strip_height):
            for x in range(self.strip_width):
                # Leichte Variationen über den Strip
                var_r = r + random.randint(-variation, variation)
                var_g = g + random.randint(-variation, variation)
                var_b = b + random.randint(-variation, variation)
                
                # Clipping
                var_r = max(0, min(255, var_r))
                var_g = max(0, min(255, var_g))
                var_b = max(0, min(255, var_b))
                
                pixels.append((var_r, var_g, var_b))
        
        gradient_image.putdata(pixels)
        return gradient_image
    
    def create_strip_background(self):
        """Erstellt realistischen Hintergrund (z.B. Tisch, Papier)"""
        # Weißer/grauer Hintergrund mit leichter Textur
        bg_color = (250, 248, 245)  # Leicht cremiger Hintergrund
        background = Image.new('RGB', (self.image_width, self.image_height), bg_color)
        
        # Leichte Textur hinzufügen
        background = self.add_realistic_noise(background, noise_level=5)
        
        return background
    
    def generate_strip_image(self, dose_jcm2, filename_suffix=""):
        """Generiert ein realistisches UV-Strip Bild für gegebene UV-Dosis"""
        
        if dose_jcm2 not in self.dose_calibration:
            raise ValueError(f"Unbekannte UV-Dosis: {dose_jcm2}. Verfügbar: {list(self.dose_calibration.keys())}")
        
        calibration = self.dose_calibration[dose_jcm2]
        base_color = calibration["rgb"]
        
        # Hintergrund erstellen
        image = self.create_strip_background()
        
        # UV-Strip erstellen
        strip = self.create_strip_gradient(base_color, variation=12)
        
        # Strip in die Mitte des Bildes platzieren
        strip_x = (self.image_width - self.strip_width) // 2
        strip_y = (self.image_height - self.strip_height) // 2
        
        # Strip auf Hintergrund platzieren
        image.paste(strip, (strip_x, strip_y))
        
        # Realistische Effekte hinzufügen
        image = self.add_realistic_noise(image, noise_level=8)
        image = self.add_lighting_variation(image)
        image = self.add_slight_blur(image, blur_radius=0.3)
        
        # Leichte Schärfung für realistischen Kamera-Look
        image = image.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=3))
        
        return image, {
            "dose_jcm2": dose_jcm2,
            "label": calibration["label"],
            "expected_rgb": base_color,
            "strip_dimensions": (self.strip_width, self.strip_height),
            "strip_position": (strip_x, strip_y, strip_x + self.strip_width, strip_y + self.strip_height)
        }
    
    def generate_all_demo_images(self, output_dir):
        """Generiert alle Demo-Bilder und speichert sie"""
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        metadata = {}
        
        print("🖼️ Generiere UV-Strip Demo-Bilder...")
        print(f"📁 Output: {output_dir}")
        print()
        
        for dose in self.dose_calibration.keys():
            calibration = self.dose_calibration[dose]
            
            # Bild generieren
            image, meta = self.generate_strip_image(dose)
            
            # Dateiname
            filename = f"uv-strip-{dose}J.jpg"
            filepath = os.path.join(output_dir, filename)
            
            # Bild speichern (hohe Qualität)
            image.save(filepath, "JPEG", quality=92, optimize=True)
            
            # Metadaten speichern
            metadata[filename] = meta
            
            print(f"✅ {filename:20} | {dose:3}J/cm² | {calibration['label']}")
        
        # Metadaten als JSON speichern
        metadata_file = os.path.join(output_dir, "demo_images_metadata.json")
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        print()
        print(f"📊 Metadaten gespeichert: {metadata_file}")
        print(f"🎯 {len(metadata)} Demo-Bilder erstellt!")
        
        return metadata

def main():
    """Hauptfunktion - Erstellt alle Demo-Bilder"""
    
    # Ausgabeordner definieren
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_dir = os.path.dirname(script_dir)  # Ein Level hoch
    output_dir = os.path.join(project_dir, "test-data", "demo-images")
    
    print("🚀 LUVEX UV Strip Demo Image Generator")
    print("=" * 50)
    print()
    
    # Generator initialisieren
    generator = UVStripGenerator()
    
    # Alle Demo-Bilder generieren
    metadata = generator.generate_all_demo_images(output_dir)
    
    print()
    print("✨ Generierung abgeschlossen!")
    print(f"📁 Bilder verfügbar in: {output_dir}")
    print()
    print("🎯 Nächste Schritte:")
    print("1. Demo-Bilder in der UV-Strip Analyzer App testen")
    print("2. Algorithmus-Genauigkeit mit bekannten Dosiswerten validieren")
    print("3. Kalibrierung basierend auf Ergebnissen anpassen")

if __name__ == "__main__":
    main()