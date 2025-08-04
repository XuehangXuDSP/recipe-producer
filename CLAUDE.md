# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start local development server
python -m http.server 8000

# Or using Node.js http-server
npx http-server docs -p 8000
```

## Architecture Overview

This is a pure frontend web application for creating structured recipe JSON files with image management:

**Frontend (Vanilla JavaScript)**
- `docs/script.js`: RecipeProducer class handles all UI logic and state
- `docs/index.html`: Single-page application interface  
- `docs/style.css`: Styling
- Uses localStorage and IndexedDB for data persistence
- Multi-tab interface for managing multiple recipes simultaneously
- Client-side ZIP generation using JSZip library

**Key Features:**
- Completely client-side application - no backend required
- IndexedDB for image storage and management
- JSZip for generating downloadable ZIP files with recipes and images
- localStorage for auto-saving work progress
- Drag-and-drop file upload support

## Recipe JSON Structure

Recipes follow a specific schema:
- Nested structure with prerequisites, walkthrough steps, media attachments
- Each step can have multiple config items and media files
- Images are managed in IndexedDB and included in generated ZIP files

## File Structure

```
docs/
├── index.html          - Main application page
├── script.js           - Application logic (pure frontend)
├── style.css           - Styling
└── libs/
    └── jszip.min.js    - JSZip library for ZIP file generation
```

## Important Implementation Details

- Frontend uses event delegation for dynamic form elements
- Images stored in IndexedDB as blobs for offline capability
- All recipe IDs are sanitized (spaces to hyphens, lowercase) for folder names
- Image uploads support JPEG/JPG/PNG/GIF/WebP formats
- Auto-saves recipe data to localStorage for persistence across browser sessions
- ZIP generation includes proper folder structure with images
- Completely offline-capable after initial page load