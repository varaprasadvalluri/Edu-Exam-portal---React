import os
import json
import base64
import random
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import firebase_admin
from firebase_admin import credentials, firestore

app = FastAPI(title="Gatekeeper Vercel Python API", version="1.0.0")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Firebase Admin SDK Secure Initialization
firebase_app = None
db = None

# Read config parameters
PROJECT_ID = "gen-lang-client-0086284509"
FIRESTORE_DATABASE_ID = "ai-studio-8391c2ab-94ef-4c90-9d99-eebfe3329077"

# Check if firebase-applet-config.json exists
config_path = os.path.join(os.getcwd(), "firebase-applet-config.json")
if os.path.exists(config_path):
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
            PROJECT_ID = config.get("projectId", PROJECT_ID)
            FIRESTORE_DATABASE_ID = config.get("firestoreDatabaseId", FIRESTORE_DATABASE_ID)
    except Exception as e:
        print(f"Error reading firebase config in python: {e}")

try:
    # Check if Service Account Key is provided in environment variables
    service_account_env = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY")
    if service_account_env:
        try:
            service_account_info = json.loads(service_account_env)
            cred = credentials.Certificate(service_account_info)
            print("Python Firebase Admin initialized via Service Account Key.")
        except Exception as e:
            print(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY env. Defaulting: {e}")
            cred = credentials.ApplicationDefault()
    else:
        cred = credentials.ApplicationDefault()
        print("Python Firebase Admin utilizing Google Application Default Credentials.")

    # Initialize firebase app
    firebase_options = {"projectId": PROJECT_ID}
    firebase_app = firebase_admin.initialize_app(cred, firebase_options, name="python-backend")
    
    # Initialize firestore database (supporting custom database ID)
    if FIRESTORE_DATABASE_ID and FIRESTORE_DATABASE_ID != "(default)":
        from google.cloud import firestore as g_firestore
        db = g_firestore.Client(project=PROJECT_ID, database=FIRESTORE_DATABASE_ID, credentials=cred.get_credential())
        print(f"Python server routed to Custom Datastore DB ID: {FIRESTORE_DATABASE_ID}")
    else:
        db = firestore.client(app=firebase_app)
        print("Python server routed to Default Datastore instance.")

except Exception as init_err:
    print(f"Fallback to client-less setup: {init_err}")
    try:
        # Fallback basic initialization
        if not firebase_admin._apps:
            firebase_app = firebase_admin.initialize_app()
        else:
            firebase_app = firebase_admin.get_app()
        if FIRESTORE_DATABASE_ID and FIRESTORE_DATABASE_ID != "(default)":
            from google.cloud import firestore as g_firestore
            db = g_firestore.Client(project=PROJECT_ID, database=FIRESTORE_DATABASE_ID)
        else:
            db = firestore.client(app=firebase_app)
    except Exception as inner_err:
        print(f"Fatal initialization failure in Python: {inner_err}")

# Pydantic Schemas
class EnrollRequest(BaseModel):
    matchedStudentId: Optional[str] = None
    matchedStudentData: Optional[Dict[str, Any]] = None
    username: Optional[str] = None
    rollNumber: str
    finalSchoolId: str
    finalExamId: str
    examTitle: Optional[str] = None
    clientFootprint: Optional[str] = None

class UpdateExamRequest(BaseModel):
    title: str
    description: str
    subject: str
    difficulty: str
    duration: int
    totalMarks: int
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    assignedSchoolIds: List[str] = Field(default_factory=list)

@app.get("/api/health")
def health_check():
    return {
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "projectId": PROJECT_ID,
        "databaseId": FIRESTORE_DATABASE_ID,
        "runtime": "Python (Vercel Serverless)"
    }

@app.put("/api/exams/{exam_id}")
def update_exam(exam_id: str, payload: UpdateExamRequest):
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase Firestore Admin instance is uninitialized or unavailable."
        )
    
    exam_doc_ref = db.document(f"exams/{exam_id}")
    exam_snapshot = exam_doc_ref.get()
    
    if not exam_snapshot.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exam paper not found."
        )
    
    try:
        update_data = {
            "title": payload.title,
            "description": payload.description,
            "subject": payload.subject,
            "difficulty": payload.difficulty,
            "duration": payload.duration,
            "totalMarks": payload.totalMarks,
            "startTime": payload.startTime or None,
            "endTime": payload.endTime or None,
            "assignedSchoolIds": payload.assignedSchoolIds
        }
        
        exam_doc_ref.update(update_data)
        
        # If the exam is published, regenerate/update secure_exam_links as well
        exam_data = exam_snapshot.to_dict()
        if exam_data.get("status") == "published":
            schools_to_provision = payload.assignedSchoolIds or []
            
            # If no specific schools specified, fetch all registered schools
            if not schools_to_provision:
                schools_snap = db.collection("schools").get()
                schools_to_provision = [s.id for s in schools_snap]
                
            expires_at = payload.endTime or (datetime.utcnow() + timedelta(days=7)).isoformat() + "Z"
            
            for s_id in schools_to_provision:
                token_doc_id = f"gen_{s_id}_{exam_id}"
                token_ref = db.document(f"secure_exam_links/{token_doc_id}")
                
                token_snap = token_ref.get()
                if not token_snap.exists:
                    uuid_token = f"tkn_{base64.b64encode(str(random.random()).encode()).decode()[:24].replace('+', '').replace('/', '').lower()}"
                    token_ref.set({
                        "id": uuid_token,
                        "examId": exam_id,
                        "schoolId": s_id,
                        "isActive": True,
                        "expiresAt": expires_at,
                        "createdAt": datetime.utcnow().isoformat() + "Z"
                    })
                else:
                    token_ref.update({
                        "expiresAt": expires_at,
                        "isActive": True
                    })
                    
        return {
            "success": True,
            "message": "Exam paper, dates, and institutional cluster associations updated successfully.",
            "updatedFields": update_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update exam: {str(e)}"
        )

@app.post("/api/gatekeeper/enroll")
def enroll_student(payload: EnrollRequest):
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase Firestore Admin instance is uninitialized or unavailable."
        )
    
    now_iso = datetime.utcnow().isoformat() + "Z"
    
    # Resolve student ID
    roll_cleaned = payload.rollNumber.strip().replace(" ", "_").lower()
    resolved_student_id = payload.matchedStudentId or f"std_{payload.finalSchoolId}_{roll_cleaned}"
    
    student_doc_ref = db.document(f"users/{resolved_student_id}")
    attempt_id_raw = f"att_{payload.finalExamId}_{resolved_student_id}"
    attempt_doc_ref = db.document(f"attempts/{attempt_id_raw}")
    
    # Firestore Transaction logic in Python
    transaction = db.transaction()
    
    @firestore.transactional
    def run_enroll_transaction(tx):
        # A. Onboard or fetch Student Profile
        student_snapshot = student_doc_ref.get(transaction=tx)
        
        if student_snapshot.exists:
            student_data = student_snapshot.to_dict()
            student_profile = {"uid": student_snapshot.id, **student_data}
        elif payload.matchedStudentData:
            student_profile = {"uid": resolved_student_id, **payload.matchedStudentData}
        else:
            student_profile = {
                "uid": resolved_student_id,
                "name": payload.username.strip() if payload.username else "Candidate",
                "rollNumber": payload.rollNumber.strip(),
                "schoolId": payload.finalSchoolId,
                "role": "student",
                "permissions": ["take_exams"],
                "createdAt": now_iso,
                "class": "Adaptive Cluster"
            }
            tx.set(student_doc_ref, student_profile)
            
        # B. Onboard or update Exam Attempt state
        attempt_snapshot = attempt_doc_ref.get(transaction=tx)
        
        if attempt_snapshot.exists:
            attempt_data = attempt_snapshot.to_dict()
            if attempt_data.get("status") == "completed":
                raise ValueError("EXAM_ALREADY_COMPLETED")
            
            if attempt_data.get("deviceFootprint") and attempt_data.get("deviceFootprint") != payload.clientFootprint:
                raise ValueError("SESSION_HIJACK_BLOCKED: Mismatched browser/device footprint registered for this unique link. Please complete on your primary device or request a clean reset from terminal administrators.")
                
            tx.update(attempt_doc_ref, {
                "lastResumedAt": now_iso,
                "status": "started"
            })
        else:
            new_attempt_data = {
                "examId": payload.finalExamId,
                "examTitle": payload.examTitle or "Single Term Link Entry Exam",
                "studentId": resolved_student_id,
                "studentName": student_profile.get("name"),
                "studentEmail": student_profile.get("email") or f"{payload.rollNumber.strip().lower()}@school.com",
                "schoolId": payload.finalSchoolId,
                "answers": [],
                "score": 0,
                "startTime": now_iso,
                "status": "started",
                "deviceFootprint": payload.clientFootprint or "GENERIC_BROWSER_PLATFORM",
                "ephemeralToken": base64.b64encode(str(random.random()).encode()).decode()[:16],
                "timePerQuestion": {}
            }
            tx.set(attempt_doc_ref, new_attempt_data)
            
        return student_profile

    try:
        final_student_profile = run_enroll_transaction(transaction)
        return {
            "success": True,
            "resolvedStudentId": resolved_student_id,
            "attemptIdRaw": attempt_id_raw,
            "finalStudentProfile": final_student_profile
        }
    except Exception as e:
        err_msg = str(e)
        if "EXAM_ALREADY_COMPLETED" in err_msg:
            return JSONResponse(
                status_code=409,
                content={
                    "code": "EXAM_ALREADY_COMPLETED",
                    "error": " This assessment attempt has already been submitted and completed."
                }
            )
        if "SESSION_HIJACK_BLOCKED" in err_msg:
            return JSONResponse(
                status_code=403,
                content={
                    "code": "SESSION_HIJACK_BLOCKED",
                    "error": err_msg
                }
            )
        return JSONResponse(
            status_code=500,
            content={
                "code": "TRANSACTION_FAIL",
                "error": err_msg
            }
        )
