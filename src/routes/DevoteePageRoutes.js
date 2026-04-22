const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.post("/", async (req, res) => {
  try {
    const raw = JSON.stringify({
      authkey: process.env.auth_key,
      mobileno: req.body.identifier,
    });

    const response = await fetch(
      "https://api.skitechno.com/api/PGM/get_devotee",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: raw,
      },
    );

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `API returned status ${response.status}`,
      });
    }

    const data = await response.json();
    console.log(data);

    // ✅ Check existing booking for today
    const query1 = `
      SELECT "Token_Prefix", verify_status 
      FROM dummy_seva_bookings 
      WHERE devotee_mobile = $1 
      AND status =0
      AND DATE(seva_date) = CURRENT_DATE
    `;

    const result = await pool.query(query1, [req.body.identifier]);

    // ✅ If booking exists
    if (result.rows.length > 0) {
      return res.json({
        success: true,
        alreadyBooked: true,
        booking: result.rows[0],
        devotee: data,
      });
    }

    // ✅ If no booking exists
    return res.json({
      success: true,
      alreadyBooked: false,
      devotee: data,
    });
  } catch (err) {
    console.error("Error fetching devotee:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
});

router.post("/devotee", async (req, res) => {
  const mobile = req.body.identifier;

  try {
    // ✅ Get devotee details
    const query = `
            SELECT 
                id AS dev_id,
                name AS dev_name,
                address AS dev_address,
                mobile AS dev_mobile 
            FROM devotee_master 
            WHERE mobile = $1
        `;

    const data = await pool.query(query, [mobile]);

    // ❌ If no devotee found
    if (data.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Devotee not found",
      });
    }

    const devotee = data.rows[0];

    // ✅ Check today's booking
    const query1 = `
            SELECT "Token_Prefix", verify_status 
            FROM dummy_seva_bookings 
            WHERE devotee_mobile = $1 
            AND status = 0
            AND DATE(seva_date) = CURRENT_DATE
        `;

    const result = await pool.query(query1, [mobile]);

    console.log(result);

    // ✅ If booking exists
    if (result.rows.length > 0) {
      return res.json({
        success: true,
        alreadyBooked: true,
        booking: result.rows,
        devotee: {
          results: devotee,
        },
      });
    }

    // ✅ If no booking
    return res.json({
      success: true,
      alreadyBooked: false,
      devotee: {
        results: devotee,
      },
    });
  } catch (err) {
    console.error("Error fetching devotee:", err);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
});

// POST: Create a new Seva Booking
router.post("/book-seva", async (req, res) => {
  try {
    const {
      devotee_id,
      devotee_name,
      devotee_address,
      devotee_mobile,
      payment_mode,
      sevas,
    } = req.body;

    // --- 1. GET CURRENT DATE INFO ---
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const datePart = `${year}${month}${day}`; // "260417"
    const dayName = now
      .toLocaleDateString("en-US", { weekday: "short" })
      .toUpperCase();

    // --- 2. CALCULATE SERIAL (nnn) ---
    // Find the max token_number for today to reset to 1 daily
    const lastTokenQuery = `
            SELECT MAX(token_number) as last_num 
            FROM dummy_seva_bookings 
            WHERE CAST(token AS TEXT) LIKE $1 || '%';
        `;
    const lastTokenRes = await pool.query(lastTokenQuery, [datePart]);
    const nnn = (lastTokenRes.rows[0].last_num || 0) + 1;
    const nnnPadded = nnn.toString().padStart(3, "0");

    // --- 3. GENERATE THE THREE FIELDS ---
    const final_token_number = nnn; // Numeric: 1
    const final_token = parseInt(`${datePart}${nnnPadded}`); // Numeric/BigInt: 260417001

    // Determine Seva Letter
    let sevaLetter = "";
    const hasP = sevas.some((s) => s.name.toLowerCase().includes("paadha"));
    const hasA = sevas.some((s) =>
      s.name.toLowerCase().includes("panchamruta"),
    );
    if (hasP && hasA) sevaLetter = "B";
    else if (hasP) sevaLetter = "P";
    else if (hasA) sevaLetter = "A";

    const final_token_prefix = `${dayName}${sevaLetter}${nnnPadded}`; // String: "FRIP001"

    // --- 4. SEVA MAPPING ---
    let seva_1 = null,
      seva_1_amount = 0;
    let seva_2 = null,
      seva_2_amount = 0;

    sevas.forEach((s) => {
      if (s.name.toLowerCase().includes("paadha pooja")) {
        seva_1 = "Paadha Pooja";
        seva_1_amount = s.amount;
      } else if (s.name.toLowerCase().includes("panchamruta")) {
        seva_2 = "Panchamruta";
        seva_2_amount = s.amount;
      }
    });

    const total_amount = Number(seva_1_amount) + Number(seva_2_amount);

    // --- 5. INSERT INTO DB ---
    const insertQuery = `
            INSERT INTO dummy_seva_bookings 
            (devotee_id, devotee_name, devotee_address, devotee_mobile, 
             token_number, "Token_Prefix", token,
             seva_1, seva_1_amount, seva_2, seva_2_amount, 
              payment_mode, total_amount,seva_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,CURRENT_DATE)
            RETURNING *;
        `;

    const result = await pool.query(insertQuery, [
      devotee_id,
      devotee_name,
      devotee_address,
      devotee_mobile,
      final_token_number,
      final_token_prefix,
      final_token,
      seva_1,
      seva_1_amount,
      seva_2,
      seva_2_amount,
      payment_mode,
      total_amount,
    ]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Booking Error:", err);
    res.status(500).json({ error: "Booking failed" });
  }
});
// GET: Fetch all bookings
router.get("/", async (req, res) => {
  try {
    const query = `
            SELECT * FROM dummy_seva_bookings
            ORDER BY token_number ASC;
        `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

router.get("/bhatBoard", async (req, res) => {
  try {
    const query = `
            SELECT * FROM dummy_seva_bookings where status=0 AND verify_status=1
            ORDER BY token_number ASC;
        `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// DELETE: Remove booking by ID or Token
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM dummy_seva_bookings WHERE id = $1",
      [id],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    res.json({ success: true, message: "Booking deleted successfully" });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// UPDATE: Finalize Booking with Dakshina and Donation

router.put("/update-amounts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { donation, GD, BD, status } = req.body;

    // 3. Update the record
    const updateQuery = `
            UPDATE dummy_seva_bookings 
            SET donation = $1, "GD" = $2, "BD" = $3,status=$4
            WHERE id = $5
            RETURNING *;
        `;

    const result = await pool.query(updateQuery, [
      donation,
      GD,
      BD,
      status,
      id,
    ]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Update failed" });
  }
});

router.put("/update-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { verify_status } = req.body;

    // 3. Update the record
    const updateQuery = `
            UPDATE dummy_seva_bookings 
            SET verify_status=$1
            WHERE id = $2
            RETURNING *;
        `;

    const result = await pool.query(updateQuery, [verify_status, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Update failed" });
  }
});

router.get("/counts", async (req, res) => {
  try {
    const result1 = await pool.query(
      "SELECT COUNT(*) AS total_sevas FROM dummy_seva_bookings where seva_date=CURRENT_DATE",
    );

    const result2 = await pool.query(
      "SELECT COUNT(*) AS finished_sevas FROM dummy_seva_bookings WHERE status = 1 AND seva_date=CURRENT_DATE",
    );

    const result4 = await pool.query(
      "SELECT COUNT(*) AS total_p_pooja FROM dummy_seva_bookings WHERE seva_1 = 'Paadha Pooja' AND seva_date=CURRENT_DATE",
    );

    const result5 = await pool.query(
      "SELECT COUNT(*) AS finished_p_pooja FROM dummy_seva_bookings WHERE seva_1 = 'Paadha Pooja' AND status = 1 AND seva_date=CURRENT_DATE",
    );

    const result7 = await pool.query(
      "SELECT COUNT(*) AS total_pan_pooja FROM dummy_seva_bookings WHERE seva_2 = 'Panchamruta' AND seva_date=CURRENT_DATE",
    );

    const result8 = await pool.query(
      "SELECT COUNT(*) AS finished_pan_pooja FROM dummy_seva_bookings WHERE seva_2 = 'Panchamruta' AND status = 1 AND seva_date=CURRENT_DATE",
    );

    // ✅ Final response object
    const result = {
      Total_Sevas: Number(result1.rows[0].total_sevas),
      Finished_Sevas: Number(result2.rows[0].finished_sevas),

      Paadha_Pooja: {
        Total: Number(result4.rows[0].total_p_pooja),
        Finished: Number(result5.rows[0].finished_p_pooja),
      },

      Panchamruta: {
        Total: Number(result7.rows[0].total_pan_pooja),
        Finished: Number(result8.rows[0].finished_pan_pooja),
      },
    };

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching counts:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.put("/status/:id", async (req, res) => {
  const id = req.params.id;
  const { status, value } = req.body;

  try {
    let query;

    if (status === 1) {
      query = `UPDATE dummy_seva_bookings SET status_1 = $1 WHERE id = $2 RETURNING *`;
    } else if (status === 2) {
      query = `UPDATE dummy_seva_bookings SET status_2 = $1 WHERE id = $2 RETURNING *`;
    }

    const result = await pool.query(query, [value, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Update failed" });
  }
});

module.exports = router;
