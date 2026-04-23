const mongoose = require("mongoose");

const AppSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName:   { type: String, default: "" },
  userEmail:  { type: String, default: "" },
  resumePath: { type: String, default: "" },
  status: {
    type: String,
    enum: ["Applied","Under Review","Shortlisted","Interview Scheduled","Rejected","Selected"],
    default: "Applied"
  },
  appliedAt: { type: Date, default: Date.now }
});

const JobSchema = new mongoose.Schema({
  title:          { type: String, required: true, trim: true },
  company:        { type: String, required: true, trim: true },
  description:    { type: String, default: "" },
  requiredSkills: { type: [String], required: true },
  experience:     { type: String, default: "Any" },
  education:      { type: String, default: "Any" },
  location:       { type: String, default: "Remote" },
  jobType: {
    type: String,
    enum: ["Full-time","Part-time","Contract","Internship","Freelance"],
    default: "Full-time"
  },
  salary:       { type: String, default: "" },
  category:     { type: String, default: "Technology" },
  icon:         { type: String, default: "💼" },
  isActive:     { type: Boolean, default: true },
  postedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  applications: [AppSchema]
}, { timestamps: true });

module.exports = mongoose.model("Job", JobSchema);
