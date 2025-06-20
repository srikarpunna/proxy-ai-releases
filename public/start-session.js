document.addEventListener('DOMContentLoaded', async () => {
  const startButton = document.getElementById('start-session-button');
  const messageArea = document.getElementById('message-area');
  let currentUser = null;

  async function initialize() {
    try {
      const { data, error } = await window.electronAPI.getCurrentUser();
      if (error || !data.user) {
        throw new Error('Could not identify user. Please restart.');
      }
      currentUser = data.user;
    } catch (error) {
      showMessage(error.message, 'error');
      startButton.disabled = true;
    }
  }

  startButton.addEventListener('click', async () => {
    if (!currentUser) {
      showMessage('User not identified. Cannot start session.', 'error');
      return;
    }

    startButton.disabled = true;
    showMessage('Activating your session...', 'info');

    const { data, error } = await window.electronAPI.startSession(currentUser.id);

    if (error) {
      showMessage(error?.message || 'Could not activate your session. Please try again.', 'error');
      startButton.disabled = false;
    } else {
      // Session started successfully, navigate to the main app
      window.electronAPI.loadMainAppPage();
    }
  });

  function showMessage(message, type = 'info') {
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
  }

  initialize();
}); 