const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const upload = require("../middlewares/upload");
const uploadImage = require("../utils/supabaseUpload");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

// GET ALL PRIESTS
router.get("/", authenticate, async (req, res) => {
  try {
    // ADDED: await to wait for the database response
    const result = await pool.query(
      "SELECT * FROM priest_master ORDER BY id DESC",
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE NEW PRIEST
router.post("/", authenticate, upload.single("image"), async (req, res) => {
  try {
    let image_url = null;
    if (req.file) {
      image_url = await uploadImage(req.file, "priests");
    }

    const {
      name,
      k_name,
      address,
      k_address,
      city,
      pincode,
      phone_number,
      email,
      education,
      university,
      gotra,
      kuladevata,
      aadhar_number,
      pan_number,
      dl_number,
    } = req.body;

    // ADDED: await and corrected table name to priest_master
    const result = await pool.query(
      `INSERT INTO priest_master (name, k_name, address, k_address, city, pincode, phone_number, email, education, university, gotra, kuladevata, aadhar_number, pan_number, dl_number, photo_url) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [
        name,
        k_name,
        address,
        k_address,
        city,
        pincode,
        phone_number,
        email,
        education,
        university,
        gotra,
        kuladevata,
        aadhar_number,
        pan_number,
        dl_number,
        image_url,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE PRIEST
router.put("/:id", authenticate, upload.single("image"), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      k_name,
      address,
      k_address,
      city,
      pincode,
      phone_number,
      email,
      education,
      university,
      gotra,
      kuladevata,
      aadhar_number,
      pan_number,
      dl_number,
    } = req.body;

    // 1. Check if the priest exists and get current photo
    const existingPriest = await pool.query(
      "SELECT photo_url FROM priest_master WHERE id = $1",
      [id],
    );
    if (existingPriest.rows.length === 0)
      return res.status(404).json({ error: "Priest not found" });

    // 2. Handle Image Update
    let image_url = existingPriest.rows[0].photo_url;
    if (req.file) {
      image_url = await uploadImage(req.file, "priests");
    }

    // 3. Update Record
    const result = await pool.query(
      `UPDATE priest_master 
             SET name=$1, k_name=$2, address=$3, k_address=$4, city=$5, pincode=$6, phone_number=$7, email=$8, education=$9, university=$10, gotra=$11, kuladevata=$12, photo_url=$13, aadhar_number=$14, pan_number=$15, dl_number=$16
             WHERE id=$17 RETURNING *`,
      [
        name,
        k_name,
        address,
        k_address,
        city,
        pincode,
        phone_number,
        email,
        education,
        university,
        gotra,
        kuladevata,
        image_url,
        aadhar_number,
        pan_number,
        dl_number,
        id,
      ],
    );

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("PUT Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE PRIEST
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM priest_master WHERE id = $1", [id]);
    res.status(200).json({ message: "Priest record deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
