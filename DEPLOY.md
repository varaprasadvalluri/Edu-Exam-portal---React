# Quick Deploy Guide

## 1. Firebase Setup (5 min)
```bash
# Create project at console.firebase.google.com
# Enable: Authentication (Email/Password), Firestore, Storage
# Copy config to .env.local
```

## 2. Security Rules
```bash
# In Firebase Console:
# - Firestore → Rules → Copy from firestore.rules
# - Storage → Rules → Copy from storage.rules
```

## 3. Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
# Add env vars when prompted
```

## 4. Create Admin
```bash
# Register at /auth/register
# Go to Firestore → users → find your doc
# Change role: "student" → "admin"
```

## Common Issues
- **Permission denied**: Check Firestore rules uploaded
- **Images won't upload**: Check Storage rules + bucket name in .env
- **Build fails**: Ensure all env vars in Vercel dashboard

Demo: admin@demo.com / admin123
