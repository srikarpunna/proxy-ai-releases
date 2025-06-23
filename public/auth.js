document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const signupView = document.getElementById('signup-view');
  const showSignup = document.getElementById('show-signup');
  const showLogin = document.getElementById('show-login');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const messageArea = document.getElementById('message-area');

  // --- View Toggling ---
  showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginView.classList.add('hidden');
    signupView.classList.remove('hidden');
    clearMessages();
  });

  showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupView.classList.add('hidden');
    loginView.classList.remove('hidden');
    clearMessages();
  });

  // --- Form Handlers ---
  function validateSignupForm(email, password, firstName, lastName) {
    if (!email || !password || !firstName || !lastName) {
      return 'All fields are required.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address.';
    }
    if (password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }
    return null; // Indicates validation passed
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();
    console.log('Login form submitted');
    
    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Logging in...';
    submitButton.disabled = true;
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    console.log('Attempting login for email:', email);
    console.log('electronAPI available:', !!window.electronAPI);
    console.log('login function available:', !!window.electronAPI?.login);
    
    if (!window.electronAPI) {
      showMessage('Error: Electron API not available. Please restart the app.', 'error');
      submitButton.textContent = originalText;
      submitButton.disabled = false;
      return;
    }
    
    if (!window.electronAPI.login) {
      showMessage('Error: Login function not available. Please restart the app.', 'error');
      submitButton.textContent = originalText;
      submitButton.disabled = false;
      return;
    }
    
    try {
      showMessage('Connecting to server...', 'info');
      const { data, error } = await window.electronAPI.login({ email, password });
      console.log('Login response:', { data, error });

      if (error) {
        console.error('Login error:', error);
        showMessage(error.message || 'Login failed. Please try again.', 'error');
      } else if (data && data.user) {
        console.log('Login successful, checking admin status...');
        showMessage('Login successful! Checking access level...', 'success');
        
        // Try to create admin session - this will only succeed if user is admin
        try {
          const sessionResult = await window.electronAPI.createAdminSession();
          
          if (sessionResult.error) {
            // Not an admin or session creation failed - go to payment page
            console.log('Regular user or admin session failed, redirecting to payment page...');
            showMessage('Redirecting to payment...', 'success');
            setTimeout(() => {
              window.electronAPI.loadPaymentPage();
            }, 1000);
          } else {
            // Admin session created successfully - go directly to main app
            console.log('Admin user detected, session created, redirecting to main app...');
            showMessage('Admin access confirmed! Redirecting to app...', 'success');
            setTimeout(() => {
              window.electronAPI.loadMainAppPage();
            }, 1000);
          }
        } catch (err) {
          // Error occurred - treat as regular user and go to payment page
          console.error('Error during admin session creation:', err);
          console.log('Treating as regular user, redirecting to payment page...');
          showMessage('Redirecting to payment...', 'success');
          setTimeout(() => {
            window.electronAPI.loadPaymentPage();
          }, 1000);
        }
      } else {
        showMessage('Unexpected response from server. Please try again.', 'error');
      }
    } catch (err) {
      console.error('Unexpected error during login:', err);
      showMessage(`Error: ${err.message || 'An error occurred during login. Please try again.'}`, 'error');
    } finally {
      // Reset button state
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Signup form submitted.');
    clearMessages();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const firstName = document.getElementById('signup-firstname').value;
    const lastName = document.getElementById('signup-lastname').value;
    const phone = document.getElementById('signup-phone').value;
    console.log('Form values captured:', { email, password: '***', firstName, lastName, phone });

    const validationError = validateSignupForm(email, password, firstName, lastName);
    if (validationError) {
      console.error('Client-side validation failed:', validationError);
      showMessage(validationError, 'error');
      return;
    }
    console.log('Client-side validation passed.');

    try {
      console.log('Sending signup request to main process...');
      const { data, error } = await window.electronAPI.signup({
        email,
        password,
        firstName,
        lastName,
        phone
      });
      console.log('Received response from main process:', { data, error });
      
      if (error) {
        console.error('Signup error received:', error.message);
        showMessage(error.message, 'error');
      } else if (data && data.user) {
        console.log('Signup successful for user:', data.user.id);
        showMessage('Account created successfully! You can now log in.', 'success');
        
        // Auto-switch to login view after successful signup
        setTimeout(() => {
          signupView.classList.add('hidden');
          loginView.classList.remove('hidden');
          // Pre-fill the email field
          document.getElementById('login-email').value = email;
          clearMessages();
        }, 2000);
      } else {
        console.warn('Signup response had no error and no user. This can happen if the user already exists. Showing a generic message.');
        showMessage('Account created successfully! You can now log in.', 'success');
        
        // Auto-switch to login view
        setTimeout(() => {
          signupView.classList.add('hidden');
          loginView.classList.remove('hidden');
          // Pre-fill the email field
          document.getElementById('login-email').value = email;
          clearMessages();
        }, 2000);
      }
    } catch (e) {
      console.error('An unexpected error occurred during signup:', e);
      showMessage('A critical error occurred. Please restart the app.', 'error');
    }
  });

  // --- Message Helpers ---
  function showMessage(message, type = 'info') {
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
  }

  function clearMessages() {
    messageArea.textContent = '';
    messageArea.className = 'message-area';
  }
}); 