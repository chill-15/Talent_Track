const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const User = require("./User");
const Job = require("./Job");
const { protect, adminOnly, generateToken } = require("./auth");

// ── multer setup ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user._id}_${Date.now()}_${file.originalname.replace(/\s+/g,"_")}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf",".doc",".docx",".txt"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only PDF/DOC/TXT files allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ── skill keywords ────────────────────────────────────────
const SKILLS_KW = [
  "python","java","javascript","typescript","c++","c#","ruby","php","swift","kotlin",
  "go","rust","scala","html","css","react","angular","vue","nextjs","nodejs","express",
  "django","flask","spring","laravel","sql","mysql","postgresql","mongodb","redis",
  "firebase","sqlite","machine learning","deep learning","tensorflow","pytorch","keras",
  "scikit","numpy","pandas","matplotlib","statistics","excel","tableau","power bi",
  "aws","azure","gcp","docker","kubernetes","jenkins","terraform","ansible","linux",
  "git","ci/cd","devops","rest","api","graphql","microservices","agile","scrum",
  "figma","photoshop","android","ios","react native","flutter","cybersecurity","blockchain"
];

function extractSkills(text) {
  const low = (text||"").toLowerCase();
  return SKILLS_KW.filter(sk => {
    try {
      return new RegExp(`\\b${sk.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"i").test(low);
    } catch { return low.includes(sk); }
  });
}

// POST /api/users/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success:false, message:"All fields required" });
    if (password.length < 6)
      return res.status(400).json({ success:false, message:"Password min 6 characters" });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ success:false, message:"Email already registered" });

    const user = await User.create({ name, email, password });
    res.status(201).json({
      success: true,
      message: "Account created",
      token: generateToken(user._id),
      user: { _id:user._id, name:user.name, email:user.email, role:user.role }
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/users/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");

    if (!user)
      return res.status(401).json({ success:false, message:"Invalid credentials" });

    const isMatch = await user.matchPassword(password);

    if (!isMatch)
      return res.status(401).json({ success:false, message:"Invalid credentials" });

    // ✅ ADD HERE (THIS IS YOUR DOUBT)
    if (user.role !== "admin") {
      return res.status(403).json({ success:false, message:"Not an admin" });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json({ success:false, message:err.message });
  }
});

// POST /api/users/admin/login
router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email:email.toLowerCase(), role:"admin" }).select("+password");
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success:false, message:"Invalid admin credentials" });

    res.json({
      success: true,
      token: generateToken(user._id),
      user: { _id:user._id, name:user.name, email:user.email, role:user.role }
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/users/profile
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("savedJobs","title company location requiredSkills icon salary jobType");
    if (!user) return res.status(404).json({ success:false, message:"User not found" });
    res.json({ success:true, user });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PUT /api/users/profile
router.put("/profile", protect, async (req, res) => {
  try {
    const { name, skills, education, experience, location, preferredRole, bio } = req.body;
    const upd = {};
    if (name)           upd.name          = name;
    if (education)      upd.education     = education;
    if (experience)     upd.experience    = experience;
    if (location)       upd.location      = location;
    if (preferredRole)  upd.preferredRole = preferredRole;
    if (bio !== undefined) upd.bio        = bio;
    if (skills) upd.skills = Array.isArray(skills)
      ? skills.map(s=>s.trim().toLowerCase()).filter(Boolean)
      : skills.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);

    const user = await User.findByIdAndUpdate(req.user._id, upd, { new:true });
    res.json({ success:true, message:"Profile updated", user });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/users/resume
router.post("/resume", protect, upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, message:"No file uploaded" });

    let extracted = [];
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === ".pdf") {
      try {
        const pdfParse = require("pdf-parse");
        const buf  = fs.readFileSync(req.file.path);
        const data = await pdfParse(buf);
        extracted  = extractSkills(data.text);
      } catch(e) { console.log("PDF parse note:", e.message); }
    }
    if (ext === ".txt") {
      try { extracted = extractSkills(fs.readFileSync(req.file.path,"utf8")); } catch(_){}
    }

    const user   = await User.findById(req.user._id);
    const merged = [...new Set([...(user.skills||[]), ...extracted])];
    const updated = await User.findByIdAndUpdate(req.user._id,{
      resumePath: req.file.filename,
      resumeOriginalName: req.file.originalname,
      skills: merged
    },{ new:true });

    res.json({
      success: true,
      message: `Resume uploaded. ${extracted.length} skills extracted.`,
      extractedSkills: extracted,
      skills: updated.skills,
      resumePath: req.file.filename,
      resumeOriginalName: req.file.originalname
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/users/saved/:id
router.post("/saved/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const jid  = req.params.id;
    if (user.savedJobs.map(x=>x.toString()).includes(jid))
      return res.status(400).json({ success:false, message:"Already saved" });
    user.savedJobs.push(jid);
    await user.save();
    res.json({ success:true, message:"Job saved", savedJobs:user.savedJobs });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/users/saved/:id
router.delete("/saved/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.savedJobs = user.savedJobs.filter(x=>x.toString()!==req.params.id);
    await user.save();
    res.json({ success:true, message:"Removed from saved", savedJobs:user.savedJobs });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/users/saved
router.get("/saved", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("savedJobs");
    res.json({ success:true, savedJobs: user.savedJobs });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/users/applications
router.get("/applications", protect, async (req, res) => {
  try {
    const jobs = await Job.find({ "applications.user": req.user._id },
      { title:1, company:1, location:1, jobType:1, "applications.$":1 });

    const apps = jobs.map(j=>({
      jobId:     j._id,
      jobTitle:  j.title,
      company:   j.company,
      location:  j.location,
      jobType:   j.jobType,
      status:    j.applications[0].status,
      appliedAt: j.applications[0].appliedAt
    })).sort((a,b)=>new Date(b.appliedAt)-new Date(a.appliedAt));

    res.json({ success:true, applications:apps });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/users/all  [admin]
router.get("/all", protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role:"user" }).select("-password").sort({ createdAt:-1 });
    res.json({ success:true, count:users.length, users });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

module.exports = router;
