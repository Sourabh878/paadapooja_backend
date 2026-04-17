const express = require('express');
const router = express.Router();
const pool = require('../config/db'); // Adjust path to your DB config
const {authenticate,isAdmin} = require('../middlewares/authMiddleware');

// GET all members for a specific branch
router.get('/:branchId', authenticate, async (req, res) => {
    try {
        const { branchId } = req.params;
        const result = await pool.query(
            'SELECT * FROM board_members WHERE branch_id = $1 ORDER BY member_id ASC',
            [branchId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPSERT (Save/Update) a row
router.post('/save', authenticate, async (req, res) => {
    const { member_id, full_name, designation, address, mobile_1, mobile_2, email, branch_id, tenure_period } = req.body;
    
    // Format the tenure_period for Postgres DATERANGE
    // If input is "2024-2026", we convert to "[2024-01-01, 2026-12-31]"
    let formattedRange = null;
    if (tenure_period && tenure_period.includes('-')) {
        const [startYear, endYear] = tenure_period.split('-').map(y => y.trim());
        formattedRange = `[${startYear}-01-01, ${endYear}-12-31]`;
    }

    try {
        if (member_id) {
            const query = `
                UPDATE board_members 
                SET full_name=$1, designation=$2, address=$3, mobile_1=$4, mobile_2=$5, email=$6, 
                    tenure_period=$7, updated_at=NOW()
                WHERE member_id=$8 AND branch_id=$9 RETURNING *`;
            const result = await pool.query(query, [full_name, designation, address, mobile_1, mobile_2, email, formattedRange, member_id, branch_id]);
            res.json(result.rows[0]);
        } else {
            const query = `
                INSERT INTO board_members (full_name, designation, address, mobile_1, mobile_2, email, tenure_period, branch_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`;
            const result = await pool.query(query, [full_name, designation, address, mobile_1, mobile_2, email, formattedRange, branch_id]);
            res.json(result.rows[0]);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE a member
router.delete('/:id', authenticate, async (req, res) => {
    try {
        await pool.query('DELETE FROM board_members WHERE member_id = $1', [req.params.id]);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;