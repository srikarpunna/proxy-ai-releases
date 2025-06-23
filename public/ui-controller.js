/**
 * UI Controller Module
 * Manages the chat interface and interaction with the backend AI service.
 */
class UIController {
  constructor() {
    // References to UI elements
    this.setupContainer = document.getElementById('setupContainer');
    this.mainContainer = document.getElementById('mainContainer');
    
    // Personalization Inputs
    this.userNameInput = document.getElementById('userName');
    this.userRoleInput = document.getElementById('userRole');
    this.assistantTraitsInput = document.getElementById('assistantTraits');
    this.userContextInput = document.getElementById('userContext');
    this.saveAndStartBtn = document.getElementById('saveAndStartBtn');
    
    // Chat Interface Elements
    this.conversationArea = document.getElementById('conversationArea');
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    
    // Media Buttons
    this.recordBtn = document.getElementById('recordBtn');
    this.captureBtn = document.getElementById('captureBtn');
    
    // Other Controls
    this.clearChatBtn = document.getElementById('clearChatBtn');
    this.toggleBrowserBtn = document.getElementById('toggleBrowserBtn');
    this.browserViewContainer = document.getElementById('browserViewContainer');
    
    // Trial Status Elements
    this.trialStatus = document.getElementById('trialStatus');
    this.trialStatusText = document.getElementById('trialStatusText');
    this.trialDaysLeft = document.getElementById('trialDaysLeft');
    this.trialNotification = document.getElementById('trialNotification');
    this.notificationTitle = document.getElementById('notificationTitle');
    this.notificationMessage = document.getElementById('notificationMessage');
    this.upgradeBtn = document.getElementById('upgradeBtn');
    this.dismissBtn = document.getElementById('dismissBtn');
    
    // State
    this.personalizationData = {};
    this.conversationHistory = [];
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.mediaStream = null;
    this.attachedImageData = null;
    this.attachedAudioData = null;
    this.isBrowserViewVisible = false;
    this.currentUser = null;
    this.sessionStatus = null;
    
    // Initialize
    this.setupEventListeners();
    this.initializeTrialStatus();
  }
  
  /**
   * Sets up all event listeners for UI elements.
   */
  setupEventListeners() {
    this.saveAndStartBtn?.addEventListener('click', () => this.savePersonalizationAndStart());
    this.sendBtn?.addEventListener('click', () => this.sendMessage());
    this.chatInput?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendMessage();
      }
    });
    this.recordBtn?.addEventListener('click', () => this.toggleRecording());
    this.captureBtn?.addEventListener('click', () => this.handleCaptureScreenClick());
    this.clearChatBtn?.addEventListener('click', () => this.clearChat());
    this.toggleBrowserBtn?.addEventListener('click', () => this.toggleBrowserVisibility());
  }
  
  /**
   * Saves personalization data and transitions to the main chat view.
   */
  savePersonalizationAndStart() {
    this.personalizationData = {
      name: this.userNameInput.value.trim(),
      role: this.userRoleInput.value.trim(),
      traits: this.assistantTraitsInput.value.trim(),
      context: this.userContextInput.value.trim(),
    };
    
    if (!this.personalizationData.name) {
      alert("Please enter your name.");
      return;
    }
    
    this.setupContainer.classList.add('hidden');
    this.mainContainer.classList.remove('hidden');
    this.displayAssistantMessage(`Hello ${this.personalizationData.name}! How can I help you today?`);
  }
  
  /**
   * Handles sending a user message and processing the streamed AI response.
   */
  async sendMessage() {
    const messageText = this.chatInput.value.trim();
    if (!messageText && !this.attachedImageData && !this.attachedAudioData) return;

    const messageToSend = messageText || "(Media attached)";
    this.displayUserMessage(messageToSend, this.attachedImageData, !!this.attachedAudioData);
    this.conversationHistory.push({ role: 'user', content: messageToSend });

    const imageDataToSend = this.attachedImageData;
    const audioDataToProcess = this.attachedAudioData;
    this.chatInput.value = '';
    this.updateInputAreaAttachmentUI(false);
    this.updateInputAreaAudioUI(false);

    // Create a NEW assistant message for this response
    const assistantMessageElement = this.displayAssistantMessage("");
    const assistantContentElement = assistantMessageElement.querySelector('.message-content');
    let fullReply = "";

    try {
      const requestData = {
        message: messageText,
        history: this.conversationHistory.slice(0, -1),
        personalization: this.personalizationData,
        imageData: imageDataToSend,
      };

      // Debug: Log conversation history being sent
      console.log('🔍 Sending conversation history to LLM:', {
        historyLength: requestData.history.length,
        history: requestData.history,
        currentMessage: messageText
      });

      if (audioDataToProcess) {
        requestData.audioData = {
          base64: await this.convertBlobToBase64(audioDataToProcess.blob),
          mimeType: audioDataToProcess.mimeType
        };
      }

      // Clear any existing stream listeners to prevent mixing
      if (window.electronAPI && window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners('chat:stream-chunk');
      }

      // Use Electron IPC - send the message via the correct method
      if (window.electronAPI && window.electronAPI.sendChatMessage) {
        window.electronAPI.sendChatMessage(requestData);
      } else {
        throw new Error('Electron API not available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      // Listen for streaming chunks via Electron IPC
      if (window.electronAPI && window.electronAPI.onChatStream) {
        window.electronAPI.onChatStream((streamEvent) => {
          if (streamEvent.status === 'error') {
            console.error("Error from chat stream:", streamEvent.error);
            if (assistantContentElement) {
              assistantContentElement.innerHTML = this.renderAssistantContent(`Sorry, I encountered an error: ${streamEvent.error}`);
            }
            return;
          }

          if (streamEvent.status === 'done') {
            this.conversationHistory.push({ role: 'assistant', content: fullReply });
            console.log('✅ Assistant response added to history. Total messages:', this.conversationHistory.length);
            console.log('📝 Current conversation history:', this.conversationHistory);
            assistantContentElement.innerHTML = this.renderAssistantContent(fullReply);
            // Ensure final code blocks are highlighted
            assistantContentElement.querySelectorAll('pre code').forEach((block) => {
              hljs.highlightElement(block);
            });
            return;
          }

          // Process raw chunks from Electron IPC
          if (streamEvent.chunk) {
            buffer += decoder.decode(streamEvent.chunk, { stream: true });
            let boundary = buffer.indexOf('\n\n');

            while (boundary !== -1) {
              const message = buffer.substring(0, boundary);
              buffer = buffer.substring(boundary + 2);

              if (message.startsWith('data:')) {
                const jsonStr = message.substring(5).trim();
                if (jsonStr) {
                  try {
                    const data = JSON.parse(jsonStr);
                    if (data.error) throw new Error(data.error);

                    if (data.chunk === '[DONE]') {
                      return;
                    }

                    fullReply += data.chunk;
                    // Update THIS specific assistant message element
                    assistantContentElement.innerHTML = this.renderAssistantContent(fullReply);
                  } catch (e) {
                    console.error('Error parsing stream data chunk:', jsonStr, e);
                  }
                }
              }
              boundary = buffer.indexOf('\n\n');
            }
          }
        });
      } else {
        throw new Error('Electron chat stream API not available');
      }

    } catch (error) {
      console.error("Error preparing chat request:", error);
      if (assistantContentElement) {
        assistantContentElement.innerHTML = this.renderAssistantContent("Sorry, I encountered an error preparing your message. Please try again.");
      }
    }
  }

  /**
   * Appends a user-authored message to the chat area.
   */
  displayUserMessage(message, imageData = null, hasAudio = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'message-user');

    const div = document.createElement('div');
    div.textContent = message;
    const escapedMessage = div.innerHTML;

    let imagePreviewHtml = imageData ? `
      <img src="data:${imageData.mimeType};base64,${imageData.base64}" 
           alt="Attached image preview" 
           style="max-width: 100px; max-height: 70px; border-radius: 4px; margin-top: 5px; display: block;">` : '';

    let audioIndicatorHtml = hasAudio ? `
      <div style="font-style: italic; font-size: 0.9em; color: #555; margin-top: 5px;">
          <i class="fas fa-file-audio"></i> Audio attached
      </div>` : '';

    messageElement.innerHTML = `
        <div class="message-role">${this.personalizationData.name || 'You'}</div>
        <div class="message-content">${escapedMessage}</div>
        ${imagePreviewHtml}
        ${audioIndicatorHtml}
    `;
    this.conversationArea.appendChild(messageElement);
    this.scrollToBottom();
  }
  
  /**
   * Appends an empty assistant message bubble to the chat area.
   */
  displayAssistantMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'message-assistant');
    const processedContent = this.renderAssistantContent(message);
    messageElement.innerHTML = `
        <div class="message-role">Assistant</div>
        <div class="message-content">${processedContent}</div>`;
    this.conversationArea.appendChild(messageElement);
    this.scrollToBottom();
    return messageElement;
  }
  
  /**
   * Renders a string with markdown into safe, highlighted HTML.
   */
  renderAssistantContent(text) {
    if (typeof text !== 'string') return '';
    marked.setOptions({
      highlight: function (code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
      },
      langPrefix: 'hljs language-',
      gfm: true,
      breaks: true,
    });
    return marked.parse(text);
  }
  
  scrollToBottom() {
    setTimeout(() => { this.conversationArea.scrollTop = this.conversationArea.scrollHeight; }, 0);
  }

  // --- Media and System Methods ---

  async convertBlobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  toggleRecording() {
    this.isRecording ? this.stopRecording() : this.startRecording();
  }

  async startRecording() {
    if (this.isRecording) return;
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
      this.mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) this.audioChunks.push(event.data); };
      this.mediaRecorder.onstop = () => {
        this.handleAudioData();
        this.mediaStream?.getTracks().forEach(track => track.stop());
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      Object.assign(this.recordBtn.style, { backgroundColor: '#dc3545' });
      this.recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
      Object.assign(this.chatInput, { placeholder: 'Recording...', disabled: true });
    } catch (error) {
      alert('Could not start recording. Please ensure microphone access is granted.');
      this.mediaStream?.getTracks().forEach(track => track.stop());
    }
  }

  stopRecording() {
    if (!this.isRecording) return;
    this.mediaRecorder.stop();
    this.isRecording = false;
    Object.assign(this.recordBtn.style, { backgroundColor: '' });
    this.recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    Object.assign(this.chatInput, { placeholder: 'Type your message or press mic to record...', disabled: false });
  }

  handleAudioData() {
    if (this.audioChunks.length === 0) return;
    const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
    this.attachedAudioData = { blob: audioBlob, mimeType: audioBlob.type };
    this.updateInputAreaAudioUI(true);
    
    // --- Securely Upload the Audio ---
    this.uploadAndAttachAudio(audioBlob);
    
    this.audioChunks = [];
  }

  async uploadAndAttachAudio(blob) {
    try {
      const userResult = await window.electronAPI.getCurrentUser();
      if (userResult.error || !userResult.data.user) throw new Error('Could not get current user for upload.');

      const base64Audio = await this.convertBlobToBase64(blob);
      
      const { data, error } = await window.electronAPI.uploadAudio({
        userId: userResult.data.user.id,
        audioData: base64Audio,
        mimeType: blob.type
      });

      if (error) {
        console.error('Audio upload failed:', error);
        // Optionally show a non-blocking error to the user
      } else {
        console.log('Audio uploaded successfully:', data.path);
        // We can store the path if needed for later reference
      }
    } catch (uploadError) {
      console.error('Error during audio upload process:', uploadError);
    }
  }

  async handleCaptureScreenClick() {
    this.captureBtn.disabled = true;
    try {
      const result = await window.electronAPI.captureScreen();
      if (result?.base64) {
        this.attachedImageData = { base64: result.base64, mimeType: result.mimeType };
        this.updateInputAreaAttachmentUI(true);
      } else {
        alert(`Could not capture screen: ${result?.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`Failed to capture screen: ${error.message}`);
    }
    this.captureBtn.disabled = false;
  }

  updateInputAreaAttachmentUI(isAttached) {
    const inputArea = document.querySelector('.chat-input-area');
    if (!inputArea) return;
    let previewElement = inputArea.querySelector('.attachment-preview');
    if (!previewElement) {
      previewElement = document.createElement('div');
      previewElement.className = 'attachment-preview';
      previewElement.style.cssText = 'position: relative; margin-right: 10px; display: none;';
      const img = document.createElement('img');
      img.style.cssText = 'max-width: 80px; max-height: 50px; border-radius: 4px; vertical-align: middle;';
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = 'position: absolute; top: -5px; right: -5px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 16px; height: 16px; line-height: 14px; font-size: 12px; cursor: pointer; padding: 0;';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.updateInputAreaAttachmentUI(false);
      };
      previewElement.append(img, closeBtn);
      inputArea.insertBefore(previewElement, this.chatInput);
    }
    previewElement.style.display = isAttached ? 'inline-block' : 'none';
    if (isAttached) {
      previewElement.querySelector('img').src = `data:${this.attachedImageData.mimeType};base64,${this.attachedImageData.base64}`;
    } else {
      this.attachedImageData = null;
    }
  }
  
  updateInputAreaAudioUI(isAttached) {
    const inputArea = document.querySelector('.chat-input-area');
    if (!inputArea) return;
    let previewElement = inputArea.querySelector('.audio-attachment-preview');
    if (!previewElement) {
      previewElement = document.createElement('div');
      previewElement.className = 'audio-attachment-preview';
      previewElement.style.cssText = 'position: relative; margin-right: 10px; display: none; padding: 5px 10px; background: #f0f0f0; border-radius: 4px; font-size: 0.9em; color: #333; vertical-align: middle; align-items: center;';
      previewElement.innerHTML = '<i class="fas fa-file-audio" style="margin-right: 5px;"></i> Audio ready';
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.style.cssText = 'position: absolute; top: -8px; right: -8px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 16px; height: 16px; line-height: 14px; font-size: 12px; cursor: pointer; padding: 0;';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.updateInputAreaAudioUI(false);
      };
      previewElement.appendChild(closeBtn);
      inputArea.insertBefore(previewElement, this.chatInput);
    }
    previewElement.style.display = isAttached ? 'inline-flex' : 'none';
    if (!isAttached) this.attachedAudioData = null;
  }
  
  clearChat() {
    this.conversationHistory = [];
    this.conversationArea.innerHTML = '';
    this.updateInputAreaAttachmentUI(false);
    this.updateInputAreaAudioUI(false);
    this.displayAssistantMessage("Chat cleared.");
  }

  toggleBrowserVisibility() {
    this.isBrowserViewVisible = !this.isBrowserViewVisible;
    const action = this.isBrowserViewVisible ? 'show' : 'hide';
    this.mainContainer.classList.toggle('hidden', this.isBrowserViewVisible);
    this.browserViewContainer.style.display = this.isBrowserViewVisible ? 'flex' : 'none';
    this.toggleBrowserBtn.innerHTML = this.isBrowserViewVisible ? '<i class="fas fa-comment-dots"></i>' : '<i class="fas fa-globe"></i>';
    this.toggleBrowserBtn.title = this.isBrowserViewVisible ? 'Show Chat View' : 'Show Web Browser';
    window.api?.send('toggle-browser-view', { action });
  }

  /**
   * Initialize trial status checking and setup event listeners
   */
  async initializeTrialStatus() {
    try {
      // Get current user
      const { data, error } = await window.electronAPI.getCurrentUser();
      if (error || !data?.user) {
        console.error('Failed to get current user for trial status');
        return;
      }
      
      this.currentUser = data.user;
      
      // Setup trial notification event listeners
      this.upgradeBtn?.addEventListener('click', () => this.handleUpgrade());
      this.dismissBtn?.addEventListener('click', () => this.dismissTrialNotification());
      
      // Check trial status
      await this.checkTrialStatus();
      
      // Set up periodic checking (every 5 minutes)
      setInterval(() => this.checkTrialStatus(), 5 * 60 * 1000);
      
    } catch (error) {
      console.error('Error initializing trial status:', error);
    }
  }

  /**
   * Check current trial/session status and update UI
   */
  async checkTrialStatus() {
    try {
      if (!this.currentUser) return;
      
      const { data: sessionData, error } = await window.electronAPI.getSessionStatus(this.currentUser.id);
      
      if (error) {
        console.error('Error checking session status:', error);
        return;
      }
      
      this.sessionStatus = sessionData;
      this.updateTrialStatusDisplay();
      this.checkForTrialNotifications();
      
    } catch (error) {
      console.error('Error in checkTrialStatus:', error);
    }
  }

  /**
   * Update the trial status indicator in the header
   */
  updateTrialStatusDisplay() {
    if (!this.trialStatus || !this.sessionStatus) return;
    
    // Remove all status classes
    this.trialStatus.classList.remove('trial-active', 'trial-warning', 'trial-expired', 'trial-paid', 'trial-admin');
    
    const sessionType = this.sessionStatus.session_type;
    const status = this.sessionStatus.status;
    
    if (sessionType === 'admin') {
      this.trialStatus.classList.add('trial-admin');
      this.trialStatusText.textContent = 'Admin Access';
      this.trialDaysLeft.textContent = '';
      this.trialStatus.querySelector('i').className = 'fas fa-crown';
    } else if (sessionType === 'paid') {
      this.trialStatus.classList.add('trial-paid');
      this.trialStatusText.textContent = 'Premium';
      this.trialDaysLeft.textContent = this.formatTimeRemaining(this.sessionStatus.activated_at, 24); // 24 hours
      this.trialStatus.querySelector('i').className = 'fas fa-star';
    } else if (sessionType === 'free_trial') {
      const daysLeft = this.calculateDaysLeft(this.sessionStatus.expires_at);
      
      if (daysLeft <= 0) {
        this.trialStatus.classList.add('trial-expired');
        this.trialStatusText.textContent = 'Trial Expired';
        this.trialDaysLeft.textContent = '';
        this.trialStatus.querySelector('i').className = 'fas fa-exclamation-triangle';
      } else if (daysLeft <= 3) {
        this.trialStatus.classList.add('trial-warning');
        this.trialStatusText.textContent = 'Trial Ending';
        this.trialDaysLeft.textContent = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
        this.trialStatus.querySelector('i').className = 'fas fa-clock';
      } else {
        this.trialStatus.classList.add('trial-active');
        this.trialStatusText.textContent = 'Free Trial';
        this.trialDaysLeft.textContent = `${daysLeft} days left`;
        this.trialStatus.querySelector('i').className = 'fas fa-clock';
      }
    }
    
    // Show the trial status indicator
    this.trialStatus.classList.remove('hidden');
  }

  /**
   * Check if we need to show trial expiration notifications
   */
  checkForTrialNotifications() {
    if (!this.sessionStatus || this.sessionStatus.session_type !== 'free_trial') return;
    
    const daysLeft = this.calculateDaysLeft(this.sessionStatus.expires_at);
    
    // Show notification if 3 days or less remaining
    if (daysLeft <= 3 && daysLeft > 0) {
      this.showTrialNotification(
        'Trial Expiring Soon',
        `Your free trial will expire in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Upgrade now to continue using the assistant.`
      );
    } else if (daysLeft <= 0) {
      this.showTrialNotification(
        'Trial Expired',
        'Your free trial has expired. Please upgrade to continue using the assistant.',
        true
      );
    }
  }

  /**
   * Show trial notification modal
   */
  showTrialNotification(title, message, isExpired = false) {
    if (!this.trialNotification) return;
    
    // Don't show notification too frequently (once per session)
    const notificationKey = `trial_notification_${isExpired ? 'expired' : 'warning'}_shown`;
    if (sessionStorage.getItem(notificationKey)) return;
    
    this.notificationTitle.textContent = title;
    this.notificationMessage.textContent = message;
    
    if (isExpired) {
      this.dismissBtn.textContent = 'Continue Anyway';
      this.upgradeBtn.textContent = 'Upgrade Now';
    } else {
      this.dismissBtn.textContent = 'Remind Later';
      this.upgradeBtn.textContent = 'Upgrade Now';
    }
    
    this.trialNotification.classList.add('show');
    
    // Mark as shown for this session
    sessionStorage.setItem(notificationKey, 'true');
  }

  /**
   * Handle upgrade button click
   */
  handleUpgrade() {
    this.dismissTrialNotification();
    // Navigate to payment page
    if (window.electronAPI?.loadPaymentPage) {
      window.electronAPI.loadPaymentPage();
    }
  }

  /**
   * Dismiss trial notification
   */
  dismissTrialNotification() {
    if (this.trialNotification) {
      this.trialNotification.classList.remove('show');
    }
  }

  /**
   * Calculate days left from expiration date
   */
  calculateDaysLeft(expiresAt) {
    if (!expiresAt) return 0;
    
    const now = new Date();
    const expiration = new Date(expiresAt);
    const diffTime = expiration - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Format time remaining for paid sessions
   */
  formatTimeRemaining(activatedAt, durationHours) {
    if (!activatedAt) return '';
    
    const activated = new Date(activatedAt);
    const expires = new Date(activated.getTime() + (durationHours * 60 * 60 * 1000));
    const now = new Date();
    const diffTime = expires - now;
    
    if (diffTime <= 0) return 'Expired';
    
    const hours = Math.floor(diffTime / (1000 * 60 * 60));
    const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.uiController = new UIController();
});

/**
 * UpdateManager - Handles app updates and notifications
 */
class UpdateManager {
  constructor() {
    this.currentVersion = '1.0.0';
    this.isUpdateAvailable = false;
    this.isDownloading = false;
    this.downloadProgress = 0;
    
    this.init();
  }

  async init() {
    try {
      // Get current app version
      if (window.electronAPI && window.electronAPI.getAppVersion) {
        this.currentVersion = await window.electronAPI.getAppVersion();
      }
      
      // Display version info
      this.displayVersionInfo();
      
      // Check for updates on startup (after a delay)
      setTimeout(() => {
        this.checkForUpdates();
      }, 5000);
      
    } catch (error) {
      console.error('Error initializing UpdateManager:', error);
    }
  }

  displayVersionInfo() {
    // Add version info to the page
    let versionElement = document.querySelector('.version-info');
    if (!versionElement) {
      versionElement = document.createElement('div');
      versionElement.className = 'version-info';
      document.body.appendChild(versionElement);
    }
    versionElement.textContent = `v${this.currentVersion}`;
  }

  async checkForUpdates() {
    if (!window.electronAPI || !window.electronAPI.checkForUpdates) {
      console.log('Update functionality not available in this environment');
      return;
    }

    try {
      console.log('🔍 Checking for updates...');
      const result = await window.electronAPI.checkForUpdates();
      
      if (result.success && result.result) {
        console.log('✅ Update check completed');
        // The auto-updater will handle showing notifications
      } else {
        console.log('ℹ️ No updates available or error occurred');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  }

  showUpdateNotification(updateInfo) {
    // Remove existing notification
    const existing = document.querySelector('.update-notification');
    if (existing) {
      existing.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
      <h4>🚀 Update Available</h4>
      <p>Version ${updateInfo.version} is ready to download.</p>
      <div class="update-actions">
        <button class="update-btn primary" onclick="updateManager.downloadUpdate()">
          Download Now
        </button>
        <button class="update-btn secondary" onclick="updateManager.dismissNotification()">
          Later
        </button>
      </div>
    `;

    document.body.appendChild(notification);
    
    // Show with animation
    setTimeout(() => {
      notification.classList.add('show');
    }, 100);
  }

  showDownloadProgress(progress) {
    const notification = document.querySelector('.update-notification');
    if (!notification) return;

    notification.innerHTML = `
      <h4>📥 Downloading Update</h4>
      <p>Downloading version ${progress.version}...</p>
      <div class="update-progress">
        <div class="update-progress-bar" style="width: ${progress.percent}%"></div>
      </div>
      <p style="font-size: 12px; opacity: 0.8;">
        ${Math.round(progress.percent)}% - ${this.formatBytes(progress.transferred)} / ${this.formatBytes(progress.total)}
      </p>
    `;
  }

  showReadyToInstall() {
    const notification = document.querySelector('.update-notification');
    if (!notification) return;

    notification.innerHTML = `
      <h4>✅ Update Ready</h4>
      <p>The update has been downloaded and is ready to install.</p>
      <div class="update-actions">
        <button class="update-btn primary" onclick="updateManager.installUpdate()">
          Restart & Install
        </button>
        <button class="update-btn secondary" onclick="updateManager.dismissNotification()">
          Install Later
        </button>
      </div>
    `;
  }

  async downloadUpdate() {
    if (!window.electronAPI || !window.electronAPI.downloadUpdate) return;

    try {
      this.isDownloading = true;
      const result = await window.electronAPI.downloadUpdate();
      
      if (result.success) {
        console.log('✅ Update download started');
      } else {
        console.error('❌ Failed to start download:', result.error);
        this.showError('Failed to download update: ' + result.error);
      }
    } catch (error) {
      console.error('Error downloading update:', error);
      this.showError('Error downloading update: ' + error.message);
    }
  }

  async installUpdate() {
    if (!window.electronAPI || !window.electronAPI.installUpdate) return;

    try {
      await window.electronAPI.installUpdate();
    } catch (error) {
      console.error('Error installing update:', error);
    }
  }

  dismissNotification() {
    const notification = document.querySelector('.update-notification');
    if (notification) {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }

  showError(message) {
    const notification = document.querySelector('.update-notification');
    if (!notification) return;

    notification.innerHTML = `
      <h4>❌ Update Error</h4>
      <p>${message}</p>
      <div class="update-actions">
        <button class="update-btn secondary" onclick="updateManager.dismissNotification()">
          Close
        </button>
      </div>
    `;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
} 