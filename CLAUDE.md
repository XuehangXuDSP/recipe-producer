# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Start production server (port 3000)
npm start

# Start development server with auto-reload
npm run dev
```

## Architecture Overview

This is a full-stack web application for creating structured recipe JSON files with image management:

**Backend (Node.js/Express)**
- `server.js`: Main server file with REST API endpoints
- Session-based architecture using UUIDs for temporary file management
- Image upload handling with Multer (10MB limit, image formats only)
- ZIP file generation using Archiver for batch downloads

**Frontend (Vanilla JavaScript)**
- `public/script.js`: RecipeProducer class handles all UI logic and state
- `public/index.html`: Single-page application interface
- `public/style.css`: Styling
- Uses localStorage for auto-saving work
- Multi-tab interface for managing multiple recipes simultaneously

**Key API Endpoints:**
- `POST /api/session/create` - Initialize new editing session
- `POST /api/upload` - Upload images with session context
- `POST /api/batch/generate` - Process all recipes and prepare ZIP
- `GET /api/batch/download/:sessionId` - Download generated ZIP file

## Recipe JSON Structure

Recipes follow a specific schema defined in `recipe.json`:
- Nested structure with prerequisites, walkthrough steps, media attachments
- Each step can have multiple config items and media files
- Images are copied to recipe folders during generation

## File Structure

```
/public/          - Frontend static files (HTML, CSS, JS)
/temp/           - Session-based temporary storage for uploads
/output/         - Generated recipe output directory
recipe.json      - Schema template for recipe structure
server.js        - Main Express server application
```

## Important Implementation Details

- Frontend uses event delegation for dynamic form elements
- Image paths are converted from temp paths to relative paths during generation
- Session cleanup is optional after download to prevent data loss
- All recipe IDs are sanitized (spaces to hyphens, lowercase) for folder names
- Image uploads limited to 10MB, supports JPEG/JPG/PNG/GIF/WebP formats
- Uses UUID-based session management for concurrent user support
- Auto-saves recipe data to localStorage for persistence across browser sessions

## Additional API Endpoints

- `POST /api/recipe/save` - Save individual recipe to session
- `GET /api/session/:sessionId/cleanup` - Clean up session temporary files
- `POST /api/recipes/upload` - Upload existing recipe JSON files for batch import