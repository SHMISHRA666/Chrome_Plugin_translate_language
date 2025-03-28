// Store the current selection range and original text
let currentSelection = null;
let originalTexts = new Map(); // Store original texts with their container IDs

// Generate unique ID for containers
let containerCounter = 0;
function generateContainerId() {
  return 'translate-container-' + (containerCounter++);
}

// Find the closest translation container
function findTranslationContainer(element) {
  while (element && !element.classList?.contains('translation-container')) {
    element = element.parentElement;
  }
  return element;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSelectedText") {
    try {
      const selection = window.getSelection();
      const selectedText = selection.toString().trim();
      
      // Store the range for later use
      if (selectedText) {
        currentSelection = selection.getRangeAt(0);
        
        // Check if the selection is within a translation container
        const container = findTranslationContainer(selection.anchorNode.parentElement);
        if (container) {
          const originalText = originalTexts.get(container.id);
          if (originalText) {
            // If we're selecting within a translation, use the original text
            sendResponse({ text: originalText, containerId: container.id });
            return true;
          }
        }
      }
      
      sendResponse({ text: selectedText });
    } catch (error) {
      console.error("Error getting selected text:", error);
      sendResponse({ text: "" });
    }
    return true;
  }
  
  if (request.action === "replaceText") {
    try {
      if (currentSelection) {
        const translation = request.translations[0];
        const originalText = currentSelection.toString();
        
        // Create a container for the translation
        const translationContainer = document.createElement('span');
        const containerId = generateContainerId();
        translationContainer.id = containerId;
        translationContainer.className = 'translation-container';
        translationContainer.style.display = 'inline';
        
        // Store original text
        originalTexts.set(containerId, originalText);
        
        // Create the translated text
        const translatedText = document.createElement('span');
        translatedText.textContent = translation.translation;
        translatedText.title = `Click to toggle between original and ${translation.language} translation`;
        translatedText.style.borderBottom = '1px dotted #666';
        translatedText.style.cursor = 'pointer';
        translatedText.dataset.isTranslated = 'true';
        
        // Add click effect to toggle between original and translated text
        translatedText.addEventListener('click', function() {
          const isTranslated = this.dataset.isTranslated === 'true';
          this.textContent = isTranslated ? originalText : translation.translation;
          this.dataset.isTranslated = (!isTranslated).toString();
          this.title = isTranslated ? 
            `Click to show ${translation.language} translation` : 
            'Click to show original text';
        });
        
        // Add the translated text to the container
        translationContainer.appendChild(translatedText);
        
        // Replace the selected text with our container
        currentSelection.deleteContents();
        currentSelection.insertNode(translationContainer);
        
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "No selection found" });
      }
    } catch (error) {
      console.error("Error replacing text:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }

  if (request.action === "restoreOriginal") {
    try {
      if (currentSelection) {
        // Find the translation container in the selection
        const container = findTranslationContainer(currentSelection.startContainer.parentElement);
        
        if (container) {
          const originalText = originalTexts.get(container.id);
          if (originalText) {
            const textNode = document.createTextNode(originalText);
            container.parentNode.replaceChild(textNode, container);
            originalTexts.delete(container.id);
            sendResponse({ success: true });
            return true;
          }
        }
        
        // If we couldn't find a container in the selection, try to find any translation container that contains the selected text
        const allContainers = document.querySelectorAll('.translation-container');
        for (const container of allContainers) {
          if (container.textContent === request.text) {
            const originalText = originalTexts.get(container.id);
            if (originalText) {
              const textNode = document.createTextNode(originalText);
              container.parentNode.replaceChild(textNode, container);
              originalTexts.delete(container.id);
              sendResponse({ success: true });
              return true;
            }
          }
        }
      }
      sendResponse({ success: false, error: "No translation container found" });
    } catch (error) {
      console.error("Error restoring original text:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
}); 