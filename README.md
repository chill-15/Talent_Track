# TalentTrack – Skill Based Job Recommendation System
Full-stack: Node.js + Express + MongoDB + HTML/CSS/JS

## QUICK START (3 steps)

### Step 1 – Install MongoDB
Download from https://www.mongodb.com/try/download/community
Start MongoDB (it usually starts automatically on Windows after install)

### Step 2 – Open in VS Code + install dependencies
```
npm install
```

### Step 3 – Run the server
```
npm run dev
```

Open: https://talenttrack-wxq1.onrender.com

## LOGIN CREDENTIALS
- Admin: admin@talenttrack.com / admin123
- Users: Register a new account

## FOLDER STRUCTURE
```
TalentTrack/
├── package.json
├── .env
├── frontend/
│   ├── index.html       ← Landing page
│   ├── login.html       ← User login
│   ├── register.html    ← User registration
│   ├── dashboard.html   ← User dashboard
│   ├── admin.html       ← Admin panel
│   ├── css/style.css
│   └── js/script.js
└── backend/
    ├── server.js
    ├── config/db.js
    ├── middleware/auth.js
    ├── models/User.js
    ├── models/Job.js
    ├── routes/users.js
    └── routes/jobs.js
```

## FEATURES
User: Register/Login, Profile, Resume Upload, Skill Extraction, Job Recommendations,
      Match Score, Skill Gap Analysis, Apply for Jobs, Save Jobs, Application Tracking,
      Career Advisor Chat, Dark Mode

Admin: Login, Post Jobs, Delete Jobs, View Applicants, Update Applicant Status,
       Analytics Dashboard, Skills Demand Chart, User Management
