document.addEventListener('DOMContentLoaded', function() {
  const translateButton = document.getElementById('translateButton');
  const translationResults = document.getElementById('translationResults');
  const languageSelect = document.getElementById('languageSelect');

  const targetLanguages = {
    'original': 'Original Text',
    'en': 'English',
    'de': 'German',
    'fr': 'French',
    'es': 'Spanish',
    'hi': 'Hindi',
    'ta': 'Tamil',
    'zh': 'Mandarin',
    'ja': 'Japanese',
    'fi': 'Finnish',
    'sv': 'Swedish'
  };

  translateButton.addEventListener('click', async () => {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        translationResults.innerHTML = '<p>Unable to access the current tab. Please try again.</p>';
        return;
      }

      // Get selected text from the page
      chrome.tabs.sendMessage(tab.id, { action: "getSelectedText" }, async function(response) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          translationResults.innerHTML = '<p>Error communicating with the page. Please refresh the page and try again.</p>';
          return;
        }

        if (!response || !response.text) {
          translationResults.innerHTML = '<p>Please select some text on the page first.</p>';
          return;
        }

        const text = response.text;
        const selectedLang = languageSelect.value;

        // If original text is selected, restore the original text
        if (selectedLang === 'original') {
          chrome.tabs.sendMessage(tab.id, {
            action: "restoreOriginal",
            text: text,
            containerId: response.containerId // Pass the container ID if available
          }, function(response) {
            if (response && response.success) {
              window.close();
            } else {
              // Try clicking the text to show original if restore fails
              translationResults.innerHTML = '<p>You can also click the translated text to see the original.</p>';
            }
          });
          return;
        }

        translationResults.innerHTML = '<p>Translating...</p>';

        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${selectedLang}&dt=t&q=${encodeURIComponent(text)}`;
          const response = await fetch(url);
          const data = await response.json();
          
          // Combine all translated sentences
          let fullTranslation = '';
          if (data && data[0]) {
            fullTranslation = data[0]
              .map(item => item[0]) // Extract translated text from each segment
              .filter(text => text) // Remove any null/undefined entries
              .join(''); // Join all segments
          }

          const translation = {
            language: targetLanguages[selectedLang],
            translation: fullTranslation
          };

          // Send translation back to the content script to replace the text
          chrome.tabs.sendMessage(tab.id, {
            action: "replaceText",
            translations: [translation]
          }, function(response) {
            if (response && response.success) {
              // Close the popup after successful translation
              window.close();
            } else {
              translationResults.innerHTML = '<p>Error replacing text on the page. Please try again.</p>';
            }
          });
        } catch (error) {
          translationResults.innerHTML = '<p>Error occurred during translation. Please try again.</p>';
          console.error('Translation error:', error);
        }
      });
    } catch (error) {
      translationResults.innerHTML = '<p>An unexpected error occurred. Please try again.</p>';
      console.error('Error:', error);
    }
  });
}); 