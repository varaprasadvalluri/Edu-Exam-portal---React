import express from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { createServer as createViteServer } from 'vite';

// Import Firebase Web/Client SDK
import { initializeApp as initializeClientApp } from 'firebase/app';
import { 
  getFirestore as getClientFirestore, 
  doc as clientDoc, 
  getDoc as clientGetDoc, 
  setDoc as clientSetDoc, 
  updateDoc as clientUpdateDoc,
  collection as clientCollection,
  getDocs as clientGetDocs,
  runTransaction as clientRunTransaction,
  addDoc as clientAddDoc
} from 'firebase/firestore';

const app = express();
const PORT = 3000;

app.use(express.json());

// Load static firebase-applet-config.json
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {
  projectId: 'gen-lang-client-0086284509',
  firestoreDatabaseId: 'ai-studio-8391c2ab-94ef-4c90-9d99-eebfe3329077'
};

if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.error("Error reading firebase config in server:", err);
  }
}

// Allow environment variable overrides to avoid hardcoding in production environments
if (process.env.FIREBASE_PROJECT_ID) {
  firebaseConfig.projectId = process.env.FIREBASE_PROJECT_ID;
}
if (process.env.FIRESTORE_DATABASE_ID) {
  firebaseConfig.firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID;
}

// Initialize Client SDK
const clientApp = initializeClientApp(firebaseConfig);
const clientDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);
console.log(`[NODE EXPRESS SERVER] Routed to Web Client SDK DB: "${firebaseConfig.firestoreDatabaseId}"`);

// 2. BACKEND API FOR HEAVY WRITES: THE GATEKEEPER TRANSACTION
app.post('/api/gatekeeper/enroll', async (req, res) => {
  const { 
    matchedStudentId, 
    matchedStudentData, 
    username, 
    rollNumber, 
    finalSchoolId, 
    finalExamId, 
    examTitle, 
    clientFootprint 
  } = req.body;

  if (!finalSchoolId || !finalExamId || !rollNumber) {
    return res.status(400).json({ error: 'Missing required validation payload parameters.' });
  }

  const now = new Date();
  const resolvedStudentId = matchedStudentId || `std_${finalSchoolId}_${rollNumber.trim().replace(/\s+/g, '_').toLowerCase()}`;
  const studentDocRef = clientDoc(clientDb, 'users', resolvedStudentId);
  const attemptIdRaw = `att_${finalExamId}_${resolvedStudentId}`;
  const attemptDocRef = clientDoc(clientDb, 'attempts', attemptIdRaw);

  let finalStudentProfile: any = null;

  try {
    // Atomic Database Transaction running on Node.js Server using Client SDK
    await clientRunTransaction(clientDb, async (transaction) => {
      const studentSnap = await transaction.get(studentDocRef);
      const attemptSnap = await transaction.get(attemptDocRef);

      // A. Onboard or fetch Student Profile atomically
      if (studentSnap.exists()) {
        finalStudentProfile = { uid: studentSnap.id, ...studentSnap.data() };
      } else if (matchedStudentData) {
        finalStudentProfile = { uid: resolvedStudentId, ...matchedStudentData };
      } else {
        // Safe auto-onboard fallback
        finalStudentProfile = {
          uid: resolvedStudentId,
          name: username?.trim() || 'Candidate',
          rollNumber: rollNumber.trim(),
          schoolId: finalSchoolId,
          role: 'student',
          permissions: ['take_exams'],
          createdAt: now.toISOString(),
          class: 'Adaptive Cluster'
        };
        transaction.set(studentDocRef, finalStudentProfile);
      }

      // B. Onboard or update Exam Attempt state atomically
      if (attemptSnap.exists()) {
        const attemptData = attemptSnap.data() as any;

        if (attemptData.status === 'completed') {
          throw new Error("EXAM_ALREADY_COMPLETED");
        }

        if (attemptData.deviceFootprint && attemptData.deviceFootprint !== clientFootprint) {
          throw new Error("SESSION_HIJACK_BLOCKED: Mismatched browser/device footprint registered for this unique link. Please complete on your primary device or request a clean reset from terminal administrators.");
        }

        // Active session resume
        transaction.update(attemptDocRef, {
          lastResumedAt: now.toISOString(),
          status: 'started'
        });
      } else {
        // Initial clean session booking
        const newAttemptData = {
          examId: finalExamId,
          examTitle: examTitle || 'Single Term Link Entry Exam',
          studentId: resolvedStudentId,
          studentName: finalStudentProfile.name,
          studentEmail: finalStudentProfile.email || `${rollNumber.trim().toLowerCase()}@school.com`,
          schoolId: finalSchoolId,
          answers: [],
          score: 0,
          startTime: now.toISOString(),
          status: 'started',
          deviceFootprint: clientFootprint || 'GENERIC_BROWSER_PLATFORM',
          ephemeralToken: Buffer.from(Math.random().toString()).toString('base64').substring(0, 16),
          timePerQuestion: {}
        };
        transaction.set(attemptDocRef, newAttemptData);
      }
    });

    return res.status(200).json({
      success: true,
      resolvedStudentId,
      attemptIdRaw,
      finalStudentProfile
    });

  } catch (transErr: any) {
    const errMsg = transErr?.message || String(transErr);
    
    // Provide explicit parseable error responses
    if (errMsg.includes("EXAM_ALREADY_COMPLETED")) {
      console.warn("Handled Gatekeeper rule: EXAM_ALREADY_COMPLETED");
      return res.status(409).json({ code: "EXAM_ALREADY_COMPLETED", error: " This assessment attempt has already been submitted and completed." });
    }
    if (errMsg.includes("SESSION_HIJACK_BLOCKED")) {
      console.warn("Handled Gatekeeper rule:", errMsg);
      return res.status(403).json({ code: "SESSION_HIJACK_BLOCKED", error: errMsg });
    }

    console.error("Transact Error in Node Gatekeeper:", transErr);
    return res.status(500).json({ code: "TRANSACTION_FAIL", error: errMsg });
  }
});

// Healthy node diagnostic route
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'operational', 
    timestamp: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId
  });
});

app.put('/api/exams/:examId', async (req, res) => {
  const { examId } = req.params;
  const { title, description, subject, difficulty, duration, totalMarks, startTime, endTime, assignedSchoolIds } = req.body;

  try {
    const examRef = clientDoc(clientDb, 'exams', examId);
    const examSnap = await clientGetDoc(examRef);

    if (!examSnap.exists()) {
      return res.status(404).json({ error: 'Exam paper not found.' });
    }

    const updateData: any = {
      title,
      description,
      subject,
      difficulty,
      duration: Number(duration) || 30,
      totalMarks: Number(totalMarks) || 100,
      startTime: startTime || null,
      endTime: endTime || null,
      assignedSchoolIds: assignedSchoolIds || []
    };

    await clientUpdateDoc(examRef, updateData);

    const examData = examSnap.data();
    if (examData?.status === 'published') {
      let schoolsToProvision = assignedSchoolIds || [];

      if (schoolsToProvision.length === 0) {
        const schoolsSnap = await clientGetDocs(clientCollection(clientDb, 'schools'));
        schoolsToProvision = schoolsSnap.docs.map(d => d.id);
      }

      const expiresAt = endTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      for (const sId of schoolsToProvision) {
        const tokenDocId = `gen_${sId}_${examId}`;
        const tokenRef = clientDoc(clientDb, 'secure_exam_links', tokenDocId);
        const tokenSnap = await clientGetDoc(tokenRef);

        if (!tokenSnap.exists()) {
          const uuidToken = `tkn_${Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)}`;
          await clientSetDoc(tokenRef, {
            id: uuidToken,
            examId,
            schoolId: sId,
            isActive: true,
            expiresAt,
            createdAt: new Date().toISOString()
          }, { merge: true });
        } else {
          await clientUpdateDoc(tokenRef, {
            expiresAt,
            isActive: true
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Exam paper, dates, and institutional cluster associations updated successfully.',
      updatedFields: updateData
    });

  } catch (err: any) {
    console.error("Error updating exam paper in Node:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/exams/:examId/import-doc', async (req, res) => {
  const { examId } = req.params;
  const { base64Data, fileName, subject } = req.body;

  if (!base64Data || !fileName) {
    return res.status(400).json({ error: 'Missing required parameters: base64Data or fileName.' });
  }

  const tempDir = os.tmpdir ? os.tmpdir() : '/tmp';
  const uniqueName = `upload_${Date.now()}_${path.basename(fileName)}`;
  const tempFilePath = path.join(tempDir, uniqueName);

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(tempFilePath, buffer);

    const safeSubject = (subject || 'General').replace(/["'\\]/g, '');
    const pythonCmd = `python3 docx_parser.py "${tempFilePath.replace(/"/g, '\\"')}" "${examId.replace(/"/g, '\\"')}" "${safeSubject}"`;

    exec(pythonCmd, { env: { ...process.env } }, async (error, stdout, stderr) => {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupErr) {
        console.error("Temp file cleanup failed:", cleanupErr);
      }

      if (error) {
        console.error("Python docx_parser exec error:", error);
        console.error("Python stderr:", stderr);
        return res.status(500).json({ error: 'Document parser execution failed.', details: stderr });
      }

      try {
        const result = JSON.parse(stdout.trim());
        if (!result.success) {
          return res.status(400).json({ error: result.error || 'Document parsing returned failure status.' });
        }

        // Save parsed questions using Node Client SDK Firestore Reference
        const questionsRef = clientCollection(clientDb, 'questions');
        let savedCount = 0;

        for (const q of result.questions || []) {
          const questionDoc = {
            text: q.text || "Untitled Question",
            options: q.options || [],
            correctAnswerIndex: Number(q.correctAnswerIndex) ?? 0,
            marks: Number(q.marks) || 4,
            examId: examId,
            subject: q.subject || subject || 'General',
            type: q.type || 'single',
            numericalAnswer: String(q.numericalAnswer || ''),
            explanation: q.explanation || ''
          };
          await clientAddDoc(questionsRef, questionDoc);
          savedCount++;
        }

        return res.status(200).json({
          success: true,
          count: savedCount,
          message: `Successfully imported ${savedCount} questions to assessment.`
        });

      } catch (parseErr) {
        console.error("Failed to parse Python parser output or save questions:", stdout);
        return res.status(500).json({ 
          error: 'Invalid response from document parser or save questions failure.', 
          rawOutput: stdout,
          details: stderr
        });
      }
    });

  } catch (err: any) {
    console.error("Failed in document upload API handler:", err);
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (ignore) {}
    return res.status(500).json({ error: err.message || String(err) });
  }
});

async function startServer() {
  // Vite server middleware for local reactive dev mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log("Vite reactive middleware mounted successfully.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // SPA routing fallback
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Production static file directory assets distribution ready.");
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NODE EXPRESS SERVER] Server actively listening at http://localhost:${PORT}`);
  });
}

startServer();
