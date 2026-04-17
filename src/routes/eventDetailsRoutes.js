const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Your database connection
const {authenticate} = require('../middlewares/authMiddleware');

/**
 * @route   GET /api/event-details
 * @desc    Fetch all events with Branch Name join
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const query = `
        SELECT 
    ed.event_id,
    ed.title,
    ed.event_type,
    ed.periodicity,
    ed.specific_date_mithi,
    ed.remarks,
    ed.function_date,
    -- This is the critical fix:
    tb.branch_name as display_branch_name,
    TO_CHAR(ed.reminder_date, 'YYYY-MM-DD') as reminder_date,
    ed.branch_id
FROM event_details ed
LEFT JOIN temple_branches tb ON ed.branch_id = tb.id
ORDER BY ed.reminder_date ASC;
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * @route   POST /api/event-details
 * @desc    Add a new annual function or meeting
 */
router.post('/', authenticate, async (req, res) => {
    const { 
        title, event_type, periodicity, specific_date_mithi, 
        remarks, reminder_date,branch_id,function_date
    } = req.body;

    // Validation for Remarks length
    if (remarks && remarks.length > 300) {
        return res.status(400).json({ error: "Remarks cannot exceed 300 characters" });
    }

    try {
        const query = `
            INSERT INTO event_details 
            (title, event_type, periodicity, specific_date_mithi, remarks, reminder_date,branch_id,function_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`;
        
        const values = [
            title, event_type, periodicity, specific_date_mithi, 
            remarks, reminder_date || null, branch_id,function_date||null
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Database Insertion Failed" });
    }
});

/**
 * @route   PUT /api/event-details/:id
 * @desc    Update an existing event
 */
router.put('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { 
        title, event_type, periodicity, specific_date_mithi, 
        remarks, reminder_date, branch_id,function_date
    } = req.body;

    try {
        const query = `
            UPDATE event_details 
            SET title=$1, event_type=$2, periodicity=$3, specific_date_mithi=$4, 
                remarks=$5, reminder_date=$6, 
                branch_id=$7,function_date=$8, updated_at=NOW()
            WHERE event_id=$9
            RETURNING *`;

        const values = [
            title, event_type, periodicity, specific_date_mithi, 
            remarks, reminder_date,
            branch_id,function_date, id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Update Failed" });
    }
});

/**
 * @route   DELETE /api/event-details/:id
 * @desc    Remove an event
 */
router.delete('/:id', authenticate, async (req, res) => {
    const { id } = req.params;

   
    try {
        const result = await pool.query('DELETE FROM event_details WHERE event_id = $1 RETURNING *', [id]);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Event not found" });
        }

        res.status(200).json({ message: "Event deleted successfully", deleted: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Delete Failed" });
    }
});

module.exports = router;