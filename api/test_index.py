import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add the parent directory or api folder to python path so we can import index.py
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient

# Mock firebase_admin before importing the main app to avoid real initialization during tests
mock_firestore_db = MagicMock()

with patch("firebase_admin.credentials.ApplicationDefault"), \
     patch("firebase_admin.credentials.Certificate"), \
     patch("firebase_admin.initialize_app"), \
     patch("firebase_admin.get_app"), \
     patch("firebase_admin.firestore.client", return_value=mock_firestore_db):
    
    from index import app, db

client = TestClient(app)

class TestGatekeeperAPI(unittest.TestCase):

    def setUp(self):
        # Reset the mock DB for each test
        mock_firestore_db.reset_mock()
        # Inject the mock DB back into index module to ensure it's utilized
        import index
        index.db = mock_firestore_db

    def test_health_check(self):
        """Test that the health endpoint returns operational status and metadata."""
        response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "operational")
        self.assertEqual(data["runtime"], "Python (Vercel Serverless)")
        self.assertIn("projectId", data)
        self.assertIn("databaseId", data)

    def test_enroll_student_validation_error(self):
        """Test that invalid enrollment payload structure returns 422 Unprocessable Entity."""
        # Missing required rollNumber and finalSchoolId
        response = client.post("/api/gatekeeper/enroll", json={
            "username": "Test Student"
        })
        self.assertEqual(response.status_code, 422)

    @patch("index.db")
    def test_enroll_student_db_uninitialized(self, mock_db):
        """Test that the enroll endpoint returns a 500 if the database is uninitialized."""
        import index
        index.db = None  # Simulate db uninitialized
        
        response = client.post("/api/gatekeeper/enroll", json={
            "rollNumber": "101",
            "finalSchoolId": "sch_123",
            "finalExamId": "ex_abc"
        })
        self.assertEqual(response.status_code, 500)
        self.assertIn("uninitialized or unavailable", response.json()["detail"])

    @patch("index.db")
    def test_enroll_new_student_success(self, mock_db):
        """Test a clean onboarding transaction where both student and attempt do not exist yet."""
        import index
        index.db = mock_db
        
        # Mock transaction and document references
        mock_transaction = MagicMock()
        mock_db.transaction.return_value = mock_transaction
        
        # Mock snapshots
        mock_student_snap = MagicMock()
        mock_student_snap.exists = False
        
        mock_attempt_snap = MagicMock()
        mock_attempt_snap.exists = False
        
        mock_student_doc = MagicMock()
        mock_student_doc.get.return_value = mock_student_snap
        
        mock_attempt_doc = MagicMock()
        mock_attempt_doc.get.return_value = mock_attempt_snap
        
        mock_db.document.side_effect = lambda path: mock_student_doc if "users/" in path else mock_attempt_doc

        # Mock the transaction execution to run the transactional function immediately
        def transactional_wrapper(func):
            def wrapper(*args, **kwargs):
                return func(mock_transaction)
            return wrapper
        
        with patch("firebase_admin.firestore.transactional", side_effect=transactional_wrapper):
            # Reload to apply decorator patch
            import importlib
            import index
            importlib.reload(index)
            index.db = mock_db
            
            payload = {
                "rollNumber": "ROLL-101",
                "finalSchoolId": "school-a",
                "finalExamId": "exam-1",
                "username": "John Doe",
                "clientFootprint": "chrome-platform-id"
            }
            
            response = client.post("/api/gatekeeper/enroll", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertTrue(data["success"])
            self.assertEqual(data["resolvedStudentId"], "std_school-a_roll-101")
            self.assertEqual(data["finalStudentProfile"]["name"], "John Doe")

    @patch("index.db")
    def test_enroll_exam_already_completed(self, mock_db):
        """Test that attempting to enroll in an already completed exam results in a 409 error."""
        import index
        index.db = mock_db
        
        mock_transaction = MagicMock()
        mock_db.transaction.return_value = mock_transaction
        
        # Student exists
        mock_student_snap = MagicMock()
        mock_student_snap.exists = True
        mock_student_snap.id = "std_school-a_roll-101"
        mock_student_snap.to_dict.return_value = {"name": "John Doe", "role": "student"}
        
        # Attempt exists and is COMPLETED
        mock_attempt_snap = MagicMock()
        mock_attempt_snap.exists = True
        mock_attempt_snap.to_dict.return_value = {"status": "completed"}
        
        mock_student_doc = MagicMock()
        mock_student_doc.get.return_value = mock_student_snap
        
        mock_attempt_doc = MagicMock()
        mock_attempt_doc.get.return_value = mock_attempt_snap
        
        mock_db.document.side_effect = lambda path: mock_student_doc if "users/" in path else mock_attempt_doc

        # Mock transaction wrapper
        def transactional_wrapper(func):
            def wrapper(*args, **kwargs):
                return func(mock_transaction)
            return wrapper
        
        with patch("firebase_admin.firestore.transactional", side_effect=transactional_wrapper):
            import importlib
            import index
            importlib.reload(index)
            index.db = mock_db
            
            payload = {
                "rollNumber": "ROLL-101",
                "finalSchoolId": "school-a",
                "finalExamId": "exam-1",
                "username": "John Doe",
                "clientFootprint": "chrome-platform-id"
            }
            
            response = client.post("/api/gatekeeper/enroll", json=payload)
            self.assertEqual(response.status_code, 409)
            data = response.json()
            self.assertEqual(data["code"], "EXAM_ALREADY_COMPLETED")

    @patch("index.db")
    def test_enroll_session_hijack_blocked(self, mock_db):
        """Test that registering from a mismatched footprint blocks with 403 Session Hijack Error."""
        import index
        index.db = mock_db
        
        mock_transaction = MagicMock()
        mock_db.transaction.return_value = mock_transaction
        
        # Student exists
        mock_student_snap = MagicMock()
        mock_student_snap.exists = True
        mock_student_snap.id = "std_school-a_roll-101"
        mock_student_snap.to_dict.return_value = {"name": "John Doe", "role": "student"}
        
        # Attempt exists with different footprint
        mock_attempt_snap = MagicMock()
        mock_attempt_snap.exists = True
        mock_attempt_snap.to_dict.return_value = {
            "status": "started",
            "deviceFootprint": "original-macbook-footprint"
        }
        
        mock_student_doc = MagicMock()
        mock_student_doc.get.return_value = mock_student_snap
        
        mock_attempt_doc = MagicMock()
        mock_attempt_doc.get.return_value = mock_attempt_snap
        
        mock_db.document.side_effect = lambda path: mock_student_doc if "users/" in path else mock_attempt_doc

        # Mock transaction wrapper
        def transactional_wrapper(func):
            def wrapper(*args, **kwargs):
                return func(mock_transaction)
            return wrapper
        
        with patch("firebase_admin.firestore.transactional", side_effect=transactional_wrapper):
            import importlib
            import index
            importlib.reload(index)
            index.db = mock_db
            
            payload = {
                "rollNumber": "ROLL-101",
                "finalSchoolId": "school-a",
                "finalExamId": "exam-1",
                "username": "John Doe",
                "clientFootprint": "attacker-android-footprint"
            }
            
            response = client.post("/api/gatekeeper/enroll", json=payload)
            self.assertEqual(response.status_code, 403)
            data = response.json()
            self.assertEqual(data["code"], "SESSION_HIJACK_BLOCKED")
            self.assertIn("Mismatched browser/device footprint", data["error"])

    @patch("index.db")
    def test_update_exam_not_found(self, mock_db):
        """Test that updating a non-existent exam paper returns a 404 error."""
        import index
        index.db = mock_db
        
        mock_snapshot = MagicMock()
        mock_snapshot.exists = False
        
        mock_doc = MagicMock()
        mock_doc.get.return_value = mock_snapshot
        mock_db.document.return_value = mock_doc
        
        payload = {
            "title": "New Title",
            "description": "New Description",
            "subject": "Physics",
            "difficulty": "Hard",
            "duration": 45,
            "totalMarks": 120,
            "startTime": "2026-07-13T09:00:00Z",
            "endTime": "2026-07-13T12:00:00Z",
            "assignedSchoolIds": ["school-x", "school-y"]
        }
        
        response = client.put("/api/exams/non_existent_exam", json=payload)
        self.assertEqual(response.status_code, 404)
        self.assertIn("Exam paper not found", response.json()["detail"])

    @patch("index.db")
    def test_update_exam_success(self, mock_db):
        """Test that updating an existing exam saves parameters and configures school links."""
        import index
        index.db = mock_db
        
        # Mock exam snapshot
        mock_exam_snap = MagicMock()
        mock_exam_snap.exists = True
        mock_exam_snap.to_dict.return_value = {"status": "published", "title": "Old Title"}
        
        mock_exam_doc = MagicMock()
        mock_exam_doc.get.return_value = mock_exam_snap
        
        mock_token_snap = MagicMock()
        mock_token_snap.exists = True
        
        mock_token_doc = MagicMock()
        mock_token_doc.get.return_value = mock_token_snap
        
        mock_db.document.side_effect = lambda path: mock_exam_doc if "exams/" in path else mock_token_doc
        
        # Mock schools fetch
        mock_school_1 = MagicMock()
        mock_school_1.id = "school-x"
        mock_school_2 = MagicMock()
        mock_school_2.id = "school-y"
        mock_db.collection.return_value.get.return_value = [mock_school_1, mock_school_2]
        
        payload = {
            "title": "Quantum Mechanics Intro",
            "description": "Welcome to Wavefunctions",
            "subject": "Physics",
            "difficulty": "Hard",
            "duration": 60,
            "totalMarks": 100,
            "startTime": "2026-07-14T10:00:00Z",
            "endTime": "2026-07-14T11:00:00Z",
            "assignedSchoolIds": ["school-x"]
        }
        
        response = client.put("/api/exams/exam_123", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertEqual(data["updatedFields"]["title"], "Quantum Mechanics Intro")
        self.assertEqual(data["updatedFields"]["assignedSchoolIds"], ["school-x"])
        mock_exam_doc.update.assert_called_once()
        mock_token_doc.update.assert_called_once()

if __name__ == "__main__":
    unittest.main()
