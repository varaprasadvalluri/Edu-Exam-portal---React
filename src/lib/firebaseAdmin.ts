// Server-side Firebase Admin initialization for Storage uploads
import admin from 'firebase-admin';


// Service account can be provided as either:
// - FIREBASE_SERVICE_ACCOUNT_KEY: JSON string (escaped newlines for private_key), or
// - FIREBASE_SERVICE_ACCOUNT_BASE64: base64-encoded JSON (recommended), or
// - GOOGLE_APPLICATION_CREDENTIALS pointing to a local file (ADC)
let serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
let serviceAccountObj: any = null;
let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
let initError: string | null = null;

if (!serviceAccountKey && serviceAccountBase64) {
  try {
    const decoded = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
    if (decoded.trim().startsWith('{')) {
      serviceAccountKey = decoded;
      console.log('Loaded Firebase service account from FIREBASE_SERVICE_ACCOUNT_BASE64 (decoded JSON)');
    } else {
      console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 does not decode to JSON. It may contain an email or incorrect value.');
      initError = 'FIREBASE_SERVICE_ACCOUNT_BASE64 is invalid: decoded value is not JSON. Paste base64 of the serviceAccount JSON or set GOOGLE_APPLICATION_CREDENTIALS.';
    }
  } catch (e) {
    console.error('Failed to decode FIREBASE_SERVICE_ACCOUNT_BASE64:', e);
    initError = 'Failed to decode FIREBASE_SERVICE_ACCOUNT_BASE64: ' + (e instanceof Error ? e.message : String(e));
  }
}

if (!serviceAccountKey) {
  console.warn('FIREBASE_SERVICE_ACCOUNT_KEY not set - admin SDK may fall back to Application Default Credentials');
}

if (!storageBucket) {
  console.warn('FIREBASE_STORAGE_BUCKET not set. Server uploads will fail until you configure FIREBASE_STORAGE_BUCKET.');
}

let initialized = false;
let bucket: any = null;

if (!admin.apps.length) {
  try {
    if (serviceAccountKey) {
      try {
        serviceAccountObj = JSON.parse(serviceAccountKey);
      } catch (parseErr) {
        console.error('Failed to parse service account JSON from env:', parseErr);
        initError = 'Failed to parse service account JSON from env: ' + (parseErr instanceof Error ? parseErr.message : String(parseErr));
        throw parseErr;
      }
    }

    const credential = serviceAccountObj
      ? admin.credential.cert(serviceAccountObj)
      : admin.credential.applicationDefault();

    const initConfig: any = { credential };
    if (storageBucket) initConfig.storageBucket = storageBucket;

    admin.initializeApp(initConfig);
    initialized = true;
  } catch (e) {
    console.error('Failed to initialize Firebase Admin SDK:', e);
    initError = initError || (e instanceof Error ? e.message : String(e));
    initialized = false;
  }
} else {
  initialized = true;
}

if (initialized) {
  try {
    bucket = storageBucket ? admin.storage().bucket(storageBucket) : admin.storage().bucket();
    console.log('Firebase Admin initialized. storageBucket=', storageBucket || '(default)');
  } catch (e) {
    console.error('Failed to get storage bucket:', e);
    initError = initError || (e instanceof Error ? e.message : String(e));
    bucket = null;
  }
} else {
  console.warn('Firebase Admin not initialized; bucket is unavailable');
}

export { admin, bucket, initialized, initError };
