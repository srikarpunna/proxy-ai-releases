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
    
    // Initialize
    this.setupEventListeners();
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

      if (audioDataToProcess) {
        requestData.audioData = {
          base64: await this.convertBlobToBase64(audioDataToProcess.blob),
          mimeType: audioDataToProcess.mimeType
        };
      }

      // THIS IS THE REFACTORED PART
      window.electronAPI.sendChatMessage(requestData);

      const decoder = new TextDecoder();
      let buffer = '';

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
          assistantContentElement.innerHTML = this.renderAssistantContent(fullReply);
          // Ensure final code blocks are highlighted
          assistantContentElement.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
          });
          return;
        }

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
                    // This is now handled by the 'done' status event
                    return;
                  }

                  fullReply += data.chunk;
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
}

document.addEventListener('DOMContentLoaded', () => {
  window.uiController = new UIController();
}); 