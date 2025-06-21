import { app, BrowserWindow, ipcMain, desktopCapturer, shell, screen } from 'electron';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables BEFORE importing supabaseClient
dotenv.config();

import { supabase } from '../lib/supabaseClient';

declare global {
  var developmentUser: any;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../../public/auth.html'));

  // --- Security: Enable content protection ---
  mainWindow.setContentProtection(true);
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- Auth IPC Handlers ---

// Function to check if user is admin via Supabase
async function checkAdminStatus(email: string): Promise<boolean> {
  try {
    const response = await fetch('https://fvoehmsgbomajmlodmsg.supabase.co/functions/v1/check-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.isAdmin;
    }
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

ipcMain.handle('auth:signup', async (_, { email, password, firstName, lastName, phone }) => {
  // Use real Supabase auth for all signups
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
      }
    }
  });
  return { data, error };
});

ipcMain.handle('auth:login', async (_, { email, password }) => {
  try {
    // Simple Supabase authentication - backend will handle admin logic
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return { data: null, error };
    }
    
    console.log(`Login successful for: ${email}`);
    return { data, error };
    
  } catch (error) {
    console.error('Login error:', error);
    return { data: null, error: { message: 'Login failed' } };
  }
});

ipcMain.handle('auth:get-user', async () => {
  // Use real Supabase auth
  const { data, error } = await supabase.auth.getUser();
  return { data, error };
});

ipcMain.handle('payment:checkout', async (event, { userId }) => {
  const { data, error } = await supabase.functions.invoke('create-checkout-session', {
    body: { user_id: userId },
  });
  return { data, error };
});

ipcMain.handle('admin:create-session', async () => {
  try {
    // Get the current authenticated user's session
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return { error: 'User not authenticated' };
    }

    // Call the admin-session Edge Function
    const response = await fetch('https://fvoehmsgbomajmlodmsg.supabase.co/functions/v1/admin-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { error: errorData.error || 'Failed to create admin session' };
    }

    const result = await response.json();
    return { data: result };

  } catch (error) {
    console.error('Admin session creation error:', error);
    return { error: 'Failed to create admin session' };
  }
});

ipcMain.handle('session:get-status', async (event, { userId }) => {
  try {
    // Get the current authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { data: null, error: 'User not authenticated' };
    }
    
    // Check session status for the authenticated user
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    // If session exists and is active, return it
    if (data && ['paid', 'active'].includes(data.status)) {
      return { data, error: null };
    }
    
    // No active session found - this is where the backend should handle admin logic
    // For now, return no session and let the payment flow handle admin detection
    return { data: null, error: error || 'No active session found' };
    
  } catch (error) {
    console.error('Session status error:', error);
    return { data: null, error: 'Failed to check session status' };
  }
});

ipcMain.handle('session:start', async (event, { userId }) => {
  const { data, error } = await supabase.functions.invoke('start-session', {
    body: { user_id: userId },
  });
  return { data, error };
});

ipcMain.handle('payment:get-publishable-key', () => {
  return process.env.STRIPE_PUBLISHABLE_KEY;
});

ipcMain.handle('open-external-url', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to open URL';
    return { error: errorMessage };
  }
});

ipcMain.on('nav:payment', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  window.loadFile(path.join(__dirname, '../../public/payment.html'));
});

ipcMain.on('nav:start-session', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  window.loadFile(path.join(__dirname, '../../public/start-session.html'));
});

ipcMain.on('nav:main-app', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  window.setSize(1200, 800, true);
  window.center();
  window.loadFile(path.join(__dirname, '../../public/main.html'));
});

ipcMain.on('chat:send', async (event, requestData) => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  try {
    // Get the current authenticated user's session (works for both admin and regular users)
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      throw new Error('User not authenticated');
    }

    // Use the real session token for authentication (backend will handle admin detection)
    const supabaseUrl = 'https://fvoehmsgbomajmlodmsg.supabase.co';
    
    const response = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        window.webContents.send('chat:stream-chunk', { status: 'done' });
        break;
      }
      // The value is a Uint8Array, send it directly
      window.webContents.send('chat:stream-chunk', { chunk: value });
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    window.webContents.send('chat:stream-chunk', { 
      status: 'error', 
      error: errorMessage
    });
  }
});

ipcMain.handle('capture-screen', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)!;
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: 1920, height: 1080 } 
    });
    
    // Find the primary display specifically
    let primarySource = sources.find(source => source.display_id === screen.getPrimaryDisplay().id.toString());
    
    // Fallback to first screen if primary not found
    if (!primarySource) {
      primarySource = sources[0];
    }
    
    if (!primarySource) {
      throw new Error('No screen sources available');
    }
    
    return {
      base64: primarySource.thumbnail.toDataURL().split(',')[1], // remove the data url prefix
      mimeType: 'image/png'
    };
  } catch (error) {
    console.error('Failed to capture screen:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to capture screen';
    return { error: errorMessage };
  }
});

ipcMain.handle('audio:upload', async (event, { userId, audioData, mimeType }) => {
  try {
    // For our secure architecture, audio is processed directly in the chat function
    // No need to store audio files separately since they're transcribed immediately
    // This handler just returns success to maintain compatibility
    console.log('Audio upload request received, but audio is processed directly in chat');
    
    return { 
      data: { 
        path: `audio/${userId}/${Date.now()}.webm`,
        message: 'Audio will be processed directly in chat function'
      } 
    };
  } catch (error) {
    console.error('Failed to process audio upload request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process audio';
    return { error: errorMessage };
  }
});
