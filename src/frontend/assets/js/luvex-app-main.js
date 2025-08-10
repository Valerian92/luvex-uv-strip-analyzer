/**
 * LUVEX UV Strip Analyzer - Professional, Optimized Version
 *
 * This class manages the entire frontend application logic for the UV Strip Analyzer.
 * It handles user interactions, communication with the backend API, state management,
 * and dynamic DOM updates in an efficient and robust manner.
 *
 * @version 3.1.0 (Database Integration - Complete)
 * @author Gemini / Valerian
 */
class UVStripAnalyzer {
    /**
     * Initializes the application.
     */
    constructor() {
        // --- Configuration ---
        this.apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:8001' 
            : '/api';

        this.config = {
            maxFileSizeMB: 10,
            maxRefFileSizeMB: 2,
            apiTimeout: 30000,
            statusMsgDuration: 4000,
        };

        // --- State ---
        this.state = {
            currentImage: null,
            newReferenceImage: null,
            currentMode: 'withReference',
            isAnalyzing: false,
            analysisStartTime: null,
        };

        // --- Auth State ---
        this.auth = {
            token: null,
            user: null,
            isAuthenticated: false
        };

        // --- Caches and Timers ---
        this.domCache = new Map();
        this.debounceTimers = new Map();

        // --- Initialization ---
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => this.init());
        } else {
            setTimeout(() => this.init(), 100);
        }
    }

    /**
     * Core initialization sequence.
     */
    async init() {
        try {
            this.cacheDOMElements();
            this.initializeEventListeners();
            this.loadAppState();
            await this.checkWordPressAuth();
            this.loadAuthToken();
            await this.checkBackendHealth();
            this.populateReferences(); // WIEDERHERGESTELLT
            this.showAllMeasurements(); // NEU: Lädt Messungen aus der DB beim Start
            this.showStatus('Anwendung erfolgreich initialisiert.', 'success');
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showStatus('Fehler beim Initialisieren der Anwendung.', 'error');
        }
    }

    //=========================================================================
    // DOM Caching and Access
    //=========================================================================

    cacheDOMElements() {
        const ids = [
            'modeWithReference', 'modeSavedReference', 'modeDescription', 'currentMode',
            'uploadMode1', 'uploadMode2', 'uploadAreaCombined', 'uploadAreaStrip', 'uploadAreaReference',
            'fileInputCombined', 'fileInputStrip', 'fileInputReference',
            'referenceSelector', 'referenceDropdown', 'referenceList',
            'imagePreview', 'referenceImagePreview', 'analyzeBtn', 'resetBtn',
            'statusMessage', 'loadingSpinner',
            'resultsContainer', 'resultsContent', 'processingTime', 'confidenceLevel',
            'backendStatus', 'lastAnalysis',
            'showAllMeasurementsBtn', 'addReferenceBtn', 'manageLibraryBtn', 'settingsBtn',
            'measurementsModal', 'addReferenceModal', 'manageLibraryModal', 'settingsModal', 'confirmModal',
            'measurementsList', 'manageLibraryList',
            'closeMeasurementsModalBtn', 'closeAddReferenceModalBtn', 'closeManageLibraryModalBtn', 'closeSettingsModalBtn',
            'saveReferenceBtn', 'cancelReferenceBtn', 'newReferenceName', 'newReferenceRange',
            'deleteAllMeasurementsBtn', 'deleteAllReferencesBtn',
            'confirmTitle', 'confirmMessage', 'confirmOkBtn', 'confirmCancelBtn'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) this.domCache.set(id, el);
        });
        this.domCache.set('modeToggleBtns', document.querySelectorAll('.mode-toggle-btn'));
        
    
    }

    get(id) {
        return this.domCache.get(id);
    }

    //=========================================================================
    // Event Listener Setup
    //=========================================================================

    initializeEventListeners() {
        this.addClickListener('modeWithReference', () => this.setMode('withReference'));
        this.addClickListener('modeSavedReference', () => this.setMode('savedReference'));
        this.addClickListener('analyzeBtn', () => this.analyzeImage());
        this.addClickListener('resetBtn', () => this.resetAnalysis());
        this.setupEnhancedDragDrop(this.get('uploadAreaCombined'), this.get('fileInputCombined'));
        this.setupEnhancedDragDrop(this.get('uploadAreaStrip'), this.get('fileInputStrip'));
        this.setupEnhancedDragDrop(this.get('uploadAreaReference'), this.get('fileInputReference'));
        this.get('fileInputCombined')?.addEventListener('change', e => this.handleFileSelection(e.target.files[0]));
        this.get('fileInputStrip')?.addEventListener('change', e => this.handleFileSelection(e.target.files[0]));
        this.get('fileInputReference')?.addEventListener('change', e => this.handleReferenceFileSelection(e.target.files[0]));
        this.setupModalListeners();
        this.setupGlobalListeners();
    }

    setupModalListeners() {
        this.addClickListener('showAllMeasurementsBtn', () => this.openModal(this.get('measurementsModal')));
        this.addClickListener('addReferenceBtn', () => this.openModal(this.get('addReferenceModal')));
        this.addClickListener('manageLibraryBtn', () => this.showManageLibrary());
        this.addClickListener('settingsBtn', () => this.openModal(this.get('settingsModal')));
        const closeButtons = new Map([
            ['closeMeasurementsModalBtn', 'measurementsModal'],
            ['closeAddReferenceModalBtn', 'addReferenceModal'],
            ['closeManageLibraryModalBtn', 'manageLibraryModal'],
            ['closeSettingsModalBtn', 'settingsModal'],
            ['confirmCancelBtn', 'confirmModal']
        ]);
        closeButtons.forEach((modalId, btnId) => {
            this.addClickListener(btnId, () => this.closeModal(this.get(modalId)));
        });
        this.addClickListener('saveReferenceBtn', () => this.saveNewReference());
        this.addClickListener('cancelReferenceBtn', () => this.closeModal(this.get('addReferenceModal')));
        this.addClickListener('deleteAllReferencesBtn', () => this.handleDeleteAllReferences()); // WIEDERHERGESTELLT
        this.addClickListener('deleteAllMeasurementsBtn', () => this.handleDeleteAllMeasurements());
        this.get('manageLibraryList')?.addEventListener('click', e => {
            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) this.deleteReference(deleteBtn.dataset.id);
        });
        this.domCache.forEach((el, key) => {
            if (key.endsWith('Modal')) {
                el.addEventListener('click', (e) => {
                    if (e.target === el) this.closeModal(el);
                });
            }
        });
    }

    setupEnhancedDragDrop(uploadArea, fileInput) {
        if (!uploadArea || !fileInput) return;
        ['dragover', 'dragenter', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, e => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over'));
        });
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over'));
        });
        uploadArea.addEventListener('drop', e => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const handler = fileInput.id === 'fileInputReference' ?
                    this.handleReferenceFileSelection.bind(this) :
                    this.handleFileSelection.bind(this);
                handler(files[0]);
            }
        });
        this.addClickListener(uploadArea.id, () => fileInput.click());
    }

    setupGlobalListeners() {
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.modal-overlay.visible');
                if (openModal) this.closeModal(openModal);
            }
            if (e.ctrlKey && e.key === 'Enter' && this.state.currentImage && !this.state.isAnalyzing) {
                this.analyzeImage();
            }
        });
        window.addEventListener('beforeunload', e => {
            if (this.state.isAnalyzing) {
                e.preventDefault();
                e.returnValue = 'Eine Analyse läuft noch. Möchten Sie die Seite wirklich verlassen?';
            }
        });
    }

    addClickListener(id, callback) {
        this.get(id)?.addEventListener('click', callback);
    }

    //=========================================================================
    // State and UI Management
    //=========================================================================

    setMode(mode) {
        if (this.state.currentMode === mode) return;
        this.state.currentMode = mode;
        const isWithReference = mode === 'withReference';
        this.get('modeWithReference')?.classList.toggle('active', isWithReference);
        this.get('modeSavedReference')?.classList.toggle('active', !isWithReference);
        this.get('uploadMode1').style.display = isWithReference ? 'flex' : 'none';
        this.get('uploadMode2').style.display = isWithReference ? 'none' : 'flex';
        this.get('referenceSelector')?.classList.toggle('active', !isWithReference);
        this.updateText('modeDescription', isWithReference ?
            'Strip und Referenzskala nebeneinander fotografieren (empfohlen)' :
            'UV-Strip fotografieren und gespeicherte Referenz verwenden'
        );
        this.updateText('currentMode', isWithReference ? 'Referenz im Bild' : 'Gespeicherte Referenz');
        this.resetAnalysis();
        this.saveAppState();
    }

    setLoading(isLoading) {
        const analyzeBtn = this.get('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = isLoading;
            analyzeBtn.innerHTML = isLoading ?
                '<span>⏳</span> Analysiere...' :
                '<span>🔍</span> Analyse starten';
        }
        this.get('loadingSpinner').style.display = isLoading ? 'block' : 'none';
    }

    showStatus(message, type = 'info') {
        const statusEl = this.get('statusMessage');
        if (!statusEl) return;
        clearTimeout(this.debounceTimers.get('statusTimer'));
        if (message) {
            statusEl.textContent = message;
            statusEl.className = `status-message status-${type}`;
            statusEl.style.display = 'block';
            if (type !== 'error') {
                const timer = setTimeout(() => {
                    statusEl.style.display = 'none';
                }, this.config.statusMsgDuration);
                this.debounceTimers.set('statusTimer', timer);
            }
        } else {
            statusEl.style.display = 'none';
        }
    }

    updateText(id, text) {
        const el = this.get(id);
        if (el) el.textContent = text;
    }

    resetAnalysis() {
        this.get('imagePreview').style.display = 'none';
        this.get('resultsContainer').style.display = 'none';
        this.get('analyzeBtn').disabled = true;
        this.state.currentImage = null;
        ['fileInputCombined', 'fileInputStrip'].forEach(id => {
            const input = this.get(id);
            if (input) input.value = '';
        });
        this.updateText('processingTime', '--');
        this.updateText('confidenceLevel', '--');
        this.showStatus('', 'info');
    }

    //=========================================================================
    // File Handling
    //=========================================================================

    async handleFileSelection(file) {
        if (!this.validateFile(file, this.config.maxFileSizeMB)) return;
        this.state.currentImage = file;
        try {
            const dataUrl = await this.readFileAsDataURL(file);
            this.showImagePreview(dataUrl, file.name, this.get('imagePreview'));
            this.get('analyzeBtn').disabled = false;
            this.showStatus(`Bild "${file.name}" bereit zur Analyse.`, 'success');
        } catch (error) {
            this.showStatus(`Fehler beim Lesen der Datei: ${error.message}`, 'error');
        }
    }

    async handleReferenceFileSelection(file) {
        if (!this.validateFile(file, this.config.maxRefFileSizeMB)) return;
        this.state.newReferenceImage = file;
        try {
            const dataUrl = await this.readFileAsDataURL(file);
            this.showImagePreview(dataUrl, file.name, this.get('referenceImagePreview'));
        } catch (error) {
            this.showStatus(`Fehler beim Lesen der Referenzdatei: ${error.message}`, 'error');
        }
    }

    async handleDeleteAllMeasurements() {
    this.showConfirm(
        'Alle Messungen löschen',
        'Möchten Sie wirklich alle Messungen aus der Datenbank löschen? Diese Aktion kann nicht rückgängig gemacht werden!',
        async () => {
            try {
                const response = await fetch(`${this.apiUrl}/measurements`, {
                    method: 'DELETE'
                });
                if (!response.ok) throw new Error('Löschen fehlgeschlagen');
                
                const result = await response.json();
                this.showStatus(`${result.deleted_count} Messungen aus der Datenbank gelöscht.`, 'success');
                this.showAllMeasurements(); // Liste aktualisieren
                this.updateText('lastAnalysis', 'Nie');
                this.closeModal(this.get('settingsModal'));
            } catch (error) {
                console.error('Delete all measurements error:', error);
                this.showStatus('Fehler beim Löschen der Messungen.', 'error');
            }
        }
    );
    }

    async deleteSingleMeasurement(measurementId, measurementName) {
        this.showConfirm(
            'Messung löschen',
            `Möchten Sie die Messung "${measurementName}" wirklich löschen?`,
            async () => {
                try {
                    const response = await fetch(`${this.apiUrl}/measurements/${measurementId}`, {
                        method: 'DELETE'
                    });
                    if (!response.ok) throw new Error('Löschen fehlgeschlagen');
                    
                    this.showStatus(`Messung "${measurementName}" gelöscht.`, 'success');
                    this.showAllMeasurements(); // Liste aktualisieren
                } catch (error) {
                    console.error('Delete measurement error:', error);
                    this.showStatus('Fehler beim Löschen der Messung.', 'error');
                }
            }
        );
    }

    validateFile(file, maxSizeMB) {
        if (!file) return false;
        if (!file.type.startsWith('image/')) {
            this.showStatus('Bitte eine gültige Bilddatei auswählen.', 'error');
            return false;
        }
        if (file.size > maxSizeMB * 1024 * 1024) {
            this.showStatus(`Datei zu groß. Maximum: ${maxSizeMB}MB`, 'error');
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
        if (!container) return;
        container.innerHTML = `
            <h4 style="color: var(--text-primary); margin-bottom: 1rem; font-weight: var(--font-weight-medium);">
                Vorschau: ${this.escapeHtml(filename)}
            </h4>
            <img src="${src}" alt="Preview of ${this.escapeHtml(filename)}" class="preview-image" loading="lazy">`;
        container.style.display = 'block';
    }

    //=========================================================================
    // API Communication & Analysis
    //=========================================================================

    async analyzeImage() {
        if (this.state.isAnalyzing || !this.state.currentImage) return;
        
        this.state.isAnalyzing = true;
        this.state.analysisStartTime = Date.now();
        this.setLoading(true);
        this.showStatus('Analysiere UV-Strip...', 'info');

        try {
            const formData = new FormData();
            formData.append('file', this.state.currentImage);
            
            const response = await fetch(`${this.apiUrl}/analyze`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error(`Serverfehler ${response.status}`);
            
            const result = await response.json();
            if (!result.success) throw new Error(result.detail || 'Analyse fehlgeschlagen');
            
            this.displayResults(result);
            this.updateAnalysisMetrics(result);
        } catch (error) {
            console.error('Analysis error:', error);
            this.showStatus(`Fehler bei der Analyse: ${error.message}`, 'error');
        } finally {
            this.state.isAnalyzing = false;
            this.setLoading(false);
        }
    }

    displayResults(result) {
        const resultsContent = this.get('resultsContent');
        if (!resultsContent) return;

        const getExposureLabel = (level) => ({
            'low': 'Niedrig', 'medium': 'Mittel', 'high': 'Hoch', 'extreme': 'Extrem'
        }[level] || 'Unbekannt');

        resultsContent.innerHTML = `
            <div class="results-grid">
                <div class="result-card"><div class="result-label">UV-Dosis</div><div class="result-value">${result.uv_dose || 'N/A'}</div><div class="result-unit">J/cm²</div></div>
                <div class="result-card"><div class="result-label">Expositionsstufe</div><div class="result-value level-${result.exposure_level}">${getExposureLabel(result.exposure_level)}</div></div>
                <div class="result-card"><div class="result-label">Konfidenz</div><div class="result-value">${result.confidence || 'N/A'}</div></div>
            </div>
            <div style="margin: 1.5rem 0; padding: 1.5rem; background: var(--bg-secondary); border-radius: var(--radius-md);">
                <h4 style="margin-bottom: 1rem;">Empfehlung</h4>
                <p>${this.escapeHtml(result.recommendation)}</p>
            </div>
            <div class="save-results-panel">
                <h4>Messung speichern</h4>
                <div class="save-form">
                    <label for="measurementName">Messungsname</label>
                    <input type="text" id="measurementName" placeholder="z.B. Labor Messung #1">
                    <label for="measurementNotes">Notizen (optional)</label>
                    <textarea id="measurementNotes" placeholder="Zusätzliche Informationen..."></textarea>
                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                        <button id="saveResultBtn" class="btn luvex-cta-primary" style="flex: 1;">Speichern</button>
                        <button id="discardResultBtn" class="btn luvex-cta-secondary" style="flex: 1;">Verwerfen</button>
                    </div>
                </div>
            </div>`;

        this.get('resultsContainer').style.display = 'block';
        this.showStatus('Analyse erfolgreich abgeschlossen!', 'success');

        document.getElementById('saveResultBtn').addEventListener('click', () => this.saveResults(result));
        document.getElementById('discardResultBtn').addEventListener('click', () => this.discardResults());
    }
    
    updateAnalysisMetrics(result) {
        const processingTime = Date.now() - this.state.analysisStartTime;
        this.updateText('processingTime', `${processingTime}ms`);
        this.updateText('confidenceLevel', result.confidence || '--');
    }

    async checkBackendHealth(retries = 3, delay = 500) {
        this.updateText('backendStatus', 'Prüfe...');
        this.get('backendStatus').style.color = 'var(--text-muted)';
        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(`${this.apiUrl}/health`);
                if (response.ok) {
                    this.updateText('backendStatus', 'Online');
                    this.get('backendStatus').style.color = 'var(--success-color)';
                    return;
                }
            } catch (error) {
                console.warn(`Backend health check attempt ${i + 1} failed.`);
            }
            if (i < retries - 1) await new Promise(res => setTimeout(res, delay));
        }
        this.updateText('backendStatus', 'Offline');
        this.get('backendStatus').style.color = 'var(--danger-color)';
        this.showStatus('Backend nicht erreichbar.', 'error');
    }

    //=========================================================================
    // Data Persistence (NEU: API-basiert)
    //=========================================================================

    async saveResults(result) {
        const measurementName = document.getElementById('measurementName').value.trim() || `Messung ${new Date().toLocaleString('de-DE')}`;
        
        const payload = {
            name: measurementName,
            notes: document.getElementById('measurementNotes').value.trim() || '',
            filename: result.filename,
            results: {
                uv_dose: result.uv_dose,
                exposure_level: result.exposure_level,
                confidence: result.confidence,
                recommendation: result.recommendation
            }
        };

        try {
            const response = await fetch(`${this.apiUrl}/measurements`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(payload)
        });
            if (!response.ok) throw new Error('Fehler beim Speichern');

            this.showStatus(`Messung "${measurementName}" erfolgreich in der Datenbank gespeichert!`, 'success');
            this.discardResults();
            this.showAllMeasurements(); // Liste aktualisieren
        } catch (error) {
            console.error('Save error:', error);
            this.showStatus('Messung konnte nicht gespeichert werden.', 'error');
        }
    }
    
    discardResults() {
        this.get('resultsContainer').style.display = 'none';
    }

    async showAllMeasurements() {
        const listContainer = this.get('measurementsList');
        try {
            const response = await fetch(`${this.apiUrl}/measurements`, {
            headers: this.getAuthHeaders()
        });
            if (!response.ok) throw new Error('Daten konnten nicht geladen werden');
            
            const measurements = await response.json();
            listContainer.innerHTML = '';

            if (measurements.length === 0) {
                listContainer.innerHTML = this.getEmptyStateHTML('Noch keine Messungen in der Datenbank gespeichert.');
            } else {
                const fragment = document.createDocumentFragment();
                measurements.forEach(m => fragment.appendChild(this.createMeasurementItem(m)));
                listContainer.appendChild(fragment);
                
                const lastAnalysisDate = new Date(measurements[0].timestamp);
                this.updateText('lastAnalysis', lastAnalysisDate.toLocaleString('de-DE'));
            }
        } catch (error) {
            console.error('Fetch measurements error:', error);
            listContainer.innerHTML = this.getEmptyStateHTML('Fehler beim Laden der Messungen.');
        }
    }


    createMeasurementItem(m) {
    const item = document.createElement('div');
    item.className = 'measurement-item';
    const date = new Date(m.timestamp).toLocaleString('de-DE');
    const dose = m.results.uv_dose || 'N/A';
    const level = { 'low': 'Niedrig', 'medium': 'Mittel', 'high': 'Hoch', 'extreme': 'Extrem' }[m.results.exposure_level] || 'Unbekannt';
    
    item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div class="measurement-header">${this.escapeHtml(m.name)}</div>
            <button class="btn-icon btn-delete" data-id="${m.id}" data-name="${this.escapeHtml(m.name)}" 
                    aria-label="Messung ${this.escapeHtml(m.name)} löschen"
                    style="color: var(--danger-color); padding: 0.5rem; border: none; background: none; cursor: pointer; border-radius: var(--radius-sm);">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
        <div class="measurement-details">
            <div class="measurement-detail-item"><strong>Datum:</strong><span>${date}</span></div>
            <div class="measurement-detail-item"><strong>UV-Dosis:</strong><span>${dose} J/cm²</span></div>
            <div class="measurement-detail-item"><strong>Stufe:</strong><span class="level-${m.results.exposure_level}">${level}</span></div>
            <div class="measurement-detail-item"><strong>Datei:</strong><span>${this.escapeHtml(m.filename)}</span></div>
        </div>
        ${m.notes ? `<div class="measurement-notes" style="margin-top: 1rem;"><strong>Notizen:</strong> <p style="margin:0; padding:0;">${this.escapeHtml(m.notes)}</p></div>` : ''}`;
    
    // Event Listener für Lösch-Button
    const deleteBtn = item.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteSingleMeasurement(m.id, m.name);
    });
    
    return item;
    }

    //=========================================================================
    // LocalStorage for App State and References
    //=========================================================================

    saveAppState() {
        try {
            localStorage.setItem('luvexAppState', JSON.stringify({ currentMode: this.state.currentMode }));
        } catch (e) { console.warn('Could not save app state.', e); }
    }

    loadAppState() {
        try {
            const savedState = JSON.parse(localStorage.getItem('luvexAppState'));
            if (savedState && savedState.currentMode) {
                this.setMode(savedState.currentMode);
            }
        } catch (e) { console.warn('Could not load app state.', e); }
    }
    
    // --- WIEDERHERGESTELLTE FUNKTIONEN FÜR REFERENZEN ---
    
    async saveNewReference() {
        const name = this.get('newReferenceName').value.trim();
        const range = this.get('newReferenceRange').value.trim();
        if (!name || !range || !this.state.newReferenceImage) {
            this.showStatus('Bitte alle Felder ausfüllen und ein Bild hochladen.', 'error');
            return;
        }
        try {
            const imageData = await this.readFileAsDataURL(this.state.newReferenceImage);
            const newReference = {
                id: `custom_${Date.now()}`,
                name,
                range,
                imageData
            };
            const references = JSON.parse(localStorage.getItem('uvReferences') || '[]');
            references.push(newReference);
            localStorage.setItem('uvReferences', JSON.stringify(references));
            this.showStatus(`Referenz "${name}" gespeichert.`, 'success');
            this.closeModal(this.get('addReferenceModal'));
            this.populateReferences();
            this.resetAddReferenceForm();
        } catch (error) {
            this.showStatus(`Fehler beim Speichern der Referenz: ${error.message}`, 'error');
        }
    }
    
    resetAddReferenceForm() {
        this.get('newReferenceName').value = '';
        this.get('newReferenceRange').value = '';
        this.get('referenceImagePreview').style.display = 'none';
        this.get('fileInputReference').value = '';
        this.state.newReferenceImage = null;
    }

    deleteReference(referenceId) {
        let references = JSON.parse(localStorage.getItem('uvReferences') || '[]');
        const refToDelete = references.find(r => r.id === referenceId);
        if (!refToDelete) return;
        this.showConfirm(
            'Referenz löschen',
            `Möchten Sie die Referenz "${refToDelete.name}" wirklich löschen?`,
            () => {
                const updatedReferences = references.filter(ref => ref.id !== referenceId);
                localStorage.setItem('uvReferences', JSON.stringify(updatedReferences));
                this.showStatus(`Referenz "${refToDelete.name}" gelöscht.`, 'info');
                this.populateReferences();
                this.showManageLibrary();
            }
        );
    }
    
    handleDeleteAllReferences() {
        this.showConfirm(
            'Alle Referenzen löschen',
            'Möchten Sie wirklich alle benutzerdefinierten Referenzen löschen?',
            () => {
                localStorage.removeItem('uvReferences');
                this.showStatus('Alle Referenzen gelöscht.', 'info');
                this.populateReferences();
                this.closeModal(this.get('settingsModal'));
            }
        );
    }

    populateReferences() {
        const customReferences = JSON.parse(localStorage.getItem('uvReferences') || '[]');
        const dropdown = this.get('referenceDropdown');
        const listContainer = this.get('referenceList');
        dropdown.querySelectorAll('option[value^="custom_"]').forEach(opt => opt.remove());
        customReferences.forEach(ref => {
            const option = document.createElement('option');
            option.value = ref.id;
            option.textContent = `${ref.name} (${ref.range})`;
            dropdown.appendChild(option);
        });
        listContainer.innerHTML = '';
        const defaultRefs = [
            { name: 'Standard UV-Strip', range: '0-500 J/cm²' },
            { name: 'UVC-Strip', range: '0-100 J/cm²' },
            { name: 'UVA-Strip', range: '0-1000 J/cm²' }
        ];
        const allRefs = [...defaultRefs, ...customReferences];
        const fragment = document.createDocumentFragment();
        allRefs.forEach(ref => {
            const item = document.createElement('div');
            item.className = 'metric-item';
            item.innerHTML = `<span class="metric-label">${this.escapeHtml(ref.name)}:</span><span class="metric-value">${this.escapeHtml(ref.range)}</span>`;
            fragment.appendChild(item);
        });
        listContainer.appendChild(fragment);
        this.get('manageLibraryBtn').disabled = customReferences.length === 0;
    }

    showManageLibrary() {
        const customReferences = JSON.parse(localStorage.getItem('uvReferences') || '[]');
        const listContainer = this.get('manageLibraryList');
        listContainer.innerHTML = '';
        if (customReferences.length === 0) {
            listContainer.innerHTML = this.getEmptyStateHTML('Keine benutzerdefinierten Referenzen vorhanden.');
        } else {
            const fragment = document.createDocumentFragment();
            customReferences.forEach(ref => {
                const item = document.createElement('div');
                item.className = 'reference-manage-item';
                item.innerHTML = `
                    <div class="reference-manage-info">
                        <strong>${this.escapeHtml(ref.name)}</strong>
                        <span>${this.escapeHtml(ref.range)}</span>
                    </div>
                    <div class="reference-manage-actions">
                        <button class="btn-icon btn-delete" data-id="${ref.id}" aria-label="Referenz ${this.escapeHtml(ref.name)} löschen">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>`;
                fragment.appendChild(item);
            });
            listContainer.appendChild(fragment);
        }
        this.openModal(this.get('manageLibraryModal'));
    }

    //=========================================================================
    // Modals and Utilities
    //=========================================================================

    openModal(modal) {
        if (!modal) return;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);
    }

    closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('visible');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
    
    showConfirm(title, message, onConfirm) {
        this.updateText('confirmTitle', title);
        this.updateText('confirmMessage', message);
        const oldBtn = this.get('confirmOkBtn');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);
        this.domCache.set('confirmOkBtn', newBtn);
        newBtn.onclick = () => {
            onConfirm();
            this.closeModal(this.get('confirmModal'));
        };
        this.openModal(this.get('confirmModal'));
    }

    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    getEmptyStateHTML(message) {
        return `
            <div class="modal-empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p>${this.escapeHtml(message)}</p>
            </div>`;
    }


    //=========================================================================
    // Authentication & Token Management  
    //=========================================================================

    loadAuthToken() {
        const token = sessionStorage.getItem('luvex_uvstrip_auth_token');
        if (token) {
            this.auth.token = token;
            this.auth.isAuthenticated = true;
            console.log('Auth token loaded');
        }
    }

    getAuthHeaders() {
        return this.auth.token ? {
            'Authorization': `Bearer ${this.auth.token}`,
            'Content-Type': 'application/json'
        } : {
            'Content-Type': 'application/json'
        };
    }

    async checkWordPressAuth() {
        try {
            // Versuche Token von WordPress zu holen
            const response = await fetch('/wp-admin/admin-ajax.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'action=luvex_uvstrip_get_token'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.token) {
                    sessionStorage.setItem('luvex_uvstrip_auth_token', data.token);
                    this.auth.token = data.token;
                    this.auth.user = data.user;
                    this.auth.isAuthenticated = true;
                    console.log('WordPress auth successful:', data.user);
                    return true;
                }
            }
        } catch (error) {
            console.log('WordPress auth not available:', error.message);
        }
            // NEU: Redirect wenn kein Auth verfügbar
            //this.redirectToWebsite();
            console.log("DEBUG: Auth check failed, but redirect disabled");
            return true; // TEMPORÄR: Tue so als ob Auth funktioniert
    }

    redirectToWebsite() {
    window.location.href = 'https://www.luvex.tech/login/?redirect=analyzer';
    }



} // <-- Das schließt die UVStripAnalyzer Klasse

// Initialize the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    window.uvAnalyzer = new UVStripAnalyzer();
});

