const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // Your database connection
const { authenticate } = require("../middlewares/authMiddleware");
const uploadImage = require("../utils/supabaseUpload");
const upload = require("../middlewares/upload");
const DeleteSupa = require("../utils/supabaseDelete");

/**
 * @route   POST /api/documents/upload
 * @desc    Create document registry and upload associated images
 */
router.post(
  "/upload",
  authenticate,
  upload.array("images"),
  async (req, res) => {
    const client = await pool.connect(); // Use a single client for transaction safety

    try {
      await client.query("BEGIN"); // Start Transaction

      const { document_name, remarks, branch_id } = req.body;

      // 1. Insert into Document Registry
      const docRegistryQuery = `
            INSERT INTO document_registry (document_name, remarks, branch_id)
            VALUES ($1, $2, $3)
            RETURNING doc_id
        `;
      const docResult = await client.query(docRegistryQuery, [
        document_name,
        remarks,
        branch_id,
      ]);
      const docId = docResult.rows[0].doc_id;

      // 2. Handle Image Uploads (Using your logic)
      if (req.files && req.files.length > 0) {
        const uploadPromises = req.files.map(async (file, index) => {
          // Upload to Supabase/Cloud storage
          const url = await uploadImage(file, "documents");

          // Parse metadata if sent, otherwise use defaults
          const metadata = req.body[`image_metadata_${index}`]
            ? JSON.parse(req.body[`image_metadata_${index}`])
            : { type: "ORIGINAL" };

          return client.query(
            `INSERT INTO document_images (doc_id, image_url) VALUES ($1, $2)`,
            [docId, url],
          );
        });

        await Promise.all(uploadPromises);
      }

      await client.query("COMMIT"); // Save all changes
      res
        .status(201)
        .json({ message: "Document digitalised successfully", doc_id: docId });
    } catch (err) {
      await client.query("ROLLBACK"); // Undo changes if anything fails
      console.error("Upload Error:", err.message);
      res.status(500).json({ error: "Failed to digitalise document" });
    } finally {
      client.release();
    }
  },
);

/**
 * @route   GET /api/documents/all
 * @desc    Fetch all documents with their branch names and image counts
 */
router.get("/all", authenticate, async (req, res) => {
  try {
    const query = `
            SELECT 
                dr.*, 
                CASE WHEN dr.branch_id = 0 THEN 'Main Branch' ELSE tb.branch_name END as display_branch_name,
                COUNT(di.photo_id) as image_count
            FROM document_registry dr
            LEFT JOIN temple_branches tb ON dr.branch_id = tb.id
            LEFT JOIN document_images di ON dr.doc_id = di.doc_id
            GROUP BY dr.doc_id, tb.branch_name
            ORDER BY dr.created_at DESC
        `;
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch document directory" });
  }
});

/**
 * @route   GET /api/documents/:id
 * @desc    Fetch a single document with all its associated images
 */
router.get("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
            SELECT 
                dr.*, 
                json_agg(di.* ORDER BY di.photo_id) as images
            FROM document_registry dr
            LEFT JOIN document_images di ON dr.doc_id = di.doc_id
            WHERE dr.doc_id = $1
            GROUP BY dr.doc_id
        `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error fetching details" });
  }
});

/**
 * @route   PUT /api/documents/:id
 * @desc    Update document metadata (Name and Remarks)
 */
router.put("/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const { document_name, remarks } = req.body;

  try {
    const query = `
            UPDATE document_registry 
            SET document_name = $1, remarks = $2
            WHERE doc_id = $3
            RETURNING *
        `;
    const result = await pool.query(query, [document_name, remarks, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

/**
 * @route   DELETE /api/documents/:id
 * @desc    Delete entire document and associated images (Cascading)
 */
router.delete("/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    // Because of the ON DELETE CASCADE constraint in our SQL schema,
    // deleting from document_registry automatically deletes from document_images.
    const result = await pool.query(
      "DELETE FROM document_registry WHERE doc_id = $1 RETURNING *",
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Document not found" });
    }

    res
      .status(200)
      .json({ message: "Document and all scans deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Delete operation failed" });
  }
});

router.delete("/images/:id", async (req, res) => {
  const id = req.params.id; // photo_id
  try {
    const findResult = await pool.query(
      "SELECT image_url FROM document_images WHERE photo_id = $1",
      [id],
    );

    if (findResult.rows.length === 0) {
      return res.status(404).json({ error: "Image record not found" });
    }

    const imageUrl = findResult.rows[0].image_url;
    const storageDeleted = await DeleteSupa(imageUrl);

    if (storageDeleted) {
      await pool.query("DELETE FROM document_images WHERE photo_id = $1", [id]);
      return res.status(200).send("removed");
    } else {
      return res.status(500).json({ error: "Storage deletion failed" });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post(
  "/images/addImage/:id",
  authenticate,
  upload.array("images"),
  async (req, res) => {
    const { id } = req.params; // doc_id
    console.log("into the add image");
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadPromises = req.files.map(async (file, index) => {
        const url = await uploadImage(file, "documents");
        return pool.query(
          `INSERT INTO document_images (doc_id, image_url) VALUES ($1, $2)`,
          [id, url],
        );
      });

      await Promise.all(uploadPromises);
      res.status(200).json({ message: "Images added successfully" });
    } catch (err) {
      console.log(err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
