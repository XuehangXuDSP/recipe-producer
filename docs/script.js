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
        this.recipes = [this.createEmptyRecipe()];
        this.currentRecipeIndex = 0;
        this.imageStorage = new ImageStorage();
        this.imageCounter = 0;
        
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
                    this.updatePreview();
                    console.log('Initial preview updated');
                } catch (error) {
                    console.error('Error updating initial preview:', error);
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
    
    checkJSZipAvailability(retryCount = 0) {
        const generateBtn = document.getElementById('generate-all');
        const maxRetries = 5;
        
        console.log(`Checking JSZip availability (attempt ${retryCount + 1}/${maxRetries + 1})`);
        
        if (typeof JSZip === 'undefined') {
            if (retryCount < maxRetries) {
                console.log(`JSZip not ready, retrying in ${(retryCount + 1) * 500}ms...`);
                setTimeout(() => this.checkJSZipAvailability(retryCount + 1), (retryCount + 1) * 500);
                return;
            }
            
            console.warn('JSZip library is not loaded after all retries - ZIP export will be disabled');
            this.jsZipAvailable = false;
            
            // Disable ZIP export button if it exists
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.title = 'JSZip库未加载，ZIP导出功能不可用。请刷新页面或检查网络连接。';
                generateBtn.style.opacity = '0.5';
                generateBtn.style.cursor = 'not-allowed';
                generateBtn.innerHTML = 'ZIP功能不可用';
            }
        } else {
            console.log(`JSZip library loaded successfully! Version: ${JSZip.version || 'unknown'}`);
            this.jsZipAvailable = true;
            
            // Enable ZIP export button if it exists
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.title = '生成并下载所有Recipe的ZIP文件';
                generateBtn.style.opacity = '1';
                generateBtn.style.cursor = 'pointer';
                generateBtn.innerHTML = 'Generate & Download All Recipes';
                console.log('ZIP export button enabled successfully!');
            }
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

    bindEvents() {
        // Use event delegation for all dynamic elements
        document.addEventListener('click', async (e) => {
            try {
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
                    document.getElementById('recipe-upload-single').click();
                    return;
                }
                
                if (e.target.id === 'upload-bulk') {
                    document.getElementById('recipe-upload-bulk').click();
                    return;
                }

                // Remove functions
                if (e.target.classList.contains('remove-config') || 
                    e.target.classList.contains('remove-media') ||
                    e.target.classList.contains('remove-link') ||
                    e.target.classList.contains('remove-downloadable') ||
                    e.target.classList.contains('remove-related')) {
                    const elementToRemove = e.target.closest('div');
                    if (elementToRemove) {
                        elementToRemove.remove();
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
                    await this.handleInputChange();
                } catch (error) {
                    console.error('Error handling input change:', error);
                }
            }
        });

        // Change events for specific elements
        document.addEventListener('change', (e) => {
            try {
                if (e.target.classList.contains('link-type')) {
                    this.updateLinkFields(e.target);
                }
                
                if (e.target.classList.contains('image-upload')) {
                    this.handleImageUpload(e.target);
                }
                
                if (e.target.id === 'recipe-upload-single') {
                    this.handleRecipeUpload(e.target, false);
                }
                
                if (e.target.id === 'recipe-upload-bulk') {
                    this.handleRecipeUpload(e.target, true);
                }
            } catch (error) {
                console.error('Error handling change event:', error);
                this.showError('处理变更事件时发生错误');
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

        // Main action buttons
        const saveBtn = document.getElementById('save-current');
        const generateBtn = document.getElementById('generate-all');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCurrentRecipe());
        }
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateAllRecipes());
        }

        // Smart auto-save interval - only save if there are changes
        setInterval(() => {
            if (this.hasUnsavedChanges) {
                this.saveToLocalStorage();
            }
        }, 30000);
        
        // Drag and drop functionality
        this.setupDragAndDrop();
    }

    async addNewRecipe() {
        try {
            const newRecipe = this.createEmptyRecipe();
            this.recipes.push(newRecipe);
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
            newTab.innerHTML = `
                <span class="tab-title">Recipe ${newIndex + 1}</span>
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
            await this.saveCurrentRecipeData();
            
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            const targetTab = document.querySelector(`[data-recipe-index="${index}"]`);
            if (!targetTab) {
                throw new Error(`Tab with index ${index} not found`);
            }
            targetTab.classList.add('active');
            
            this.currentRecipeIndex = index;
            await this.loadRecipeData(this.recipes[index]);
            this.updatePreview();
            console.log(`Successfully switched to recipe ${index}`);
        } catch (error) {
            console.error('Error switching recipe:', error);
            this.showError('切换Recipe时发生错误');
        }
    }

    async saveCurrentRecipeData() {
        try {
            const recipe = this.recipes[this.currentRecipeIndex];
            if (!recipe) {
                console.warn('No recipe found at current index:', this.currentRecipeIndex);
                return;
            }
            
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
            
            console.log('Recipe data saved successfully');
        } catch (error) {
            console.error('Error saving current recipe data:', error);
            this.showError('保存Recipe数据时发生错误');
        }
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
            
            // Handle media items with IndexedDB
            for (const mediaEl of stepEl.querySelectorAll('.media-item')) {
                const type = mediaEl.querySelector('.media-type').value.trim();
                const alt = mediaEl.querySelector('.media-alt').value.trim();
                const preview = mediaEl.querySelector('.image-preview');
                const imageId = preview?.dataset.imageId || '';
                
                if (imageId || alt) {
                    step.media.push({
                        type,
                        url: '',
                        alt,
                        imageId
                    });
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
        
        const imageId = media.imageId || '';
        let imageSrc = '';
        let hasImage = false;
        
        if (imageId) {
            try {
                const imageFile = await this.imageStorage.getImage(imageId);
                if (imageFile) {
                    imageSrc = URL.createObjectURL(imageFile);
                    hasImage = true;
                }
            } catch (error) {
                console.error('Failed to load image:', error);
            }
        }
        
        mediaEl.innerHTML = `
            <select class="media-type">
                <option value="image" ${media.type === 'image' ? 'selected' : ''}>Image</option>
                <option value="video" ${media.type === 'video' ? 'selected' : ''}>Video</option>
            </select>
            <div class="image-upload-area">
                <input type="file" class="image-upload" accept="image/*">
                <div class="upload-placeholder" ${hasImage ? 'style="display:none"' : ''}>Click or drag to upload image</div>
                <img class="image-preview" ${hasImage ? `src="${imageSrc}" style="display:block"` : 'style="display:none"'} ${imageId ? `data-image-id="${imageId}"` : ''}>
            </div>
            <input type="text" placeholder="Alt Text" class="media-alt" value="${media.alt || ''}">
            <button type="button" class="btn-small remove-media">-</button>
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
            
            // Generate unique image ID
            const imageId = `img_${this.sessionId}_${++this.imageCounter}_${Date.now()}`;
            
            // Store image in IndexedDB
            await this.imageStorage.storeImage(imageId, file);
            
            // Create object URL for preview
            const imageUrl = URL.createObjectURL(file);
            
            // Update UI
            const preview = input.parentElement.querySelector('.image-preview');
            const placeholder = input.parentElement.querySelector('.upload-placeholder');
            
            preview.src = imageUrl;
            preview.dataset.imageId = imageId;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            
            // Use debounced version for better performance
            await this.handleInputChange();
        } catch (error) {
            console.error('Image upload error:', error);
            alert('Failed to upload image: ' + error.message);
        } finally {
            this.hideLoading();
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

    updateTabTitle() {
        try {
            const titleEl = document.getElementById('title');
            const title = titleEl ? titleEl.value : '';
            const tab = document.querySelector(`[data-recipe-index="${this.currentRecipeIndex}"] .tab-title`);
            if (tab) {
                tab.textContent = title || `Recipe ${this.currentRecipeIndex + 1}`;
            }
        } catch (error) {
            console.error('Error updating tab title:', error);
        }
    }

    updatePreview() {
        try {
            const recipe = this.recipes[this.currentRecipeIndex];
            if (!recipe) {
                console.warn('No recipe found for preview at index:', this.currentRecipeIndex);
                return;
            }
            
            const cleanRecipe = JSON.parse(JSON.stringify(recipe));
            
            // Remove imageId from preview (only used internally)
            if (cleanRecipe.walkthrough) {
                cleanRecipe.walkthrough.forEach(step => {
                    if (step.media) {
                        step.media.forEach(media => {
                            delete media.imageId;
                        });
                    }
                });
            }
            
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
        console.log('generateAllRecipes called');
        await this.saveCurrentRecipeData();
        
        console.log('Total recipes:', this.recipes.length);
        const validRecipes = this.recipes.filter(r => r.title);
        console.log('Valid recipes (with title):', validRecipes.length);
        
        if (validRecipes.length === 0) {
            console.warn('No valid recipes found');
            alert('Please enter at least one recipe title');
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
            
            for (const recipe of validRecipes) {
                const recipeId = recipe.id.replace(/\s+/g, '-').toLowerCase();
                const recipeFolder = zip.folder(recipeId);
                const imagesFolder = recipeFolder.folder('images');
                
                // Process recipe data and copy images
                const processedRecipe = JSON.parse(JSON.stringify(recipe));
                
                if (recipe.walkthrough && Array.isArray(recipe.walkthrough)) {
                    for (let step of recipe.walkthrough) {
                        if (step.media && Array.isArray(step.media)) {
                            for (let media of step.media) {
                                if (media.imageId) {
                                    try {
                                        const imageFile = await this.imageStorage.getImage(media.imageId);
                                        if (imageFile) {
                                            const fileName = `${media.imageId}.${imageFile.name.split('.').pop() || 'jpg'}`;
                                            imagesFolder.file(fileName, imageFile);
                                            media.url = `images/${fileName}`;
                                        }
                                    } catch (error) {
                                        console.error(`Failed to process image: ${error.message}`);
                                    }
                                    delete media.imageId; // Remove internal property
                                }
                            }
                        }
                    }
                }
                
                // Add recipe.json file
                recipeFolder.file('recipe.json', JSON.stringify(processedRecipe, null, 2));
            }
            
            // Generate ZIP file
            const content = await zip.generateAsync({ type: 'blob' });
            
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
            
            setTimeout(() => {
                if (confirm('Do you want to clean up temporary files?')) {
                    this.cleanupSession();
                }
            }, 1000);
            
        } catch (error) {
            console.error('Generation error:', error);
            alert('Generation failed: ' + error.message);
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
                        tab.innerHTML = `
                            <span class="tab-title">${recipe.title || `Recipe ${index + 1}`}</span>
                            <button class="close-tab" ${this.recipes.length === 1 ? 'style="display: none;"' : ''}>×</button>
                        `;
                        tabsContainer.appendChild(tab);
                    });
                    
                    const addBtn = document.createElement('button');
                    addBtn.className = 'add-tab';
                    addBtn.textContent = '+ Add New Recipe';
                    tabsContainer.appendChild(addBtn);
                    
                    await this.loadRecipeData(this.recipes[this.currentRecipeIndex]);
                    this.updateRecipesStatus();
                    
                    // Update close button visibility after loading
                    this.updateCloseButtonVisibility();
                }
            } catch (error) {
                console.error('Failed to load saved data:', error);
            }
        }
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
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
        
        // Click to upload
        uploadArea.addEventListener('click', () => {
            if (document.getElementById('recipe-upload-bulk')) {
                document.getElementById('recipe-upload-bulk').click();
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
                errors.push(`${file.name}: ${error.message}`);
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
        statusElement.textContent = message;
        statusElement.style.display = 'block';
        
        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
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