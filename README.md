# Vehicle Management App

## 🧭 Overview
The **Vehicle Management App** is a full-stack project built as part of the Optibus Home Assignment. It allows users to manage a fleet of vehicles — create, edit, delete, and update their current status.

The app demonstrates a clean separation between backend (API + business logic) and frontend (UI + interaction), both written in **TypeScript**.

### Core Features
- Full **CRUD** functionality for vehicles.
- Vehicle status management: `Available`, `InUse`, `Maintenance`.
- Business rules enforced:
  - A vehicle in *Maintenance* can only move back to *Available*.
  - Vehicles in *InUse* or *Maintenance* cannot be deleted.
  - A maximum of **5%** of vehicles can be in *Maintenance* simultaneously (minimum 1).
- Preloaded seed data (`vehicles.json`) with example vehicles.
- Unit and integration test coverage for backend logic and API.

---

## 🧱 Project Structure
```
optibus-vehicle-management/
├── backend/
│   ├── src/
│   │   ├── data/vehicles.json
│   │   ├── models/structures.ts
│   │   ├── routes/vehicles.ts
│   │   ├── services/vehicleService.ts
│   │   ├── tests/
│   │   │   ├── __mocks__/
│   │   │   │   ├── fs.promises.mock.ts
│   │   │   │   └── vehicles.fixture.ts
│   │   │   ├── integration/
│   │   │   │   └── vehicles.api.test.ts
│   │   │   └── vehicleService.test.ts
│   │   └── server.ts
│   ├── jest.config.ts
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── assets/
│   │   ├── api.ts
│   │   ├── App.tsx
│   │   ├── errorMessages.ts
│   │   ├── main.tsx
│   │   └── types.ts
│   ├── vite.config.ts
│   ├── index.html
│   └── tsconfig.app.json
│
├── package.json
└── README.md
```

---

## 🧰 Prerequisites
Before running the project, make sure the following are installed:
- **Node.js** (version 18 or later)
- **npm** (comes with Node.js)
- **Git** (optional, for cloning the repository)
- **VS Code** (optional, for development convenience)

---

## ⚙️ Setup & Installation

### 1. Clone the repository
```bash
git clone <repository_url>
cd optibus-vehicle-management
```

### 2. Install all dependencies
```bash
npm run install:all
```

### 3. Run the app (backend + frontend together)
```bash
npm run dev
```

This will concurrently run:
- **Backend** → `http://localhost:3000`
- **Frontend** → `http://localhost:5173`

---

## 🖥️ Frontend Functionality
- **Create vehicle**: form with `License plate` and `Model` inputs, validation, and inline success/error messages.
- **Vehicle table**: columns for ID, plate, model, status, creation date, and actions.
  - Filter by status (`All | Available | InUse | Maintenance`).
  - Sorting by creation date.
- **Status management**: dropdown with dynamic disabling based on transition rules and the 5% maintenance cap.
- **Edit plate**: updates license plate with backend normalization and validation.
- **Delete**: allowed only for `Available` vehicles, requires admin password.
- **Feedback & themes**: real-time loading, inline notifications, and automatic light/dark theme.

---

## 🛠️ Backend API Details
Base URL: `/api/vehicles`

| Method | Endpoint | Description |
|---------|-----------|-------------|
| GET | `/api/vehicles` | List all vehicles |
| POST | `/api/vehicles` | Create a new vehicle |
| PATCH | `/api/vehicles/:licensePlate/status` | Update vehicle status |
| PATCH | `/api/vehicles/:id/plate` | Edit license plate |
| DELETE | `/api/vehicles/:id` | Delete vehicle (admin only) |

Each endpoint returns consistent error shapes:
```json
{ "error": { "code": "<ERROR_CODE>", "message": "<human readable>" } }
```

---

## 🔐 Environment & Configuration
The backend uses a simple `.env` file for configuration. For this exercise, it includes one variable used to authorize vehicle deletions:
```env
ADMIN_DELETE_TOKEN=261098
```
When attempting to delete a vehicle, the app prompts for this token and sends it in the `x-admin-token` HTTP header.

---

## 🧪 Testing
### Structure
All backend tests are located in `backend/src/tests/`:
- **Unit tests** (`vehicleService.test.ts`) – Validate core business logic (CRUD operations, validation, and transitions).
- **Integration tests** (`integration/vehicles.api.test.ts`) – Validate full API flow using `supertest` on a temporary in-memory JSON copy.

### How they work
- Each integration test creates an isolated temporary data file using the environment variable `DATA_PATH`, ensuring real seed data isn’t modified.
- Tests dynamically adapt to the current fleet and 5% Maintenance cap.
- Coverage includes:
  - Valid and invalid status transitions.
  - CRUD flow (Create → Update → Delete).
  - Enforcement of deletion permissions and admin token.

### Run tests
```bash
cd backend
npm test
```

---

## 🧩 Technologies Used
- **Frontend:** React + Vite + TypeScript
- **Backend:** Node.js + Express + TypeScript
- **Testing:** Jest + Supertest
- **Data Storage:** JSON file (`vehicles.json`)
- **Utilities:** Concurrently, ESLint, TSConfig

---

## 🚀 Future Improvements
1. **Advanced filtering:** Allow users to search vehicles by model name (e.g., typing “Mazda” filters the table dynamically).
2. **Additional attributes:** Add a new column for the number of passengers each vehicle supports, enabling filtering (e.g., “7 seats or more”).
3. **Database upgrade:** Move from local JSON storage to a robust database (e.g., MongoDB or PostgreSQL) for persistence and scalability.
4. **UI/UX enhancement:** Improve visual design and layout for a smoother, more intuitive user experience.

---

## 💡 Notes
- The app enforces all validation and business logic rules both client-side and server-side.
- Vehicles data is stored locally in a JSON file for simplicity.
- The project was structured for scalability and readability.

---

## 👩‍💻 Author
Developed by **Maya Cohen** as part of the Optibus Fullstack Developer Assignment.

