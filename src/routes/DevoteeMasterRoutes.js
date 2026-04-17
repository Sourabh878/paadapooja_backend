const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");

// Helper to handle empty strings from frontend and convert to NULL for SQL
const n = (val) => (val === "" || val === undefined ? null : val);

/**
 * @route   GET /api/devotees
 * @desc    Fetch all devotees ordered by latest
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM devotee_master ORDER BY id DESC",
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   POST /api/devotees
 * @desc    Register a new devotee with full location and religious details
 */
router.post("/", authenticate, async (req, res) => {
  const {
    name,
    k_name,
    address,
    k_address,
    city,
    k_city,
    pincode,
    mobile,
    email,
    gotra,
    kuladevata,
    uid,
    Taluk,
    District,
    State,
    country,
    mobile_2,
    math,
    house,
    street_1,
    street_2,
    landmark,
  } = req.body;

  try {
    const query = `
            INSERT INTO devotee_master (
                name, k_name, address, k_address, city, k_city, 
                pincode, mobile, email, gotra, kuladevata, 
                uid, "Taluk", "District", "State", country, mobile_2, math,house,street_1,street_2,landmark
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,$20,$21,$22
            ) RETURNING *`;

    const values = [
      n(name),
      n(k_name),
      n(address),
      n(k_address),
      n(city),
      n(k_city),
      n(pincode),
      n(mobile),
      n(email),
      n(gotra),
      n(kuladevata),
      n(uid),
      n(Taluk),
      n(District),
      n(State),
      n(country),
      n(mobile_2),
      n(math),
      n(house),
      n(street_1),
      n(street_2),
      n(landmark),
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   PUT /api/devotees/:id
 * @desc    Update existing devotee details
 */
router.put("/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const {
    name,
    k_name,
    address,
    k_address,
    city,
    k_city,
    pincode,
    mobile,
    email,
    gotra,
    kuladevata,
    Taluk,
    District,
    State,
    country,
    mobile_2,
    math,
    house,
    street_1,
    street_2,
    landmark,
  } = req.body;

  try {
    const query = `
            UPDATE devotee_master SET 
                name=$1, k_name=$2, address=$3, k_address=$4, city=$5, k_city=$6, 
                pincode=$7, mobile=$8, email=$9, gotra=$10, kuladevata=$11, 
                "Taluk"=$12, "District"=$13, "State"=$14, country=$15, 
                mobile_2=$16, math=$17, updated_at=CURRENT_TIMESTAMP,house=$18, street_1=$19,street_2=$20,landmark=$21
            WHERE id=$22 RETURNING *`;

    const values = [
      n(name),
      n(k_name),
      n(address),
      n(k_address),
      n(city),
      n(k_city),
      n(pincode),
      n(mobile),
      n(email),
      n(gotra),
      n(kuladevata),
      n(Taluk),
      n(District),
      n(State),
      n(country),
      n(mobile_2),
      n(math),
      n(house),
      n(street_1),
      n(street_2),
      n(landmark),
      id,
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Devotee not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("PUT Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/check", authenticate, async (req, res) => {
  const { search } = req.query;
  if (!search) return res.status(400).json({ error: "Search term required" });

  try {
    // Search by mobile OR email
    const result = await pool.query(
      "SELECT id, name FROM devotee_master WHERE mobile = $1 OR email = $1 LIMIT 1",
      [search],
    );

    if (result.rows.length > 0) {
      res.status(200).json({
        exists: true,
        id: result.rows[0].id,
        name: result.rows[0].name,
      });
    } else {
      res.status(200).json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
