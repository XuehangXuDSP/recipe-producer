// IndexedDB utility for image storage
class ImageStorage {
    constructor() {
        this.dbName = 'RecipeProducerDB';
        this.storeName = 'images';
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    async storeImage(id, file) {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.put({ id, file, timestamp: Date.now() });
            request.onsuccess = () => resolve(id);
            request.onerror = () => reject(request.error);
        });
    }

    async getImage(id) {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result ? request.result.file : null);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteImage(id) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAll() {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

class RecipeProducer {
    constructor() {
        this.sessionId = this.generateUUID();
        this.currentMode = 'recipe'; // 'recipe' or 'function'
        this.recipes = [this.createEmptyContent('recipe')];
        this.currentRecipeIndex = 0;
        this.imageStorage = new ImageStorage();
        this.imageCounter = 0;
        this.zoomLevel = 1;
        
        // Debounced functions for performance optimization
        // JSON preview should be more responsive, so shorter debounce
        this.debouncedUpdatePreview = this.debounce(() => this.updatePreview(), 50);
        this.debouncedSaveToLocalStorage = this.debounce(() => this.saveToLocalStorage(), 1000);
        
        // For tracking changes
        this.lastSavedState = null;
        this.hasUnsavedChanges = false;
        
        // JSZip availability flag
        this.jsZipAvailable = false;
        
        // Define step options
        this.stepOptions = [
            'Create Executable',
            'Create Pipeline', 
            'Create Scheduler',
            'Retrieve',
            'Scoping',
            'Match',
            'Mapping',
            'Action',
            'Verify',
            'Preview',
            'Preview Transformed',
            'Data List(Q) Settings',
            'Batch Settings',
            'Action Button Settings',
            'Trigger Settings',
            'Variable'
        ];
        
        this.init();
    }
    
    // Debounce utility function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        }.bind(this);
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async init() {
        try {
            console.log('Initializing Recipe Producer...');
            
            // Initialize core components first
            await this.imageStorage.init();
            console.log('IndexedDB initialized successfully');
            
            this.bindEvents();
            console.log('Event handlers bound successfully');
            
            await this.loadFromLocalStorage();
            console.log('Data loaded from localStorage');
            
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                try {
                    this.loadCurrentContent();
                    this.updatePreview();
                    console.log('Initial content and preview updated');
                } catch (error) {
                    console.error('Error updating initial content/preview:', error);
                }
            }, 100);
            
            // Check JSZip availability (non-blocking)
            this.checkJSZipAvailability();
            
            console.log('Recipe Producer initialization complete');
        } catch (error) {
            console.error('Failed to initialize Recipe Producer:', error);
            this.showError('Failed to initialize application. Please refresh the page and try again.');
        }
    }
    
    async checkJSZipAvailability() {
        const generateBtn = document.getElementById('generate-all');
        
        try {
            // Wait for JSZipReady promise if it exists
            if (window.JSZipReady) {
                console.log('Waiting for JSZip to load...');
                await window.JSZipReady;
            }
            
            // Double check JSZip is available
            if (typeof JSZip !== 'undefined') {
                console.log(`JSZip library loaded successfully! Version: ${JSZip.version || 'unknown'}`);
                this.jsZipAvailable = true;
                
                // Enable ZIP export button
                if (generateBtn) {
                    generateBtn.disabled = false;
                    generateBtn.title = 'Generate ZIP file with all recipes';
                    generateBtn.style.opacity = '1';
                    generateBtn.style.cursor = 'pointer';
                    generateBtn.innerHTML = 'Generate & Download All Recipes';
                    console.log('ZIP export button enabled successfully!');
                }
                
                // Show success message briefly
                this.showTemporaryMessage('ZIP功能已就绪', 'success');
            } else {
                throw new Error('JSZip is still undefined after loading');
            }
        } catch (error) {
            console.error('JSZip loading failed:', error);
            this.jsZipAvailable = false;
            
            // Disable ZIP export button
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.title = 'ZIP导出功能不可用。可能的解决方案：\n1. 刷新页面重试\n2. 检查网络连接\n3. 使用现代浏览器访问';
                generateBtn.style.opacity = '0.5';
                generateBtn.style.cursor = 'not-allowed';
                generateBtn.innerHTML = '⚠️ ZIP功能不可用';
            }
            
            // Show error message to user
            this.showTemporaryMessage('ZIP功能加载失败，请刷新页面重试', 'error');
        }
    }
    
    // 添加手动强制启用按钮的方法
    forceEnableDownload() {
        console.log('Force enabling download functionality...');
        const generateBtn = document.getElementById('generate-all');
        
        this.jsZipAvailable = true;
        
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.title = '生成并下载所有Recipe的ZIP文件 (强制启用)';
            generateBtn.style.opacity = '1';
            generateBtn.style.cursor = 'pointer';
            generateBtn.innerHTML = 'Generate & Download All Recipes';
            console.log('Download button force enabled!');
        }
        
        return this.jsZipAvailable;
    }

    generateStepOptions(selectedValue = '') {
        let options = '<option value="">Please select a step</option>';
        
        this.stepOptions.forEach(option => {
            const selected = option === selectedValue ? 'selected' : '';
            options += `<option value="${option}" ${selected}>${option}</option>`;
        });
        
        // Add support for custom values (backward compatibility)
        if (selectedValue && !this.stepOptions.includes(selectedValue)) {
            options += `<option value="${selectedValue}" selected>${selectedValue}</option>`;
        }
        
        return options;
    }

    createEmptyRecipe() {
        return {
            contentType: 'recipe',
            id: '',
            title: '',
            category: '',
            DSPVersions: ['', ''],
            usecase: '',
            prerequisites: [{
                description: '',
                quickLinks: [{
                    title: '',
                    url: ''
                }]
            }],
            direction: '',
            connection: '',
            walkthrough: [{
                step: '',
                config: [{
                    field: '',
                    value: ''
                }],
                media: [{
                    type: 'image',
                    url: '',
                    alt: '',
                    imageId: ''
                }]
            }],
            downloadableExecutables: [{
                title: '',
                url: ''
            }],
            relatedRecipes: [{
                title: '',
                url: ''
            }],
            keywords: []
        };
    }

    createEmptyFunction() {
        return {
            contentType: 'function',
            id: '',
            title: '',
            description: '',
            syntax: '',
            parameters: [{
                name: '',
                type: '',
                required: 'Yes',
                description: ''
            }],
            examples: [''],
            tips: [{
                text: '',
                children: []
            }],
            relatedFormula: []
        };
    }

    createEmptyContent(contentType = 'recipe') {
        if (contentType === 'function') {
            return this.createEmptyFunction();
        } else {
            return this.createEmptyRecipe();
        }
    }

    getCurrentContentType() {
        const currentContent = this.recipes[this.currentRecipeIndex];
        return currentContent?.contentType || 'recipe';
    }

    bindEvents() {
        // Use event delegation for all dynamic elements
        document.addEventListener('click', async (e) => {
            try {
                // Floating button clicks
                if (e.target.id === 'import-btn') {
                    this.openOverlay('Import Recipes', 'import-template');
                    return;
                }
                if (e.target.id === 'actions-btn') {
                    this.openOverlay('Actions', 'actions-template');
                    return;
                }
                if (e.target.id === 'status-btn') {
                    this.openOverlay('Recipe Status', 'status-template');
                    return;
                }
                
                // Overlay close
                if (e.target.classList.contains('overlay-close') || e.target.classList.contains('overlay-backdrop')) {
                    this.closeOverlay();
                    return;
                }

                // Mode switching
                if (e.target.classList.contains('mode-btn')) {
                    const mode = e.target.dataset.mode;
                    this.switchMode(mode);
                    return;
                }
                
                // Tab management
                if (e.target.classList.contains('add-tab')) {
                    await this.addNewRecipe();
                    return;
                }
                
                // Handle close button clicks first to prevent tab switching
                if (e.target.classList.contains('close-tab')) {
                    e.stopPropagation();
                    const tab = e.target.closest('.tab');
                    if (tab && tab.dataset.recipeIndex) {
                        const index = parseInt(tab.dataset.recipeIndex);
                        await this.removeRecipe(index);
                    }
                    return;
                }
                
                // Handle tab clicks - check if clicked element is within a tab
                const clickedTab = e.target.closest('.tab');
                if (clickedTab && !e.target.classList.contains('close-tab')) {
                    const index = parseInt(clickedTab.dataset.recipeIndex);
                    if (!isNaN(index)) {
                        await this.switchToRecipe(index);
                    }
                    return;
                }

                // Add functions
                if (e.target.classList.contains('add-dsp-version')) {
                    this.addDSPVersion();
                    return;
                }
                if (e.target.classList.contains('add-prerequisite')) {
                    this.addPrerequisite();
                    return;
                }
                if (e.target.classList.contains('add-step')) {
                    this.addStep();
                    return;
                }
                if (e.target.classList.contains('add-config')) {
                    this.addConfig(e.target);
                    return;
                }
                if (e.target.classList.contains('add-media')) {
                    this.addMedia(e.target);
                    return;
                }
                if (e.target.classList.contains('add-link')) {
                    this.addQuickLink(e.target);
                    return;
                }
                if (e.target.classList.contains('add-downloadable')) {
                    this.addDownloadable();
                    return;
                }
                if (e.target.classList.contains('add-related')) {
                    this.addRelatedRecipe();
                    return;
                }

                // Function content form additions
                if (e.target.classList.contains('add-parameter')) {
                    this.addParameter();
                    return;
                }
                if (e.target.classList.contains('add-example')) {
                    this.addExample();
                    return;
                }
                if (e.target.classList.contains('add-tip')) {
                    this.addTip();
                    return;
                }
                if (e.target.classList.contains('add-child')) {
                    this.addChildTip(e.target);
                    return;
                }

                // Actions toggle functionality
                if (e.target.closest('#actions-toggle')) {
                    this.toggleActionsPanel();
                    return;
                }
                
                // Import toggle functionality
                if (e.target.closest('#import-toggle')) {
                    this.toggleImportPanel();
                    return;
                }
                
                // Recipes status toggle functionality
                if (e.target.closest('#recipes-status-toggle')) {
                    this.toggleRecipesStatusPanel();
                    return;
                }
                
                // Upload buttons functionality
                if (e.target.id === 'upload-single') {
                    e.stopPropagation();
                    document.getElementById('recipe-upload-single').click();
                    return;
                }
                
                if (e.target.id === 'upload-bulk') {
                    e.stopPropagation();
                    document.getElementById('recipe-upload-bulk').click();
                    return;
                }
                
                if (e.target.id === 'upload-zip') {
                    e.stopPropagation();
                    console.log('Upload ZIP button clicked');
                    document.getElementById('recipe-upload-zip').click();
                    return;
                }

                // Action buttons (save-current and generate-all)
                if (e.target.id === 'save-current') {
                    e.stopPropagation();
                    console.log('Save current recipe button clicked');
                    await this.saveCurrentRecipe();
                    return;
                }
                
                if (e.target.id === 'generate-all') {
                    e.stopPropagation();
                    console.log('Generate all recipes button clicked');
                    await this.generateAllRecipes();
                    return;
                }

                // Remove functions
                if (e.target.classList.contains('remove-config') || 
                    e.target.classList.contains('remove-media') ||
                    e.target.classList.contains('remove-link') ||
                    e.target.classList.contains('remove-downloadable') ||
                    e.target.classList.contains('remove-related') ||
                    e.target.classList.contains('remove-parameter') ||
                    e.target.classList.contains('remove-example')) {
                    const elementToRemove = e.target.closest('div');
                    if (elementToRemove) {
                        elementToRemove.remove();
                        await this.handleInputChange();
                    }
                    return;
                }

                // Handle tip removal
                if (e.target.classList.contains('remove')) {
                    const tipItem = e.target.closest('.tip-item');
                    if (tipItem) {
                        // Check if this tip has children
                        const childrenContainer = tipItem.querySelector('.tip-children');
                        const hasChildren = childrenContainer && childrenContainer.children.length > 0;
                        
                        if (hasChildren) {
                            const confirmDelete = confirm('This tip has sub-tips. Delete all?');
                            if (!confirmDelete) {
                                return;
                            }
                        }
                        
                        tipItem.remove();
                        await this.handleInputChange();
                    }
                    return;
                }
                
                // Keyword remove button
                if (e.target.classList.contains('keyword-remove-btn')) {
                    const keywordTag = e.target.closest('.keyword-tag');
                    if (keywordTag) {
                        keywordTag.remove();
                        await this.handleInputChange();
                    }
                    return;
                }
            } catch (error) {
                console.error('Error in click handler:', error);
                this.showError(`操作失败: ${error.message}`);
            }
        });

        // Input change events using delegation
        document.addEventListener('input', async (e) => {
            if (e.target.matches('input, textarea, select')) {
                try {
                    // Check if this change affects image naming
                    if (e.target.id === 'category' || 
                        e.target.classList.contains('step-name') || 
                        e.target.classList.contains('media-alt')) {
                        
                        // Debounce image name updates to avoid too frequent updates
                        clearTimeout(this.imageNameUpdateTimeout);
                        this.imageNameUpdateTimeout = setTimeout(async () => {
                            await this.updateImageNamesForContentChange();
                        }, 1000);
                    }
                    
                    await this.handleInputChange();
                } catch (error) {
                    console.error('Error handling input change:', error);
                }
            }
        });

        // Change events for specific elements
        document.addEventListener('change', async (e) => {
            try {
                if (e.target.classList.contains('link-type')) {
                    this.updateLinkFields(e.target);
                }

                if (e.target.classList.contains('media-type')) {
                    this.toggleMediaType(e.target);
                }
                
                if (e.target.classList.contains('image-upload')) {
                    console.log('Image upload triggered');
                    await this.handleImageUpload(e.target);
                }
                
                if (e.target.id === 'recipe-upload-single') {
                    console.log('Single recipe upload triggered');
                    await this.handleRecipeUpload(e.target, false);
                }
                
                if (e.target.id === 'recipe-upload-bulk') {
                    console.log('Bulk recipe upload triggered');
                    await this.handleRecipeUpload(e.target, true);
                }
                
                if (e.target.id === 'recipe-upload-zip') {
                    console.log('ZIP upload triggered');
                    await this.handleZipUpload(e.target);
                }

                // Remove the old content-type-selector handling since we use mode-based switching now
            } catch (error) {
                console.error('Error handling change event:', error);
                this.showUploadStatus('error', `Error: ${error.message}`);
            }
        });

        // Setup drag and drop for image upload areas
        this.setupImageDragAndDrop();

        // Keyboard shortcuts for image preview and overlay
        document.addEventListener('keydown', (e) => {
            // Check if overlay is open first
            const overlay = document.getElementById('overlay');
            if (overlay && overlay.style.display === 'flex') {
                if (e.key === 'Escape') {
                    this.closeOverlay();
                    return;
                }
            }
            
            const modal = document.getElementById('image-preview-modal');
            if (modal.style.display === 'flex') {
                switch(e.key) {
                    case 'Escape':
                        this.closeImagePreview();
                        break;
                    case '+':
                    case '=':
                        e.preventDefault();
                        this.zoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        this.zoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        this.resetZoom();
                        break;
                }
            }
        });

        // Keyword input handling
        document.addEventListener('keypress', async (e) => {
            if (e.target.classList.contains('keyword-input') && e.key === 'Enter') {
                try {
                    e.preventDefault();
                    await this.addKeyword(e.target.value);
                    e.target.value = '';
                } catch (error) {
                    console.error('Error adding keyword:', error);
                    this.showError('添加关键词失败');
                }
            }
        });

        // Keyboard shortcuts for tab navigation
        document.addEventListener('keydown', async (e) => {
            // Ctrl/Cmd + Left Arrow - Previous tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
                e.preventDefault();
                const newIndex = this.currentRecipeIndex > 0 ? this.currentRecipeIndex - 1 : this.recipes.length - 1;
                await this.switchToRecipe(newIndex);
            }
            // Ctrl/Cmd + Right Arrow - Next tab
            else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
                e.preventDefault();
                const newIndex = this.currentRecipeIndex < this.recipes.length - 1 ? this.currentRecipeIndex + 1 : 0;
                await this.switchToRecipe(newIndex);
            }
            // Ctrl/Cmd + T - New tab
            else if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                await this.addNewRecipe();
            }
        });

        // Main action buttons - Now handled by event delegation above
        // These buttons are in templates and will be handled by the event delegation system
        console.log('Action buttons will be handled by event delegation');

        // Smart auto-save interval - only save if there are changes
        setInterval(() => {
            if (this.hasUnsavedChanges) {
                this.saveToLocalStorage();
            }
        }, 30000);
        
        // Drag and drop functionality
        this.setupDragAndDrop();
    }

    async addNewRecipe(contentType = null) {
        try {
            // Use current mode if no contentType specified
            const actualContentType = contentType || this.currentMode;
            const newContent = this.createEmptyContent(actualContentType);
            this.recipes.push(newContent);
            const newIndex = this.recipes.length - 1;
            
            const tabsContainer = document.querySelector('.tabs');
            const addTabButton = document.querySelector('.add-tab');
            
            if (!tabsContainer) {
                console.error('Tabs container not found');
                return;
            }
            
            if (!addTabButton) {
                console.error('Add tab button not found');
                return;
            }
            
            const newTab = document.createElement('div');
            newTab.className = 'tab';
            newTab.dataset.recipeIndex = newIndex;
            const contentTypeLabel = actualContentType === 'function' ? 'Function' : 'Recipe';
            newTab.innerHTML = `
                <span class="tab-title">${contentTypeLabel} ${newIndex + 1}</span>
                <button class="close-tab">×</button>
            `;
            
            tabsContainer.insertBefore(newTab, addTabButton);
            await this.switchToRecipe(newIndex);
            
            // Update close button visibility
            this.updateCloseButtonVisibility();
        } catch (error) {
            console.error('Error adding new recipe:', error);
        }
    }

    async removeRecipe(index) {
        try {
            if (this.recipes.length <= 1) {
                alert('At least one recipe must be kept');
                return;
            }

            // Determine which tab to switch to after deletion
            let newCurrentIndex = this.currentRecipeIndex;
            
            if (index === this.currentRecipeIndex) {
                // If deleting current tab, switch to next tab, or previous if it's the last
                if (index < this.recipes.length - 1) {
                    newCurrentIndex = index; // Will become the next tab after deletion
                } else {
                    newCurrentIndex = index - 1; // Switch to previous tab
                }
            } else if (index < this.currentRecipeIndex) {
                // If deleting a tab before current, adjust current index
                newCurrentIndex = this.currentRecipeIndex - 1;
            }
            
            // Remove the recipe from data
            this.recipes.splice(index, 1);
            
            // Remove the DOM element
            const tabToRemove = document.querySelector(`[data-recipe-index="${index}"]`);
            if (tabToRemove) {
                tabToRemove.remove();
            }
            
            // Update remaining tabs with correct indices and preserve titles
            document.querySelectorAll('.tab').forEach((tab, i) => {
                tab.dataset.recipeIndex = i;
                const recipe = this.recipes[i];
                if (recipe) {
                    const title = recipe.title || `Recipe ${i + 1}`;
                    const titleElement = tab.querySelector('.tab-title');
                    if (titleElement) {
                        titleElement.textContent = title;
                    }
                }
            });
            
            // Update current index and switch to appropriate tab
            this.currentRecipeIndex = Math.max(0, Math.min(newCurrentIndex, this.recipes.length - 1));
            await this.switchToRecipe(this.currentRecipeIndex);
            
            // Update close button visibility
            this.updateCloseButtonVisibility();
            
            // Save changes to localStorage
            this.saveToLocalStorage();
            
        } catch (error) {
            console.error('Error removing recipe:', error);
            alert('Failed to remove recipe. Please try again.');
        }
    }

    updateCloseButtonVisibility() {
        const tabs = document.querySelectorAll('.tab');
        const shouldShowCloseButtons = this.recipes.length > 1;
        
        tabs.forEach(tab => {
            const closeButton = tab.querySelector('.close-tab');
            if (closeButton) {
                closeButton.style.display = shouldShowCloseButtons ? 'flex' : 'none';
            }
        });
    }

    async switchToRecipe(index) {
        try {
            console.log(`Switching to recipe ${index}`);
            
            // Check if the target recipe matches current mode
            const targetRecipe = this.recipes[index];
            if (!targetRecipe) {
                throw new Error(`Recipe at index ${index} not found`);
            }
            
            // Mode compatibility check
            if (targetRecipe.contentType !== this.currentMode) {
                console.warn(`Recipe type ${targetRecipe.contentType} does not match current mode ${this.currentMode}`);
                // Switch mode to match the recipe type
                this.switchMode(targetRecipe.contentType);
                return; // switchMode will call filterAndRenderTabs which handles the switching
            }
            
            await this.saveCurrentRecipeData();
            
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            const targetTab = document.querySelector(`[data-recipe-index="${index}"]`);
            if (!targetTab) {
                throw new Error(`Tab with index ${index} not found`);
            }
            targetTab.classList.add('active');
            
            this.currentRecipeIndex = index;
            this.loadCurrentContent();
            this.updatePreview();
            console.log(`Successfully switched to recipe ${index}`);
        } catch (error) {
            console.error('Error switching recipe:', error);
            this.showError('切换Recipe时发生错误');
        }
    }

    async saveCurrentRecipeData() {
        try {
            const content = this.recipes[this.currentRecipeIndex];
            if (!content) {
                console.warn('No content found at current index:', this.currentRecipeIndex);
                return;
            }
            
            if (content.contentType === 'function') {
                await this.saveFunctionData(content);
            } else {
                await this.saveRecipeData(content);
            }
            
            console.log('Content data saved successfully');
        } catch (error) {
            console.error('Error saving current content data:', error);
            this.showError('保存内容数据时发生错误');
        }
    }

    async saveRecipeData(recipe) {
        // Safely get element values with fallbacks
        const titleEl = document.getElementById('title');
        const categoryEl = document.getElementById('category');
        const usecaseEl = document.getElementById('usecase');
        const directionEl = document.getElementById('direction');
        const connectionEl = document.getElementById('connection');
        
        recipe.title = titleEl ? titleEl.value.trim() : '';
        recipe.category = categoryEl ? categoryEl.value.trim() : '';
        recipe.usecase = usecaseEl ? usecaseEl.value.trim() : '';
        recipe.direction = directionEl ? directionEl.value.trim() : '';
        recipe.connection = connectionEl ? connectionEl.value.trim() : '';
        
        // Safely collect DSP versions
        const dspVersionElements = document.querySelectorAll('.dsp-version');
        recipe.DSPVersions = Array.from(dspVersionElements)
            .map(input => input ? input.value.trim() : '')
            .filter(v => v);
        
        // Safely collect keywords
        const keywordElements = document.querySelectorAll('.keyword-tag');
        recipe.keywords = Array.from(keywordElements)
            .map(tag => tag ? tag.textContent.replace('×', '').trim() : '')
            .filter(k => k);
        
        recipe.prerequisites = this.collectPrerequisites();
        recipe.walkthrough = await this.collectWalkthrough();
        recipe.downloadableExecutables = this.collectDownloadables();
        recipe.relatedRecipes = this.collectRelatedRecipes();
        
        if (recipe.title) {
            recipe.id = recipe.title.toLowerCase().replace(/\s+/g, '-');
        }
    }

    async saveFunctionData(functionData) {
        // Get function form elements
        const titleEl = document.getElementById('function-title');
        const descEl = document.getElementById('function-description');
        const syntaxEl = document.getElementById('function-syntax');
        const relatedFormulaEl = document.getElementById('related-formula');

        functionData.title = titleEl ? titleEl.value.trim() : '';
        functionData.description = descEl ? descEl.value.trim() : '';
        functionData.syntax = syntaxEl ? syntaxEl.value.trim() : '';
        
        // Handle related formula (can be comma-separated string or array)
        const relatedFormulaValue = relatedFormulaEl ? relatedFormulaEl.value.trim() : '';
        functionData.relatedFormula = relatedFormulaValue ? relatedFormulaValue.split(',').map(f => f.trim()).filter(f => f) : [];

        // Collect parameters
        functionData.parameters = this.collectParameters();

        // Collect examples
        functionData.examples = this.collectExamples();

        // Collect tips
        functionData.tips = this.collectTips();

        if (functionData.title) {
            functionData.id = functionData.title.toLowerCase().replace(/\s+/g, '-');
        }
    }

    collectParameters() {
        const parameters = [];
        document.querySelectorAll('.parameter-item').forEach(item => {
            const nameEl = item.querySelector('.parameter-name');
            const typeEl = item.querySelector('.parameter-type');
            const requiredEl = item.querySelector('.parameter-required');
            const descEl = item.querySelector('.parameter-description');

            const name = nameEl ? nameEl.value.trim() : '';
            const type = typeEl ? typeEl.value.trim() : '';
            const required = requiredEl ? requiredEl.value : 'Yes';
            const description = descEl ? descEl.value.trim() : '';

            if (name || type || description) {
                parameters.push({ name, type, required, description });
            }
        });
        return parameters.length > 0 ? parameters : [{ name: '', type: '', required: 'Yes', description: '' }];
    }

    collectExamples() {
        const examples = [];
        document.querySelectorAll('.example-item').forEach(item => {
            const textEl = item.querySelector('.example-text');
            const text = textEl ? textEl.value.trim() : '';
            if (text) {
                examples.push(text);
            }
        });
        return examples.length > 0 ? examples : [''];
    }

    collectTips() {
        const tips = [];
        // Only collect top-level tips 
        const topLevelTips = document.querySelectorAll('.tips-container > .tip-item');
        
        topLevelTips.forEach(item => {
            const tipData = this.collectTipData(item);
            if (tipData.text || tipData.children.length > 0) {
                tips.push(tipData);
            }
        });
        
        return tips.length > 0 ? tips : [{ text: '', children: [] }];
    }

    collectTipData(tipElement) {
        const textEl = tipElement.querySelector('.tip-content .tip-text');
        const text = textEl ? textEl.value.trim() : '';
        const children = [];
        
        // Collect children tips
        const childrenContainer = tipElement.querySelector('.tip-children');
        if (childrenContainer) {
            const childTips = childrenContainer.querySelectorAll(':scope > .tip-item');
            childTips.forEach(childTip => {
                const childData = this.collectTipData(childTip);
                if (childData.text || childData.children.length > 0) {
                    children.push(childData);
                }
            });
        }
        
        return { text, children };
    }

    collectPrerequisites() {
        const prerequisites = [];
        document.querySelectorAll('.prerequisite-item').forEach(item => {
            const desc = item.querySelector('.prerequisite-desc').value.trim();
            const links = [];
            
            item.querySelectorAll('.quick-link-item').forEach(linkItem => {
                const title = linkItem.querySelector('.link-title').value.trim();
                const url = linkItem.querySelector('.link-url').value.trim();
                if (title || url) {
                    links.push({ title, url });
                }
            });
            
            if (desc || links.length > 0) {
                prerequisites.push({
                    description: desc,
                    quickLinks: links
                });
            }
        });
        
        return prerequisites.length > 0 ? prerequisites : [{ description: '', quickLinks: [] }];
    }

    async collectWalkthrough() {
        const walkthrough = [];
        
        for (const stepEl of document.querySelectorAll('.step-item')) {
            const step = {
                step: stepEl.querySelector('.step-name').value.trim(),
                config: [],
                media: []
            };
            
            stepEl.querySelectorAll('.config-item').forEach(configEl => {
                const field = configEl.querySelector('.config-field').value.trim();
                const value = configEl.querySelector('.config-value').value.trim();
                if (field || value) {
                    step.config.push({ field, value });
                }
            });
            
            // Handle media items (both image and video)
            for (const mediaEl of stepEl.querySelectorAll('.media-item')) {
                const type = mediaEl.querySelector('.media-type').value.trim();
                const alt = mediaEl.querySelector('.media-alt').value.trim();
                let url = '';
                let imageKey = '';
                
                if (type === 'video') {
                    // For video, get URL from video URL input
                    const videoUrlInput = mediaEl.querySelector('.video-url');
                    url = videoUrlInput ? videoUrlInput.value.trim() : '';
                } else {
                    // For image, get filename from preview dataset
                    const preview = mediaEl.querySelector('.image-preview');
                    const fileName = preview?.dataset.fileName || '';
                    imageKey = preview?.dataset.imageKey || fileName; // Use imageKey if available, fallback to fileName
                    url = fileName ? `images/${fileName}` : '';
                    
                    console.log(`Collecting image for step: fileName=${fileName}, imageKey=${imageKey}, url=${url}`);
                }
                
                if (url || alt) {
                    const mediaItem = {
                        type,
                        url,
                        alt
                    };
                    
                    // Store the IndexedDB key for images to help with retrieval during ZIP generation
                    if (type === 'image' && imageKey) {
                        mediaItem.imageKey = imageKey;
                    }
                    
                    step.media.push(mediaItem);
                }
            }
            
            if (step.step || step.config.length > 0 || step.media.length > 0) {
                walkthrough.push(step);
            }
        }
        
        return walkthrough.length > 0 ? walkthrough : [{ step: '', config: [], media: [] }];
    }

    collectDownloadables() {
        const downloadables = [];
        document.querySelectorAll('.downloadable-item').forEach(item => {
            const title = item.querySelector('.downloadable-title').value.trim();
            const url = item.querySelector('.downloadable-url').value.trim();
            if (title || url) {
                downloadables.push({ title, url });
            }
        });
        return downloadables.length > 0 ? downloadables : [{ title: '', url: '' }];
    }

    collectRelatedRecipes() {
        const related = [];
        document.querySelectorAll('.related-item').forEach(item => {
            const title = item.querySelector('.related-title').value.trim();
            const url = item.querySelector('.related-url').value.trim();
            if (title || url) {
                related.push({ title, url });
            }
        });
        return related.length > 0 ? related : [{ title: '', url: '' }];
    }

    async loadRecipeData(recipe) {
        document.getElementById('title').value = recipe.title || '';
        document.getElementById('category').value = recipe.category || '';
        document.getElementById('usecase').value = recipe.usecase || '';
        document.getElementById('direction').value = recipe.direction || '';
        document.getElementById('connection').value = recipe.connection || '';
        
        this.updateTabTitle();
        
        // Load DSP versions
        const dspContainer = document.querySelector('.dsp-versions');
        dspContainer.innerHTML = '';
        recipe.DSPVersions.forEach((version, i) => {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'dsp-version';
            input.placeholder = `Version ${i + 1}`;
            input.value = version;
            dspContainer.appendChild(input);
        });
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-small add-dsp-version';
        addBtn.textContent = '+';
        dspContainer.appendChild(addBtn);
        
        // Load prerequisites
        this.loadPrerequisites(recipe.prerequisites);
        
        // Load walkthrough
        await this.loadWalkthrough(recipe.walkthrough);
        
        // Load other sections
        this.loadDownloadables(recipe.downloadableExecutables);
        this.loadRelatedRecipes(recipe.relatedRecipes);
        this.loadKeywords(recipe.keywords);
    }

    loadPrerequisites(prerequisites) {
        const container = document.querySelector('.prerequisites-container');
        container.innerHTML = '';
        
        prerequisites.forEach(prereq => {
            const item = document.createElement('div');
            item.className = 'prerequisite-item';
            
            const linksHtml = prereq.quickLinks.map(link => {
                const isRecipe = !link.url || (!link.url.startsWith('http://') && !link.url.startsWith('https://'));
                return `
                    <div class="quick-link-item">
                        <select class="link-type">
                            <option value="recipe" ${isRecipe ? 'selected' : ''}>Recipe Reference</option>
                            <option value="external" ${!isRecipe ? 'selected' : ''}>External Link</option>
                        </select>
                        <input type="text" placeholder="${isRecipe ? 'Recipe Title' : 'Link Title'}" class="link-title" value="${link.title || ''}">
                        <input type="text" placeholder="${isRecipe ? 'Recipe ID' : 'Link URL'}" class="link-url" value="${link.url || ''}">
                        <button type="button" class="btn-small remove-link">-</button>
                    </div>
                `;
            }).join('');
            
            item.innerHTML = `
                <input type="text" placeholder="Description" class="prerequisite-desc" value="${prereq.description || ''}">
                <div class="quick-links">
                    ${linksHtml}
                    <button type="button" class="btn-small add-link">+ Add Link</button>
                </div>
            `;
            container.appendChild(item);
        });
        
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-secondary add-prerequisite';
        addBtn.textContent = '+ Add Prerequisite';
        container.appendChild(addBtn);
    }

    async loadWalkthrough(walkthrough) {
        const container = document.querySelector('.walkthrough-container');
        container.innerHTML = '';
        
        for (let stepIndex = 0; stepIndex < walkthrough.length; stepIndex++) {
            const step = walkthrough[stepIndex];
            const stepEl = document.createElement('div');
            stepEl.className = 'step-item';
            stepEl.dataset.stepIndex = stepIndex;
            
            stepEl.innerHTML = `
                <h3>Step ${stepIndex + 1}</h3>
                <select class="step-name">
                    ${this.generateStepOptions(step.step || '')}
                </select>
                
                <h4>Configuration</h4>
                <div class="config-items">
                    ${step.config.map(cfg => `
                        <div class="config-item">
                            <input type="text" placeholder="Field" class="config-field" value="${cfg.field || ''}">
                            <input type="text" placeholder="Value" class="config-value" value="${cfg.value || ''}">
                            <button type="button" class="btn-small remove-config">-</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn-small add-config">+ Add Config</button>

                <h4>Media</h4>
                <div class="media-items"></div>
                <button type="button" class="btn-small add-media">+ Add Media</button>
            `;
            
            container.appendChild(stepEl);
            
            // Load media items
            const mediaContainer = stepEl.querySelector('.media-items');
            for (const media of step.media) {
                await this.createMediaItem(mediaContainer, media);
            }
        }
    }

    async createMediaItem(container, media = {}) {
        const mediaEl = document.createElement('div');
        mediaEl.className = 'media-item';
        
        // Extract filename from URL (remove 'images/' prefix)
        const fileName = media.url ? media.url.replace('images/', '') : '';
        const imageKey = fileName ? fileName.replace(/\.[^/.]+$/, '') : ''; // Remove extension for IndexedDB key
        let imageSrc = '';
        let hasImage = false;
        
        if (imageKey) {
            try {
                const imageFile = await this.imageStorage.getImage(imageKey);
                if (imageFile) {
                    imageSrc = URL.createObjectURL(imageFile);
                    hasImage = true;
                }
            } catch (error) {
                console.error('Failed to load image:', error);
            }
        }
        
        const isVideo = media.type === 'video';
        const videoUrl = isVideo ? (media.url || '') : '';
        
        mediaEl.innerHTML = `
            <div class="media-row">
                <select class="media-type">
                    <option value="image" ${media.type === 'image' ? 'selected' : ''}>Image</option>
                    <option value="video" ${media.type === 'video' ? 'selected' : ''}>Video</option>
                </select>
                <div class="image-upload-area" ${isVideo ? 'style="display:none"' : ''}>
                    <input type="file" class="image-upload" accept="image/*">
                    <div class="upload-placeholder" ${hasImage ? 'style="display:none"' : ''}>Click or drag to upload image</div>
                    <img class="image-preview" ${hasImage ? `src="${imageSrc}" style="display:block"` : 'style="display:none"'} ${fileName ? `data-file-name="${fileName}"` : ''}>
                    ${hasImage ? '<button class="image-remove-btn" title="Remove image">×</button>' : ''}
                </div>
                <div class="video-url-area" ${!isVideo ? 'style="display:none"' : ''}>
                    <input type="url" class="video-url" placeholder="Video URL" value="${videoUrl}">
                </div>
                <button type="button" class="btn-small remove-media">-</button>
            </div>
            <div class="media-alt-row">
                <input type="text" placeholder="Alt Text / Description" class="media-alt" value="${media.alt || ''}">
            </div>
        `;
        
        container.appendChild(mediaEl);
    }

    loadDownloadables(downloadables) {
        const container = document.querySelector('.downloadable-executables');
        container.innerHTML = '<h4>Downloadable Executables</h4>';
        
        downloadables.forEach(item => {
            const div = document.createElement('div');
            div.className = 'downloadable-item';
            div.innerHTML = `
                <input type="text" placeholder="File Title" class="downloadable-title" value="${item.title || ''}">
                <input type="url" placeholder="File URL" class="downloadable-url" value="${item.url || ''}">
            `;
            container.appendChild(div);
        });
        
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-small add-downloadable';
        addBtn.textContent = '+ Add File';
        container.appendChild(addBtn);
    }

    loadRelatedRecipes(related) {
        const container = document.querySelector('.related-recipes');
        container.innerHTML = '<h4>Related Recipes</h4>';
        
        related.forEach(item => {
            const div = document.createElement('div');
            div.className = 'related-item';
            div.innerHTML = `
                <input type="text" placeholder="Recipe Title" class="related-title" value="${item.title || ''}">
                <input type="url" placeholder="Recipe URL" class="related-url" value="${item.url || ''}">
            `;
            container.appendChild(div);
        });
        
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-small add-related';
        addBtn.textContent = '+ Add Related Recipe';
        container.appendChild(addBtn);
    }

    loadKeywords(keywords) {
        const container = document.querySelector('.keywords-list');
        container.innerHTML = '';
        
        keywords.forEach(keyword => {
            this.createKeywordTag(keyword);
        });
    }

    addDSPVersion() {
        try {
            const container = document.querySelector('.dsp-versions');
            if (!container) {
                console.error('DSP versions container not found');
                return;
            }
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'dsp-version';
            input.placeholder = `Version ${container.querySelectorAll('.dsp-version').length + 1}`;
            
            const lastElement = container.lastElementChild;
            if (lastElement) {
                container.insertBefore(input, lastElement);
            } else {
                container.appendChild(input);
            }
        } catch (error) {
            console.error('Error adding DSP version:', error);
        }
    }

    addPrerequisite() {
        try {
            const container = document.querySelector('.prerequisites-container');
            if (!container) {
                console.error('Prerequisites container not found');
                return;
            }
            
            const item = document.createElement('div');
            item.className = 'prerequisite-item';
            item.innerHTML = `
                <input type="text" placeholder="Description" class="prerequisite-desc">
                <div class="quick-links">
                    <div class="quick-link-item">
                        <select class="link-type">
                            <option value="recipe">Recipe Reference</option>
                            <option value="external">External Link</option>
                        </select>
                        <input type="text" placeholder="Recipe Title" class="link-title">
                        <input type="text" placeholder="Recipe ID" class="link-url">
                        <button type="button" class="btn-small remove-link">-</button>
                    </div>
                    <button type="button" class="btn-small add-link">+ Add Link</button>
                </div>
            `;
            
            const lastElement = container.lastElementChild;
            if (lastElement) {
                container.insertBefore(item, lastElement);
            } else {
                container.appendChild(item);
            }
        } catch (error) {
            console.error('Error adding prerequisite:', error);
        }
    }

    addStep() {
        try {
            const container = document.querySelector('.walkthrough-container');
            if (!container) {
                console.error('Walkthrough container not found');
                return;
            }
            
            const stepIndex = container.querySelectorAll('.step-item').length;
            const stepEl = document.createElement('div');
            stepEl.className = 'step-item';
            stepEl.dataset.stepIndex = stepIndex;
            
            stepEl.innerHTML = `
                <h3>Step ${stepIndex + 1}</h3>
                <select class="step-name">
                    ${this.generateStepOptions()}
                </select>
                
                <h4>Configuration</h4>
                <div class="config-items">
                    <div class="config-item">
                        <input type="text" placeholder="Field" class="config-field">
                        <input type="text" placeholder="Value" class="config-value">
                        <button type="button" class="btn-small remove-config">-</button>
                    </div>
                </div>
                <button type="button" class="btn-small add-config">+ Add Config</button>

                <h4>Media</h4>
                <div class="media-items">
                    <div class="media-item">
                        <select class="media-type">
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                        </select>
                        <div class="image-upload-area">
                            <input type="file" class="image-upload" accept="image/*">
                            <div class="upload-placeholder">Click or drag to upload image</div>
                            <img class="image-preview" style="display: none;">
                        </div>
                        <input type="text" placeholder="Alt Text" class="media-alt">
                        <button type="button" class="btn-small remove-media">-</button>
                    </div>
                </div>
                <button type="button" class="btn-small add-media">+ Add Media</button>
            `;
            
            container.appendChild(stepEl);
        } catch (error) {
            console.error('Error adding step:', error);
        }
    }

    addConfig(button) {
        try {
            const container = button.previousElementSibling;
            if (!container) {
                console.error('Config container not found');
                return;
            }
            
            const configItem = document.createElement('div');
            configItem.className = 'config-item';
            configItem.innerHTML = `
                <input type="text" placeholder="Field" class="config-field">
                <input type="text" placeholder="Value" class="config-value">
                <button type="button" class="btn-small remove-config">-</button>
            `;
            container.appendChild(configItem);
        } catch (error) {
            console.error('Error adding config:', error);
        }
    }

    async addMedia(button) {
        try {
            const container = button.previousElementSibling;
            if (!container) {
                console.error('Media container not found');
                return;
            }
            
            await this.createMediaItem(container);
        } catch (error) {
            console.error('Error adding media:', error);
        }
    }

    addQuickLink(button) {
        try {
            const container = button.parentElement;
            if (!container) {
                console.error('Quick link container not found');
                return;
            }
            
            const linkItem = document.createElement('div');
            linkItem.className = 'quick-link-item';
            linkItem.innerHTML = `
                <select class="link-type">
                    <option value="recipe">Recipe Reference</option>
                    <option value="external">External Link</option>
                </select>
                <input type="text" placeholder="Recipe Title" class="link-title">
                <input type="text" placeholder="Recipe ID" class="link-url">
                <button type="button" class="btn-small remove-link">-</button>
            `;
            
            container.insertBefore(linkItem, button);
        } catch (error) {
            console.error('Error adding quick link:', error);
        }
    }

    addDownloadable() {
        try {
            const container = document.querySelector('.downloadable-executables');
            if (!container) {
                console.error('Downloadable executables container not found');
                return;
            }
            
            const item = document.createElement('div');
            item.className = 'downloadable-item';
            item.innerHTML = `
                <input type="text" placeholder="File Title" class="downloadable-title">
                <input type="url" placeholder="File Link/URL" class="downloadable-url">
                <button type="button" class="btn-small remove-downloadable">-</button>
            `;
            
            const lastElement = container.lastElementChild;
            if (lastElement) {
                container.insertBefore(item, lastElement);
            } else {
                container.appendChild(item);
            }
        } catch (error) {
            console.error('Error adding downloadable:', error);
        }
    }

    addRelatedRecipe() {
        try {
            const container = document.querySelector('.related-recipes');
            if (!container) {
                console.error('Related recipes container not found');
                return;
            }
            
            const item = document.createElement('div');
            item.className = 'related-item';
            item.innerHTML = `
                <input type="text" placeholder="Recipe Title" class="related-title">
                <input type="url" placeholder="Recipe URL" class="related-url">
                <button type="button" class="btn-small remove-related">-</button>
            `;
            
            const lastElement = container.lastElementChild;
            if (lastElement) {
                container.insertBefore(item, lastElement);
            } else {
                container.appendChild(item);
            }
        } catch (error) {
            console.error('Error adding related recipe:', error);
        }
    }

    async addKeyword(keyword) {
        try {
            if (!keyword.trim()) return;
            
            this.createKeywordTag(keyword.trim());
            await this.handleInputChange();
        } catch (error) {
            console.error('Error adding keyword:', error);
            this.showError('添加关键词失败');
        }
    }

    // Content type switching
    switchContentType(contentType) {
        try {
            const recipeContent = document.querySelector('.recipe-content');
            const functionContent = document.querySelector('.function-content');
            
            if (contentType === 'function') {
                if (recipeContent) recipeContent.style.display = 'none';
                if (functionContent) functionContent.style.display = 'block';
            } else {
                if (recipeContent) recipeContent.style.display = 'block';
                if (functionContent) functionContent.style.display = 'none';
            }

            // Update current recipe type
            if (this.recipes[this.currentRecipeIndex]) {
                this.recipes[this.currentRecipeIndex].contentType = contentType;
                
                // If switching to function and current content is recipe, create new function structure
                if (contentType === 'function' && !this.recipes[this.currentRecipeIndex].parameters) {
                    const functionData = this.createEmptyFunction();
                    // Preserve common fields
                    functionData.id = this.recipes[this.currentRecipeIndex].id;
                    functionData.title = this.recipes[this.currentRecipeIndex].title || '';
                    this.recipes[this.currentRecipeIndex] = functionData;
                }
                
                this.loadCurrentContent();
                this.debouncedUpdatePreview();
            }
        } catch (error) {
            console.error('Error switching content type:', error);
        }
    }

    // Mode switching functionality
    switchMode(mode) {
        try {
            this.currentMode = mode;
            
            // Update mode buttons
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.mode === mode) {
                    btn.classList.add('active');
                }
            });
            
            // Update add tab button text
            const addTabBtn = document.querySelector('.add-tab');
            if (addTabBtn) {
                addTabBtn.textContent = mode === 'function' ? '+ Add New Function' : '+ Add New Recipe';
            }
            
            // Filter and render tabs based on new mode
            this.filterAndRenderTabs();
            
            // Update all existing content to show/hide based on mode
            this.updateContentVisibility();
            
            // Update JSON preview
            this.debouncedUpdatePreview();
            
            // Save mode to localStorage
            localStorage.setItem('currentMode', mode);
            
        } catch (error) {
            console.error('Error switching mode:', error);
        }
    }

    // Update content visibility based on current mode
    updateContentVisibility() {
        try {
            const recipeContent = document.querySelector('.recipe-content');
            const functionContent = document.querySelector('.function-content');
            
            if (this.currentMode === 'function') {
                if (recipeContent) recipeContent.style.display = 'none';
                if (functionContent) functionContent.style.display = 'block';
            } else {
                if (recipeContent) recipeContent.style.display = 'block';
                if (functionContent) functionContent.style.display = 'none';
            }
        } catch (error) {
            console.error('Error updating content visibility:', error);
        }
    }

    // Sync UI with current mode
    syncModeUI() {
        try {
            // Update mode buttons
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.mode === this.currentMode) {
                    btn.classList.add('active');
                }
            });
            
            // Update add tab button text
            const addTabBtn = document.querySelector('.add-tab');
            if (addTabBtn) {
                addTabBtn.textContent = this.currentMode === 'function' ? '+ Add New Function' : '+ Add New Recipe';
            }
            
            // Filter and render tabs based on current mode
            this.filterAndRenderTabs();
            
            // Update content visibility
            this.updateContentVisibility();
            
        } catch (error) {
            console.error('Error syncing mode UI:', error);
        }
    }

    // Filter and render tabs based on current mode
    filterAndRenderTabs() {
        try {
            const tabsContainer = document.querySelector('.tabs');
            if (!tabsContainer) return;

            // Get filtered recipes based on current mode
            const filteredRecipes = this.recipes.filter(recipe => 
                recipe.contentType === this.currentMode
            );

            // Clear existing tabs (but preserve add button)
            const addButton = tabsContainer.querySelector('.add-tab');
            tabsContainer.innerHTML = '';

            // Create tabs for filtered recipes
            let activeTabFound = false;
            filteredRecipes.forEach((recipe, filteredIndex) => {
                // Find original index in the recipes array
                const originalIndex = this.recipes.indexOf(recipe);
                
                const tab = document.createElement('div');
                tab.className = 'tab';
                tab.dataset.recipeIndex = originalIndex;
                
                // Check if this should be the active tab
                if (originalIndex === this.currentRecipeIndex || 
                    (!activeTabFound && filteredIndex === 0)) {
                    tab.classList.add('active');
                    this.currentRecipeIndex = originalIndex;
                    activeTabFound = true;
                }
                
                const contentTypeLabel = recipe.contentType === 'function' ? 'Function' : 'Recipe';
                tab.innerHTML = `
                    <span class="tab-title">${recipe.title || `${contentTypeLabel} ${filteredIndex + 1}`}</span>
                    <button class="close-tab" ${filteredRecipes.length === 1 ? 'style="display: none;"' : ''}>×</button>
                `;
                
                tabsContainer.appendChild(tab);
            });

            // Add back the add button
            if (addButton) {
                tabsContainer.appendChild(addButton);
            }

            // If no tabs match current mode, show empty state or switch to first available
            if (filteredRecipes.length === 0) {
                console.log('No recipes match current mode, creating new one');
                this.addNewRecipe();
                return;
            }

            // Load content for current tab
            this.loadCurrentContent();

        } catch (error) {
            console.error('Error filtering and rendering tabs:', error);
        }
    }

    // Function form management methods
    addParameter() {
        try {
            const container = document.querySelector('.parameters-container');
            if (!container) return;
            
            const item = document.createElement('div');
            item.className = 'parameter-item';
            item.innerHTML = `
                <div class="parameter-row">
                    <input type="text" placeholder="Parameter Name" class="parameter-name">
                    <input type="text" placeholder="Type" class="parameter-type">
                    <select class="parameter-required">
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                    </select>
                    <input type="text" placeholder="Description" class="parameter-description">
                    <button type="button" class="btn-small remove-parameter">-</button>
                </div>
            `;
            
            const addButton = container.querySelector('.add-parameter');
            if (addButton) {
                container.insertBefore(item, addButton);
            } else {
                container.appendChild(item);
            }
        } catch (error) {
            console.error('Error adding parameter:', error);
        }
    }

    addExample() {
        try {
            const container = document.querySelector('.examples-container');
            if (!container) return;
            
            const item = document.createElement('div');
            item.className = 'example-item';
            item.innerHTML = `
                <textarea placeholder="Enter example" class="example-text" rows="2"></textarea>
                <button type="button" class="btn-small remove-example">-</button>
            `;
            
            const addButton = container.querySelector('.add-example');
            if (addButton) {
                container.insertBefore(item, addButton);
            } else {
                container.appendChild(item);
            }
        } catch (error) {
            console.error('Error adding example:', error);
        }
    }

    addTip() {
        try {
            const container = document.querySelector('.tips-container');
            if (!container) return;
            
            const item = document.createElement('div');
            item.className = 'tip-item';
            item.innerHTML = `
                <div class="tip-content">
                    <textarea placeholder="Enter tip" class="tip-text" rows="2"></textarea>
                    <div class="tip-controls">
                        <button type="button" class="tip-btn add-child" title="Add sub-tip">+</button>
                        <button type="button" class="tip-btn remove" title="Remove">×</button>
                    </div>
                </div>
                <div class="tip-children"></div>
            `;
            
            const addButton = container.querySelector('.add-tip');
            if (addButton) {
                container.insertBefore(item, addButton);
            } else {
                container.appendChild(item);
            }
        } catch (error) {
            console.error('Error adding tip:', error);
        }
    }

    addChildTip(button) {
        try {
            const tipItem = button.closest('.tip-item');
            if (!tipItem) return;
            
            const childrenContainer = tipItem.querySelector('.tip-children');
            if (!childrenContainer) return;
            
            // Check nesting depth
            let depth = 0;
            let parent = tipItem;
            while (parent && parent.classList.contains('tip-item')) {
                depth++;
                parent = parent.parentElement.closest('.tip-item');
            }
            
            if (depth >= 3) {
                alert('Maximum 3 levels allowed');
                return;
            }
            
            const childTip = document.createElement('div');
            childTip.className = 'tip-item';
            childTip.innerHTML = `
                <div class="tip-content">
                    <textarea placeholder="Enter sub-tip" class="tip-text" rows="2"></textarea>
                    <div class="tip-controls">
                        ${depth < 2 ? '<button type="button" class="tip-btn add-child" title="Add sub-tip">+</button>' : ''}
                        <button type="button" class="tip-btn remove" title="Remove">×</button>
                    </div>
                </div>
                <div class="tip-children"></div>
            `;
            
            childrenContainer.appendChild(childTip);
            
            // Focus on the new textarea
            const newTextarea = childTip.querySelector('.tip-text');
            if (newTextarea) {
                newTextarea.focus();
            }
        } catch (error) {
            console.error('Error adding child tip:', error);
        }
    }

    // Load current content based on content type
    loadCurrentContent() {
        try {
            const currentContent = this.recipes[this.currentRecipeIndex];
            if (!currentContent) return;

            // Show/hide appropriate content sections based on current mode
            this.updateContentVisibility();

            if (currentContent.contentType === 'function') {
                this.loadFunctionData(currentContent);
            } else {
                this.loadRecipeData(currentContent);
            }
        } catch (error) {
            console.error('Error loading current content:', error);
        }
    }

    // Load function data into form
    loadFunctionData(functionData) {
        try {
            // Basic function information
            const titleEl = document.getElementById('function-title');
            const descEl = document.getElementById('function-description');
            const syntaxEl = document.getElementById('function-syntax');
            const relatedFormulaEl = document.getElementById('related-formula');

            if (titleEl) titleEl.value = functionData.title || '';
            if (descEl) descEl.value = functionData.description || '';
            if (syntaxEl) syntaxEl.value = functionData.syntax || '';
            if (relatedFormulaEl) relatedFormulaEl.value = Array.isArray(functionData.relatedFormula) ? functionData.relatedFormula.join(', ') : (functionData.relatedFormula || '');

            // Load parameters
            this.loadParameters(functionData.parameters || []);

            // Load examples
            this.loadExamples(functionData.examples || []);

            // Load tips
            this.loadTips(functionData.tips || []);

            this.updateTabTitle();
        } catch (error) {
            console.error('Error loading function data:', error);
        }
    }

    loadParameters(parameters) {
        const container = document.querySelector('.parameters-container');
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Add each parameter
        parameters.forEach(param => {
            const item = document.createElement('div');
            item.className = 'parameter-item';
            item.innerHTML = `
                <div class="parameter-row">
                    <input type="text" placeholder="Parameter Name" class="parameter-name" value="${param.name || ''}">
                    <input type="text" placeholder="Type" class="parameter-type" value="${param.type || ''}">
                    <select class="parameter-required">
                        <option value="Yes" ${param.required === 'Yes' ? 'selected' : ''}>Yes</option>
                        <option value="No" ${param.required === 'No' ? 'selected' : ''}>No</option>
                    </select>
                    <input type="text" placeholder="Description" class="parameter-description" value="${param.description || ''}">
                    <button type="button" class="btn-small remove-parameter">-</button>
                </div>
            `;
            container.appendChild(item);
        });

        // Add button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-secondary add-parameter';
        addBtn.textContent = '+ Add Parameter';
        container.appendChild(addBtn);
    }

    loadExamples(examples) {
        const container = document.querySelector('.examples-container');
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Add each example
        examples.forEach(example => {
            const item = document.createElement('div');
            item.className = 'example-item';
            item.innerHTML = `
                <textarea placeholder="Enter example" class="example-text" rows="2">${example || ''}</textarea>
                <button type="button" class="btn-small remove-example">-</button>
            `;
            container.appendChild(item);
        });

        // Add button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-secondary add-example';
        addBtn.textContent = '+ Add Example';
        container.appendChild(addBtn);
    }

    loadTips(tips) {
        const container = document.querySelector('.tips-container');
        if (!container) return;

        // Clear existing content
        container.innerHTML = '';

        // Add each tip with children support
        tips.forEach(tip => {
            const tipElement = this.createTipElement(tip, 0);
            container.appendChild(tipElement);
        });

        // Add button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn-secondary add-tip';
        addBtn.textContent = '+ Add Tip';
        container.appendChild(addBtn);
    }

    createTipElement(tip, level = 0) {
        const item = document.createElement('div');
        item.className = 'tip-item';
        
        item.innerHTML = `
            <div class="tip-content">
                <textarea placeholder="Enter tip" class="tip-text" rows="2">${tip.text || ''}</textarea>
                <div class="tip-controls">
                    ${level < 2 ? '<button type="button" class="tip-btn add-child" title="Add sub-tip">+</button>' : ''}
                    <button type="button" class="tip-btn remove" title="Remove">×</button>
                </div>
            </div>
            <div class="tip-children"></div>
        `;

        // Add children if they exist
        if (tip.children && tip.children.length > 0) {
            const childrenContainer = item.querySelector('.tip-children');
            tip.children.forEach(childTip => {
                const childElement = this.createTipElement(childTip, level + 1);
                childrenContainer.appendChild(childElement);
            });
        }

        return item;
    }

    updateLinkFields(selectElement) {
        const linkItem = selectElement.closest('.quick-link-item');
        const titleInput = linkItem.querySelector('.link-title');
        const urlInput = linkItem.querySelector('.link-url');
        
        if (selectElement.value === 'recipe') {
            titleInput.placeholder = 'Recipe Title';
            urlInput.placeholder = 'Recipe ID';
            urlInput.type = 'text';
        } else {
            titleInput.placeholder = 'Link Title';
            urlInput.placeholder = 'Link URL';
            urlInput.type = 'url';
        }
        
        this.handleInputChange();
    }

    toggleMediaType(selectElement) {
        const mediaItem = selectElement.closest('.media-item');
        if (!mediaItem) return;

        const selectedType = selectElement.value;
        const imageUploadArea = mediaItem.querySelector('.image-upload-area');
        const videoUrlArea = mediaItem.querySelector('.video-url-area');
        
        if (selectedType === 'video') {
            // Show video URL area, hide image upload area
            imageUploadArea.style.display = 'none';
            videoUrlArea.style.display = 'block';
            
            // Clear image data when switching to video
            const preview = imageUploadArea.querySelector('.image-preview');
            const fileInput = imageUploadArea.querySelector('.image-upload');
            const removeBtn = imageUploadArea.querySelector('.image-remove-btn');
            const placeholder = imageUploadArea.querySelector('.upload-placeholder');
            
            if (preview && preview.dataset.fileName) {
                // Remove from IndexedDB if there was an image
                const fileName = preview.dataset.fileName;
                const imageKey = fileName.replace(/\.[^/.]+$/, '');
                this.imageStorage.deleteImage(imageKey).catch(console.error);
                
                preview.src = '';
                preview.style.display = 'none';
                delete preview.dataset.fileName;
            }
            
            if (fileInput) fileInput.value = '';
            if (removeBtn) removeBtn.remove();
            if (placeholder) placeholder.style.display = 'block';
            
        } else if (selectedType === 'image') {
            // Show image upload area, hide video URL area  
            imageUploadArea.style.display = 'block';
            videoUrlArea.style.display = 'none';
            
            // Clear video URL when switching to image
            const videoUrlInput = videoUrlArea.querySelector('.video-url');
            if (videoUrlInput) videoUrlInput.value = '';
        }
        
        // Trigger data save
        this.handleInputChange();
    }

    createKeywordTag(keyword) {
        const container = document.querySelector('.keywords-list');
        const tag = document.createElement('div');
        tag.className = 'keyword-tag';
        tag.innerHTML = `
            ${keyword}
            <button class="keyword-remove-btn">×</button>
        `;
        container.appendChild(tag);
    }

    async handleImageUpload(input) {
        const file = input.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }
        
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            alert('Image file is too large. Please select a file smaller than 10MB');
            return;
        }
        
        try {
            this.showLoading();
            
            // Generate meaningful image name based on content
            const fileName = this.generateImageName(file, input.parentElement);
            const extension = file.name.split('.').pop() || 'jpg';
            const fullFileName = `${fileName}.${extension}`;
            
            // Store image in IndexedDB with the full filename as key
            // This ensures consistency between storage and retrieval
            await this.imageStorage.storeImage(fullFileName, file);
            
            // Create object URL for preview
            const imageUrl = URL.createObjectURL(file);
            
            // Update UI
            const uploadArea = input.parentElement;
            const preview = uploadArea.querySelector('.image-preview');
            const placeholder = uploadArea.querySelector('.upload-placeholder');
            
            preview.src = imageUrl;
            preview.dataset.fileName = fullFileName; // Store full filename for reference
            preview.dataset.imageKey = fullFileName; // Store the IndexedDB key for easy retrieval
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            
            console.log(`Image uploaded successfully: ${fullFileName} stored with key: ${fullFileName}`);
            
            // Add remove button if it doesn't exist
            if (!uploadArea.querySelector('.image-remove-btn')) {
                const removeBtn = document.createElement('button');
                removeBtn.className = 'image-remove-btn';
                removeBtn.title = 'Remove image';
                removeBtn.innerHTML = '×';
                uploadArea.appendChild(removeBtn);
            }
            
            // Use debounced version for better performance
            await this.handleInputChange();
        } catch (error) {
            console.error('Image upload error:', error);
            alert('Failed to upload image: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async resetImageUpload(preview) {
        await this.removeImageFromPreview(preview);
    }
    
    async removeImageFromPreview(preview) {
        try {
            const uploadArea = preview.closest('.image-upload-area');
            if (!uploadArea) return;

            const placeholder = uploadArea.querySelector('.upload-placeholder');
            const fileInput = uploadArea.querySelector('.image-upload');
            const removeBtn = uploadArea.querySelector('.image-remove-btn');
            
            // Clear the preview
            preview.src = '';
            preview.style.display = 'none';
            delete preview.dataset.fileName;
            
            // Hide remove button
            if (removeBtn) {
                removeBtn.remove();
            }
            
            // Show placeholder
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
            
            // Clear file input
            if (fileInput) {
                fileInput.value = '';
            }
            
            // Update data
            await this.handleInputChange();
            
            this.showTemporaryMessage('图片已移除', 'info', 2000);
        } catch (error) {
            console.error('Error removing image:', error);
            this.showTemporaryMessage('移除图片失败', 'error');
        }
    }

    async handleInputChange() {
        try {
            await this.saveCurrentRecipeData();
            
            // Mark that we have unsaved changes
            this.hasUnsavedChanges = true;
            
            // Update preview immediately for better UX, with minimal debounce
            this.debouncedUpdatePreview();
            this.updateTabTitle(); // This is fast, no need to debounce
            this.debouncedSaveToLocalStorage();
        } catch (error) {
            console.error('Error in handleInputChange:', error);
            // Don't show error message here as it would be too frequent
        }
    }
    
    // Update image names when content changes
    async updateImageNamesForContentChange(changeType, oldValue, newValue) {
        try {
            const currentRecipe = this.recipes[this.currentRecipeIndex];
            if (!currentRecipe.walkthrough) return;
            
            let needsUpdate = false;
            
            for (const step of currentRecipe.walkthrough) {
                if (step.media) {
                    for (const media of step.media) {
                        if (media.url && media.url.startsWith('images/')) {
                            // Extract current filename and key
                            const currentFileName = media.url.replace('images/', '');
                            const currentKey = currentFileName.replace(/\.[^/.]+$/, '');
                            
                            // Generate new name based on current content
                            const stepElement = document.querySelector(`[data-step-index]`);
                            if (stepElement) {
                                const file = await this.imageStorage.getImage(currentKey);
                                if (file) {
                                    const newKey = this.generateImageName(file, stepElement.querySelector('.image-upload-area'));
                                    
                                    if (currentKey !== newKey) {
                                        // Update IndexedDB with new key
                                        const extension = currentFileName.split('.').pop() || 'jpg';
                                        const newFileName = `${newKey}.${extension}`;
                                        
                                        await this.imageStorage.storeImage(newKey, file);
                                        await this.imageStorage.deleteImage(currentKey);
                                        
                                        // Update media reference
                                        media.url = `images/${newFileName}`;
                                        needsUpdate = true;
                                        
                                        // Update DOM if needed
                                        const preview = document.querySelector(`[data-file-name="${currentFileName}"]`);
                                        if (preview) {
                                            preview.dataset.fileName = newFileName;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            if (needsUpdate) {
                await this.saveCurrentRecipeData();
                console.log('Updated image names due to content change');
            }
        } catch (error) {
            console.error('Error updating image names:', error);
        }
    }

    updateTabTitle() {
        try {
            const currentContent = this.recipes[this.currentRecipeIndex];
            let title = '';
            
            if (currentContent?.contentType === 'function') {
                const titleEl = document.getElementById('function-title');
                title = titleEl ? titleEl.value : '';
            } else {
                const titleEl = document.getElementById('title');
                title = titleEl ? titleEl.value : '';
            }
            
            const tab = document.querySelector(`[data-recipe-index="${this.currentRecipeIndex}"] .tab-title`);
            if (tab) {
                const contentTypeLabel = currentContent?.contentType === 'function' ? 'Function' : 'Recipe';
                tab.textContent = title || `${contentTypeLabel} ${this.currentRecipeIndex + 1}`;
            }
        } catch (error) {
            console.error('Error updating tab title:', error);
        }
    }

    // Clean recipe data for export (remove internal fields)
    cleanRecipeForExport(recipe) {
        try {
            if (!recipe) return null;
            
            // Create a deep copy to avoid modifying original data
            const cleanRecipe = JSON.parse(JSON.stringify(recipe));
            
            // Always remove contentType field (internal use only)
            delete cleanRecipe.contentType;
            
            // For function type, also remove id field
            if (recipe.contentType === 'function') {
                delete cleanRecipe.id;
            }
            
            return cleanRecipe;
        } catch (error) {
            console.error('Error cleaning recipe for export:', error);
            return recipe; // Return original if cleaning fails
        }
    }

    updatePreview() {
        try {
            const recipe = this.recipes[this.currentRecipeIndex];
            if (!recipe) {
                console.warn('No recipe found for preview at index:', this.currentRecipeIndex);
                return;
            }
            
            // Use the same cleaning logic as export
            const cleanRecipe = this.cleanRecipeForExport(recipe);
            
            const previewEl = document.getElementById('json-preview');
            if (previewEl) {
                previewEl.textContent = JSON.stringify(cleanRecipe, null, 2);
            }
        } catch (error) {
            console.error('Error updating preview:', error);
            const previewEl = document.getElementById('json-preview');
            if (previewEl) {
                previewEl.textContent = '{预览错误: 无法生成JSON预览}';
            }
        }
    }

    async saveCurrentRecipe() {
        await this.saveCurrentRecipeData();
        const recipe = this.recipes[this.currentRecipeIndex];
        
        if (!recipe.title) {
            alert('Please enter a recipe title');
            return;
        }
        
        try {
            this.showLoading();
            
            alert('Recipe saved successfully! (saved to local storage)');
            this.updateRecipesStatus();
        } catch (error) {
            alert('Save failed: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async generateAllRecipes() {
        console.log('=== Starting recipe generation process ===');
        console.log('generateAllRecipes called');
        await this.saveCurrentRecipeData();
        
        console.log('Total recipes:', this.recipes.length);
        const validRecipes = this.recipes.filter(r => r.title);
        console.log('Valid recipes (with title):', validRecipes.length);
        
        // Log detailed recipe information
        validRecipes.forEach((recipe, index) => {
            console.log(`Recipe ${index + 1}: ${recipe.title}`);
            if (recipe.walkthrough) {
                const imageCount = recipe.walkthrough.reduce((count, step) => {
                    if (step.media) {
                        return count + step.media.filter(m => m.type === 'image' && m.url).length;
                    }
                    return count;
                }, 0);
                console.log(`  - Contains ${imageCount} images`);
            }
        });
        
        if (validRecipes.length === 0) {
            console.warn('No valid recipes found');
            alert('请至少输入一个recipe标题才能生成下载文件');
            return;
        }
        
        console.log('JSZip available flag:', this.jsZipAvailable);
        console.log('JSZip type check:', typeof JSZip);
        
        try {
            this.showLoading();
            
            // Check if JSZip is available
            if (!this.jsZipAvailable || typeof JSZip === 'undefined') {
                throw new Error('ZIP导出功能不可用：JSZip库未加载。请刷新页面或检查网络连接后重试。');
            }
            
            console.log('JSZip available, creating ZIP archive...');
            
            const zip = new JSZip();
            let totalImagesProcessed = 0;
            let totalImagesFound = 0;
            
            for (const recipe of validRecipes) {
                console.log(`\n=== Processing ${recipe.contentType || 'recipe'}: ${recipe.title} ===`);
                
                // Process recipe data using unified cleaning method
                const processedRecipe = this.cleanRecipeForExport(recipe);

                // Handle function type with simplified structure (no folders)
                if (recipe.contentType === 'function') {
                    console.log('Function type detected - using simplified export structure');
                    
                    // Generate function filename
                    const sanitizedTitle = recipe.title.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
                    const functionFileName = `${sanitizedTitle}.json`;
                    
                    // Add function JSON directly to ZIP root
                    zip.file(functionFileName, JSON.stringify(processedRecipe, null, 2));
                    console.log(`Function exported as: ${functionFileName}`);
                    
                    continue; // Skip the rest of the loop for functions
                }

                // Recipe type processing (original logic with folders and images)
                const recipeId = recipe.id.replace(/\s+/g, '-').toLowerCase();
                console.log(`Recipe ID: ${recipeId}`);
                
                const recipeFolder = zip.folder(recipeId);
                const imagesFolder = recipeFolder.folder('images');
                let recipeImageCount = 0;
                let recipeImageSuccess = 0;
                
                if (recipe.walkthrough && Array.isArray(recipe.walkthrough)) {
                    for (let stepIndex = 0; stepIndex < recipe.walkthrough.length; stepIndex++) {
                        const step = recipe.walkthrough[stepIndex];
                        console.log(`  Step ${stepIndex + 1}: ${step.step || '(unnamed)'}`);
                        
                        if (step.media && Array.isArray(step.media)) {
                            for (let mediaIndex = 0; mediaIndex < step.media.length; mediaIndex++) {
                                const media = step.media[mediaIndex];
                                if (media.url && media.url.startsWith('images/') && media.type === 'image') {
                                    recipeImageCount++;
                                    totalImagesFound++;
                                    
                                    try {
                                        console.log(`    Processing image ${mediaIndex + 1}: ${media.url}, imageKey: ${media.imageKey}`);
                                        
                                        const fileName = media.url.replace('images/', '');
                                        // Use the stored imageKey if available, otherwise fallback to filename
                                        const imageKey = media.imageKey || fileName;
                                        
                                        console.log(`    Attempting to retrieve image with key: ${imageKey}`);
                                        const imageFile = await this.imageStorage.getImage(imageKey);
                                        
                                        if (imageFile) {
                                            console.log(`    ✓ Successfully retrieved image: ${fileName}, size: ${imageFile.size} bytes`);
                                            imagesFolder.file(fileName, imageFile);
                                            recipeImageSuccess++;
                                            totalImagesProcessed++;
                                        } else {
                                            console.warn(`    ✗ Image not found in IndexedDB: key=${imageKey}, fileName=${fileName}`);
                                            // Try alternative key strategies as fallback
                                            const alternativeKeys = [
                                                fileName.replace(/\.[^/.]+$/, ''), // Remove extension
                                                fileName, // Use full filename
                                                media.imageKey // Use original imageKey if different
                                            ].filter((key, index, arr) => key && arr.indexOf(key) === index); // Remove duplicates
                                            
                                            for (const altKey of alternativeKeys) {
                                                if (altKey !== imageKey) { // Don't retry the same key
                                                    console.log(`    Trying alternative key: ${altKey}`);
                                                    const altImageFile = await this.imageStorage.getImage(altKey);
                                                    if (altImageFile) {
                                                        console.log(`    ✓ Found image with alternative key: ${altKey}`);
                                                        imagesFolder.file(fileName, altImageFile);
                                                        recipeImageSuccess++;
                                                        totalImagesProcessed++;
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                    } catch (error) {
                                        console.error(`    ✗ Failed to process image ${media.url}: ${error.message}`);
                                    }
                                }
                            }
                        }
                    }
                }
                
                console.log(`  Recipe summary: ${recipeImageSuccess}/${recipeImageCount} images processed successfully`);
                
                // Add recipe.json file (functions are handled separately above)
                recipeFolder.file('recipe.json', JSON.stringify(processedRecipe, null, 2));
            }
            
            console.log(`=== ZIP Generation Summary ===`);
            console.log(`Total recipes processed: ${validRecipes.length}`);
            console.log(`Total images found: ${totalImagesFound}`);
            console.log(`Total images successfully added to ZIP: ${totalImagesProcessed}`);
            
            if (totalImagesFound > 0 && totalImagesProcessed === 0) {
                console.warn('Warning: No images were successfully added to the ZIP file. This may indicate an IndexedDB retrieval issue.');
            }
            
            // Generate ZIP file
            console.log('Generating ZIP file...');
            const content = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 6
                }
            });
            
            console.log(`ZIP file generated successfully. Size: ${content.size} bytes`);
            
            // Create download link
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const fileName = `recipes-batch-${timestamp}.zip`;
            
            const url = URL.createObjectURL(content);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log(`Download initiated: ${fileName}`);
            
            // Show success message with details
            const successMessage = `成功生成ZIP文件！\n包含 ${validRecipes.length} 个recipes\n${totalImagesProcessed}/${totalImagesFound} 个图片`;
            alert(successMessage);
            
            setTimeout(() => {
                if (confirm('是否要清理临时文件？')) {
                    this.cleanupSession();
                }
            }, 1000);
            
        } catch (error) {
            console.error('=== Generation Error ===', error);
            console.error('Error stack:', error.stack);
            
            let errorMessage = 'ZIP文件生成失败：' + error.message;
            if (error.message.includes('JSZip')) {
                errorMessage += '\n\n建议：请刷新页面后重试';
            } else if (error.message.includes('IndexedDB')) {
                errorMessage += '\n\n建议：请检查浏览器的IndexedDB支持';
            }
            
            alert(errorMessage);
        } finally {
            this.hideLoading();
        }
    }

    async cleanupSession() {
        try {
            await this.imageStorage.clearAll();
            localStorage.removeItem('recipeProducerData');
            location.reload();
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }

    async handleZipUpload(input) {
        console.log('handleZipUpload called', input);
        const file = input.files[0];
        console.log('Selected file:', file);
        
        if (!file) {
            console.log('No file selected');
            return;
        }
        
        if (!file.name.endsWith('.zip')) {
            console.log('Not a ZIP file:', file.name);
            this.showUploadStatus('error', 'Please select a ZIP file');
            return;
        }
        
        console.log('Processing ZIP file:', file.name);
        
        try {
            this.showLoading();
            this.showUploadStatus('info', `Processing ${file.name}...`);
            await this.processZipFile(file);
        } catch (error) {
            console.error('ZIP upload error:', error);
            this.showUploadStatus('error', `Failed to import ZIP: ${error.message}`);
        } finally {
            this.hideLoading();
            input.value = '';
        }
    }
    
    async processZipFile(file) {
        console.log('processZipFile called');
        
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            console.error('JSZip is not defined');
            throw new Error('JSZip library is not loaded. Please refresh the page and try again.');
        }
        
        console.log('JSZip is available, version:', JSZip.version || 'unknown');
        
        const zip = new JSZip();
        console.log('Loading ZIP file...');
        const content = await zip.loadAsync(file);
        console.log('ZIP loaded, files:', Object.keys(content.files));
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        const recipePromises = [];
        
        // Process each folder in the ZIP
        for (const [path, zipEntry] of Object.entries(content.files)) {
            if (zipEntry.dir) continue;
            
            // Check if this is a recipe.json file
            if (path.endsWith('recipe.json')) {
                const folderName = path.split('/')[0];
                recipePromises.push(this.processZipRecipe(content, folderName, path, errors));
            }
        }
        
        // Wait for all recipes to be processed
        const results = await Promise.all(recipePromises);
        results.forEach(result => {
            if (result.success) successCount++;
            else errorCount++;
        });
        
        // Show status
        let message = `ZIP import completed: ${successCount} recipes imported`;
        if (errorCount > 0) {
            message += `, ${errorCount} failed`;
        }
        
        if (errors.length > 0) {
            message += `\nErrors:\n${errors.join('\n')}`;
            this.showUploadStatus('warning', message);
        } else {
            this.showUploadStatus('success', message);
        }
        
        // Update UI
        this.updateRecipesStatus();
    }
    
    async processZipRecipe(zip, folderName, recipePath, errors) {
        try {
            // Extract recipe JSON
            const recipeText = await zip.file(recipePath).async('string');
            const recipeData = JSON.parse(recipeText);
            
            // Validate recipe data
            const validation = this.validateRecipeData(recipeData);
            if (!validation.valid) {
                errors.push(`${folderName}: ${validation.error}`);
                return { success: false };
            }
            
            // Process images in the recipe
            if (recipeData.walkthrough && Array.isArray(recipeData.walkthrough)) {
                for (const step of recipeData.walkthrough) {
                    if (step.media && Array.isArray(step.media)) {
                        for (const media of step.media) {
                            if (media.url && media.url.startsWith('images/')) {
                                // Try to find and store the image
                                const imagePath = `${folderName}/${media.url}`;
                                const imageFile = zip.file(imagePath);
                                
                                if (imageFile) {
                                    try {
                                        const imageBlob = await imageFile.async('blob');
                                        const fileName = media.url.split('/').pop();
                                        const imageKey = fileName.replace(/\.[^/.]+$/, ''); // Remove extension for IndexedDB key
                                        const file = new File([imageBlob], fileName, { type: this.getMimeType(fileName) });
                                        
                                        // Store in IndexedDB using filename without extension as key
                                        await this.imageStorage.storeImage(imageKey, file);
                                        
                                        // URL is already correctly set, keep it as is
                                    } catch (imgError) {
                                        console.error(`Failed to process image ${imagePath}:`, imgError);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // Add recipe to the collection
            await this.addRecipeFromUpload(recipeData, folderName);
            return { success: true };
            
        } catch (error) {
            errors.push(`${folderName}: ${error.message}`);
            return { success: false };
        }
    }
    
    getMimeType(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        };
        return mimeTypes[ext] || 'image/jpeg';
    }
    
    // Generate meaningful image name based on recipe content
    generateImageName(file, uploadArea) {
        try {
            const currentRecipe = this.recipes[this.currentRecipeIndex];
            const category = this.createSafeString(currentRecipe.category || 'uncategorized');
            
            // Find the current step
            const stepElement = uploadArea.closest('.step-item');
            const stepName = stepElement ? 
                this.createSafeString(stepElement.querySelector('.step-name')?.value || 'step') : 
                'step';
            
            // Get alt text
            const altInput = uploadArea.parentElement.querySelector('.media-alt');
            const altText = this.createSafeString(altInput?.value || 'image');
            
            // Get file extension
            const extension = file.name.split('.').pop().toLowerCase();
            
            // Create base name
            const baseName = `${category}-${stepName}-${altText}`;
            
            // Ensure unique name
            return this.ensureUniqueImageName(baseName, extension);
        } catch (error) {
            console.error('Error generating image name:', error);
            // Fallback to timestamp-based naming
            return `image-${Date.now()}`;
        }
    }
    
    // Create safe filename string
    createSafeString(text) {
        if (!text || typeof text !== 'string') return 'unnamed';
        
        return text
            .toLowerCase()
            .trim()
            .replace(/[/\\?<>\\:*|"]/g, '') // Remove invalid filename characters
            .replace(/[^\w\s-]/g, '') // Keep only word characters, spaces, and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
            .substring(0, 30) // Limit length
            || 'unnamed';
    }
    
    // Ensure unique image name within current recipe
    ensureUniqueImageName(baseName, extension) {
        const currentRecipe = this.recipes[this.currentRecipeIndex];
        const usedNames = new Set();
        
        // Collect all existing image names in current recipe
        if (currentRecipe.walkthrough) {
            currentRecipe.walkthrough.forEach(step => {
                if (step.media) {
                    step.media.forEach(media => {
                        if (media.url && media.url.startsWith('images/')) {
                            const fileName = media.url.replace('images/', '');
                            const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
                            usedNames.add(nameWithoutExt);
                        }
                    });
                }
            });
        }
        
        // Check if base name is unique
        let finalName = baseName;
        let counter = 1;
        
        while (usedNames.has(finalName)) {
            finalName = `${baseName}-${++counter}`;
        }
        
        return finalName;
    }
    
    openImagePreview(imageElement) {
        if (!imageElement.src || imageElement.src === '') return;
        
        const modal = document.getElementById('image-preview-modal');
        const largeImage = document.getElementById('image-preview-large');
        
        largeImage.src = imageElement.src;
        this.resetZoom();
        modal.style.display = 'flex';
        
        // Prevent body scrolling when modal is open
        document.body.style.overflow = 'hidden';
    }
    
    closeImagePreview() {
        const modal = document.getElementById('image-preview-modal');
        modal.style.display = 'none';
        this.resetZoom();
        
        // Restore body scrolling
        document.body.style.overflow = 'auto';
    }
    
    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel * 1.2, 5);
        this.applyZoom();
    }
    
    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel / 1.2, 0.2);
        this.applyZoom();
    }
    
    resetZoom() {
        this.zoomLevel = 1;
        this.applyZoom();
    }
    
    applyZoom() {
        const largeImage = document.getElementById('image-preview-large');
        largeImage.style.transform = `scale(${this.zoomLevel})`;
    }

    updateRecipesStatus() {
        const container = document.getElementById('recipes-status');
        container.innerHTML = '';
        
        this.recipes.forEach((recipe, index) => {
            if (recipe.title) {
                const item = document.createElement('div');
                item.className = 'recipe-status-item';
                item.innerHTML = `
                    <h4>${recipe.title}</h4>
                    <p>Category: ${recipe.category || 'Not set'}</p>
                    <p>Steps: ${recipe.walkthrough.filter(s => s.step).length}</p>
                `;
                container.appendChild(item);
            }
        });
    }

    saveToLocalStorage() {
        try {
            const data = {
                sessionId: this.sessionId,
                recipes: this.recipes,
                currentRecipeIndex: this.currentRecipeIndex,
                imageCounter: this.imageCounter
            };
            
            const dataString = JSON.stringify(data);
            
            // Check if data has actually changed
            if (this.lastSavedState !== dataString) {
                localStorage.setItem('recipeProducerData', dataString);
                this.lastSavedState = dataString;
                this.hasUnsavedChanges = false;
                console.log('Data saved to localStorage');
            }
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            this.showError('保存数据失败');
        }
    }

    async loadFromLocalStorage() {
        // Load saved mode
        const savedMode = localStorage.getItem('currentMode');
        if (savedMode && (savedMode === 'recipe' || savedMode === 'function')) {
            this.currentMode = savedMode;
        }
        
        const saved = localStorage.getItem('recipeProducerData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.recipes && data.recipes.length > 0) {
                    this.recipes = data.recipes;
                    this.currentRecipeIndex = data.currentRecipeIndex || 0;
                    this.imageCounter = data.imageCounter || 0;
                    
                    // Recreate tabs
                    const tabsContainer = document.querySelector('.tabs');
                    tabsContainer.innerHTML = '';
                    
                    this.recipes.forEach((recipe, index) => {
                        const tab = document.createElement('div');
                        tab.className = 'tab' + (index === this.currentRecipeIndex ? ' active' : '');
                        tab.dataset.recipeIndex = index;
                        const contentTypeLabel = recipe.contentType === 'function' ? 'Function' : 'Recipe';
                        tab.innerHTML = `
                            <span class="tab-title">${recipe.title || `${contentTypeLabel} ${index + 1}`}</span>
                            <button class="close-tab" ${this.recipes.length === 1 ? 'style="display: none;"' : ''}>×</button>
                        `;
                        tabsContainer.appendChild(tab);
                    });
                    
                    const addBtn = document.createElement('button');
                    addBtn.className = 'add-tab';
                    addBtn.textContent = '+ Add New Recipe';
                    tabsContainer.appendChild(addBtn);
                    
                    this.loadCurrentContent();
                    this.updateRecipesStatus();
                    
                    // Update close button visibility after loading
                    this.updateCloseButtonVisibility();
                }
            } catch (error) {
                console.error('Failed to load saved data:', error);
            }
        }
        
        // Sync UI with current mode
        this.syncModeUI();
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    showTemporaryMessage(message, type = 'info', duration = 3000) {
        // Remove existing message if any
        const existingMessage = document.querySelector('.temporary-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `temporary-message ${type}`;
        messageDiv.textContent = message;
        
        // Style the message
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 300px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideInRight 0.3s ease-out;
        `;
        
        // Set color based on type
        switch (type) {
            case 'success':
                messageDiv.style.backgroundColor = '#10b981';
                break;
            case 'error':
                messageDiv.style.backgroundColor = '#ef4444';
                break;
            case 'warning':
                messageDiv.style.backgroundColor = '#f59e0b';
                break;
            default:
                messageDiv.style.backgroundColor = '#3b82f6';
        }
        
        // Add animation keyframes if not already added
        if (!document.querySelector('#temp-message-styles')) {
            const style = document.createElement('style');
            style.id = 'temp-message-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add to document
        document.body.appendChild(messageDiv);
        
        // Auto remove after duration
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, 300);
            }
        }, duration);
    }

    setupImageDragAndDrop() {
        // Use event delegation for image upload areas since they're dynamically created
        document.addEventListener('dragenter', (e) => {
            if (e.target.closest('.image-upload-area')) {
                e.preventDefault();
                e.target.closest('.image-upload-area').classList.add('drag-over');
            }
        });

        document.addEventListener('dragover', (e) => {
            if (e.target.closest('.image-upload-area')) {
                e.preventDefault();
                e.target.closest('.image-upload-area').classList.add('drag-over');
            }
        });

        document.addEventListener('dragleave', (e) => {
            const uploadArea = e.target.closest('.image-upload-area');
            if (uploadArea && !uploadArea.contains(e.relatedTarget)) {
                uploadArea.classList.remove('drag-over');
            }
        });

        document.addEventListener('drop', (e) => {
            const uploadArea = e.target.closest('.image-upload-area');
            if (uploadArea) {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    const fileInput = uploadArea.querySelector('.image-upload');
                    if (fileInput) {
                        // Create a new FileList-like object and assign to input
                        fileInput.files = files;
                        this.handleImageUpload(fileInput).catch(error => {
                            console.error('Image upload error:', error);
                            this.showTemporaryMessage('Failed to upload image: ' + error.message, 'error');
                        });
                    }
                }
            }
        });

        // Click to upload functionality
        document.addEventListener('click', (e) => {
            if (e.target.closest('.upload-placeholder')) {
                const uploadArea = e.target.closest('.image-upload-area');
                const fileInput = uploadArea?.querySelector('.image-upload');
                if (fileInput) {
                    fileInput.click();
                }
            }
            
            // Single click to preview image
            if (e.target.classList.contains('image-preview') && e.detail === 1) {
                this.openImagePreview(e.target);
            }
            
            // Double-click to remove/reset image
            if (e.target.classList.contains('image-preview') && e.detail === 2) {
                this.resetImageUpload(e.target);
            }
            
            // Image modal controls
            if (e.target.classList.contains('image-modal-close') || 
                e.target.classList.contains('image-modal-backdrop') ||
                e.target.id === 'image-preview-large') {
                this.closeImagePreview();
            }
            
            if (e.target.classList.contains('zoom-btn')) {
                const action = e.target.dataset.action;
                switch(action) {
                    case 'zoom-in':
                        this.zoomIn();
                        break;
                    case 'zoom-out':
                        this.zoomOut();
                        break;
                    case 'reset-zoom':
                        this.resetZoom();
                        break;
                }
            }
            
            // Image remove button
            if (e.target.classList.contains('image-remove-btn')) {
                const uploadArea = e.target.closest('.image-upload-area');
                const preview = uploadArea?.querySelector('.image-preview');
                if (preview) {
                    this.removeImageFromPreview(preview);
                }
            }
        });
    }

    setupDragAndDrop() {
        const uploadArea = document.getElementById('upload-area');
        
        if (!uploadArea) return;
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });
        
        // Highlight drop area when dragging over it
        ['dragenter', 'dragover'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.add('drag-over'), false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            uploadArea.addEventListener(eventName, () => uploadArea.classList.remove('drag-over'), false);
        });
        
        // Handle dropped files
        uploadArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleDroppedFiles(files);
        }, false);
        
        // Click to upload - only trigger if not clicking on a button
        uploadArea.addEventListener('click', (e) => {
            // Don't trigger if clicking on a button
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            
            // Only trigger for placeholder area
            if (e.target.closest('.upload-placeholder')) {
                if (document.getElementById('recipe-upload-bulk')) {
                    document.getElementById('recipe-upload-bulk').click();
                }
            }
        });
    }
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    async handleDroppedFiles(files) {
        const jsonFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.json'));
        
        if (jsonFiles.length === 0) {
            this.showUploadStatus('error', '请上传有效的JSON文件');
            return;
        }
        
        if (jsonFiles.length === 1) {
            await this.processSingleRecipeFile(jsonFiles[0]);
        } else {
            await this.processBulkRecipeFiles(jsonFiles);
        }
    }
    
    async handleRecipeUpload(input, isBulk) {
        const files = Array.from(input.files);
        
        if (files.length === 0) return;
        
        try {
            this.showLoading();
            
            if (isBulk || files.length > 1) {
                await this.processBulkRecipeFiles(files);
            } else {
                await this.processSingleRecipeFile(files[0]);
            }
        } catch (error) {
            this.showUploadStatus('error', `上传失败: ${error.message}`);
        } finally {
            this.hideLoading();
            input.value = ''; // Reset input
        }
    }
    
    async processSingleRecipeFile(file) {
        try {
            const text = await this.readFileAsText(file);
            const recipeData = JSON.parse(text);
            
            const validation = this.validateRecipeData(recipeData);
            if (!validation.valid) {
                this.showUploadStatus('error', `上传失败: ${validation.error}`);
                return;
            }
            
            await this.addRecipeFromUpload(recipeData, file.name);
            this.showUploadStatus('success', `成功导入recipe: ${file.name}`);
        } catch (error) {
            this.showUploadStatus('error', `上传失败: ${error.message}`);
        }
    }
    
    async processBulkRecipeFiles(files) {
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        for (const file of files) {
            try {
                // Check if this might be a ZIP file
                if (file.name.endsWith('.zip')) {
                    errors.push(`${file.name}: This is a ZIP file. Please use the "Import ZIP Archive" button instead.`);
                    errorCount++;
                    continue;
                }
                
                const text = await this.readFileAsText(file);
                const recipeData = JSON.parse(text);
                
                const validation = this.validateRecipeData(recipeData);
                if (!validation.valid) {
                    errors.push(`${file.name}: ${validation.error}`);
                    errorCount++;
                    continue;
                }
                
                await this.addRecipeFromUpload(recipeData, file.name);
                successCount++;
            } catch (error) {
                // Improve error message for common JSON parsing errors
                if (error.message.includes('Unexpected token')) {
                    if (file.name.endsWith('.zip')) {
                        errors.push(`${file.name}: Cannot parse ZIP file as JSON. Use the "Import ZIP Archive" button for ZIP files.`);
                    } else {
                        errors.push(`${file.name}: Invalid JSON format - ${error.message}`);
                    }
                } else {
                    errors.push(`${file.name}: ${error.message}`);
                }
                errorCount++;
            }
        }
        
        let message = `批量上传完成: ${successCount}个成功`;
        if (errorCount > 0) {
            message += `, ${errorCount}个失败`;
        }
        
        if (errors.length > 0) {
            message += `\n错误详情:\n${errors.join('\n')}`;
            this.showUploadStatus('info', message);
        } else {
            this.showUploadStatus('success', message);
        }
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    validateRecipeData(recipeData) {
        const requiredFields = ['title'];
        
        // Check if it's an object
        if (typeof recipeData !== 'object' || recipeData === null) {
            return { valid: false, error: 'Recipe data must be a valid JSON object' };
        }
        
        // Check required fields
        for (const field of requiredFields) {
            if (!recipeData.hasOwnProperty(field) || !recipeData[field]) {
                return { valid: false, error: `Missing required field: ${field}` };
            }
        }
        
        // Validate structure of complex fields
        if (recipeData.walkthrough && !Array.isArray(recipeData.walkthrough)) {
            return { valid: false, error: 'walkthrough must be an array' };
        }
        
        if (recipeData.prerequisites && !Array.isArray(recipeData.prerequisites)) {
            return { valid: false, error: 'prerequisites must be an array' };
        }
        
        return { valid: true };
    }
    
    async addRecipeFromUpload(recipeData, filename) {
        // Ensure recipe has required structure
        const recipe = this.normalizeRecipeData(recipeData);
        
        // Add new recipe to the recipes array
        this.recipes.push(recipe);
        const newIndex = this.recipes.length - 1;
        
        // Create new tab
        const tabsContainer = document.querySelector('.tabs');
        const addTabButton = document.querySelector('.add-tab');
        
        if (tabsContainer && addTabButton) {
            const newTab = document.createElement('div');
            newTab.className = 'tab';
            newTab.dataset.recipeIndex = newIndex;
            
            const displayTitle = recipe.title || filename.replace('.json', '') || `Recipe ${newIndex + 1}`;
            newTab.innerHTML = `
                <span class="tab-title">${displayTitle}</span>
                <button class="close-tab" ${this.recipes.length === 1 ? 'style="display: none;"' : ''}>×</button>
            `;
            
            tabsContainer.insertBefore(newTab, addTabButton);
        }
        
        // Update close button visibility
        this.updateCloseButtonVisibility();
        
        // Switch to the new recipe
        await this.switchToRecipe(newIndex);
        
        // Save to localStorage
        this.saveToLocalStorage();
        
        // Update status
        this.updateRecipesStatus();
    }
    
    normalizeRecipeData(recipeData) {
        const normalized = {
            id: recipeData.id || '',
            title: recipeData.title || '',
            category: recipeData.category || '',
            DSPVersions: Array.isArray(recipeData.DSPVersions) ? recipeData.DSPVersions : ['', ''],
            usecase: recipeData.usecase || '',
            prerequisites: Array.isArray(recipeData.prerequisites) ? recipeData.prerequisites : [{ description: '', quickLinks: [] }],
            direction: recipeData.direction || '',
            connection: recipeData.connection || '',
            walkthrough: Array.isArray(recipeData.walkthrough) ? recipeData.walkthrough : [{ step: '', config: [], media: [] }],
            downloadableExecutables: Array.isArray(recipeData.downloadableExecutables) ? recipeData.downloadableExecutables : [{ title: '', url: '' }],
            relatedRecipes: Array.isArray(recipeData.relatedRecipes) ? recipeData.relatedRecipes : [{ title: '', url: '' }],
            keywords: Array.isArray(recipeData.keywords) ? recipeData.keywords : []
        };
        
        // Ensure each section has at least one empty item if empty
        if (normalized.prerequisites.length === 0) {
            normalized.prerequisites = [{ description: '', quickLinks: [{ title: '', url: '' }] }];
        }
        
        if (normalized.walkthrough.length === 0) {
            normalized.walkthrough = [{ step: '', config: [{ field: '', value: '' }], media: [{ type: 'image', url: '', alt: '', imageId: '' }] }];
        }
        
        if (normalized.downloadableExecutables.length === 0) {
            normalized.downloadableExecutables = [{ title: '', url: '' }];
        }
        
        if (normalized.relatedRecipes.length === 0) {
            normalized.relatedRecipes = [{ title: '', url: '' }];
        }
        
        return normalized;
    }
    
    showUploadStatus(type, message) {
        const statusElement = document.getElementById('upload-status');
        if (!statusElement) return;
        
        statusElement.className = `upload-status ${type}`;
        
        // Support multi-line messages
        if (message.includes('\n')) {
            const lines = message.split('\n');
            statusElement.innerHTML = lines.map((line, index) => {
                if (index === 0) return `<strong>${line}</strong>`;
                return `<div style="margin-left: 10px; font-size: 0.9em;">${line}</div>`;
            }).join('');
        } else {
            statusElement.textContent = message;
        }
        
        statusElement.style.display = 'block';
        
        // Auto-hide after different durations based on type
        const autoHideDuration = {
            'success': 5000,
            'info': 8000,
            'warning': 10000,
            'error': null // Don't auto-hide errors
        };
        
        const duration = autoHideDuration[type];
        if (duration) {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, duration);
        }
    }
    
    showError(message) {
        console.error('Application error:', message);
        
        // Try to show in upload status first
        const statusElement = document.getElementById('upload-status');
        if (statusElement) {
            statusElement.className = 'upload-status error';
            statusElement.textContent = message;
            statusElement.style.display = 'block';
            
            // Auto-hide after 8 seconds for errors
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 8000);
        } else {
            // Fallback to alert if no status element
            alert(message);
        }
    }
    
    showSuccess(message) {
        console.log('Success:', message);
        this.showUploadStatus('success', message);
    }
    
    showInfo(message) {
        console.info('Info:', message);
        this.showUploadStatus('info', message);
    }
    
    toggleImportPanel() {
        const importContent = document.getElementById('import-content');
        const toggleIcon = document.querySelector('#import-toggle .toggle-icon');
        
        if (importContent && toggleIcon) {
            const isHidden = importContent.style.display === 'none';
            
            if (isHidden) {
                importContent.style.display = 'block';
                toggleIcon.classList.add('expanded');
            } else {
                importContent.style.display = 'none';
                toggleIcon.classList.remove('expanded');
            }
        }
    }

    toggleActionsPanel() {
        const actionsContent = document.getElementById('actions-content');
        const toggleIcon = document.querySelector('#actions-toggle .toggle-icon');
        
        if (actionsContent && toggleIcon) {
            const isHidden = actionsContent.style.display === 'none';
            
            if (isHidden) {
                actionsContent.style.display = 'block';
                toggleIcon.classList.add('expanded');
            } else {
                actionsContent.style.display = 'none';
                toggleIcon.classList.remove('expanded');
            }
        }
    }

    toggleRecipesStatusPanel() {
        const recipesStatusContent = document.getElementById('recipes-status-content');
        const toggleIcon = document.querySelector('#recipes-status-toggle .toggle-icon');
        
        if (recipesStatusContent && toggleIcon) {
            const isHidden = recipesStatusContent.style.display === 'none';
            
            if (isHidden) {
                recipesStatusContent.style.display = 'block';
                toggleIcon.classList.add('expanded');
            } else {
                recipesStatusContent.style.display = 'none';
                toggleIcon.classList.remove('expanded');
            }
        }
    }

    // Overlay Management
    openOverlay(title, templateId) {
        const overlay = document.getElementById('overlay');
        const overlayTitle = document.getElementById('overlay-title');
        const overlayContent = document.getElementById('overlay-content');
        const template = document.getElementById(templateId);
        
        if (overlay && overlayTitle && overlayContent && template) {
            overlayTitle.textContent = title;
            overlayContent.innerHTML = template.innerHTML;
            
            overlay.style.display = 'flex';
            // Trigger animation
            setTimeout(() => {
                overlay.classList.add('show');
            }, 10);
            
            // Prevent body scrolling
            document.body.style.overflow = 'hidden';
        }
    }

    closeOverlay() {
        const overlay = document.getElementById('overlay');
        
        if (overlay) {
            overlay.classList.remove('show');
            
            // Wait for animation to complete before hiding
            setTimeout(() => {
                overlay.style.display = 'none';
                document.body.style.overflow = 'auto';
            }, 300);
        }
    }
}

// Initialize the application when the page loads
let recipeProducer;

// Global helper functions for debugging and fixing issues
window.fixDownloadButton = function() {
    console.log('Attempting to fix download button...');
    
    if (!recipeProducer) {
        console.error('RecipeProducer not initialized');
        return false;
    }
    
    // Force enable the button
    const result = recipeProducer.forceEnableDownload();
    
    if (result) {
        console.log('Download button should now be enabled. Try clicking it!');
    } else {
        console.error('Failed to enable download button');
    }
    
    return result;
};

window.debugRecipeProducer = function() {
    console.log('=== Recipe Producer Debug Info ===');
    console.log('RecipeProducer exists:', !!recipeProducer);
    console.log('JSZip available:', typeof JSZip !== 'undefined');
    
    if (recipeProducer) {
        console.log('jsZipAvailable flag:', recipeProducer.jsZipAvailable);
        console.log('Recipes count:', recipeProducer.recipes.length);
        console.log('Valid recipes:', recipeProducer.recipes.filter(r => r.title).length);
    }
    
    const button = document.getElementById('generate-all');
    if (button) {
        console.log('Button disabled:', button.disabled);
        console.log('Button opacity:', button.style.opacity || '1');
        console.log('Button cursor:', button.style.cursor || 'default');
    } else {
        console.log('Button not found!');
    }
    
    console.log('=== End Debug Info ===');
};

// Add console help message
console.log('%c🔧 Recipe Producer Debug Commands:', 'color: #007bff; font-weight: bold; font-size: 14px;');
console.log('%cfixDownloadButton() - Fix the download button if it\'s not clickable', 'color: #28a745;');
console.log('%cdebugRecipeProducer() - Show debug information', 'color: #17a2b8;');

async function initializeApplication() {
    try {
        console.log('Initializing Recipe Producer application...');
        
        // Initialize the main application without waiting for JSZip
        recipeProducer = new RecipeProducer();
        
        // Wait for JSZip in background for ZIP functionality
        if (window.JSZipReady) {
            window.JSZipReady.then(() => {
                console.log('JSZip ready, re-checking availability...');
                if (recipeProducer && typeof recipeProducer.checkJSZipAvailability === 'function') {
                    recipeProducer.checkJSZipAvailability();
                }
            }).catch(error => {
                console.warn('JSZip loading failed, ZIP export will be disabled:', error);
            });
        } else {
            // If no JSZipReady promise, check immediately after a short delay
            setTimeout(() => {
                if (recipeProducer && typeof recipeProducer.checkJSZipAvailability === 'function') {
                    recipeProducer.checkJSZipAvailability();
                }
            }, 500);
        }
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = 'position: fixed; top: 20px; left: 20px; right: 20px; background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; z-index: 9999;';
        errorDiv.innerHTML = `
            <strong>初始化失败：</strong>${error.message}<br>
            <small>请刷新页面重试。</small>
        `;
        document.body.appendChild(errorDiv);
    }
}

document.addEventListener('DOMContentLoaded', initializeApplication);