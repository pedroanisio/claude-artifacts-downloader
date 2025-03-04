document.addEventListener('DOMContentLoaded', function() {
    const downloadButton = document.getElementById('downloadButton');
    const statusContainer = document.getElementById('statusContainer');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const artifactCountContainer = document.getElementById('artifactCountContainer');
    const artifactCount = document.getElementById('artifactCount');
    const artifactListContainer = document.getElementById('artifactListContainer');
    const artifactListBody = document.getElementById('artifactListBody');
    const loadingContainer = document.getElementById('loadingContainer');
    
    // Initially disable download button
    downloadButton.disabled = true;
    
    // Check if we're on a Claude page
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentUrl = tabs[0]?.url;
      if (!currentUrl?.startsWith('https://claude.ai/chat/')) {
        hideLoading();
        showStatus('Please navigate to a Claude conversation page first', 'info');
      } else {
        // If we're on a valid page, scan for artifacts right away
        scanForArtifacts(tabs[0].id);
      }
    });
    
    // Handle download button click
    downloadButton.addEventListener('click', function() {
      // Clear previous status and show progress
      statusContainer.className = 'status hidden';
      progressContainer.className = 'progress-container';
      progressBar.style.width = '10%';
      
      // Disable button during download
      downloadButton.disabled = true;
      downloadButton.textContent = 'Processing...';
      
      // Execute the extraction script in the current tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const tabId = tabs[0].id;
        startExtraction(tabId);
      });
    });
    
    function scanForArtifacts(tabId) {
      // Show loading spinner (if not already visible)
      showLoading();
      
      // First check if our script is already injected
      chrome.tabs.sendMessage(tabId, { action: 'checkReady' }, response => {
        if (chrome.runtime.lastError || !response || !response.ready) {
          // If content script is not ready, inject it
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['extractor.js']
          }).then(() => {
            // Wait a bit for the script to initialize
            setTimeout(() => scanArtifactsWithScript(tabId), 500);
          }).catch(error => {
            console.error('Script injection failed:', error);
            hideLoading();
            showStatus('Failed to inject script: ' + error.message, 'error');
          });
        } else {
          // Content script is already ready, proceed with scanning
          scanArtifactsWithScript(tabId);
        }
      });
    }
    
    function scanArtifactsWithScript(tabId) {
      // Send message to just scan for artifacts without downloading
      chrome.tabs.sendMessage(tabId, { 
        action: 'scanArtifacts'
      }, response => {
        // Hide loading spinner once we have a response
        hideLoading();
        
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          showStatus('Error scanning for artifacts: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        if (!response) {
          showStatus('No response from page. Please refresh and try again.', 'error');
          return;
        }
        
        if (response.error) {
          showStatus('Error: ' + response.error, 'error');
          return;
        }
        
        if (!response.artifacts || response.artifacts.length === 0) {
          showStatus('No artifacts found in this conversation.', 'info');
          return;
        }
        
        // Enable download button if artifacts were found
        downloadButton.disabled = false;
        
        // Display the artifacts list
        displayArtifacts(response.artifacts);
      });
    }
    
    function startExtraction(tabId) {
      // First check if our script is already injected
      chrome.tabs.sendMessage(tabId, { action: 'checkReady' }, response => {
        if (chrome.runtime.lastError || !response || !response.ready) {
          // If content script is not ready, inject it
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['extractor.js']
          }).then(() => {
            // Wait a bit for the script to initialize
            setTimeout(() => extractArtifacts(tabId), 500);
          }).catch(error => {
            console.error('Script injection failed:', error);
            showStatus('Failed to inject script: ' + error.message, 'error');
            resetButton();
          });
        } else {
          // Content script is already ready, proceed with extraction
          extractArtifacts(tabId);
        }
      });
    }
    
    function extractArtifacts(tabId) {
      progressBar.style.width = '20%';
      
      chrome.tabs.sendMessage(tabId, { 
        action: 'extractArtifacts'
      }, response => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
          resetButton();
          return;
        }
        
        if (!response) {
          showStatus('No response from page. Please refresh and try again.', 'error');
          resetButton();
          return;
        }
        
        if (response.error) {
          showStatus('Error: ' + response.error, 'error');
          resetButton();
          return;
        }
        
        // Display artifacts if not already shown
        if (response.artifacts) {
          displayArtifacts(response.artifacts);
        }
        
        // Update progress
        progressBar.style.width = '60%';
        
        // Process successful extraction
        if (response.success) {
          chrome.runtime.sendMessage({
            action: 'downloadZip',
            zipData: response.zipData,
            conversationId: response.conversationId,
            artifactCount: response.artifactCount
          }, function(downloadResponse) {
            progressBar.style.width = '100%';
            
            if (downloadResponse && downloadResponse.success) {
              showStatus(`Successfully downloaded ${response.artifactCount} artifacts!`, 'success');
            } else {
              showStatus('Error during download: ' + 
                (downloadResponse ? downloadResponse.error : 'Unknown error'), 'error');
            }
            
            resetButton();
          });
        }
      });
    }
    
    function displayArtifacts(artifacts) {
        hideLoading()
      if (!artifacts || !artifacts.length) {
        return;
      }
      
      // Update count
      artifactCount.textContent = artifacts.length;
      artifactCountContainer.classList.remove('hidden');
      
      // Clear existing list
      artifactListBody.innerHTML = '';
      
      // Add each artifact to the table
      artifacts.forEach(artifact => {
        const row = document.createElement('tr');
        
        const filenameCell = document.createElement('td');
        filenameCell.textContent = artifact.filename;
        row.appendChild(filenameCell);
        
        const typeCell = document.createElement('td');
        typeCell.textContent = formatType(artifact.type);
        row.appendChild(typeCell);
        
        artifactListBody.appendChild(row);
      });
      
      // Show the list
      artifactListContainer.classList.remove('hidden');
    }
    
    function formatType(type) {
      if (!type) return 'Unknown';
      
      const typeMap = {
        'application/vnd.ant.code': 'Code',
        'text/markdown': 'Markdown',
        'text/html': 'HTML',
        'image/svg+xml': 'SVG',
        'application/vnd.ant.mermaid': 'Mermaid',
        'application/vnd.ant.react': 'React'
      };
      
      return typeMap[type] || type;
    }
    
    function showStatus(message, type) {
      statusContainer.textContent = message;
      statusContainer.className = `status ${type}`;
    }
    
    function resetButton() {
      downloadButton.disabled = false;
      downloadButton.textContent = 'Download Artifacts';
    }
    
    function showLoading() {
      loadingContainer.classList.remove('hidden');
      downloadButton.classList.add('hidden');
    }
    
    function hideLoading() {
      loadingContainer.classList.add('hidden');
      downloadButton.classList.remove('hidden');
    }
  });