const pool = require("../config/db");
const uploadImage = require("../utils/supabaseupload");
const DeleteSupa =require("../utils/supabaseDelete");


const addBranch = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Insert Branch Text Data
        const {branch_name, k_name, address, location, email, website, contact, Description} = req.body;
        
        const branchRes = await client.query(
            `INSERT INTO temple_branches (branch_name, k_name, address, location_url, email, website, contact_no,description) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [ branch_name, k_name, address, location, email, website, contact,Description]
        );
        
        const branchId = branchRes.rows[0].id;

        // 2. Upload Images to Supabase and Save to branch_images
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const url = await uploadImage(req.files[i], "branches"); // reuse your supabase helper
                await client.query(
                    `INSERT INTO branch_images (branch_id, image_url, is_primary) VALUES ($1, $2, $3)`,
                    [branchId, url, i === 0] // Make first image primary
                );
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Branch added successfully" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
};

const getall = async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT 
    t.*, 
    (
        SELECT image_url 
        FROM branch_images b 
        WHERE b.branch_id = t.id  
        LIMIT 1
    ) AS image_url
   FROM temple_branches t;
      `
    );


    if (result.rows.length === 0) {
      throw { message: "NO BRANCH FOUND", status: 404 };
    }

    res.status(200).json(result.rows);

  } catch (err) {
    res.status(err.status ? err.status : 500).json({ error: err.message });
  }
}

const getbyId = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch Temple Details
    const temple_details = await pool.query('SELECT * FROM temple_branches WHERE id = $1', [id]);

    if (temple_details.rows.length === 0) {
      // Added RETURN here to stop execution
      return res.status(404).json({ message: 'Branch not found' });
    }

    // 2. Fetch Images (Fixed "from" typo and added "await")
    const images = await pool.query('SELECT * FROM branch_images WHERE branch_id = $1', [id]);

    // 3. Return combined data
    res.json({
      ...temple_details.rows[0],
      images: images.rows
    });

  } catch (err) {
    // Standardizing the error response
    console.error("Error in getById:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
};

const updateBranch = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    
    // console.log(req.body);

    try {
        await client.query("BEGIN");

        // 1. Update Parent Table
        await client.query(
            `UPDATE temple_branches SET branch_name=$1,k_name=$2, address=$3, location_url=$4,email=$5,website=$6,contact_no=$7, updated_at=NOW() WHERE id=$8`,
            [req.body.branch_name, req.body.K_name, req.body.address,req.body.location_url,req.body.email,req.body.website,req.body.contact_no,id]
        ).then(()=>{
            console.log("Branch upated");
        });


        await client.query("COMMIT");
        res.json({ message: "Asset and new images updated successfully" });
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
        console.log(err.message);

    } finally {
        client.release();
    }
};

const deleteImg = async (req, res) => {
  const id = req.params.id;

  try {
    // 1. Get the URL from DB first
    const findResult = await pool.query(
      'SELECT image_url FROM branch_images WHERE id = $1', 
      [id]
    );

    if (findResult.rows.length === 0) {
        
      return res.status(404).json({ error: "Image record not found" });
     
    }

    const imageUrl = findResult.rows[0].image_url;

    // 2. Attempt to delete from Supabase
    const storageDeleted = await DeleteSupa(imageUrl);



    if (storageDeleted) {
      // 3. Only if Supabase delete succeeds (or file was already gone), 
      // delete the database record
      console.log("inside Query");
      await pool.query('DELETE FROM branch_images WHERE id = $1', [id]);
      return res.status(200).send('removed');
    } else {
      return res.status(500).json({ error: "Failed to delete file from storage" });
    }

  } catch (err) {
    console.error("Controller Error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const AddImage = async (req, res) => {
    const { id } = req.params; // Ensure your route is /addImage/:id
  
    
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }
       

        const uploadPromises = req.files.map(async (file, index) => {
            // 1. Upload to Supabase
            const url = await uploadImage(file, "TempleBranch");

            // 2. Safe Metadata handling (Fallbacks if metadata isn't sent)
            let metadata = { type: 'GALLERY', is_primary: false };
            if (req.body[`image_metadata_${index}`]) {
                metadata = JSON.parse(req.body[`image_metadata_${index}`]);
            }

            // 3. Return the query promise
            return pool.query(
                `INSERT INTO branch_images (branch_id, image_url, is_primary) 
                 VALUES ($1, $2, $3)`,
                [id, url,metadata.is_primary]
            );
        });

        await Promise.all(uploadPromises);

        // 4. Always send a response!
        res.status(200).json({ message: "Images added successfully" });

    } catch (err) {
        console.error("AddImage Error:", err.message);
        res.status(500).json({ error: err.message });
    }
};


module.exports ={addBranch,getall,getbyId,updateBranch,deleteImg,AddImage};