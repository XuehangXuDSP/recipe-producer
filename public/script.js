class RecipeProducer {
    constructor() {
        this.sessionId = null;
        this.recipes = [this.createEmptyRecipe()];
        this.currentRecipeIndex = 0;
        this.uploadedImages = new Map();
        
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

    async init() {
        await this.createSession();
        this.bindEvents();
        this.loadFromLocalStorage();
        this.updatePreview();
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

    async createSession() {
        try {
            const response = await fetch('/api/session/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            this.sessionId = data.sessionId;
        } catch (error) {
            console.error('Failed to create session:', error);
            alert('Failed to create session, please refresh the page and try again');
        }
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
                    tempPath: ''
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
        document.addEventListener('click', (e) => {
            try {
                // Tab management
                if (e.target.classList.contains('add-tab')) {
                    this.addNewRecipe();
                    return;
                }
                
                // Handle close button clicks first to prevent tab switching
                if (e.target.classList.contains('close-tab')) {
                    e.stopPropagation();
                    const tab = e.target.closest('.tab');
                    if (tab && tab.dataset.recipeIndex) {
                        const index = parseInt(tab.dataset.recipeIndex);
                        this.removeRecipe(index);
                    }
                    return;
                }
                
                // Handle tab clicks - check if clicked element is within a tab
                const clickedTab = e.target.closest('.tab');
                if (clickedTab && !e.target.classList.contains('close-tab')) {
                    const index = parseInt(clickedTab.dataset.recipeIndex);
                    if (!isNaN(index)) {
                        this.switchToRecipe(index);
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
                        this.handleInputChange();
                    }
                    return;
                }
            } catch (error) {
                console.error('Error in click handler:', error);
            }
        });

        // Input change events using delegation
        document.addEventListener('input', (e) => {
            if (e.target.matches('input, textarea, select')) {
                this.handleInputChange();
            }
        });

        // Change events for specific elements
        document.addEventListener('change', (e) => {
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
        });

        // Keyword input handling
        document.addEventListener('keypress', (e) => {
            if (e.target.classList.contains('keyword-input') && e.key === 'Enter') {
                e.preventDefault();
                this.addKeyword(e.target.value);
                e.target.value = '';
            }
        });

        // Keyboard shortcuts for tab navigation
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Left Arrow - Previous tab
            if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft') {
                e.preventDefault();
                const newIndex = this.currentRecipeIndex > 0 ? this.currentRecipeIndex - 1 : this.recipes.length - 1;
                this.switchToRecipe(newIndex);
            }
            // Ctrl/Cmd + Right Arrow - Next tab
            else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight') {
                e.preventDefault();
                const newIndex = this.currentRecipeIndex < this.recipes.length - 1 ? this.currentRecipeIndex + 1 : 0;
                this.switchToRecipe(newIndex);
            }
            // Ctrl/Cmd + T - New tab
            else if ((e.ctrlKey || e.metaKey) && e.key === 't') {
                e.preventDefault();
                this.addNewRecipe();
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

        // Auto-save interval
        setInterval(() => this.saveToLocalStorage(), 30000);
        
        // Drag and drop functionality
        this.setupDragAndDrop();
    }

    addNewRecipe() {
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
            this.switchToRecipe(newIndex);
            
            // Update close button visibility
            this.updateCloseButtonVisibility();
        } catch (error) {
            console.error('Error adding new recipe:', error);
        }
    }

    removeRecipe(index) {
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
            this.switchToRecipe(this.currentRecipeIndex);
            
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

    switchToRecipe(index) {
        this.saveCurrentRecipeData();
        
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-recipe-index="${index}"]`).classList.add('active');
        
        this.currentRecipeIndex = index;
        this.loadRecipeData(this.recipes[index]);
        this.updatePreview();
    }

    saveCurrentRecipeData() {
        const recipe = this.recipes[this.currentRecipeIndex];
        
        recipe.title = document.getElementById('title').value.trim();
        recipe.category = document.getElementById('category').value.trim();
        recipe.usecase = document.getElementById('usecase').value.trim();
        recipe.direction = document.getElementById('direction').value.trim();
        recipe.connection = document.getElementById('connection').value.trim();
        
        recipe.DSPVersions = Array.from(document.querySelectorAll('.dsp-version'))
            .map(input => input.value.trim())
            .filter(v => v);
        
        recipe.keywords = Array.from(document.querySelectorAll('.keyword-tag'))
            .map(tag => tag.textContent.replace('×', '').trim());
        
        recipe.prerequisites = this.collectPrerequisites();
        recipe.walkthrough = this.collectWalkthrough();
        recipe.downloadableExecutables = this.collectDownloadables();
        recipe.relatedRecipes = this.collectRelatedRecipes();
        
        if (recipe.title) {
            recipe.id = recipe.title.toLowerCase().replace(/\s+/g, '-');
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

    collectWalkthrough() {
        const walkthrough = [];
        document.querySelectorAll('.step-item').forEach(stepEl => {
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
            
            stepEl.querySelectorAll('.media-item').forEach(mediaEl => {
                const type = mediaEl.querySelector('.media-type').value.trim();
                const alt = mediaEl.querySelector('.media-alt').value.trim();
                const preview = mediaEl.querySelector('.image-preview');
                const tempPath = preview?.dataset.tempPath || '';
                
                if (tempPath || alt) {
                    step.media.push({
                        type,
                        url: '',
                        alt,
                        tempPath
                    });
                }
            });
            
            if (step.step || step.config.length > 0 || step.media.length > 0) {
                walkthrough.push(step);
            }
        });
        
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

    loadRecipeData(recipe) {
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
        this.loadWalkthrough(recipe.walkthrough);
        
        // Load other sections
        this.loadDownloadables(recipe.downloadableExecutables);
        this.loadRelatedRecipes(recipe.relatedRecipes);
        this.loadKeywords(recipe.keywords);
        
        // Events are now handled via delegation, no need for re-binding
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

    loadWalkthrough(walkthrough) {
        const container = document.querySelector('.walkthrough-container');
        container.innerHTML = '';
        
        walkthrough.forEach((step, stepIndex) => {
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
            step.media.forEach(media => {
                this.createMediaItem(mediaContainer, media);
            });
        });
    }

    createMediaItem(container, media = {}) {
        const mediaEl = document.createElement('div');
        mediaEl.className = 'media-item';
        
        mediaEl.innerHTML = `
            <select class="media-type">
                <option value="image" ${media.type === 'image' ? 'selected' : ''}>Image</option>
                <option value="video" ${media.type === 'video' ? 'selected' : ''}>Video</option>
            </select>
            <div class="image-upload-area">
                <input type="file" class="image-upload" accept="image/*">
                <div class="upload-placeholder" ${media.tempPath ? 'style="display:none"' : ''}>Click or drag to upload image</div>
                <img class="image-preview" ${media.tempPath ? `src="${media.tempPath}" style="display:block"` : 'style="display:none"'} ${media.tempPath ? `data-temp-path="${media.tempPath}"` : ''}>
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

    addMedia(button) {
        try {
            const container = button.previousElementSibling;
            if (!container) {
                console.error('Media container not found');
                return;
            }
            
            this.createMediaItem(container);
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

    addKeyword(keyword) {
        if (!keyword.trim()) return;
        
        this.createKeywordTag(keyword.trim());
        this.handleInputChange();
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
            <button onclick="this.parentElement.remove(); recipeProducer.handleInputChange()">×</button>
        `;
        container.appendChild(tag);
    }

    async handleImageUpload(input) {
        const file = input.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('image', file);
        formData.append('sessionId', this.sessionId);
        
        try {
            this.showLoading();
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                const preview = input.parentElement.querySelector('.image-preview');
                const placeholder = input.parentElement.querySelector('.upload-placeholder');
                
                preview.src = data.path;
                preview.dataset.tempPath = data.path;
                preview.style.display = 'block';
                placeholder.style.display = 'none';
                
                this.uploadedImages.set(data.filename, data);
                this.handleInputChange();
            } else {
                alert('Upload failed: ' + data.error);
            }
        } catch (error) {
            alert('Upload failed: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    handleInputChange() {
        this.saveCurrentRecipeData();
        this.updatePreview();
        this.updateTabTitle();
        this.saveToLocalStorage();
    }

    updateTabTitle() {
        const title = document.getElementById('title').value;
        const tab = document.querySelector(`[data-recipe-index="${this.currentRecipeIndex}"] .tab-title`);
        if (tab) {
            tab.textContent = title || `Recipe ${this.currentRecipeIndex + 1}`;
        }
    }

    updatePreview() {
        const recipe = this.recipes[this.currentRecipeIndex];
        const cleanRecipe = JSON.parse(JSON.stringify(recipe));
        
        // Remove temp paths from preview
        if (cleanRecipe.walkthrough) {
            cleanRecipe.walkthrough.forEach(step => {
                if (step.media) {
                    step.media.forEach(media => {
                        delete media.tempPath;
                    });
                }
            });
        }
        
        document.getElementById('json-preview').textContent = JSON.stringify(cleanRecipe, null, 2);
    }

    async saveCurrentRecipe() {
        this.saveCurrentRecipeData();
        const recipe = this.recipes[this.currentRecipeIndex];
        
        if (!recipe.title) {
            alert('Please enter a recipe title');
            return;
        }
        
        try {
            this.showLoading();
            
            const response = await fetch('/api/recipe/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    recipeId: recipe.id || recipe.title.toLowerCase().replace(/\s+/g, '-'),
                    recipe: recipe
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert('Recipe saved successfully!');
                this.updateRecipesStatus();
            } else {
                alert('Save failed: ' + data.error);
            }
        } catch (error) {
            alert('Save failed: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async generateAllRecipes() {
        this.saveCurrentRecipeData();
        
        const validRecipes = this.recipes.filter(r => r.title);
        if (validRecipes.length === 0) {
            alert('Please enter at least one recipe title');
            return;
        }
        
        try {
            this.showLoading();
            
            const response = await fetch('/api/batch/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    recipes: validRecipes
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                window.location.href = data.downloadUrl;
                setTimeout(() => {
                    if (confirm('Do you want to clean up temporary files after download?')) {
                        this.cleanupSession();
                    }
                }, 1000);
            } else {
                alert('Generation failed: ' + data.error);
            }
        } catch (error) {
            alert('Generation failed: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async cleanupSession() {
        try {
            await fetch(`/api/session/${this.sessionId}/cleanup`);
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
        const data = {
            sessionId: this.sessionId,
            recipes: this.recipes,
            currentRecipeIndex: this.currentRecipeIndex
        };
        localStorage.setItem('recipeProducerData', JSON.stringify(data));
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('recipeProducerData');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.recipes && data.recipes.length > 0) {
                    this.recipes = data.recipes;
                    this.currentRecipeIndex = data.currentRecipeIndex || 0;
                    
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
                    
                    this.loadRecipeData(this.recipes[this.currentRecipeIndex]);
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
        const formData = new FormData();
        formData.append('recipeFile', file);
        formData.append('sessionId', this.sessionId);
        
        try {
            const response = await fetch('/api/recipe/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.addRecipeFromUpload(data.recipe, data.originalFilename);
                this.showUploadStatus('success', `成功导入recipe: ${data.originalFilename}`);
            } else {
                this.showUploadStatus('error', `上传失败: ${data.error}`);
            }
        } catch (error) {
            this.showUploadStatus('error', `上传失败: ${error.message}`);
        }
    }
    
    async processBulkRecipeFiles(files) {
        const formData = new FormData();
        files.forEach(file => {
            formData.append('recipeFiles', file);
        });
        formData.append('sessionId', this.sessionId);
        
        try {
            const response = await fetch('/api/recipe/bulk-upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                let message = `批量上传完成: ${data.successCount}个成功`;
                if (data.errorCount > 0) {
                    message += `, ${data.errorCount}个失败`;
                }
                
                data.recipes.forEach(item => {
                    this.addRecipeFromUpload(item.recipe, item.originalFilename);
                });
                
                if (data.errors.length > 0) {
                    message += `\n错误详情:\n${data.errors.join('\n')}`;
                    this.showUploadStatus('info', message);
                } else {
                    this.showUploadStatus('success', message);
                }
            } else {
                this.showUploadStatus('error', `批量上传失败: ${data.error}`);
            }
        } catch (error) {
            this.showUploadStatus('error', `批量上传失败: ${error.message}`);
        }
    }
    
    addRecipeFromUpload(recipeData, filename) {
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
        this.switchToRecipe(newIndex);
        
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
            normalized.walkthrough = [{ step: '', config: [{ field: '', value: '' }], media: [{ type: 'image', url: '', alt: '', tempPath: '' }] }];
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

const recipeProducer = new RecipeProducer();