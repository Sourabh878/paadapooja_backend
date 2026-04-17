const pool = require("../config/db");
const uploadImage = require("../utils/supabaseUpload");
const DeleteSupa = require("../utils/supabaseDelete");

// --- GET ALL ASSETS (With Joins) ---
// This fetches the base asset info and joins the specific details based on type
const getAllAssets = async (req, res) => {
  try {
    const query = `
            SELECT a.*, 
                   p.property_type, p.location, p.total_area_sqft, p.rental_rate,
                   o.material_type, o.purity, o.gross_weight, o.locker_no,
                   ins.policy_number, ins.expiry_date,
                   (SELECT image_url FROM asset_images WHERE asset_id = a.id AND is_primary = true LIMIT 1) as primary_image
            FROM assets a
            LEFT JOIN property_assets p ON a.id = p.asset_id
            LEFT JOIN ornament_assets o ON a.id = o.asset_id
            LEFT JOIN asset_insurance ins ON a.id = ins.asset_id
            ORDER BY a.created_at DESC
        `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- GET SINGLE ASSET (Full Detail) ---
const getAssetById = async (req, res) => {
  const { id } = req.params;
  try {
    const assetBase = await pool.query("SELECT * FROM assets WHERE id = $1", [
      id,
    ]);
    if (assetBase.rows.length === 0)
      return res.status(404).send("Asset not found");

    const type = assetBase.rows[0].asset_type;
    const typeTable =
      type === "PROPERTY" ? "property_assets" : "ornament_assets";

    const details = await pool.query(
      `SELECT * FROM ${typeTable} WHERE asset_id = $1`,
      [id],
    );
    const insurance = await pool.query(
      "SELECT * FROM asset_insurance WHERE asset_id = $1",
      [id],
    );
    const images = await pool.query(
      "SELECT * FROM asset_images WHERE asset_id = $1",
      [id],
    );

    res.json({
      ...assetBase.rows[0],
      details: details.rows[0],
      insurance: insurance.rows[0],
      images: images.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- PUT (UPDATE) ASSET ---

const postAssets = async (req, res) => {
  const client = await pool.connect();
  console.log(req.body);
  try {
    await client.query("BEGIN");

    // 1. Insert Core Asset
    const assetQuery = `
            INSERT INTO assets (asset_code, asset_name, asset_type, description, purchase_type, purchase_date, purchase_cost)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;

    const assetRes = await client.query(assetQuery, [
      req.body.asset_code,
      req.body.asset_name,
      req.body.asset_type,
      req.body.description,
      req.body.purchase_type,
      req.body.purchase_date || null,
      req.body.purchase_cost || 0,
    ]);
    const assetId = assetRes.rows[0].id;

    // 2. Handle Donor Information (If Purchase Type is Donation)
    if (req.body.purchase_type === "Donation" && req.body.donor_name) {
      await client.query(
        `
                INSERT INTO donors (donor_name, phone, address, donation_date,asset_id)
                VALUES ($1, $2, $3, $4, $5)`,
        [
          req.body.donor_name,
          req.body.donor_phone,
          req.body.donor_address,
          req.body.purchase_date || new Date(),
          assetId,
        ],
      );
      // Note: You can also add a donor_id column to the assets table to link them formally
    }

    // 3. Insert Type-Specific Details
    if (req.body.asset_type === "PROPERTY") {
      await client.query(
        `
                INSERT INTO property_assets (asset_id, property_type, location, total_area_sqft, rental_rate)
                VALUES ($1, $2, $3, $4, $5)`,
        [
          assetId,
          req.body.property_type,
          req.body.location,
          req.body.total_area_sqft,
          req.body.rental_rate,
        ],
      );
    } else {
      await client.query(
        `
                INSERT INTO ornament_assets (asset_id, material_type, purity, gross_weight, net_weight, locker_no, stone_weight ,length)
                VALUES ($1, $2, $3, $4, $5, $6,$7,$8)`,
        [
          assetId,
          req.body.material_type,
          req.body.purity,
          req.body.gross_weight,
          req.body.net_weight,
          req.body.locker_no,
          req.body.stone_weight,
          req.body.O_length,
        ],
      );
    }

    if (req.body.policy_number) {
      await client.query(
        `
                INSERT INTO asset_insurance (asset_id, policy_number, insured_value, expiry_date)
                VALUES ($1, $2, $3, $4)`,
        [
          assetId,
          req.body.policy_number,
          req.body.insured_value || 0,
          req.body.expiry_date || null,
        ],
      );
    }

    // 4. Supabase Image Uploads
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file, index) => {
        const url = await uploadImage(file, "assets"); // Your Supabase Utility
        const metadata = JSON.parse(req.body[`image_metadata_${index}`]);
        return client.query(
          `INSERT INTO asset_images (asset_id, image_url, image_type, is_primary) VALUES ($1, $2, $3, $4)`,
          [assetId, url, metadata.type, metadata.is_primary],
        );
      });
      await Promise.all(uploadPromises);
    }

    await client.query("COMMIT");
    res
      .status(201)
      .json({
        success: true,
        message: "Asset and Donor details recorded successfully",
      });
  } catch (err) {
    await client.query("ROLLBACK");
    console.log("Error in postAssets:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const updateAsset = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  // console.log(req.body);

  try {
    await client.query("BEGIN");

    // 1. Update Parent Table
    await client
      .query(
        `UPDATE assets SET asset_name=$1,purchase_cost=$2, current_value=$3, updated_at=NOW() WHERE id=$4`,
        [
          req.body.asset_name,
          req.body.purchase_cost,
          req.body.current_value,
          id,
        ],
      )
      .then(() => {
        console.log("asset upated");
      });

    // 2. Update Type-Specific Table
    if (req.body.asset_type === "PROPERTY") {
      await client.query(
        `UPDATE property_assets SET property_type=$1, location=$2, rental_rate=$3,total_area_sqft=$4 WHERE asset_id=$5`,
        [
          req.body.details.property_type,
          req.body.details.location,
          req.body.details.rental_rate,
          req.body.details.total_area_sqft,
          id,
        ],
      );
    } else {
      await client.query(
        `UPDATE ornament_assets SET material_type=$1, purity=$2, gross_weight=$3,net_weight=$4,stone_weight=$5,length=$6, locker_no=$7 WHERE asset_id=$8`,
        [
          req.body.details.material_type,
          req.body.details.purity,
          req.body.details.gross_weight,
          req.body.details.net_weight,
          req.body.details.stone_weight,
          req.body.details.length,
          req.body.details.locker_no,
          id,
        ],
      );
    }

    // 3. Update Insurance (UPSERT)
    await client.query(
      `UPDATE asset_insurance 
            SET policy_number = $1, 
                insured_value = $2, 
                expiry_date = $3
            WHERE asset_id = $4`,
      [
        req.body.insurance.policy_number,
        req.body.insurance.insured_value,
        req.body.insurance.expiry_date,
        id,
      ],
    );

    // 4. Handle New Image Uploads (If any provided during update)

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
      "SELECT image_url FROM asset_images WHERE id = $1",
      [id],
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
      await pool.query("DELETE FROM asset_images WHERE id = $1", [id]);
      return res.status(200).send("removed");
    } else {
      return res
        .status(500)
        .json({ error: "Failed to delete file from storage" });
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
      const url = await uploadImage(file, "assets");

      // 2. Safe Metadata handling (Fallbacks if metadata isn't sent)
      let metadata = { type: "GALLERY", is_primary: false };
      if (req.body[`image_metadata_${index}`]) {
        metadata = JSON.parse(req.body[`image_metadata_${index}`]);
      }

      // 3. Return the query promise
      return pool.query(
        `INSERT INTO asset_images (asset_id, image_url, image_type, is_primary) 
                 VALUES ($1, $2, $3, $4)`,
        [id, url, metadata.type, metadata.is_primary],
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

module.exports = {
  postAssets,
  getAllAssets,
  getAssetById,
  updateAsset,
  deleteImg,
  AddImage,
};
