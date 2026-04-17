const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const upload = require("../middlewares/upload"); // Multer config
const uploadImage = require("../utils/supabaseUpload");
const { authenticate, isAdmin } = require("../middlewares/authMiddleware");
const crypto = require("crypto"); // Ensure this is imported at the top of the file

router.get("/pcat", authenticate, async (req, res) => {
  try {
    const result = await pool.query("select * from property_category");
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.post("/pcat", authenticate, async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO property_category (p_name) VALUES ($1) RETURNING *",
      [name],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

router.delete("/pcat/:id", authenticate, async (req, res) => {
  try {
    await pool.query("DELETE FROM property_category WHERE p_id = $1", [
      req.params.id,
    ]);

    res.status(200).json({ message: "Property Category Deleted Successfully" });
  } catch (err) {
    console.log(err.message);
    res.status(500).send({ error: err.message });
  }
});

// Get Assets by Category
router.get("/category/:catId", authenticate, async (req, res) => {
  try {
    const query = `
            SELECT a.id, a.asset_name, pa.location, pa.rental_rate, pa.total_area_sqft 
            FROM assets a
            JOIN property_assets pa ON a.id = pa.asset_id
            WHERE pa.prop_type_id = $1`;
    const result = await pool.query(query, [req.params.catId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Booking
router.post("/property-bookings", authenticate, async (req, res) => {
  // 1. Destructure
  const {
    asset_id,
    devotee_id,
    event_date,
    amount_paid,
    no_of_days,
    payment_id,
    function_type,
  } = req.body;

  console.log(req.body);

  // 2. Simple validation check
  if (!asset_id || !devotee_id || !event_date) {
    return res.status(400).json({ error: "Missing required booking fields" });
  }

  try {
    const query = `
            INSERT INTO book_property (
                asset_id, devotee_id, event_date, amount_paid, no_of_days, function_type, payment_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *`;

    // 3. FIXED ORDER: Matches the $1-$8 sequence above
    const values = [
      asset_id, // $1
      devotee_id, // $2
      event_date, // $3
      amount_paid, // $4
      no_of_days, // $6
      function_type, // $7
      payment_id, // $8
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Booking Property Error:", err.message);
    res.status(500).json({ error: "Internal Server Error" }); // Don't leak raw DB errors to client
  }
});

router.post("/payment_details", async (req, res) => {
  console.log("inside the payment_details");
  // 1. Added transaction_date to the destructuring
  const {
    payment_method,
    amount,
    cheque_no,
    cheque_date,
    transaction_id,
    transaction_date,
  } = req.body;

  try {
    let normalizedMethod = payment_method;
    if (payment_method === "UPI / QR") {
      normalizedMethod = "UPI";
    }

    // 2. Generate a unique internal transaction ID
    const internalTid = `TXN-${Date.now()}-${crypto.randomBytes(2).toString("hex")}`;

    // 3. Prepare values for payment_methods table
    const paymentValues = [
      internalTid,
      transaction_date || new Date(), // Now correctly defined
      amount,
      normalizedMethod,
      normalizedMethod === "UPI" || normalizedMethod === "Bank Transfer"
        ? transaction_id
        : null,
      normalizedMethod === "Cheque" ? cheque_no : null,
      normalizedMethod === "Cheque" ? cheque_date : null,
      "Completed",
    ];

    const paymentQuery = `
      INSERT INTO payment_methods (
        transaction_id, payment_date, amount, payment_mode, 
        reference_number, cheque_no, cheque_date, status
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
      RETURNING *; -- Returning everything is better for the frontend
    `;

    const paymentResult = await pool.query(paymentQuery, paymentValues);

    // 4. Fixed the logic check
    if (paymentResult.rowCount === 0) {
      throw new Error("No rows returned from database");
    } else {
      // Return the specific row object so receipt can use it
      res.status(201).json({ payment: paymentResult.rows[0] });
    }
  } catch (err) {
    console.error("Payment Error:", err.message);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});
module.exports = router;
