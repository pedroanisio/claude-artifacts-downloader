// Global variable to signal that the extractor is ready
window.claudeArtifactsExtractorReady = true;

// Setup message listener
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  
  if (request.action === 'checkReady') {
    sendResponse({ ready: true });
    return true;
  }
  
  if (request.action === 'scanArtifacts') {
    
    scanArtifacts().then(response => {
      sendResponse(response);
    }).catch(error => {
      console.error('Scan failed:', error);
      sendResponse({ error: error.message });
    });
    
    // Return true to indicate we want to send a response asynchronously
    return true;
  }
  
  if (request.action === 'extractArtifacts') {
    
    extractArtifacts().then(response => {
      sendResponse(response);
    }).catch(error => {
      console.error('Extraction failed:', error);
      sendResponse({ error: error.message });
    });
    
    // Return true to indicate we want to send a response asynchronously
    return true;
  }
});

// Signal that the script is loaded
console.log('Claude Artifacts Extractor script loaded');

// Function to extract conversation ID from URL
function getConversationId() {
  const url = window.location.href;
  const match = url.match(/\/chat\/([0-9a-f-]+)/);
  return match ? match[1] : null;
}

// Function to just scan for artifacts without creating a zip
async function scanArtifacts() {
  try {
    // Get conversation ID
    const conversationId = getConversationId();
    if (!conversationId) {
      throw new Error("Could not extract conversation ID from URL");
    }
    
    // Get artifacts data
    const artifactsData = await extractArtifactsData(conversationId);
    
    return {
      success: true,
      conversationId: conversationId,
      artifacts: artifactsData.artifacts,
      artifactCount: artifactsData.artifacts.length
    };
  } catch (error) {
    console.error("Error scanning artifacts:", error);
    throw error;
  }
}

// Main function to extract artifacts
async function extractArtifacts() {
  try {
    
    // Get the conversation ID
    const conversationId = getConversationId();
    if (!conversationId) {
      throw new Error("Could not extract conversation ID from URL");
    }
    
    // Get artifacts data
    const artifactsData = await extractArtifactsData(conversationId);
    
    // Send data to background for processing
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'createZip',
        data: {
          conversationId: conversationId,
          artifacts: artifactsData.artifacts
        }
      }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!response || response.error) {
          reject(new Error(response ? response.error : 'Unknown error'));
          return;
        }
        
        resolve({
          success: true,
          conversationId: conversationId,
          zipData: response.zipData,
          artifactCount: artifactsData.artifacts.length,
          artifacts: artifactsData.artifacts
        });
      });
    });
    
  } catch (error) {
    console.error("Error extracting artifacts:", error);
    throw error;
  }
}

// Helper function to extract artifacts data
async function extractArtifactsData(conversationId) {
  // Create API URL
  const orgId = getOrganizationId();
  const apiUrl = `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}?tree=True&rendering_mode=messages&render_all_tools=true`;
  
  // Fetch the conversation data
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`API request failed with status: ${response.status}`);
  }
  
  const data = await response.json();
  
  // Extract artifacts
  const artifacts = {};
  
  // Iterate through all messages
  data.chat_messages.forEach(message => {
    // Skip if not from assistant
    if (message.sender !== 'assistant') return;
    
    // Look for content with tool_use
    if (!message.content) return;
    
    message.content.forEach(item => {
      if (item.type !== 'tool_use' || item.name !== 'artifacts') return;
      
      const artifactData = item.input;
      const artifactId = artifactData.id;
      
      // Create or update the artifact
      if (artifactData.command === 'create') {
        artifacts[artifactId] = {
          id: artifactId,
          title: artifactData.title || 'Untitled',
          content: artifactData.content,
          type: artifactData.type || 'text/plain',
          language: artifactData.language || '',
          filename: extractFilename(artifactData.title)
        };
      } else if (artifactData.command === 'update') {
        // Update existing artifact if it exists
        if (artifacts[artifactId]) {
          // If this is a string replacement, apply it
          if (artifactData.old_str && artifactData.new_str) {
            artifacts[artifactId].content = artifacts[artifactId].content.replace(
              artifactData.old_str,
              artifactData.new_str
            );
          } else if (artifactData.content) {
            // Or if it's a full content replacement
            artifacts[artifactId].content = artifactData.content;
          }
        }
      }
    });
  });
  
  return {
    artifacts: Object.values(artifacts)
  };
}

// Helper function to extract filename from title
function extractFilename(title) {
	if (!title) return "unknown.txt";

	return title.split(" ")[0].trim();
}


// Function to extract organization ID
function getOrganizationId() {
  // Try to get from URL
  const urlMatch = window.location.href.match(/\/organizations\/([0-9a-f-]+)/);
  if (urlMatch) return urlMatch[1];
  
  // Try from localStorage
  try {
    const apolloState = JSON.parse(localStorage.getItem('apollo-cache-persist') || '{}');
    for (const key in apolloState) {
      if (key.includes('Organization') && apolloState[key]?.id) {
        return apolloState[key].id;
      }
    }
  } catch (e) {
    console.warn('Could not extract organization ID from localStorage:', e);
  }
  
  // Default value from the API URL in the example
  return "3a282320-9fdd-4d0d-9223-058d86e9c384";
}