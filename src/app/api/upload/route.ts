// ============================================================
// SERVER-SIDE IMAGE UPLOAD ENDPOINT
// Bypasses CORS by uploading from server to Firebase Storage
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { admin, bucket, initialized, initError } from '@/lib/firebaseAdmin';

export const POST = async (req: NextRequest) => {
  try {
    // Quick sanity checks to return JSON errors instead of HTML server pages
    if (!initialized || !admin.apps || admin.apps.length === 0) {
      console.error('Firebase Admin not initialized (initialized=', initialized, ', apps=', admin.apps.length);
      return NextResponse.json({ error: 'Server misconfiguration: Firebase Admin not initialized', detail: initError || null }, { status: 500 });
    }
    if (!bucket) {
      console.error('Firebase storage bucket not configured. bucket=', bucket);
      return NextResponse.json({ error: 'Server misconfiguration: storage bucket not configured', detail: initError || null }, { status: 500 });
    }
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string;
    const id = formData.get('id') as string;

    if (!file || !folder || !id) {
      return NextResponse.json(
        { error: 'Missing file, folder, or id' },
        { status: 400 }
      );
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    // Generate filename
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `${id}_${Date.now()}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    // Upload using Admin SDK bucket (server-side, bypasses client CORS and auth rules)
    const fileRef = bucket.file(filePath);
    await fileRef.save(fileBuffer, { contentType: file.type });

    // Generate a long-lived signed URL for the uploaded file
    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      // expire far in the future (adjust as needed)
      expires: '01-01-2500',
    });

    return NextResponse.json({ url: signedUrl }, { status: 200 });
  } catch (error) {
    // Log full error and return JSON with message to client
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to upload image: ' + message }, { status: 500 });
  }
};
