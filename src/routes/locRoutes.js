const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const {authenticate,isAdmin} = require('../middlewares/authMiddleware');

router.get("/",authenticate, async (req, res) => {
  try {
    const result = await pool.query("select * from storage_Location");
    res.status(200).json(result.rows);
    if (result.rows.length === 0) {
      console.log(result);
      res.status(404).json({ message: "No storage locations found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/",authenticate, async (req, res) => {
  const { name } = req.body;

  try {
    const result = await pool.query(
      "insert into storage_location(name)  values($1) returning *",
      [name],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id",authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "delete from storage_location where id=$1 returning *",
      [req.params.id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ message: "Storage location not found" });
    }
    res.status(200).json({ message: "Storage location deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
