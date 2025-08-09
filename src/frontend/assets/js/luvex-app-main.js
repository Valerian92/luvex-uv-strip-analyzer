/**
 * LUVEX UV Strip Analyzer - Professional, Optimized Version
 *
 * This class manages the entire frontend application logic for the UV Strip Analyzer.
 * It handles user interactions, communication with the backend API, state management,
 * and dynamic DOM updates in an efficient and robust manner.
 *
 * @version 2.3.0 (Robust Health Check)
 * @author Gemini / Valerian
 */
class UVStripAnalyzer {
    /**
     * Initializes the application.
     */
    constructor() {
        // --- Configuration ---
        // Die API-URL wird jetzt an die /api/ Route angepasst.
        this.apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:8001' // Für lokale Entwicklung, Port an Server angepasst
            : '/api'; // Auf dem Server werden alle Aufrufe an /api/... gesendet

        this.config = {
            maxFileSizeMB: 10,
            maxRefFileSizeMB: 2,
            apiTimeout: 30000, // 30 seconds
            statusMsgDuration: 4000, // 4 seconds
            maxMeasurements: 100,
        };

        // --- State ---
        this.state = {
            currentImage: null,
            newReferenceImage: null,
            currentMode: 'withReference',
            isAnalyzing: false,
            analysisStartTime: null,
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
            await this.checkBackendHealth();
            this.populateReferences();
            this.showStatus('Anwendung erfolgreich initialisiert.', 'success');
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showStatus('Fehler beim Initialisieren der Anwendung.', 'error');
        }
    }

    //=========================================================================
    // DOM Caching and Access
    //=========================================================================

    /**
     * Caches frequently accessed DOM elements.
     */
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

    /**
     * Retrieves a cached DOM element.
     */
    get(id) {
        return this.domCache.get(id);
    }

    //=========================================================================
    // Event Listener Setup
    //=========================================================================

    /**
     * Centralized method to initialize all event listeners.
     */
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

    /**
     * Sets up listeners for all modals.
     */
    setupModalListeners() {
        this.addClickListener('showAllMeasurementsBtn', () => this.showAllMeasurements());
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
        this.addClickListener('deleteAllMeasurementsBtn', () => this.handleDeleteAllMeasurements());
        this.addClickListener('deleteAllReferencesBtn', () => this.handleDeleteAllReferences());
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

    /**
     * Sets up drag and drop functionality for an upload area.
     */
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

    /**
     * Sets up global listeners for keyboard shortcuts and window events.
     */
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

    /**
     * Helper to add a click listener to a cached element.
     */
    addClickListener(id, callback) {
        this.get(id)?.addEventListener('click', callback);
    }

    //=========================================================================
    // State and UI Management
    //=========================================================================

    /**
     * Sets the analysis mode and updates the UI accordingly.
     */
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

    /**
     * Sets the application into a loading state.
     */
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

    /**
     * Displays a status message to the user.
     */
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

    /**
     * Updates a text content of a cached element.
     */
    updateText(id, text) {
        const el = this.get(id);
        if (el) el.textContent = text;
    }

    /**
     * Resets the analysis view to its initial state.
     */
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

    /**
     * Handles the selection of the main analysis image.
     */
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

    /**
     * Handles the selection of a new reference image.
     */
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

    /**
     * Validates a file based on type and size.
     */
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

    /**
     * Reads a file and returns its content as a Data URL.
     */
    readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsDataURL(file);
        });
    }

    /**
     * Displays an image preview in a specified container.
     */
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

    /**
     * Sends the image to the backend for analysis.
     */
    async analyzeImage() {
        if (this.state.isAnalyzing) return;
        if (!this.state.currentImage) {
            this.showStatus('Bitte zuerst ein Bild auswählen.', 'error');
            return;
        }
        if (this.state.currentMode === 'savedReference' && !this.get('referenceDropdown').value) {
            this.showStatus('Bitte eine Referenzskala auswählen.', 'error');
            return;
        }
        this.state.isAnalyzing = true;
        this.state.analysisStartTime = Date.now();
        this.setLoading(true);
        this.showStatus('Analysiere UV-Strip...', 'info');
        try {
            const formData = new FormData();
            formData.append('file', this.state.currentImage);
            formData.append('mode', this.state.currentMode);
            if (this.state.currentMode === 'savedReference') {
                formData.append('reference', this.get('referenceDropdown').value);
            }
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.apiTimeout);
            const response = await fetch(`${this.apiUrl}/analyze`, {
                method: 'POST',
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(`Serverfehler ${response.status}: ${errorData.detail}`);
            }
            const result = await response.json();
            if (!result.success) throw new Error(result.detail || 'Analyse fehlgeschlagen');
            this.displayResults(result);
            this.updateAnalysisMetrics(result);
        } catch (error) {
            console.error('Analysis error:', error);
            const message = error.name === 'AbortError' ? 'Analyse-Timeout: Server antwortet nicht.' : error.message;
            this.showStatus(`Fehler bei der Analyse: ${message}`, 'error');
        } finally {
            this.state.isAnalyzing = false;
            this.setLoading(false);
        }
    }

    /**
     * Displays the analysis results in the UI.
     */
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
            <div class="save-results-panel">
                <h4 style="color: var(--text-primary); margin-bottom: 1rem; font-weight: var(--font-weight-semibold);">Messung speichern</h4>
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
    
    /**
     * Updates dashboard metrics after an analysis.
     */
    updateAnalysisMetrics(result) {
        const processingTime = Date.now() - this.state.analysisStartTime;
        this.updateText('processingTime', `${processingTime}ms`);
        this.updateText('confidenceLevel', result.confidence || '--');
    }

    /**
     * Checks the health of the backend API with a retry mechanism.
     */
    async checkBackendHealth(retries = 3, delay = 500) {
        this.updateText('backendStatus', 'Prüfe...');
        this.get('backendStatus').style.color = 'var(--text-muted)';

        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(`${this.apiUrl}/health`);
                if (response.ok) {
                    this.updateText('backendStatus', 'Online');
                    this.get('backendStatus').style.color = 'var(--success-color)';
                    return; // Success, exit the loop
                }
            } catch (error) {
                console.warn(`Backend health check attempt ${i + 1} failed.`);
            }
            if (i < retries - 1) await new Promise(res => setTimeout(res, delay));
        }
        
        // If all retries fail
        this.updateText('backendStatus', 'Offline');
        this.get('backendStatus').style.color = 'var(--danger-color)';
        this.showStatus('Backend nicht erreichbar. Bitte Server starten.', 'error');
    }

    //=========================================================================
    // Data Persistence (LocalStorage)
    //=========================================================================

    /**
     * Saves the current application state to LocalStorage.
     */
    saveAppState() {
        try {
            localStorage.setItem('luvexAppState', JSON.stringify({
                currentMode: this.state.currentMode
            }));
        } catch (e) {
            console.warn('Could not save app state to LocalStorage.', e);
        }
    }

    /**
     * Loads application state from LocalStorage.
     */
    loadAppState() {
        try {
            const savedState = JSON.parse(localStorage.getItem('luvexAppState'));
            if (savedState && savedState.currentMode) {
                this.setMode(savedState.currentMode);
            }
        } catch (e) {
            console.warn('Could not load app state from LocalStorage.', e);
        }
    }

    /**
     * Saves the analysis result to LocalStorage.
     */
    saveResults(result) {
        const measurementName = document.getElementById('measurementName').value.trim() || `Messung ${new Date().toLocaleString('de-DE')}`;
        const measurement = {
            id: Date.now().toString(),
            name: measurementName,
            notes: document.getElementById('measurementNotes').value.trim() || '',
            timestamp: new Date().toISOString(),
            filename: this.state.currentImage.name,
            mode: this.state.currentMode,
            results: result
        };
        const savedMeasurements = JSON.parse(localStorage.getItem('uvMeasurements') || '[]');
        savedMeasurements.unshift(measurement);
        if (savedMeasurements.length > this.config.maxMeasurements) savedMeasurements.pop();
        localStorage.setItem('uvMeasurements', JSON.stringify(savedMeasurements));
        this.showStatus(`Messung "${measurementName}" gespeichert!`, 'success');
        this.updateText('lastAnalysis', new Date().toLocaleString('de-DE'));
        this.discardResults();
    }
    
    /**
     * Hides the results container.
     */
    discardResults() {
        this.get('resultsContainer').style.display = 'none';
    }

    /**
     * Saves a new custom reference to LocalStorage.
     */
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
    
    /**
     * Resets the form for adding a new reference.
     */
    resetAddReferenceForm() {
        this.get('newReferenceName').value = '';
        this.get('newReferenceRange').value = '';
        this.get('referenceImagePreview').style.display = 'none';
        this.get('fileInputReference').value = '';
        this.state.newReferenceImage = null;
    }

    /**
     * Deletes a specific custom reference from LocalStorage.
     */
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

    /**
     * Handles the deletion of all measurements.
     */
    handleDeleteAllMeasurements() {
        this.showConfirm(
            'Alle Messungen löschen',
            'Möchten Sie wirklich alle Messungen löschen? Diese Aktion ist endgültig.',
            () => {
                localStorage.removeItem('uvMeasurements');
                this.showStatus('Alle Messungen gelöscht.', 'info');
                this.closeModal(this.get('settingsModal'));
            }
        );
    }

    /**
     * Handles the deletion of all custom references.
     */
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

    //=========================================================================
    // Modal and Dynamic Content
    //=========================================================================

    /**
     * Opens a modal with an animation.
     */
    openModal(modal) {
        if (!modal) return;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('visible'), 10);
    }

    /**
     * Closes a modal with an animation.
     */
    closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
    
    /**
     * Displays a confirmation dialog.
     */
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

    /**
     * Populates the reference dropdown and library list from LocalStorage.
     */
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

    /**
     * Shows the modal with all saved measurements.
     */
    showAllMeasurements() {
        const measurements = JSON.parse(localStorage.getItem('uvMeasurements') || '[]');
        const listContainer = this.get('measurementsList');
        listContainer.innerHTML = '';
        if (measurements.length === 0) {
            listContainer.innerHTML = this.getEmptyStateHTML('Noch keine Messungen gespeichert.');
        } else {
            const fragment = document.createDocumentFragment();
            measurements.forEach(m => fragment.appendChild(this.createMeasurementItem(m)));
            listContainer.appendChild(fragment);
        }
        this.openModal(this.get('measurementsModal'));
    }
    
    /**
     * Creates an HTML element for a single measurement item.
     */
    createMeasurementItem(m) {
        const item = document.createElement('div');
        item.className = 'measurement-item';
        const date = new Date(m.timestamp).toLocaleString('de-DE');
        const dose = m.results.uv_dose || 'N/A';
        const level = { 'low': 'Niedrig', 'medium': 'Mittel', 'high': 'Hoch', 'extreme': 'Extrem' }[m.results.exposure_level] || 'Unbekannt';
        const mode = m.mode === 'withReference' ? 'Referenz im Bild' : 'Gespeicherte Referenz';
        item.innerHTML = `
            <div class="measurement-header">${this.escapeHtml(m.name)}</div>
            <div class="measurement-details">
                <div class="measurement-detail-item"><strong>Datum:</strong><span>${date}</span></div>
                <div class="measurement-detail-item"><strong>UV-Dosis:</strong><span>${dose} J/cm²</span></div>
                <div class="measurement-detail-item"><strong>Stufe:</strong><span class="level-${m.results.exposure_level}">${level}</span></div>
                <div class="measurement-detail-item"><strong>Modus:</strong><span>${mode}</span></div>
            </div>
            ${m.notes ? `<div class="measurement-notes"><strong>Notizen:</strong> <p>${this.escapeHtml(m.notes)}</p></div>` : ''}`;
        return item;
    }

    /**
     * Shows the modal to manage custom references.
     */
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
    // Utilities
    //=========================================================================

    /**
     * Sanitizes a string to prevent XSS.
     */
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Generates HTML for an empty state message in modals.
     */
    getEmptyStateHTML(message) {
        return `
            <div class="modal-empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p>${this.escapeHtml(message)}</p>
            </div>`;
    }
}

// Initialize the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    window.uvAnalyzer = new UVStripAnalyzer();
});
