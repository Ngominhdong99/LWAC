# LWAC (Learn With Amateur Coach) - Internal Project Documentation

**Target Audience:** Future AI Agents handling this repository.
**Goal:** Provide rapid onboarding, tech stack insight, feature architecture, and database contexts so you do not have to deeply analyze the whole codebase from scratch.

## 1. Project Overview
LWAC is a dedicated educational platform enabling a **Coach** to create, assign, and manage comprehensive IELTS-style tasks (Reading, Listening, Writing, Speaking) for **Students**. Students log in to take assigned tests, ask questions to coaches, and manage a vocabulary library.

## 2. Tech Stack & Environment
* **Frontend:** React + Vite, Tailwind CSS, Lucide-React, Axios, React Router v6.
   * Path: `c:\Users\os\Desktop\LWAC\frontend`
   * Run script: `npm.cmd run dev` (If `npm run dev` fails on Windows)
* **Backend:** Python + FastAPI, SQLAlchemy (ORM), Pydantic (validation), SQLite (Database handling), Uvicorn.
   * Path: `c:\Users\os\Desktop\LWAC\backend`
   * DB File: `c:\Users\os\Desktop\LWAC\backend\lwac.db`
   * Run script: `.\venv\Scripts\uvicorn app.main:app --reload` (Run from logic root `backend/`)
* **Authentication:** JWT-based stateless auth for distinct role gating (`coach` vs `student`).

## 3. Directory Layout
* `backend/app/main.py`: Entry point for FastAPI, mounts routing logic and static files for media.
* `backend/app/routers/`: Segmented endpoints (`auth`, `lessons`, `vocab`, `results`, `quiz`, `chat`, `coach`, `upload`).
* `backend/app/models.py`: SQLAlchemy schemas (critical to check relationships and `cascade` delete mechanisms).
* `backend/app/schemas.py`: Pydantic input/response validation structs.
* `frontend/src/pages/`: Major UI views (`LessonManager`, `LessonBuilder`, `StudentManager`, etc.)
* `frontend/src/components/`: Reusable layouts (`MainLayout`, `ProtectedRoute`, `BottomNav`).

## 4. Key Entities & Database Schema (`models.py`)
1. **User**: Differentiates `role` as `"coach"` or `"student"`.
2. **Lesson**: The core assessment entity. Can be of type `reading`, `listening`, `writing`, or `speaking`. Contains JSON `content` (passages, prompts) and `media_url` for uploaded audios.
3. **Question**: Attached to `Lesson` (only for reading/listening). Types include `multiple_choice` or `fill_blank`. Holds options and `correct_answer`.
4. **Assignment**: The linking table between Coach, Student, and Lesson. Tracks `status` (`pending`, `completed`), and links to `Result`.
5. **Result**: Stores the final grading `score` and JSON `responses`. For Writing tasks, feedback/instructor highlights are also saved inside the JSON payload.
6. **TeacherQuestion**: A system where students ask specific context questions, and coaches answer them.
7. **VocabVault**: Flashcard mechanism for students holding terms, IPA, meaning, and text-to-speech auto-generated URLs.

## 5. Specific Features & Workarounds Implemented

### A. The "Assignment-Driven" Architecture
Students **only** see tests inside their `Practice` tab if a coach explicitly assigns them via the `StudentManager.jsx` assigning modal. Unassigned tests are hidden from students.

### B. Lesson Builder & Manager (`LessonBuilder.jsx`, `LessonManager.jsx`)
* Coaches build complex lessons containing paragraphs, questions with distinct options, timers (writing tasks), or audio upload components (listening tasks).
* **The "Edit Modal":** To maintain UX, editing an existing lesson is done completely within a large modal in `LessonManager.jsx` (which shares the UI definition with `LessonBuilder`) rather than navigating to a separate route. Updates patch the `Lesson` core object and bulk update any related `Question` array using `# DELETE existing / Insert new` logic on the backend.
* **Cascade Delete Rule**: Deleting a Lesson from the `LessonManager` requires manual cleanup of SQLite schemas due to foreign key constraints: `DELETE /lessons/{id}` manually removes `TeacherQuestion` and `Assignment` instances linked to the lesson to prevent throwing `400 IntegrityError`.

### C. Audio Systems
* **Listening Tests**: Teachers upload `.mp3` or `.wav` via a `FormData` POST `/upload/audio`. The backend serves these via the Mount static directory `/static/uploads`. If playback fails on the Frontend, verify no double `http://127.0.0.1:8000/` domains are appending.
* **Speaking Tests**: Built with native browser `MediaRecorder` API. Actively captures audio from the Student's mic, converts to `Blob` (`audio/mp3`), uploads via a specific backend route, and commits the `media_url` response deep inside the `Result` JSON object for later coach playback.

## 6. How to Continue Development (Best Practices for Agents)
1. Whenever modifying an item that interacts heavily with DB rules (e.g., updating result structures), check `schemas.py` and `models.py` to ensure schema shapes match frontend requests.
2. If hitting `405 Method Not Allowed` or `422 Unprocessable Entity` issues on edits/deletes, check routing order logic in the `routers/` directory, and verify you are not missing trailing slashes.
3. For Frontend UI, use Tailwind CSS utility classes heavily. Follow the established design pattern of `slate-50` backgrounds, `rounded-xl` or `rounded-2xl` containers, and `primary-600` interactive focus rings.

## 7. Current Project Status
- The Assignment & Lesson Builder workflows are fully functioning.
- The UI features modals for Editing/Deleting without page reloads.
- The database is pre-seeded with genuine test data via `scripts/seed.py`.

*Last Updated: March 2026*
