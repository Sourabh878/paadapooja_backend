const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const {authenticate,isAdmin} = require('../middlewares/authMiddleware');

// 1. GET ALL ROLES
router.get('/roles',authenticate, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM roles ORDER BY role_name ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. GET ALL USERS (Joined with Roles)
router.get('/',authenticate, async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.full_name, u.email, u.phone, r.role_name, u.is_active 
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            ORDER BY u.created_at DESC`;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. REGISTER NEW USER
router.post('/register',authenticate, async (req, res) => {
    const { full_name, email, phone, password, role_id } = req.body;

    try {
        // Check if user already exists
        const userExist = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExist.rows.length > 0) return res.status(400).json({ message: "Email already registered" });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert User
        const query = `
            INSERT INTO users (full_name, email, phone, password, role_id) 
            VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email`;
        const result = await pool.query(query, [full_name, email, phone, hashedPassword, role_id]);

        res.status(201).json({ message: "User created", user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// UPDATE USER
router.put('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { full_name, email, phone, role_id, is_active, password } = req.body;

    try {
        let result; // Define here so it is accessible to the whole function

        // Check if password exists and is not an empty string
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            const query = `
                UPDATE users 
                SET full_name = $1, email = $2, phone = $3, role_id = $4, is_active = $5, password = $6
                WHERE id = $7 RETURNING id, full_name, email`;

            result = await pool.query(query, [full_name, email, phone, role_id, is_active, hashedPassword, id]);
        } 
        else {
            const query = `
                UPDATE users 
                SET full_name = $1, email = $2, phone = $3, role_id = $4, is_active = $5
                WHERE id = $6 RETURNING id, full_name, email`;
            
            result = await pool.query(query, [full_name, email, phone, role_id, is_active, id]);
        }

        // Now 'result' is accessible here
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        
        res.status(200).json({ 
            message: "User updated successfully", 
            user: result.rows[0] 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE USER
router.delete('/:id', authenticate, async (req, res) => {

    console.log("inside the delete");
    const { id } = req.params;

    try {
        // Optional: Prevent self-deletion
        if (id === req.user.id) {
            return res.status(400).json({ message: "You cannot delete your own admin account." });
        }

        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;