const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

const Job = require("./Job");
const User = require("./User");
const { protect, adminOnly } = require("./auth");

// ══════════════════════════════════════════════════════════
// SKILL MATCHING ALGORITHM
// matchScore = (matchedSkills / totalRequiredSkills) × 100
// ══════════════════════════════════════════════════════════
function computeMatch(userSkills, jobSkills) {
  if (!jobSkills||!jobSkills.length||!userSkills||!userSkills.length) return 0;
  const u = userSkills.map(s=>s.toLowerCase().trim());
  const j = jobSkills.map(s=>s.toLowerCase().trim());
  const matched = j.filter(js=>u.some(us=>us===js||us.includes(js)||js.includes(us)));
  return Math.round((matched.length/j.length)*100);
}

function getMatched(userSkills, jobSkills) {
  if (!userSkills||!jobSkills) return [];
  const u = userSkills.map(s=>s.toLowerCase().trim());
  return jobSkills.filter(js=>u.some(us=>us===js.toLowerCase()||us.includes(js.toLowerCase())||js.toLowerCase().includes(us)));
}

function getMissing(userSkills, jobSkills) {
  const m = getMatched(userSkills, jobSkills).map(s=>s.toLowerCase());
  return (jobSkills||[]).filter(js=>!m.includes(js.toLowerCase()));
}

async function getTokenSkills(req) {
  try {
    const auth = req.headers.authorization;
    if (!auth||!auth.startsWith("Bearer ")) return [];
    const dec  = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
    const user = await User.findById(dec.id).select("skills");
    return user?.skills||[];
  } catch { return []; }
}

// Career advisor data
const CAREER_PATHS = [
  { title:"Data Scientist",       icon:"🔬", skills:["python","machine learning","sql","statistics","pandas","tensorflow"] },
  { title:"Full Stack Developer", icon:"💻", skills:["javascript","react","nodejs","sql","html","css"] },
  { title:"Backend Developer",    icon:"⚙️",  skills:["python","nodejs","sql","rest","docker","aws"] },
  { title:"Frontend Developer",   icon:"🎨", skills:["html","css","javascript","react","typescript","figma"] },
  { title:"DevOps Engineer",      icon:"🚀", skills:["docker","kubernetes","aws","linux","ci/cd","git"] },
  { title:"Data Analyst",         icon:"📊", skills:["python","sql","excel","tableau","statistics"] },
  { title:"ML Engineer",          icon:"🤖", skills:["python","machine learning","tensorflow","docker","aws"] },
  { title:"Cloud Architect",      icon:"☁️",  skills:["aws","azure","gcp","docker","kubernetes"] },
  { title:"Mobile Developer",     icon:"📱", skills:["react native","flutter","android","ios","javascript"] },
  { title:"Cybersecurity Analyst",icon:"🔐", skills:["cybersecurity","networking","linux","python","aws"] }
];

const COURSES = {
  python:["Python for Everybody – Coursera (Free Audit)","Complete Python Bootcamp – Udemy"],
  react:["React – The Complete Guide – Udemy","Official React Docs – react.dev (Free)"],
  javascript:["JavaScript.info – Free Online","freeCodeCamp JS Course – Free"],
  sql:["SQL for Data Science – Coursera","SQLZoo Interactive Tutorial – Free"],
  "machine learning":["Machine Learning Specialization – Coursera","Fast.ai Practical ML – Free"],
  aws:["AWS Cloud Practitioner – aws.amazon.com/training","AWS Solutions Architect – Udemy"],
  docker:["Docker Mastery – Udemy","Docker Official Documentation – Free"],
  nodejs:["Node.js Complete Guide – Udemy","The Odin Project – Free"],
  typescript:["Understanding TypeScript – Udemy","TypeScript Handbook – typescriptlang.org (Free)"],
  excel:["Excel Skills for Business – Coursera","ExcelJet Tutorials – exceljet.net (Free)"],
  tableau:["Tableau Desktop Specialist – Tableau (Official)","Tableau on Udemy"],
  default:["Search on Coursera – coursera.org","Search on Udemy – udemy.com"]
};

// ── GET /api/jobs ─────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { search, location, experience, type, sort } = req.query;
    const query = { isActive:true };

    if (search) query.$or = [
      { title:          { $regex:search, $options:"i" } },
      { company:        { $regex:search, $options:"i" } },
      { requiredSkills: { $elemMatch:{ $regex:search, $options:"i" } } }
    ];
    if (location)   query.location   = { $regex:location,   $options:"i" };
    if (experience) query.experience = experience;
    if (type)       query.jobType    = type;

    const jobs = await Job.find(query).sort({ createdAt:-1 });
    const uSkills = await getTokenSkills(req);

    let result = jobs.map(job => {
      const obj  = job.toObject();
      obj.matchScore      = computeMatch(uSkills, job.requiredSkills);
      obj.matchedSkills   = getMatched(uSkills, job.requiredSkills);
      obj.missingSkills   = getMissing(uSkills, job.requiredSkills);
      obj.applicationCount = job.applications.length;
      return obj;
    });

    if (sort === "match") result.sort((a,b)=>b.matchScore-a.matchScore);
    res.json({ success:true, count:result.length, jobs:result });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /api/jobs/admin/stats ─────────────────────────────
router.get("/admin/stats", protect, adminOnly, async (req, res) => {
  try {
    const [totalJobs, activeJobs, totalUsers, allJobs] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ isActive:true }),
      User.countDocuments({ role:"user" }),
      Job.find({},{ applications:1, requiredSkills:1, title:1, company:1 })
    ]);

    const totalApps = allJobs.reduce((s,j)=>s+j.applications.length,0);
    const selected  = allJobs.reduce((s,j)=>s+j.applications.filter(a=>a.status==="Selected").length,0);

    const sc = {};
    allJobs.forEach(j=>j.requiredSkills.forEach(sk=>{ sc[sk]=(sc[sk]||0)+1; }));
    const topSkills = Object.entries(sc).sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([skill,count])=>({ skill,count }));

    const recentJobs = await Job.find({ "applications.0":{ $exists:true } })
      .sort({ updatedAt:-1 }).limit(5).select("title company applications");
    const recentApps = [];
    recentJobs.forEach(j=>j.applications.slice(0,2).forEach(a=>recentApps.push({
      jobTitle:j.title, company:j.company, userName:a.userName, status:a.status, appliedAt:a.appliedAt
    })));

    res.json({ success:true, stats:{ totalJobs,activeJobs,totalUsers,totalApps,selected,topSkills,recentApps:recentApps.slice(0,6) } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /api/jobs/:id ─────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success:false, message:"Job not found" });
    res.json({ success:true, job });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /api/jobs (admin) ────────────────────────────────
router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { title, company, description, requiredSkills, experience, education,
            location, jobType, salary, category, icon } = req.body;
    if (!title||!company||!requiredSkills)
      return res.status(400).json({ success:false, message:"Title, company and skills required" });

    const skills = Array.isArray(requiredSkills)
      ? requiredSkills.map(s=>s.trim().toLowerCase())
      : requiredSkills.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);

    const job = await Job.create({
      title, company, description,
      requiredSkills: skills,
      experience: experience||"Any",
      education:  education||"Any",
      location:   location||"Remote",
      jobType:    jobType||"Full-time",
      salary:     salary||"",
      category:   category||"Technology",
      icon:       icon||"💼",
      postedBy:   req.user._id
    });
    res.status(201).json({ success:true, message:"Job posted successfully", job });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── PUT /api/jobs/:id (admin) ─────────────────────────────
router.put("/:id", protect, adminOnly, async (req, res) => {
  try {
    const upd = { ...req.body };
    if (upd.requiredSkills && !Array.isArray(upd.requiredSkills))
      upd.requiredSkills = upd.requiredSkills.split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
    const job = await Job.findByIdAndUpdate(req.params.id, upd, { new:true });
    if (!job) return res.status(404).json({ success:false, message:"Job not found" });
    res.json({ success:true, message:"Job updated", job });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── DELETE /api/jobs/:id (admin) ──────────────────────────
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ success:false, message:"Job not found" });
    res.json({ success:true, message:"Job deleted" });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /api/jobs/:id/apply ──────────────────────────────
router.post("/:id/apply", protect, async (req, res) => {
  try {
    const job  = await Job.findById(req.params.id);
    if (!job)          return res.status(404).json({ success:false, message:"Job not found" });
    if (!job.isActive) return res.status(400).json({ success:false, message:"Job is no longer active" });

    const user = await User.findById(req.user._id);
    if (!user.resumePath)
      return res.status(400).json({ success:false, message:"Please upload your resume before applying" });

    const already = job.applications.some(a=>a.user.toString()===req.user._id.toString());
    if (already) return res.status(400).json({ success:false, message:"Already applied for this job" });

    job.applications.push({
      user:req.user._id, userName:user.name, userEmail:user.email, resumePath:user.resumePath
    });
    await job.save();
    res.json({ success:true, message:`Applied to ${job.title} successfully! 🎉` });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── GET /api/jobs/:id/applicants (admin) ──────────────────
router.get("/:id/applicants", protect, adminOnly, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate("applications.user","name email skills education experience location");
    if (!job) return res.status(404).json({ success:false, message:"Job not found" });
    res.json({ success:true, job:{ title:job.title, company:job.company }, applicants:job.applications });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── PUT /api/jobs/:id/applicants/:uid (admin) ─────────────
router.put("/:id/applicants/:uid", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ["Applied","Under Review","Shortlisted","Interview Scheduled","Rejected","Selected"];
    if (!valid.includes(status))
      return res.status(400).json({ success:false, message:"Invalid status" });

    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success:false, message:"Job not found" });

    const app = job.applications.find(a=>a.user.toString()===req.params.uid);
    if (!app)  return res.status(404).json({ success:false, message:"Application not found" });

    app.status = status;
    await job.save();
    res.json({ success:true, message:`Status updated to "${status}"` });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /api/jobs/advisor ────────────────────────────────
router.post("/advisor", protect, async (req, res) => {
  try {
    const { message="", userSkills=[] } = req.body;
    const lmsg = message.toLowerCase();

    const scored = CAREER_PATHS
      .map(cp=>({ ...cp, score:computeMatch(userSkills,cp.skills) }))
      .sort((a,b)=>b.score-a.score);

    const mentionedSkill = Object.keys(COURSES).find(k=>lmsg.includes(k) && k!=="default");
    let reply = "";

    if (/salary|pay|earn|ctc|package/.test(lmsg)) {
      reply = `Typical salary ranges in India:<br>
• <b>Fresher (0y):</b> ₹3–6 LPA<br>
• <b>Junior (1-2y):</b> ₹6–12 LPA<br>
• <b>Mid-level (3-5y):</b> ₹12–20 LPA<br>
• <b>Senior (5+y):</b> ₹20–40+ LPA<br><br>
High-demand skills like ML, AWS, React, and Docker command premium salaries.`;
    }
    else if (/certif|course|learn/.test(lmsg)) {
      reply = `Top certifications to pursue:<br>
• <b>AWS Cloud Practitioner</b> – for cloud roles<br>
• <b>Google Data Analytics</b> – for data roles<br>
• <b>Meta Frontend Developer</b> – for web roles<br>
• <b>Coursera ML Specialization</b> – for AI/ML<br><br>
Available on Coursera, Udemy and official vendor sites.`;
    }
    else if (/fresher|beginner|start|no experience|new/.test(lmsg)) {
      const top = scored[0];
      reply = `As a fresher, here is your roadmap:<br>
1. Master fundamentals in your domain<br>
2. Build 2–3 portfolio projects on GitHub<br>
3. Get one relevant certification<br>
4. Network on LinkedIn<br>
5. Apply to internships first<br><br>
Based on your skills, <b>${top.title}</b> seems like a great starting point with a <b>${top.score}% match</b>!`;
    }
    else if (/interview|prepare|interview tips/.test(lmsg)) {
      reply = `Interview preparation tips:<br>
• Practice DSA on LeetCode / HackerRank daily<br>
• Review system design basics for senior roles<br>
• Be ready to explain your projects end-to-end<br>
• Research the company before every interview<br>
• Do mock interviews on Pramp or interviewing.io<br><br>
Focus on your top matched roles and use the 📊 Gap Analysis feature on job cards!`;
    }
    else if (mentionedSkill) {
      const key = Object.keys(COURSES).find(k=>mentionedSkill.includes(k)||k.includes(mentionedSkill))||"default";
      const courses = COURSES[key]||COURSES.default;
      const roles   = CAREER_PATHS.filter(cp=>cp.skills.includes(mentionedSkill)).slice(0,3).map(cp=>cp.title);
      reply = `To learn <b>${mentionedSkill}</b>, I recommend:<br>
${courses.map(c=>`• ${c}`).join("<br>")}<br><br>
This skill unlocks roles like: <b>${roles.length?roles.join(", "):"many tech positions"}</b>.`;
    }
    else if (/best|recommend|suggest|what should|career|path/.test(lmsg)) {
      const top  = scored[0];
      const miss = top.skills.filter(s=>!userSkills.some(us=>us.includes(s)||s.includes(us))).slice(0,3);
      reply = `Based on your skills, your best career match is <b>${top.title}</b> (${top.score}% match).<br><br>
Your top 4 career paths:<br>
${scored.slice(0,4).map(cp=>`• <b>${cp.icon} ${cp.title}</b> – ${cp.score}% match`).join("<br>")}
${miss.length?`<br><br>Skills to learn next: <b>${miss.join(", ")}</b>`:"<br><br>✅ You have excellent skill coverage!"}`;
    }
    else if (/hi|hello|hey|namaste/.test(lmsg)) {
      reply = `Hello! 👋 I'm your TalentTrack Career Advisor.<br><br>
I can help you with:<br>
• <b>Career path recommendations</b> based on your skills<br>
• <b>Skills to learn next</b> for your target role<br>
• <b>Course suggestions</b> to close skill gaps<br>
• <b>Salary information</b> by role and experience<br>
• <b>Fresher tips</b> to land your first job<br><br>
What would you like to know?`;
    }
    else {
      const top3 = scored.slice(0,3).map(cp=>`• <b>${cp.icon} ${cp.title}</b> – ${cp.score}% match`).join("<br>");
      reply = `Based on your skills, your top career matches are:<br>${top3}<br><br>
Ask me about a specific role, skill to learn, salary, or career advice and I'll give a detailed answer!`;
    }

    res.json({ success:true, reply, topCareers:scored.slice(0,6) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

module.exports = router;
