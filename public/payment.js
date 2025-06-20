document.addEventListener('DOMContentLoaded', async () => {
  const payButton = document.getElementById('pay-button');
  const devModeDiv = document.getElementById('dev-mode');
  const devBypassButton = document.getElementById('dev-bypass-button');
  const messageArea = document.getElementById('message-area');
  let stripe = null;
  let currentUser = null;

  // Check if we're in development mode
  const isDevelopment = true; // Always show in development for now

  async function initialize() {
    try {
      const publishableKey = await window.electronAPI.getStripePublishableKey();
      if (!publishableKey) {
        throw new Error('Stripe configuration is missing.');
      }
      stripe = Stripe(publishableKey);

      const { data, error } = await window.electronAPI.getCurrentUser();
      if (error) {
        throw new Error('Could not identify user. Please restart.');
      }
      currentUser = data.user;

      // Show development mode bypass if in development
      if (isDevelopment) {
        devModeDiv.style.display = 'block';
      }

    } catch (error) {
      showMessage(error.message, 'error');
      payButton.disabled = true;
    }
  }

  // Production payment flow
  payButton.addEventListener('click', async () => {
    if (!currentUser || !stripe) {
      showMessage('User not identified or Stripe not initialized. Cannot proceed with payment.', 'error');
      return;
    }

    payButton.disabled = true;
    showMessage('Creating payment session...', 'info');

    try {
      const { data, error } = await window.electronAPI.createCheckoutSession(currentUser.id);

      if (error || !data || !data.url) {
        throw new Error(error?.message || 'Could not create payment session. Please try again.');
      }

      showMessage('Opening Stripe Checkout in your browser...', 'info');
      
      // Open the Stripe checkout URL in the user's default browser
      await window.electronAPI.openExternalUrl(data.url);
      
      // Show instruction to user
      showMessage('Complete your payment in the browser, then return to this app.', 'info');
      
    } catch (err) {
      showMessage(err.message, 'error');
      payButton.disabled = false;
    }
  });

  // Development mode bypass
  devBypassButton.addEventListener('click', async () => {
    if (!currentUser) {
      showMessage('User not identified. Cannot proceed.', 'error');
      return;
    }

    devBypassButton.disabled = true;
    showMessage('Checking admin status and creating session...', 'info');

    try {
      // Call the admin-session Edge Function to check admin status and create session
      const result = await window.electronAPI.createAdminSession();

      if (result.error) {
        throw new Error(result.error);
      }

      showMessage('Admin session created! Redirecting to app...', 'success');
      
      // Wait a moment then redirect to main app
      setTimeout(() => {
        window.electronAPI.loadMainAppPage();
      }, 1500);

    } catch (err) {
      showMessage(err.message, 'error');
      devBypassButton.disabled = false;
    }
  });

  function showMessage(message, type = 'info') {
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
  }

  initialize();
});

// We need to include the Stripe.js script in our payment.html
// I will add that now. 