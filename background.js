// Load JSZip in the background script
importScripts('jszip.min.js');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'createZip') {
    try {
      // Create zip with the artifacts
      const zip = new JSZip();
      const artifacts = request.data.artifacts;
      
      // Add each artifact to the zip
      artifacts.forEach(artifact => {
        zip.file(artifact.filename, artifact.content);
      });
      
      // Generate and return the zip data
      zip.generateAsync({ type: "base64" }).then(zipData => {
        sendResponse({
          success: true,
          zipData: zipData
        });
      });
      
      return true; // Keep the message channel open for the async response
    } catch (error) {
      console.error('Error creating zip:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  if (request.action === 'openPopup') {
    // Get the current tab ID
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs && tabs[0]) {
        // Programmatically open the popup in the current tab
        chrome.action.openPopup();
      }
    });
    return true;
  }
  
  if (request.action === 'downloadZip') {
    try {
      // Set filename based on conversation ID
      const filename = `claude-artifacts-${request.conversationId.substring(0, 8)}.zip`;
      
      // Create a data URI for the ZIP file
      const dataUri = `data:application/zip;base64,${request.zipData}`;
      
      // Download the zip file - always use saveAs dialog
      chrome.downloads.download({
        url: dataUri,
        filename: filename,
        saveAs: true // Always show the save as dialog
      }, function(downloadId) {
        if (chrome.runtime.lastError) {
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
        } else {
          sendResponse({ 
            success: true, 
            downloadId: downloadId 
          });
        }
      });
      
      return true; // Keep the message channel open for the async response
    } catch (error) {
      console.error('Error in download handler:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }
});