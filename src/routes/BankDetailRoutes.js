const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Your database connection
const {authenticate} = require('../middlewares/authMiddleware');

/**
 * @route   GET /api/branch-details
 * @desc    Get all banking details (joined with branch names)
 */
router.get('/', authenticate, async (req, res) => {
    try {
        const query = `
            SELECT 
                bd.*, 
                CASE WHEN bd.branch_id =0 THEN 'Main Branch' ELSE tb.branch_name END as display_branch_name
            FROM bank_details bd
            LEFT JOIN temple_branches tb ON bd.branch_id = tb.id
            ORDER BY bd.created_at DESC
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

/**
 * @route   POST /api/branch-details
 * @desc    Add new banking details
 */
router.post('/', authenticate, async (req, res) => {
    const { 
        bank_name, branch_name, ifsc_code, branch_address, 
        account_number, has_net_banking, has_cheque_book, branch_id 
    } = req.body;

    if(branch_id==''){
        branch_id=0;
    }

    try {
        const query = `
            INSERT INTO bank_details 
            (bank_name, branch_name, ifsc_code, branch_address, account_number, has_net_banking, has_cheque_book, branch_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`;
        
        const values = [
            bank_name, 
            branch_name, 
            ifsc_code.toUpperCase(), 
            branch_address, 
            account_number, 
            has_net_banking === 'true' || has_net_banking === true, 
            has_cheque_book === 'true' || has_cheque_book === true, 
            branch_id
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to save banking details" });
    }
});

/**
 * @route   PUT /api/branch-details/:id
 * @desc    Edit existing banking details
 */
router.put('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { 
        bank_name, branch_name, ifsc_code, branch_address, 
        account_number, has_net_banking, has_cheque_book, branch_id 
    } = req.body;

    try {
        const query = `
            UPDATE bank_details 
            SET bank_name = $1, branch_name = $2, ifsc_code = $3, branch_address = $4, 
                account_number = $5, has_net_banking = $6, has_cheque_book = $7, branch_id = $8
            WHERE account_id = $9
            RETURNING *`;

        const values = [
            bank_name, 
            branch_name, 
            ifsc_code.toUpperCase(), 
            branch_address, 
            account_number, 
            has_net_banking === 'true' || has_net_banking === true, 
            has_cheque_book === 'true' || has_cheque_book === true, 
            branch_id,
            id
        ];

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Account details not found" });
        }

        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Update failed" });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    const id = req.params.id;

    try {
        // 1. Added RETURNING * so you can actually send the deleted data back
        const query = 'DELETE FROM bank_details WHERE account_id = $1 RETURNING *';
        
        // 2. Wrapped 'id' in an array [id]
        const result = await pool.query(query, [id]);

        // 3. Check if anything was actually deleted
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Record not found" });
        }

        // 4. Changed status to 200 (Success)
        res.status(200).json(result.rows[0]);
        
    } catch (err) {
        console.error(err.message);
        res.status(err.status || 500).json({ 
            message: err.message || 'Internal Server Error' 
        });
    }
});
module.exports = router;