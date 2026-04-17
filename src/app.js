// ================== IMPORTS ==================
const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Database
const pool = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const sevaRoutes = require("./routes/sevaRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const categoryRoutes = require("./routes/catRoutes");
const locationRoutes = require("./routes/locRoutes");
const assetRoutes = require("./routes/assetRoutes");
const devoteeRoutes = require("./routes/DevoteeMasterRoutes");
const priestRoutes = require("./routes/PriestMaster");
const templeBranchRoutes = require("./routes/TempleBranchRoutes");
const userRoutes = require("./routes/CreateUserRoutes");
const boardRoutes = require("./routes/BranchDirectorsRoute");
const bankRoutes = require("./routes/BankDetailRoutes");
const eventRoutes = require("./routes/eventDetailsRoutes");
const documentRoutes = require("./routes/DocumentDigitalRoutes");
const projectRoutes = require("./routes/ProjectRoutes");
const { curr_user } = require("./controllers/authController");
const devoteePageRoutes= require("./routes/DevoteePageRoutes");

// ================== APP INIT ==================
const app = express();

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(express.json());

// ================== ROUTES ==================
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/sevas", sevaRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/assets", assetRoutes);

// Master Data Routes
app.use("/api/devotees", devoteeRoutes);
app.use("/api/priests", priestRoutes);
app.use("/api/TempleBranches", templeBranchRoutes);
app.use("/api/ManageUser", userRoutes);
app.use("/api/board-members", boardRoutes);
app.use("/api/BankDetails", bankRoutes);
app.use("/api/EventMaster", eventRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/devoteeCheck", devoteePageRoutes);

// ================== TEST ROUTE ==================
app.get("/api/getId", (req, res) => {
  console.log("Current User ID:", curr_user);
  res.json({ userId: curr_user });
});

// ================== DB CHECK ==================
pool.query("SELECT NOW()", (err, result) => {
  if (err) {
    console.error("❌ DB Error:", err.message);
  } else {
    console.log("🕒 DB Time:", result.rows[0].now);
  }
});

// ================== EXPORT ==================
module.exports = app;