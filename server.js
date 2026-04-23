require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(__dirname)); // serve frontend from same folder

app.use("/api/users", require("./users"));
app.use("/api/jobs", require("./jobs"));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server running" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});