document.addEventListener('DOMContentLoaded', async () => {
  const payButton = document.getElementById('pay-button');
  const skipPaymentBtn = document.getElementById('skip-payment-btn');
  const messageArea = document.getElementById('message-area');
  const trialStatus = document.getElementById('trial-status');
  const trialTitle = document.getElementById('trial-title');
  const trialMessage = document.getElementById('trial-message');
  const trialDaysLeft = document.getElementById('trial-days-left');
  const paymentDescription = document.getElementById('payment-description');
  
  let stripe = null;
  let currentUser = null;
  let sessionStatus = null;

  async function initialize() {
    try {
      console.log('Payment page initializing...');
      
      // Get current user
      const { data, error } = await window.electronAPI.getCurrentUser();
      console.log('getCurrentUser result:', { data, error });
      
      if (error) {
        console.error('getCurrentUser error:', error);
        throw new Error('Could not identify user. Please restart.');
      }
      
      // Handle case where user might be null in development mode
      if (!data || !data.user) {
        console.log('No user data found, using development mode fallback');
        currentUser = { id: 'dev-user-id', email: 'dev@example.com' };
      } else {
        currentUser = data.user;
      }
      
      console.log('Current user:', currentUser);

      // Get session status to determine trial state
      console.log('Getting session status for user:', currentUser.id);
      const sessionResult = await window.electronAPI.getSessionStatus(currentUser.id);
      console.log('getSessionStatus result:', sessionResult);
      
      if (sessionResult.error) {
        console.error('getSessionStatus error:', sessionResult.error);
        const errorMessage = typeof sessionResult.error === 'string' 
          ? sessionResult.error 
          : sessionResult.error.message || JSON.stringify(sessionResult.error);
        throw new Error(`Could not get session status: ${errorMessage}`);
      }
      
      sessionStatus = sessionResult.data;
      console.log('Session status:', sessionStatus);

      // Initialize Stripe (only if needed for payment)
      if (shouldShowPayment()) {
        console.log('Payment required, initializing Stripe...');
        const publishableKey = await window.electronAPI.getStripePublishableKey();
        if (!publishableKey) {
          throw new Error('Stripe configuration is missing.');
        }
        stripe = Stripe(publishableKey);
        console.log('Stripe initialized');
      } else {
        console.log('Payment not required, skipping Stripe initialization');
      }

      // Update UI based on trial status
      updateUIBasedOnTrialStatus();
      console.log('Payment page initialization complete');

    } catch (error) {
      console.error('Payment page initialization error:', error);
      showMessage(error.message, 'error');
      payButton.disabled = true;
    }
  }

  function shouldShowPayment() {
    if (!sessionStatus) return false;
    
    // Show payment if:
    // 1. No free trial (shouldn't happen with current logic)
    // 2. Free trial has expired
    // 3. User is not admin
    return sessionStatus.session_type !== 'admin' && 
           (sessionStatus.session_type !== 'free_trial' || isTrialExpired());
  }

  function isTrialExpired() {
    if (!sessionStatus || !sessionStatus.expires_at) return true;
    
    const now = new Date();
    const expiration = new Date(sessionStatus.expires_at);
    return now >= expiration;
  }

  function calculateDaysLeft() {
    if (!sessionStatus || !sessionStatus.expires_at) return 0;
    
    const now = new Date();
    const expiration = new Date(sessionStatus.expires_at);
    const diffTime = expiration - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  function updateUIBasedOnTrialStatus() {
    const daysLeft = calculateDaysLeft();
    const isExpired = isTrialExpired();
    
    if (sessionStatus.session_type === 'admin') {
      // Admin users should not see payment page, but just in case
      showMessage('Admin access detected. Redirecting to main app...', 'info');
      setTimeout(() => {
        window.electronAPI.loadMainAppPage();
      }, 1000);
      return;
    }

    if (sessionStatus.session_type === 'free_trial') {
      // Show trial status
      trialStatus.style.display = 'block';
      
      if (isExpired) {
        // Trial expired - force payment
        trialStatus.classList.add('trial-expired');
        trialTitle.textContent = 'Free Trial Expired';
        trialMessage.innerHTML = 'Your free trial has ended. Please purchase access to continue using the assistant.';
        
        // Enable payment, hide skip button
        payButton.disabled = false;
        payButton.textContent = 'Pay $15 Now (Required)';
        skipPaymentBtn.style.display = 'none';
        
        paymentDescription.textContent = 'Payment is now required to continue using the AI Assistant.';
        
      } else if (daysLeft <= 3) {
        // Trial ending soon - show warning but allow skip
        trialStatus.classList.add('trial-warning');
        trialTitle.textContent = 'Free Trial Ending Soon';
        trialDaysLeft.textContent = `${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
        
        // Disable payment, show skip button
        payButton.disabled = true;
        payButton.textContent = 'Pay $15 Now (Available after trial)';
        skipPaymentBtn.style.display = 'block';
        
        paymentDescription.textContent = 'You can continue with your free trial or upgrade now for extended access.';
        
      } else {
        // Trial active - disable payment, show skip
        trialTitle.textContent = 'Free Trial Active';
        trialDaysLeft.textContent = `${daysLeft} days`;
        
        // Disable payment, show skip button
        payButton.disabled = true;
        payButton.textContent = 'Pay $15 Now (Available after trial)';
        skipPaymentBtn.style.display = 'block';
        
        paymentDescription.textContent = 'Enjoy your free trial! Payment will be available when your trial period ends.';
      }
    } else {
      // No active trial - enable payment
      trialStatus.style.display = 'none';
      payButton.disabled = false;
      payButton.textContent = 'Pay $15 Now';
      skipPaymentBtn.style.display = 'none';
    }
  }

  // Payment button click handler
  payButton.addEventListener('click', async () => {
    if (!currentUser || !stripe) {
      showMessage('User not identified or Stripe not initialized. Cannot proceed with payment.', 'error');
      return;
    }

    // Double-check if payment should be allowed
    if (sessionStatus.session_type === 'free_trial' && !isTrialExpired()) {
      showMessage('Payment is not available during active trial period.', 'error');
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

  // Skip payment button click handler
  skipPaymentBtn.addEventListener('click', async () => {
    if (sessionStatus.session_type !== 'free_trial' || isTrialExpired()) {
      showMessage('Free trial is not available.', 'error');
      return;
    }

    try {
      showMessage('Continuing with free trial...', 'info');
      
      // Navigate to main app
      window.electronAPI.loadMainAppPage();
      
    } catch (error) {
      showMessage('Error continuing with trial: ' + error.message, 'error');
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