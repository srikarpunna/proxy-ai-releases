/**
 * Main Application Entry Point
 * Initializes the Interview Assistant application
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed, initializing Interview Assistant');
  
  // Initialize Update Manager
  try {
    console.log('Creating UpdateManager instance');
    window.updateManager = new UpdateManager();
    console.log('UpdateManager initialized successfully');
  } catch (error) {
    console.error('Error initializing Update Manager:', error);
  }
  
  // Initialize UI Controller
  try {
    console.log('Creating UIController instance');
    window.uiController = new UIController();
    console.log('UIController initialized successfully');
    
    // Check if elements are found correctly
    console.log('Setup container exists:', !!document.getElementById('setupContainer'));
    console.log('Main container exists:', !!document.getElementById('mainContainer'));
    console.log('Start button exists:', !!document.getElementById('startSessionBtn'));
    
  } catch (error) {
    console.error('Error initializing UI Controller:', error);
  }
  
  // Set up Electron API integration if available
  if (window.api) {
    console.log('Electron API detected, setting up event handlers');
    
    // Handle displaying response in overlay
    window.api.onDisplayResponse(response => {
      // TODO: Fill in this functionality once overlay is implemented
      console.log('Received response from main process:', response);
    });
    
    // Handle keyboard shortcuts from main process
    window.api.onKeyboardShortcut(shortcut => {
      console.log('Keyboard shortcut received:', shortcut);
      
      switch (shortcut) {
        case 'toggle-listening':
          if (window.uiController) {
            window.uiController.toggleListening();
          }
          break;
          
        case 'end-session':
          if (window.uiController) {
            window.uiController.endSession();
          }
          break;
          
        default:
          console.log('Unhandled shortcut:', shortcut);
      }
    });
  } else {
    console.log('Running in browser mode (Electron API not detected)');
  }
  
  // Set up keyboard shortcuts for the application
  document.addEventListener('keydown', (event) => {
    // Global shortcut: Escape to end session
    if (event.key === 'Escape' && window.uiController && window.uiController.isSessionActive) {
      window.uiController.endSession();
    }
    
    // Global shortcut: F1 to toggle listening
    if (event.key === 'F1') {
      if (window.uiController && window.uiController.audioProcessor.getListeningStatus()) {
        window.uiController.audioProcessor.stopListening();
        window.uiController.updateListeningStatus(false);
      } else {
        window.uiController.audioProcessor.startListening();
        window.uiController.updateListeningStatus(true);
      }
    }
  });
  
  // Add custom window dragging functionality
  const header = document.querySelector('header');
  if (header) {
    let isDragging = false;
    let startPos = { x: 0, y: 0 };
    
    // For Electron - access window API if available
    const electronWindow = window.api ? window.api.getCurrentWindow : null;
    
    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      startPos = { x: e.clientX, y: e.clientY };
      
      if (electronWindow) {
        // Let Electron handle the dragging
        electronWindow().setIgnoreMouseEvents(false);
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      // Calculate movement
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      
      // For web version, we could implement custom dragging here
      // For Electron, the native dragging should handle this
    });
    
    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }
}); 