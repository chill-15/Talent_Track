const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name:               { type: String, required: true, trim: true },
  email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:           { type: String, required: true, minlength: 6, select: false },
  role:               { type: String, enum: ["user","admin"], default: "user" },
  skills:             { type: [String], default: [] },
  education:          { type: String, default: "" },
  experience:         { type: String, default: "" },
  location:           { type: String, default: "" },
  preferredRole:      { type: String, default: "" },
  bio:                { type: String, default: "" },
  resumePath:         { type: String, default: null },
  resumeOriginalName: { type: String, default: null },
  savedJobs:          [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }],
}, { timestamps: true });

UserSchema.pre("save", async function(next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function(entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", UserSchema);
