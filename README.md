# 🤖 Proxy AI - Secure Desktop Application

A secure, downloadable desktop application built with Electron that provides AI-powered interview assistance with payment-gated access and enterprise-grade security.

## 🎯 **Project Overview**

This application transforms a web-based AI interview assistant into a secure desktop app with:
- **Zero exposed API keys** in client code
- **Payment-gated access** via Stripe ($15 one-time payment)
- **24-hour session management** with automatic expiration
- **Admin bypass system** for authorized users
- **LLM-powered chat** with audio transcription
- **Screen capture** capabilities
- **Cross-platform compatibility** (macOS, Windows)

## 🏗️ **Architecture**

### **Security-First Design**
- **Hybrid Architecture**: Client handles UI, backend handles all sensitive operations
- **Zero Client Secrets**: No API keys, tokens, or credentials in downloadable code
- **Server-Side Validation**: All authentication and authorization on backend
- **JWT-Based Sessions**: Secure token-based authentication
- **Content Protection**: Prevents screenshots and screen recording

### **Tech Stack**
- **Frontend**: Electron + TypeScript + HTML/CSS/JS
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Payments**: Stripe Checkout
- **AI**: Google Gemini API
- **Build**: electron-builder

## 🚀 **Features**

### **Core Functionality**
- ✅ Secure user authentication (signup/login)
- ✅ Payment processing with Stripe
- ✅ 24-hour session management
- ✅ AI-powered chat with streaming responses
- ✅ Audio recording and transcription
- ✅ Screen capture for context
- ✅ Admin bypass system

### **Security Features**
- ✅ Content protection (prevents screenshots)
- ✅ Zero exposed credentials
- ✅ Server-side session validation
- ✅ Encrypted communication
- ✅ Secure token management

## 📋 **Prerequisites**

- **Node.js**: v20+ (use `nvm` to switch versions)
- **Yarn**: Package manager
- **Supabase Account**: For backend services
- **Stripe Account**: For payment processing
- **Google AI API Key**: For Gemini integration

## 🛠️ **Setup Instructions**

### **1. Clone Repository**
```bash
git clone https://github.com/srikarpunna/proxy-ai-app.git
cd proxy-ai-app
```

### **2. Node.js Version**
```bash
nvm use 20  # Ensure Node.js 20+
```

### **3. Install Dependencies**
```bash
yarn install
```

### **4. Environment Configuration**

Create a `.env` file in the root directory:
```env
# Stripe (for payments)
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_SECRET_KEY=sk_test_your_secret_key

# Optional: For development
NODE_ENV=development
```

### **5. Supabase Configuration**

The app uses these Supabase services:
- **Authentication**: User signup/login
- **Database**: User profiles, sessions, admin users
- **Edge Functions**: Secure backend operations

#### **Required Tables:**
- `profiles`: User information
- `sessions`: Payment and session tracking
- `admin_users`: Admin email addresses

#### **Required Edge Functions:**
- `create-checkout-session`: Stripe payment initiation
- `stripe-webhook`: Payment completion handling
- `start-session`: Session activation
- `admin-session`: Admin bypass functionality
- `chat`: AI chat with streaming

### **6. Admin Setup**

To add admin users (bypass payment):
```sql
INSERT INTO admin_users (email, is_active) 
VALUES ('your-admin-email@example.com', true);
```

## 🎮 **Usage**

### **Development Mode**
```bash
yarn start
```

### **Build for Production**
```bash
# Build TypeScript
yarn build:ts

# Build macOS app
yarn build:mac

# Build Windows app
yarn build:win
```

### **User Flow**

1. **Authentication**
   - Launch app → Login/Signup screen
   - Enter credentials → Authenticate with Supabase
   - Successful login → Redirect to payment page

2. **Payment (Regular Users)**
   - Payment page → Click "Purchase 24-Hour Access"
   - Stripe Checkout → Complete $15 payment
   - Return to app → Session activated
   - Access main application

3. **Admin Bypass**
   - Payment page → "Skip Payment (Dev Mode)" button visible
   - Click button → Backend validates admin status
   - If admin → Create unlimited session → Access app
   - If not admin → Error message

4. **Main Application**
   - AI chat interface with streaming responses
   - Audio recording with transcription
   - Screen capture for context
   - Session timer showing remaining time

## 🔧 **Development**

### **Project Structure**
```
proxy-ai/
├── src/
│   ├── electron/
│   │   ├── main.ts          # Main Electron process
│   │   └── preload.ts       # IPC bridge
│   └── lib/
│       └── supabaseClient.ts # Database client
├── public/
│   ├── auth.html           # Login/signup page
│   ├── payment.html        # Payment page
│   ├── main.html          # Main application
│   └── *.js               # Frontend logic
├── supabase/
│   └── functions/         # Edge Functions
└── package.json
```

### **Key Commands**
```bash
# Development
yarn start              # Start app in development
yarn build:ts          # Build TypeScript
yarn lint              # Run linter

# Production
yarn build:mac         # Build macOS app
yarn build:win         # Build Windows app
yarn dist              # Build all platforms
```

### **IPC Communication**
The app uses Electron's IPC for secure communication between renderer and main processes:

```typescript
// Authentication
window.electronAPI.login({ email, password })
window.electronAPI.signup({ email, password, firstName, lastName })

// Payments
window.electronAPI.createCheckoutSession(userId)
window.electronAPI.createAdminSession()

// Sessions
window.electronAPI.getSessionStatus(userId)
window.electronAPI.startSession(userId)

// Chat
window.electronAPI.sendChatMessage(data)
window.electronAPI.onChatStream(callback)
```

## 🔒 **Security Considerations**

### **Client-Side Security**
- **No API Keys**: Zero credentials in downloadable code
- **Content Protection**: Prevents screenshots/recording
- **Secure IPC**: All sensitive operations through main process
- **Token Storage**: Secure session management

### **Server-Side Security**
- **JWT Validation**: All requests authenticated
- **Admin Validation**: Server-side admin checking
- **Payment Verification**: Stripe webhook validation
- **Session Expiration**: Automatic 24-hour timeout

### **Best Practices**
- All sensitive operations happen server-side
- Client only handles UI and user interactions
- Database operations through authenticated Edge Functions
- Payment processing through secure Stripe integration

## 🐛 **Troubleshooting**

### **Common Issues**

1. **"Invalid API key" Error**
   - Ensure Supabase client is properly configured
   - Check that API keys are current and valid

2. **Payment Not Working**
   - Verify Stripe keys in Supabase environment variables
   - Check webhook configuration
   - Review Edge Function logs

3. **Admin Bypass Not Working**
   - Verify email exists in `admin_users` table
   - Check Edge Function logs for errors
   - Ensure proper authentication

4. **Build Failures**
   - Use Node.js 20+ (`nvm use 20`)
   - Clear node_modules and reinstall
   - Check TypeScript compilation

### **Debugging**
```bash
# Check logs
yarn start  # Console logs in terminal

# Build with verbose output
yarn build:ts --verbose

# Check Supabase Edge Function logs
# (View in Supabase dashboard)
```

## 📝 **Environment Variables**

### **Required in .env**
```env
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
NODE_ENV=development
```

### **Required in Supabase Dashboard**
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `APP_GEMINI_API_KEY`
- `APP_GEMINI_MODEL` (optional)
- `APP_LLM_MAX_TOKENS` (optional)
- `APP_LLM_TEMPERATURE` (optional)

## 🚀 **Deployment**

### **Building Distributables**
```bash
# macOS
yarn build:mac

# Windows
yarn build:win

# Both platforms
yarn dist
```

### **Distribution**
- Built apps are in `dist/` directory
- Distribute `.dmg` (macOS) or `.exe` (Windows)
- No additional setup required for end users

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make changes with proper TypeScript typing
4. Test thoroughly in development mode
5. Submit pull request

## 📄 **License**

This project is proprietary software. All rights reserved.

## 🆘 **Support**

For issues or questions:
1. Check troubleshooting section above
2. Review Supabase Edge Function logs
3. Check browser console for client-side errors
4. Create GitHub issue with detailed description

---

**Built with ❤️ using Electron, Supabase, and TypeScript** 