const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const sessionId = req.body.sessionId || req.query.sessionId;
        const uploadPath = path.join(__dirname, 'temp', sessionId, 'uploads');
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Recipe JSON file upload configuration
const recipeStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const sessionId = req.body.sessionId || req.query.sessionId;
        const uploadPath = path.join(__dirname, 'temp', sessionId, 'recipes');
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const uploadRecipe = multer({
    storage: recipeStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for JSON files
    fileFilter: (req, file, cb) => {
        const allowedTypes = /json/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = file.mimetype === 'application/json' || file.mimetype === 'text/plain';
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed'));
        }
    }
});

// Function to validate recipe JSON structure
function validateRecipeData(recipeData) {
    const requiredFields = ['title'];
    const optionalFields = ['id', 'category', 'DSPVersions', 'usecase', 'prerequisites', 'direction', 'connection', 'walkthrough', 'downloadableExecutables', 'relatedRecipes', 'keywords'];
    
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

app.post('/api/session/create', async (req, res) => {
    try {
        const sessionId = uuidv4();
        const sessionPath = path.join(__dirname, 'temp', sessionId);
        await fs.mkdir(sessionPath, { recursive: true });
        res.json({ sessionId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        res.json({ 
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: `/temp/${req.body.sessionId}/uploads/${req.file.filename}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Single recipe file upload endpoint
app.post('/api/recipe/upload', uploadRecipe.single('recipeFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No recipe file uploaded' });
        }
        
        const filePath = req.file.path;
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        let recipeData;
        try {
            recipeData = JSON.parse(fileContent);
        } catch (parseError) {
            return res.status(400).json({ error: 'Invalid JSON format in uploaded file' });
        }
        
        const validation = validateRecipeData(recipeData);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }
        
        // Clean up the uploaded file
        await fs.unlink(filePath);
        
        res.json({
            success: true,
            recipe: recipeData,
            originalFilename: req.file.originalname
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk recipe files upload endpoint
app.post('/api/recipe/bulk-upload', uploadRecipe.array('recipeFiles', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No recipe files uploaded' });
        }
        
        const results = [];
        const errors = [];
        
        for (const file of req.files) {
            try {
                const fileContent = await fs.readFile(file.path, 'utf8');
                let recipeData;
                
                try {
                    recipeData = JSON.parse(fileContent);
                } catch (parseError) {
                    errors.push(`${file.originalname}: Invalid JSON format`);
                    continue;
                }
                
                const validation = validateRecipeData(recipeData);
                if (!validation.valid) {
                    errors.push(`${file.originalname}: ${validation.error}`);
                    continue;
                }
                
                results.push({
                    recipe: recipeData,
                    originalFilename: file.originalname
                });
                
                // Clean up the uploaded file
                await fs.unlink(file.path);
            } catch (error) {
                errors.push(`${file.originalname}: ${error.message}`);
            }
        }
        
        res.json({
            success: results.length > 0,
            recipes: results,
            errors: errors,
            totalProcessed: req.files.length,
            successCount: results.length,
            errorCount: errors.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/recipe/save', async (req, res) => {
    try {
        const { sessionId, recipeId, recipe } = req.body;
        
        if (!sessionId || !recipeId || !recipe) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const recipePath = path.join(__dirname, 'temp', sessionId, recipeId);
        await fs.mkdir(recipePath, { recursive: true });
        
        await fs.writeFile(
            path.join(recipePath, 'recipe.json'),
            JSON.stringify(recipe, null, 2)
        );
        
        res.json({ success: true, message: 'Recipe saved successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/batch/generate', async (req, res) => {
    try {
        const { sessionId, recipes } = req.body;
        
        if (!sessionId || !recipes || !Array.isArray(recipes)) {
            return res.status(400).json({ error: 'Invalid request data' });
        }

        const sessionPath = path.join(__dirname, 'temp', sessionId);
        const outputPath = path.join(__dirname, 'output', sessionId);
        await fs.mkdir(outputPath, { recursive: true });

        for (const recipe of recipes) {
            const recipeId = recipe.id.replace(/\s+/g, '-').toLowerCase();
            const recipePath = path.join(outputPath, recipeId);
            const imagesPath = path.join(recipePath, 'images');
            
            await fs.mkdir(imagesPath, { recursive: true });
            
            const processedRecipe = { ...recipe };
            
            if (recipe.walkthrough && Array.isArray(recipe.walkthrough)) {
                for (let step of recipe.walkthrough) {
                    if (step.media && Array.isArray(step.media)) {
                        for (let media of step.media) {
                            if (media.tempPath) {
                                const sourcePath = path.join(__dirname, media.tempPath);
                                const fileName = path.basename(media.tempPath);
                                const destPath = path.join(imagesPath, fileName);
                                
                                try {
                                    await fs.copyFile(sourcePath, destPath);
                                    media.url = `images/${fileName}`;
                                    delete media.tempPath;
                                } catch (err) {
                                    console.error(`Failed to copy image: ${err.message}`);
                                }
                            }
                        }
                    }
                }
            }
            
            await fs.writeFile(
                path.join(recipePath, 'recipe.json'),
                JSON.stringify(processedRecipe, null, 2)
            );
        }

        res.json({ 
            success: true, 
            message: 'All recipes generated successfully',
            downloadUrl: `/api/batch/download/${sessionId}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/batch/download/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const outputPath = path.join(__dirname, 'output', sessionId);
        
        const stats = await fs.stat(outputPath).catch(() => null);
        if (!stats || !stats.isDirectory()) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const zipFileName = `recipes-batch-${timestamp}.zip`;
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

        const archive = archiver('zip', {
            zlib: { level: 9 }
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(res);
        archive.directory(outputPath, false);
        await archive.finalize();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/session/:sessionId/cleanup', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const tempPath = path.join(__dirname, 'temp', sessionId);
        const outputPath = path.join(__dirname, 'output', sessionId);
        
        await fs.rm(tempPath, { recursive: true, force: true });
        await fs.rm(outputPath, { recursive: true, force: true });
        
        res.json({ success: true, message: 'Session cleaned up' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Recipe Producer server running on http://localhost:${PORT}`);
});