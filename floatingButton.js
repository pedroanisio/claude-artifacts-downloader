// Function to check if we're on a Claude conversation page
function isClaudeConversation() {
  return window.location.href.includes('https://claude.ai/chat/');
}

// Function to create and inject the floating button
function createFloatingButton() {
  // Only create the button if we're on a Claude conversation page
  if (!isClaudeConversation()) {
    return;
  }

  // Create the button element
  const floatingButton = document.createElement('div');
  floatingButton.className = 'claude-artifacts-floating-button';
  floatingButton.title = 'Download Claude Artifacts';
  
  // Add the logo image
  const logoImg = document.createElement('img');
  logoImg.src = chrome.runtime.getURL('images/logo128.png');
  logoImg.alt = 'Claude Artifacts';
  logoImg.className = 'claude-artifacts-logo';
  floatingButton.appendChild(logoImg);
  
  // Add click handler to trigger the extension popup
  floatingButton.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'openPopup' });
  });
  
  // Add styles
  const styles = document.createElement('style');
  styles.textContent = `
    .claude-artifacts-floating-button {
      position: fixed;
      bottom: 10px;
      right: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      transition: all 0.3s ease;
    }
    
    .claude-artifacts-floating-button:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    }
    
    .claude-artifacts-logo {
      width: 36px;
      height: 36px;
    }
  `;
  
  // Append the button and styles to the document
  document.head.appendChild(styles);
  document.body.appendChild(floatingButton);
}

// Run when the DOM is fully loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createFloatingButton);
} else {
  createFloatingButton();
}