# MindMap Knowledge System

A dynamic, interactive Progressive Web App (PWA) for creating, navigating, and learning from hierarchical mind maps. This tool allows users to visualize complex topics, drill down into sub-modules, and test their knowledge with an interactive quizzing system.

## ✨ Key Features

*   **Hierarchical Mind Map Visualization**: Displays knowledge modules as interactive, multi-level tree structures.
*   **Visual Polish**: Features a dynamic, parallax starry background for the mind map canvas and a full light/dark mode.
*   **Interactive Navigation**:
    *   **Pan & Zoom**: Smoothly pan and zoom the mind map canvas with mouse controls.
    *   **Drill Down**: Click on nodes with sub-modules to "zoom in" and load more detailed maps.
    *   **Breadcrumb Navigation**: Easily navigate back up the hierarchy.
*   **Dynamic Node Management**:
    *   **Add & Remove Nodes**: Contextually add child nodes to any selected node or remove nodes entirely.
    *   **Draggable Nodes**: Click and drag nodes to customize their positions.
    *   **Interactive Auto-Organization**: A "press and hold" physics-based layout engine that uses attraction and repulsion forces to neatly organize nodes. Clicking again while it's running makes the organization more aggressive.
*   **Rich Content Editing**:
    *   Click the pencil icon next to a node's title to open a rich text editor (powered by Quill.js) for its content.
*   **Interactive Quizzing System**:
    *   Each node can contain a mini-quiz to test user knowledge.
    *   The system shuffles questions to provide variety in learning sessions.
*   **Data Persistence & File Management**:
    *   **Local Storage**: All changes, including node content edits and custom node positions, are automatically saved to `localStorage`.
    *   **Save to File**: Download the current state of any module as a `.json` file.
    *   **Load from File**: Load a custom mind map module from a local `.json` file.
*   **User-Friendly Interface**:
    *   **Global Search**: A powerful search that finds nodes across *all* available modules and allows for seamless navigation directly to a result in a different module.
    *   **Dynamic Font Sizing**: Increase or decrease the font size for all content, with UI elements scaling proportionally.
    *   **Visual Cues**: Nodes with sub-modules glow, and child nodes have a subtle shadow to indicate depth.
*   **Progressive Web App (PWA)**:
    *   Installable on desktop and mobile devices for an app-like experience.
    *   Offline-first caching strategy ensures the application works without an internet connection.
*   **Advanced Reset**: A utility to clear caches and/or local storage to ensure a clean application state for testing.

## 🛠️ Technology Stack

*   **Frontend**: HTML5, CSS3, JavaScript (ES6 Modules)
*   **Rich Text Editing**: Quill.js
*   **Offline Capabilities**: Service Workers

## 📂 Project Structure & Architecture

```
MindMap/
├── css/
│   └── style.css         # Main stylesheet
├── js/
│   ├── main.js           # Main application orchestrator
│   ├── MindMapRenderer.js  # Handles all SVG drawing and layout
│   ├── MindMapInteraction.js # Manages pan, zoom, and drag events
│   ├── UIManager.js        # Controls UI elements (side panel, modals, etc.)
│   ├── NodeManager.js      # Manages node creation, editing, and deletion
│   └── quiz.js           # Logic for the adaptive quizzing system
├── modules/
│   └── *.json            # Data files for each knowledge module
├── icons/
│   └── *.png             # PWA icons
├── index.html
├── manifest.json         # PWA manifest
└── sw.js                 # Service Worker for offline caching
```

## 🚀 How to Run Locally

1.  Ensure all the project files are in a single directory.
2.  Due to the use of ES6 Modules and the Service Worker, you must run the project from a local web server.
3.  A simple way to do this is to use a tool like the **Live Server** extension for Visual Studio Code.
    *   Install the extension.
    *   Right-click on `index.html` and select "Open with Live Server".
4.  The application will open in your default web browser.

## 📖 How to Use

*   **Load a Module**: Click the hamburger icon (☰) in the top-left to open the side panel. Select a pre-defined module or click "Load from File" to open a local `.json` file.
*   **Navigate the Map**:
    *   Click and drag on the map background to **pan**.
    *   Use the mouse wheel to **zoom** in and out.
    *   Click on a node to select it and view its content.
    *   Click on a glowing node to load its sub-module.
*   **Edit Content**:
    *   Select a node.
    *   Click the pencil icon (✎) next to the node's title in the right-hand panel.
    *   Make your changes in the modal and click "Save".
*   **Modify the Map**:
    *   Select a node, then click the plus icon (+) to add a new child node.
    *   Select a node, then click the trash icon (🗑️) to remove it.
    *   Click and drag any node to a new position.
*   **Organize & Save**:
    *   Click the "Arrange" button (grid icon) in the map panel to reset all nodes to their default positions.
    *   Click the "Save" button (download icon) to save the current module, including all your edits and custom positions, to a `.json` file.

### 🤖 Development with AI Assistance

This project was developed with significant assistance from **Gemini Code Assist**. The AI was instrumental in various stages of the development lifecycle, acting as a pair programmer for tasks including:

*   **Rapid Prototyping & Feature Implementation**: Implementing complex features like the physics-based layout engine, the global search functionality, and the parallax background.
*   **Debugging & Root Cause Analysis**: Identifying the source of complex bugs, from UI layout issues to race conditions and state management flaws in the navigation logic.
*   **Architectural Refactoring**: Restructuring the application from a single large class into a more modular, maintainable architecture with distinct manager classes (`StateManager`, `ModuleLoader`, etc.).
*   **Code Review & Optimization**: Reviewing existing code for correctness, suggesting improvements, and optimizing algorithms (like the layout and search functions).
*   **Content Generation**: Populating the knowledge base by creating and expanding the content within the `.json` module files.
*   **Documentation**: Generating and updating this `README.md` file to reflect the project's current state.

For developers looking to accelerate their workflow, integrating an AI assistant like Gemini can be a powerful tool for brainstorming, implementation, and debugging.