const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {authenticate,isAdmin} = require('../middlewares/authMiddleware');
const crypto = require('crypto'); // Ensure this is imported at the top of the file

router.post('/payment_details', async (req, res) => {

  console.log("inside the payment_details");
  // 1. Added transaction_date to the destructuring
  const { 
    payment_method, 
    amount, 
    cheque_no, 
    cheque_date, 
    transaction_id, 
    transaction_date 
  } = req.body;

  try {
    let normalizedMethod = payment_method;
    if (payment_method === 'UPI / QR') {
      normalizedMethod = 'UPI';
    }

    // 2. Generate a unique internal transaction ID
    const internalTid = `TXN-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;

    // 3. Prepare values for payment_methods table
    const paymentValues = [
      internalTid,
      transaction_date || new Date(), // Now correctly defined
      amount,
      normalizedMethod,
      (normalizedMethod === 'UPI' || normalizedMethod === 'Bank Transfer') ? transaction_id : null,
      (normalizedMethod === 'Cheque') ? cheque_no : null,
      (normalizedMethod === 'Cheque') ? cheque_date : null,
      'Completed'
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

 // client
router.post('/', authenticate, async (req, res) => {
  const {
    devotee_id,
    seva_id,
    booking_date,
    seva_date,// This is what comes from frontend
    user_id,
    amount,
    Quantity,
    payment_id,
    courier_charges
  } = req.body;

  try {
    // 1. Normalize payment method name
    // 4. Insert into booking_sevas table
    // Using the paymentId we just generated
    const bookingQuery = `
      INSERT INTO booking_sevas (
        devotee_id, seva_id, booking_date, seva_date, 
        user_id, amount,quantity, payment_id, courier_charges
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8 , $9) 
      RETURNING *;
    `;
    
    const bookingValues = [
      devotee_id, 
      seva_id, 
      booking_date, 
      seva_date, 
      user_id, 
      amount, 
      Quantity, 
      payment_id,
      courier_charges || 0
    ];

    const bookingResult = await pool.query(bookingQuery, bookingValues);

    // 5. Single Response - Combined data
    res.status(201).json({
      message: "Seva booked successfully!",
      booking: bookingResult.rows[0],
      payment_id: payment_id
    });

  } catch (err) {
    console.error("Error in booking:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/all', authenticate, async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id, 
        b.booking_date, 
        b.seva_date, 
        b.amount, 
        p.payment_mode,
        d.name AS devotee_name, 
        d.mobile,
        s.seva_name,
        c.name as category
      FROM booking_sevas b
      JOIN devotee_master d ON b.devotee_id = d.id
      JOIN sevas s ON b.seva_id = s.seva_id JOIN payment_methods p ON b.payment_id=p.id JOIN category c ON s.category=c.id
      ORDER BY b.seva_date DESC;
    `;
    
    const result = await pool.query(query);
     if(result.rows.length === 0) return res.status(404).json({message:"No bookings found"});
    res.status(200).json(result.rows);

  } catch (err) {
    console.error("Fetch Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


router.get('/summary', authenticate, async (req, res) => {
  const { fromDate, toDate } = req.query; // Get filters from URL params
  try {
    let query = `
      SELECT 
        s.seva_name,
        SUM(b.quantity) as total_quantity,
        SUM(b.amount) as total_amount
      FROM booking_sevas b
      JOIN sevas s ON b.seva_id = s.seva_id
    `;

    const values = [];
    if (fromDate && toDate) {
      query += ` WHERE b.seva_date BETWEEN $1 AND $2 `;
      values.push(fromDate, toDate);
    }

    query += ` GROUP BY s.seva_name ORDER BY total_amount DESC;`;
    
    const result = await pool.query(query, values);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. READ USER'S BOOKINGS (HTTP GET)
// Used by devotees to see their "My Bookings" page
router.get('/user/:userId',authenticate, async (req, res) => {
  try {
    const query = `
      SELECT b.*, s.seva_name, s.price 
      FROM seva_bookings b
      JOIN sevas s ON b.seva_id = s.seva_id
      WHERE b.user_id = $1
      ORDER BY b.seva_date DESC;
    `;
    const result = await pool.query(query, [req.params.userId]);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.put('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  
  const { category, seva_name, seva_date, payment_mode,amount } = req.body;
 

  try {
    // 1. Validate Category
    const catResults = await pool.query("SELECT id FROM category WHERE name = $1", [category]);
    if (catResults.rows.length === 0) {
      return res.status(400).json({ message: "Invalid category selected" });
    }
    const catId = catResults.rows[0].id;

    // 2. Validate Seva belongs to that Category
    const sevaResults = await pool.query(
      "SELECT seva_id FROM sevas WHERE seva_name = $1 AND category = $2", 
      [seva_name, catId]
    );
    
    
    if (sevaResults.rows.length === 0) {
      return res.status(400).json({ message: "Selected seva does not exist in this category" });
    }
    const finalSevaId = sevaResults.rows[0].seva_id;

    // 3. Execute Update
    // We only update seva_id because seva_name/category are retrieved via JOINs in GET requests
    
    const updateQuery = `
      UPDATE booking_sevas 
      SET 
        seva_id = $1, 
        seva_date = $2,
        amount=$3
      WHERE id = $4
      RETURNING *;
    `;
    
    const values = [finalSevaId, seva_date,amount,id];
    
    const result = await pool.query(updateQuery, values);
   
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Booking record not found" });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 3. READ ALL BOOKINGS (HTTP GET)
// Used by Admin to see the daily schedule
router.get('/admin/all',authenticate,isAdmin, async (req, res) => {
  try {
    const query = `
      SELECT b.*, s.seva_name, u.email as user_email,u.full_name as full_name,s.price as price
      FROM seva_bookings b
      JOIN sevas s ON b.seva_id = s.seva_id
      LEFT JOIN users u ON b.user_id = u.id
      ORDER BY b.seva_date ASC;
    `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. CANCEL BOOKING (HTTP PATCH)
router.patch('/cancel/:id',authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE seva_bookings SET status = 'CANCELLED' WHERE booking_id = $1 RETURNING *",
      [req.params.id]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



module.exports = router;