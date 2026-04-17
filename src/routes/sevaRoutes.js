const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const { authenticate} = require('../middlewares/authMiddleware');


router.post('/', authenticate, async (req, res) => {
  const { seva_name, k_name, description, price, Priest_price, category, storage_location } = req.body;

  try {
    // 1. Rename the database results to avoid shadowing the req.body variables
    const categoryResult = await pool.query('SELECT id FROM category WHERE name = $1', [category]);
    const ledgerResult = await pool.query('SELECT id FROM storage_location WHERE name = $1', [storage_location]);
    // console.log("Category Query Result:", categoryResult.rows);
    // console.log("Ledger Query Result:", ledgerResult.rows);

    // 2. Safety Check: Ensure the Category and Ledger actually exist
    if (categoryResult.rows.length === 0) {
      return res.status(400).json({ error: `Category '${category}' not found.` });
    }
    if (ledgerResult.rows.length === 0) {
      return res.status(400).json({ error: `Ledger '${storage_location}' not found.` });
    }

    // 3. Extract the IDs
    const catId = categoryResult.rows[0].id;
    const locId = ledgerResult.rows[0].id;
    // console.log(catId,locId);

    const query = `
      INSERT INTO sevas (seva_name, k_name, description, price, "Priest_price", category,l_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
    `;
    
    const values = [seva_name, k_name, description, price, Priest_price, catId, locId];
    
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. READ ALL (Fetch) - HTTP GET
router.get('/',authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sevas WHERE is_active = TRUE ORDER BY seva_id ASC');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fetch',authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT s.*, c.name as Cname, l.name as Lname FROM sevas s JOIN category c ON s.category = c.id JOIN storage_location l ON s.l_id = l.id ORDER BY s.seva_id ASC');
    if(result.rows.length === 0) return res.status(404).json({message:"No sevas found"});

    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// 4. DELETE - HTTP DELETE
router.delete('/:id',authenticate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM sevas WHERE seva_id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: "Seva not found" });
    res.status(200).json({ message: "Seva deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticate, async(req,res)=>{
  const { is_active} =req.body;
  try
  {
    const result =await pool.query('update sevas set is_active =$1 where seva_id =$2 RETURNING *',[is_active,req.params.id]);
    if(result.rows.length === 0) return res.status(404).json({message:"Seva not found"});
    res.status(200).json({message:"Seva updated successfully", updatedSeva: result.rows[0]});
  }
  catch(err)
  {
    res.status(500).json({error:err.message});
  }

});

router.put('/:id', authenticate, async(req,res)=>{
  const { seva_name, k_name, description, price, Priest_price, category, storage_location } = req.body;
  try{
    const categoryResult = await pool.query('SELECT id FROM category WHERE name = $1', [category]);
    const ledgerResult = await pool.query('SELECT id FROM storage_location WHERE name = $1', [storage_location]);
    if (categoryResult.rows.length === 0) {
      return res.status(400).json({ error: `Category '${category}' not found.` });
    }
    if (ledgerResult.rows.length === 0) {
      return res.status(400).json({ error: `Ledger '${storage_location}' not found.` });
    }

    const catId = categoryResult.rows[0].id;
    const locId = ledgerResult.rows[0].id;

    const query = `
      UPDATE sevas SET seva_name=$1, k_name=$2, description=$3, price=$4, "Priest_price"=$5, category=$6, l_id=$7 WHERE seva_id=$8 RETURNING *;
    `;
    
    const values = [seva_name, k_name, description, price, Priest_price, catId, locId, req.params.id];
    
    const result = await pool.query(query, values);
    res.status(200).json(result.rows[0]);
  }
  catch(err)
  {
    res.status(500).json({error:err.message});
  }
});


router.get('/category/:catname', authenticate, async(req,res)=>{
  try{
    const categoryResult =await pool.query('select *from category where name=$1',[req.params.catname]);
    if(categoryResult.rows.length === 0) return res.status(404).json({message:"Category not found"});

    const catId = categoryResult.rows[0].id;
    console.log("catID",catId);

    const result =await pool.query('select * from sevas where category=$1 and is_active=true',[catId]);
    res.status(200).json(result.rows);
  }
  catch(err)
  {
    res.status(500).json({error:err.message});
  }
});




module.exports = router;
