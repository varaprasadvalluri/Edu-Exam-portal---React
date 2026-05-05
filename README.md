# Edu-Exam-portal---React
=======
# 🎓 EduExam Portal — Online Examination System

A **production-ready**, full-stack online examination platform for schools (Play School to Class 10), built with Next.js 14, Firebase, and Tailwind CSS.

---

## ✨ Features

### 👨‍💼 Admin Portal
- Secure login + role-based access
- Dashboard with live analytics
- Create/edit/delete exams with rich settings
- Add questions: Single choice, Multiple choice, Text answer, Image-based
- Upload images for questions via Firebase Storage
- Assign exams to specific classes (Play School → Class 10)
- Set duration, start time, end time
- Publish/unpublish exams
- Manage students (add, deactivate, remove)
- View all results with filters and analytics

### 👨‍🎓 Student Portal
- Simple login + registration
- Dashboard showing available/upcoming/completed exams
- Instruction screen before exam starts
- Real-time exam interface:
  - Live countdown timer
  - Auto-submit when time ends
  - Question navigation sidebar
  - Answered/unanswered/flagged visual indicators
  - Single + multiple choice + text answer types
  - Image support in questions
- Auto-save every 30 seconds
- Anti-cheat: tab switch warnings (auto-submit after 3 violations)
- Copy/paste/right-click disabled during exam
- Instant result after submission
- Detailed results history

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase project (free Spark tier works)
- Vercel account (for deployment)

### 1. Clone & Install

```bash
git clone https://github.com/your-repo/exam-portal.git
cd exam-portal
npm install
```

### 2. Firebase Setup

#### Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** → Enter name → Continue
3. Disable Google Analytics if not needed → **Create project**

#### Enable Authentication
1. Go to **Authentication** → **Get started**
2. Click **Sign-in method** → Enable **Email/Password**

#### Create Firestore Database
1. Go to **Firestore Database** → **Create database**
2. Choose **Start in production mode** → Select region → **Enable**
3. Go to **Rules** tab → Replace with:

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow admins to read/write everything
    match /{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Users can read/update their own profile
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow create: if request.auth != null;
    }
    
    // Students can read published exams for their class
    match /exams/{examId} {
      allow read: if request.auth != null && resource.data.isPublished == true;
    }
    
    // Students can read questions for published exams
    match /questions/{questionId} {
      allow read: if request.auth != null;
    }
    
    // Students can create and update their own attempts
    match /attempts/{attemptId} {
      allow create: if request.auth != null && request.resource.data.studentId == request.auth.uid;
      allow read, update: if request.auth != null && resource.data.studentId == request.auth.uid;
    }
    
    // Students can read their own results
    match /results/{resultId} {
      allow read: if request.auth != null && resource.data.studentId == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
```

#### Enable Firebase Storage
1. Go to **Storage** → **Get started** → **Next** → **Done**
2. Go to **Rules** → Replace with:

```rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /questions/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /options/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /profiles/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid != null;
    }
  }
}
```

#### Get Firebase Config
1. Go to **Project Settings** (gear icon) → **General**
2. Scroll to **Your apps** → Click **</>** (Web)
3. Register app → Copy the config object

### 3. Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc...

NEXT_PUBLIC_APP_NAME="EduExam Portal"
NEXT_PUBLIC_SCHOOL_NAME="Your School Name"
```

### 4. Create Admin Account

Run the development server first:

```bash
npm run dev
```

1. Go to `http://localhost:3000/auth/register`
2. Register with any email/password
3. Go to **Firebase Console** → **Firestore** → `users` collection
4. Find the document → Edit `role` field from `student` to `admin`
5. That account now has full admin access

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🌐 Deploy to Vercel

### Option A: One-Click Deploy

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your repository
4. Add Environment Variables (same as `.env.local`)
5. Click **Deploy**

### Option B: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

When prompted, add all environment variables from `.env.local`.

---

## 📁 Project Structure

```
src/
├── app/                     # Next.js App Router
│   ├── auth/
│   │   ├── login/           # Login page
│   │   └── register/        # Student registration
│   ├── admin/               # Admin portal (protected)
│   │   ├── layout.tsx       # Sidebar navigation
│   │   ├── page.tsx         # Dashboard
│   │   ├── exams/
│   │   │   ├── page.tsx     # Exams list
│   │   │   ├── create/      # Create exam
│   │   │   └── [id]/        # Edit exam + questions
│   │   ├── students/        # Student management
│   │   └── results/         # Analytics
│   └── student/             # Student portal (protected)
│       ├── layout.tsx       # Top navigation
│       ├── page.tsx         # Available exams
│       ├── exam/[id]/       # Take exam (full interface)
│       └── results/         # Result history
├── context/
│   └── AuthContext.tsx      # Firebase auth state
├── lib/
│   ├── firebase.ts          # Firebase init
│   ├── firestore.ts         # All DB operations
│   └── storage.ts           # Image upload
└── types/
    └── index.ts             # TypeScript definitions
```

---

## 🔒 Security Features

| Feature | Details |
|---------|---------|
| Role-based access | Admin vs Student routes enforced |
| Tab switch detection | 3 warnings → auto-submit |
| Copy/paste disabled | During exam mode |
| Right-click blocked | During exam mode |
| Auto-save | Every 30 seconds |
| Auto-submit | When timer reaches 0 |
| Input validation | All forms validated client-side |

---

## 🎨 Customization

### Change School Name / Branding
Edit `.env.local`:
```env
NEXT_PUBLIC_SCHOOL_NAME="St. Mary's High School"
NEXT_PUBLIC_APP_NAME="St. Mary's Exam Portal"
```

### Change Colors
Edit `tailwind.config.js` → `colors.primary` object.

### Add New Subjects
Edit the `SUBJECTS` array in `/src/app/admin/exams/create/page.tsx`.

---

## 🗄️ Firestore Data Schema

### `users` collection
```json
{
  "uid": "string",
  "email": "string",
  "displayName": "string",
  "role": "admin | student",
  "classLevel": "Play School | Nursery | ... | Class 10",
  "rollNumber": "string",
  "isActive": true,
  "createdAt": "ISO string"
}
```

### `exams` collection
```json
{
  "title": "string",
  "subject": "string",
  "classLevel": "string",
  "duration": 60,
  "startTime": "ISO string",
  "endTime": "ISO string",
  "totalMarks": 100,
  "passingMarks": 40,
  "questionCount": 25,
  "isPublished": false,
  "shuffleQuestions": false,
  "showResultImmediately": true
}
```

### `questions` collection
```json
{
  "examId": "string",
  "type": "single | multiple | text",
  "text": "string",
  "imageUrl": "string?",
  "options": [{ "id": "uuid", "text": "string", "imageUrl": "string?" }],
  "correctAnswers": ["option-id-1"],
  "marks": 1,
  "order": 1
}
```

### `attempts` collection
```json
{
  "examId": "string",
  "studentId": "string",
  "answers": {
    "questionId": {
      "selectedOptions": ["option-id"],
      "isAnswered": true,
      "timeTaken": 45
    }
  },
  "status": "in_progress | submitted | evaluated",
  "startTime": "ISO string",
  "submitTime": "ISO string",
  "autoSubmitted": false,
  "score": 85,
  "percentage": 85,
  "passed": true
}
```

---

## 📦 Tech Stack

| Technology | Purpose |
|-----------|---------|
| Next.js 14 | Full-stack React framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Firebase Auth | Authentication |
| Firestore | Database |
| Firebase Storage | Image hosting |
| date-fns | Date formatting |
| react-hot-toast | Notifications |
| Vercel | Hosting |

---

## 🐛 Troubleshooting

**"Permission denied" on Firestore**
→ Check Firestore security rules. Make sure the user's `role` field is set correctly.

**Images not uploading**
→ Verify Firebase Storage rules allow writes. Check bucket name in `.env.local`.

**Admin role not working**
→ Go to Firestore → `users` collection → find your document → set `role: "admin"`.

**Build fails on Vercel**
→ Ensure all env variables are set in Vercel dashboard (not just `.env.local`).

---

## 📄 License

MIT License — Free for educational use.
