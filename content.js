// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'extractArtifacts') {
      extractArtifacts().then(response => {
        sendResponse(response);
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      
      // Return true to indicate we want to send a response asynchronously
      return true;
    }
  });
  
  // Function to extract conversation ID from URL
  function getConversationId() {
    const url = window.location.href;
    const match = url.match(/\/chat\/([0-9a-f-]+)/);
    return match ? match[1] : null;
  }
  
  // Main function to extract artifacts
  async function extractArtifacts() {
    try {
      // Load required libraries first
      await loadLibraries();
      
      // Get the conversation ID
      const conversationId = getConversationId();
      if (!conversationId) {
        throw new Error("Could not extract conversation ID from URL");
      }
      
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
              title: artifactData.title,
              content: artifactData.content,
              type: artifactData.type,
              language: artifactData.language,
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
      
      // Create a zip file
      const zip = new JSZip();
      
      // Add each artifact to the zip
      for (const id in artifacts) {
        const artifact = artifacts[id];
        zip.file(artifact.filename, artifact.content);
      }
      
      // Generate the zip content as base64
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = function() {
          // Extract the base64 data
          const base64data = reader.result.split(',')[1];
          
          // Send back the artifacts data
          resolve({
            success: true,
            conversationId: conversationId,
            zipData: base64data,
            artifactCount: Object.keys(artifacts).length
          });
        };
        
        reader.onerror = function() {
          reject(new Error("Failed to convert zip to base64"));
        };
        
        reader.readAsDataURL(zipBlob);
      });
      
    } catch (error) {
      console.error("Error extracting artifacts:", error);
      throw error;
    }
  }
  
  // Helper function to extract filename from title
  function extractFilename(title) {
    if (!title) return "unknown.txt";
    
    // Try to extract filename from title patterns like "filename.ext - Title"
    const match = title.match(/^([^-]+)(\s*-\s*.+)?$/);
    if (match) {
      return match[1].trim();
    }
    
    // Fallback: sanitize the title and use as filename
    return title.replace(/[^a-zA-Z0-9_\-\.]/g, '_').toLowerCase();
  }
  
  // Function to extract organization ID
  function getOrganizationId() {
    // Try to get from URL or localStorage
    // This is a simplified approach - may need to be enhanced
    const url = window.location.href;
    const match = url.match(/\/organizations\/([0-9a-f-]+)/);
    if (match) return match[1];
    
    return "";
  }
  
  // Load required libraries asynchronously
  async function loadLibraries() {
    // Check if JSZip is already loaded
    if (window.JSZip) {
      return;
    }
    
    // Load JSZip library
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }