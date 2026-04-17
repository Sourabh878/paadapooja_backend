const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerDevotee = async (req, res) => {
  try {
    const { full_name, email, phone, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const roleResult = await pool.query(
      "SELECT id FROM roles WHERE role_name='MANAGER'",
    );

    const role_id = roleResult.rows[0].id;

    await pool.query(
      `INSERT INTO users (full_name, email, phone, password, role_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [full_name, email, phone, hashedPassword, role_id],
    );

    res.status(201).json({ message: "Manager registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
  
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const userRes = await pool.query(
      `SELECT users.*, roles.role_name
       FROM users
       JOIN roles ON users.role_id = roles.id
       WHERE email=$1`,
      [email],
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    current_user(user);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      token,
      role: user.role_name,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

let curr_user;
function current_user(user)
{
   curr_user=user.id;
   console.log(curr_user);
}



module.exports = { registerDevotee, loginUser,curr_user};
