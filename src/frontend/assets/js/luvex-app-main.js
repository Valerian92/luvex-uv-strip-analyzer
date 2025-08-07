// UV Strip Analyzer - Professional Version
class UVStripAnalyzer {
    constructor() {
        this.apiUrl = 'http://localhost:8000';
        this.currentImage = null;
        this.currentMode = 'withReference';
        this.analysisStartTime = null;
        this.newReferenceImage = null;

        this.cacheDOMElements();
        this.initializeEventListeners();
        this.checkBackendHealth();
        this.populateReferences();
    }

    cacheDOMElements() {
        // Main UI elements
        this.referenceDropdown = document.getElementById('referenceDropdown');
        this.referenceListContainer = document.getElementById('referenceList');
        this.manageLibraryBtn = document.getElementById('manageLibraryBtn');

        // Modals
        this.measurementsModal = document.getElementById('measurementsModal');
        this.addReferenceModal = document.getElementById('addReferenceModal');
        this.manageLibraryModal = document.getElementById('manageLibraryModal');
        this.settingsModal = document.getElementById('settingsModal');
        this.confirmModal = document.getElementById('confirmModal');

        // Modal content areas
        this.measurementsList = document.getElementById('measurementsList');
        this.manageLibraryList = document.getElementById('manageLibraryList');

        // Buttons
        this.showAllMeasurementsBtn = document.getElementById('showAllMeasurementsBtn');
        this.addReferenceBtn = document.getElementById('addReferenceBtn');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.deleteAllMeasurementsBtn = document.getElementById('deleteAllMeasurementsBtn');
        this.deleteAllReferencesBtn = document.getElementById('deleteAllReferencesBtn');
        this.confirmOkBtn = document.getElementById('confirmOkBtn');
        this.confirmCancelBtn = document.getElementById('confirmCancelBtn');
    }

    initializeEventListeners() {
        // Mode Toggle
        document.getElementById('modeWithReference').addEventListener('click', () => this.setMode('withReference'));
        document.getElementById('modeSavedReference').addEventListener('click', () => this.setMode('savedReference'));

        // Upload Areas
        this.setupDragDrop(document.getElementById('uploadAreaCombined'), document.getElementById('fileInputCombined'));
        this.setupDragDrop(document.getElementById('uploadAreaStrip'), document.getElementById('fileInputStrip'));
        this.setupDragDrop(document.getElementById('uploadAreaReference'), document.getElementById('fileInputReference'));

        // File Input Events
        document.getElementById('fileInputCombined').addEventListener('change', (e) => this.handleFileSelection(e.target.files[0]));
        document.getElementById('fileInputStrip').addEventListener('change', (e) => this.handleFileSelection(e.target.files[0]));
        document.getElementById('fileInputReference').addEventListener('change', (e) => this.handleReferenceFileSelection(e.target.files[0]));

        // Main Action Buttons
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeImage());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetAnalysis());

        // Modal Triggers
        this.showAllMeasurementsBtn.addEventListener('click', () => this.showAllMeasurements());
        this.addReferenceBtn.addEventListener('click', () => this.openModal(this.addReferenceModal));
        this.manageLibraryBtn.addEventListener('click', () => this.showManageLibrary());
        this.settingsBtn.addEventListener('click', () => this.openModal(this.settingsModal));
        
        // Modal Close Buttons
        document.getElementById('closeMeasurementsModalBtn').addEventListener('click', () => this.closeModal(this.measurementsModal));
        document.getElementById('closeAddReferenceModalBtn').addEventListener('click', () => this.closeModal(this.addReferenceModal));
        document.getElementById('closeManageLibraryModalBtn').addEventListener('click', () => this.closeModal(this.manageLibraryModal));
        document.getElementById('closeSettingsModalBtn').addEventListener('click', () => this.closeModal(this.settingsModal));
        
        // Modal specific buttons
        document.getElementById('saveReferenceBtn').addEventListener('click', () => this.saveNewReference());
        document.getElementById('cancelReferenceBtn').addEventListener('click', () => this.closeModal(this.addReferenceModal));
        this.deleteAllMeasurementsBtn.addEventListener('click', () => this.handleDeleteAllMeasurements());
        this.deleteAllReferencesBtn.addEventListener('click', () => this.handleDeleteAllReferences());
        this.confirmCancelBtn.addEventListener('click', () => this.closeModal(this.confirmModal));


        // Click outside to close modals
        [this.measurementsModal, this.addReferenceModal, this.manageLibraryModal, this.settingsModal, this.confirmModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal(modal);
            });
        });
        
        // Event delegation for dynamic delete buttons
        this.manageLibraryList.addEventListener('click', (e) => {
            if (e.target.closest('.btn-delete')) {
                const button = e.target.closest('.btn-delete');
                const referenceId = button.dataset.id;
                this.deleteReference(referenceId);
            }
        });
    }

    // ... (rest of the methods are the same as before)

    setupDragDrop(uploadArea, fileInput) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                if (fileInput.id === 'fileInputReference') {
                    this.handleReferenceFileSelection(files[0]);
                } else {
                    this.handleFileSelection(files[0]);
                }
            }
        });

        uploadArea.addEventListener('click', () => fileInput.click());
    }

    setMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-toggle-btn').forEach(btn => btn.classList.remove('active'));
        if (mode === 'withReference') {
            document.getElementById('modeWithReference').classList.add('active');
            document.getElementById('uploadMode1').style.display = 'flex';
            document.getElementById('uploadMode2').style.display = 'none';
            document.getElementById('referenceSelector').classList.remove('active');
            document.getElementById('modeDescription').textContent = 'Strip und Referenzskala nebeneinander fotografieren (empfohlen)';
            document.getElementById('currentMode').textContent = 'Referenz im Bild';
        } else {
            document.getElementById('modeSavedReference').classList.add('active');
            document.getElementById('uploadMode1').style.display = 'none';
            document.getElementById('uploadMode2').style.display = 'flex';
            document.getElementById('referenceSelector').classList.add('active');
            document.getElementById('modeDescription').textContent = 'UV-Strip fotografieren und gespeicherte Referenz verwenden';
            document.getElementById('currentMode').textContent = 'Gespeicherte Referenz';
        }
        this.resetAnalysis();
    }

    async handleFileSelection(file) {
        if (!this.validateFile(file, 10)) return;
        this.currentImage = file;
        const dataUrl = await this.readFileAsDataURL(file);
        this.showImagePreview(dataUrl, file.name, document.getElementById('imagePreview'));
        document.getElementById('analyzeBtn').disabled = false;
        this.showStatus(`Bild "${file.name}" erfolgreich geladen.`, 'success');
    }

    async handleReferenceFileSelection(file) {
        if (!this.validateFile(file, 2)) return;
        this.newReferenceImage = file;
        const dataUrl = await this.readFileAsDataURL(file);
        this.showImagePreview(dataUrl, file.name, document.getElementById('referenceImagePreview'));
    }

    validateFile(file, maxSizeMB) {
        if (!file.type.startsWith('image/')) {
            this.showStatus('Bitte wählen Sie eine gültige Bilddatei aus.', 'error');
            return false;
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
            this.showStatus(`Datei ist zu groß. Maximum: ${maxSizeMB}MB`, 'error');
            return false;
        }
        return true;
    }

    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsDataURL(file);
        });
    }


    showImagePreview(src, filename, container) {
        container.innerHTML = `
            <h4 style="color: var(--text-primary); margin-bottom: 1rem; font-weight: var(--font-weight-medium);">
                Vorschau: ${filename}
            </h4>
            <img src="${src}" alt="Preview" class="preview-image">
        `;
        container.style.display = 'block';
    }

    async analyzeImage() {
        if (!this.currentImage) {
            this.showStatus('Bitte wählen Sie zuerst ein Bild aus.', 'error');
            return;
        }
        if (this.currentMode === 'savedReference' && !this.referenceDropdown.value) {
            this.showStatus('Bitte wählen Sie eine Referenzskala aus.', 'error');
            return;
        }

        this.analysisStartTime = Date.now();
        this.setLoading(true);
        this.showStatus('Analysiere UV-Strip...', 'info');

        try {
            const formData = new FormData();
            formData.append('file', this.currentImage);
            formData.append('mode', this.currentMode);
            if (this.currentMode === 'savedReference') {
                formData.append('reference', this.referenceDropdown.value);
            }
            const response = await fetch(`${this.apiUrl}/analyze`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const result = await response.json();
            this.displayResults(result);
            this.updateAnalysisMetrics(result);
        } catch (error) {
            console.error('Analyse-Fehler:', error);
            this.showStatus(`Fehler bei der Analyse: ${error.message}`, 'error');
        } finally {
            this.setLoading(false);
        }
    }

    displayResults(result) {
        const resultsContainer = document.getElementById('resultsContainer');
        const resultsContent = document.getElementById('resultsContent');
        resultsContent.innerHTML = `
            <div class="results-grid">
                <div class="result-card"><div class="result-label">UV-Dosis</div><div class="result-value">${result.uv_dose || 'N/A'}</div><div class="result-unit">J/cm²</div></div>
                <div class="result-card"><div class="result-label">Expositionsstufe</div><div class="result-value level-${result.exposure_level}">${this.getExposureLabel(result.exposure_level)}</div></div>
                <div class="result-card"><div class="result-label">Konfidenz</div><div class="result-value">${result.confidence || 'N/A'}</div></div>
            </div>
            <div class="save-results-panel">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem; font-weight: var(--font-weight-semibold);">Messung speichern</h4>
                <div class="save-form">
                    <input type="text" id="measurementName" placeholder="Messungsname (optional)">
                    <textarea id="measurementNotes" placeholder="Notizen (optional)"></textarea>
                    <div style="display: flex; gap: 1rem;"><button id="saveResultBtn" class="btn luvex-cta-primary" style="flex: 1;">Speichern</button><button id="discardResultBtn" class="btn luvex-cta-secondary" style="flex: 1;">Verwerfen</button></div>
                </div>
            </div>`;
        resultsContainer.style.display = 'block';
        this.showStatus('Analyse erfolgreich abgeschlossen!', 'success');
        document.getElementById('saveResultBtn').addEventListener('click', () => this.saveResults(result));
        document.getElementById('discardResultBtn').addEventListener('click', () => this.discardResults());
    }

    saveResults(result) {
        const measurementName = document.getElementById('measurementName').value || `Messung ${new Date().toLocaleString('de-DE')}`;
        const measurement = {
            id: Date.now().toString(),
            name: measurementName,
            notes: document.getElementById('measurementNotes').value || '',
            timestamp: new Date().toISOString(),
            filename: this.currentImage.name,
            mode: this.currentMode,
            results: result
        };
        const savedMeasurements = JSON.parse(localStorage.getItem('uvMeasurements') || '[]');
        savedMeasurements.unshift(measurement);
        if (savedMeasurements.length > 50) savedMeasurements.pop();
        localStorage.setItem('uvMeasurements', JSON.stringify(savedMeasurements));
        this.showStatus(`Messung "${measurementName}" erfolgreich gespeichert!`, 'success');
        document.getElementById('lastAnalysis').textContent = new Date().toLocaleString('de-DE');
    }

    discardResults() {
        document.getElementById('resultsContainer').style.display = 'none';
        this.showStatus('Ergebnisse verworfen.', 'info');
    }

    resetAnalysis() {
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('resultsContainer').style.display = 'none';
        document.getElementById('analyzeBtn').disabled = true;
        this.currentImage = null;
        this.updateDashboard('processingTime', '--');
        this.updateDashboard('confidenceLevel', '--');
        this.showStatus('', '');
    }

    updateAnalysisMetrics(result) {
        const processingTime = Date.now() - this.analysisStartTime;
        this.updateDashboard('processingTime', `${processingTime}ms`);
        this.updateDashboard('confidenceLevel', result.confidence || '--');
    }

    updateDashboard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = value;
    }

    getExposureLabel(level) {
        return { 'low': 'Niedrig', 'medium': 'Mittel', 'high': 'Hoch', 'extreme': 'Extrem' }[level] || 'Unbekannt';
    }

    setLoading(isLoading) {
        const analyzeBtn = document.getElementById('analyzeBtn');
        const spinner = document.getElementById('loadingSpinner');
        analyzeBtn.disabled = isLoading;
        analyzeBtn.textContent = isLoading ? 'Analysiere...' : 'Analyse starten';
        if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('statusMessage');
        if (!statusEl) return;
        if (message) {
            statusEl.textContent = message;
            statusEl.className = `status-message status-${type}`;
            statusEl.style.display = 'block';
            if (type === 'success' || type === 'info') {
                setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
            }
        } else {
            statusEl.style.display = 'none';
        }
    }

    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            if (!response.ok) throw new Error('Offline');
            document.getElementById('backendStatus').textContent = 'Online';
            document.getElementById('backendStatus').style.color = '#10b981';
        } catch (error) {
            document.getElementById('backendStatus').textContent = 'Offline';
            document.getElementById('backendStatus').style.color = '#ef4444';
            this.showStatus('Backend nicht erreichbar. Bitte starten Sie den Server.', 'error');
        }
    }

    showAllMeasurements() {
        const measurements = JSON.parse(localStorage.getItem('uvMeasurements') || '[]');
        this.measurementsList.innerHTML = '';
        if (measurements.length === 0) {
            this.measurementsList.innerHTML = `
                <div class="modal-empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p>Noch keine Messungen gespeichert.</p>
                </div>`;
        } else {
            measurements.forEach(m => {
                const item = document.createElement('div');
                item.className = 'measurement-item';
                const date = new Date(m.timestamp).toLocaleString('de-DE');
                const dose = m.results.uv_dose || 'N/A';
                const level = this.getExposureLabel(m.results.exposure_level);
                item.innerHTML = `
                    <div class="measurement-header">${m.name}</div>
                    <div class="measurement-details">
                        <div class="measurement-detail-item"><strong>Datum:</strong><span>${date}</span></div>
                        <div class="measurement-detail-item"><strong>UV-Dosis:</strong><span>${dose} J/cm²</span></div>
                        <div class="measurement-detail-item"><strong>Stufe:</strong><span class="level-${m.results.exposure_level}">${level}</span></div>
                        <div class="measurement-detail-item"><strong>Modus:</strong><span>${m.mode === 'withReference' ? 'Referenz im Bild' : 'Gespeicherte Referenz'}</span></div>
                    </div>`;
                this.measurementsList.appendChild(item);
            });
        }
        this.openModal(this.measurementsModal);
    }

    async saveNewReference() {
        const name = document.getElementById('newReferenceName').value;
        const range = document.getElementById('newReferenceRange').value;

        if (!name || !range || !this.newReferenceImage) {
            this.showStatus('Bitte füllen Sie alle Felder aus und laden Sie ein Bild hoch.', 'error');
            return;
        }

        const imageData = await this.readFileAsDataURL(this.newReferenceImage);
        
        const newReference = {
            id: `custom_${Date.now()}`,
            name: name,
            range: range,
            imageData: imageData
        };

        const references = JSON.parse(localStorage.getItem('uvReferences') || '[]');
        references.push(newReference);
        localStorage.setItem('uvReferences', JSON.stringify(references));

        this.showStatus(`Referenz "${name}" erfolgreich gespeichert.`, 'success');
        this.closeModal(this.addReferenceModal);
        this.populateReferences();
        
        document.getElementById('newReferenceName').value = '';
        document.getElementById('newReferenceRange').value = '';
        document.getElementById('referenceImagePreview').style.display = 'none';
        this.newReferenceImage = null;
    }

    populateReferences() {
        const customReferences = JSON.parse(localStorage.getItem('uvReferences') || '[]');
        
        // Populate Dropdown
        this.referenceDropdown.querySelectorAll('option[value^="custom_"]').forEach(opt => opt.remove());
        customReferences.forEach(ref => {
            const option = document.createElement('option');
            option.value = ref.id;
            option.textContent = `${ref.name} (${ref.range})`;
            this.referenceDropdown.appendChild(option);
        });

        // Populate Library List
        this.referenceListContainer.innerHTML = '';
        const defaultRefs = [
            { name: 'Standard UV-Strip', range: '0-500 J/cm²' },
            { name: 'UVC-Strip', range: '0-100 J/cm²' },
            { name: 'UVA-Strip', range: '0-1000 J/cm²' }
        ];
        const allRefs = [...defaultRefs, ...customReferences];
        allRefs.forEach(ref => {
            const item = document.createElement('div');
            item.className = 'metric-item';
            item.innerHTML = `<span class="metric-label">${ref.name}:</span><span class="metric-value">${ref.range}</span>`;
            this.referenceListContainer.appendChild(item);
        });

        // Enable/disable manage button
        this.manageLibraryBtn.disabled = customReferences.length === 0;
    }
    
    showManageLibrary() {
        const customReferences = JSON.parse(localStorage.getItem('uvReferences') || '[]');
        this.manageLibraryList.innerHTML = '';

        if (customReferences.length === 0) {
            this.manageLibraryList.innerHTML = `
                <div class="modal-empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    <p>Keine benutzerdefinierten Referenzen vorhanden.</p>
                </div>`;
        } else {
            customReferences.forEach(ref => {
                const item = document.createElement('div');
                item.className = 'reference-manage-item';
                item.innerHTML = `
                    <div class="reference-manage-info">
                        <strong>${ref.name}</strong>
                        <span>${ref.range}</span>
                    </div>
                    <div class="reference-manage-actions">
                        <button class="btn-icon btn-delete" data-id="${ref.id}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                `;
                this.manageLibraryList.appendChild(item);
            });
        }
        this.openModal(this.manageLibraryModal);
    }

    deleteReference(referenceId) {
        let references = JSON.parse(localStorage.getItem('uvReferences') || '[]');
        const referenceToDelete = references.find(r => r.id === referenceId);
        
        if (!referenceToDelete) return;

        this.showConfirm(
            'Referenz löschen',
            `Möchten Sie die Referenz "${referenceToDelete.name}" wirklich endgültig löschen?`,
            () => {
                references = references.filter(ref => ref.id !== referenceId);
                localStorage.setItem('uvReferences', JSON.stringify(references));
                this.showStatus(`Referenz "${referenceToDelete.name}" gelöscht.`, 'info');
                this.populateReferences();
                this.showManageLibrary(); // Refresh the list in the modal
            }
        );
    }

    handleDeleteAllMeasurements() {
        this.showConfirm(
            'Alle Messungen löschen',
            'Möchten Sie wirklich alle gespeicherten Messungen endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
            () => {
                localStorage.removeItem('uvMeasurements');
                this.showStatus('Alle Messungen wurden gelöscht.', 'info');
                this.closeModal(this.settingsModal);
            }
        );
    }

    handleDeleteAllReferences() {
        this.showConfirm(
            'Alle Referenzen löschen',
            'Möchten Sie wirklich alle benutzerdefinierten Referenzen endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
            () => {
                localStorage.removeItem('uvReferences');
                this.showStatus('Alle benutzerdefinierten Referenzen wurden gelöscht.', 'info');
                this.populateReferences();
                this.closeModal(this.settingsModal);
            }
        );
    }
    
    showConfirm(title, message, onConfirm) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        
        // Clone and replace the button to remove old event listeners
        const newOkBtn = this.confirmOkBtn.cloneNode(true);
        this.confirmOkBtn.parentNode.replaceChild(newOkBtn, this.confirmOkBtn);
        this.confirmOkBtn = newOkBtn;
        
        this.confirmOkBtn.onclick = () => {
            onConfirm();
            this.closeModal(this.confirmModal);
        };
        
        this.openModal(this.confirmModal);
    }


    openModal(modal) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);
    }

    closeModal(modal) {
        modal.classList.remove('visible');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.uvAnalyzer = new UVStripAnalyzer();
});
