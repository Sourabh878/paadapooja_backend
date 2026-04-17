const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const {authenticate }= require('../middlewares/authMiddleware');

/**
 * @route   GET /api/projects
 * @desc    Get all projects with their branch names and stages
 */
router.get('/all', authenticate, async (req, res) => {
    try {
        const query = `
            SELECT 
                pr.*, 
                CASE WHEN pr.branch_id = 0 THEN 'Main Branch' ELSE tb.branch_name END as display_branch_name,
                COALESCE(json_agg(ps.* ORDER BY ps.stage_id) FILTER (WHERE ps.stage_id IS NOT NULL), '[]') as stages
            FROM project_registry pr
            LEFT JOIN temple_branches tb ON pr.branch_id = tb.id
            LEFT JOIN project_stages ps ON pr.project_id = ps.project_id
            GROUP BY pr.project_id, tb.branch_name
            ORDER BY pr.created_at DESC
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route   POST /api/projects/register
 * @desc    Create a new project and its stages using a Transaction
 */

const nullyfy=(val)=>{
    if(val=='')
    {
        val=null;
    }

}
router.post('/register', authenticate, async (req, res) => {
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { 
            project_name, project_details, commence_date, estimated_end_date,
            coordinator_name, phone, email, address, project_cost, 
            ledger_id, branch_id, has_stages, stages 
        } = req.body;

        // 1. Insert Main Project
        const projectQuery = `
            INSERT INTO project_registry 
            (project_name, project_details, commence_date, estimated_end_date, coordinator_name, phone, email, address, project_cost, ledger_id, branch_id, has_stages)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING project_id
        `;
        const projectRes = await client.query(projectQuery, [
            project_name, project_details, nullyfy(commence_date), nullyfy(estimated_end_date),
            coordinator_name, phone, email, address, project_cost || 0, 
            ledger_id, branch_id, has_stages
        ]);
        const projectId = projectRes.rows[0].project_id;

        // 2. Insert Stages if they exist
        if (has_stages && stages && stages.length > 0) {
            const stageQuery = `
                INSERT INTO project_stages (project_id, stage_name, start_date, end_date, remarks)
                VALUES ($1, $2, $3, $4, $5)
            `;
            for (const stage of stages) {
                await client.query(stageQuery, [
                    projectId, stage.stage_name, stage.start_date || null, 
                    stage.end_date || null, stage.remarks
                ]);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Project registered successfully", project_id: projectId });
    } catch (err) {
        console.log(err.message);
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project and refresh stages
 */
router.put('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { 
            project_name, project_details, commence_date, estimated_end_date,
            coordinator_name, phone, email, address, project_cost, 
            ledger_id, branch_id, has_stages, stages 
        } = req.body;

        // 1. Update Main Project
        await client.query(`
            UPDATE project_registry SET 
            project_name=$1, project_details=$2, commence_date=$3, estimated_end_date=$4, 
            coordinator_name=$5, phone=$6, email=$7, address=$8, project_cost=$9, 
            ledger_id=$10, branch_id=$11, has_stages=$12, updated_at=NOW()
            WHERE project_id=$13`, 
            [project_name, project_details, commence_date, estimated_end_date, coordinator_name, phone, email, address, project_cost, ledger_id, branch_id, has_stages, id]
        );

        // 2. Refresh Stages: Delete old and insert new (simplest way to sync)
        await client.query('DELETE FROM project_stages WHERE project_id = $1', [id]);
        
        if (has_stages && stages && stages.length > 0) {
            const stageQuery = `INSERT INTO project_stages (project_id, stage_name, start_date, end_date, remarks) VALUES ($1, $2, $3, $4, $5)`;
            for (const stage of stages) {
                await client.query(stageQuery, [id, stage.stage_name, stage.start_date || null, stage.end_date || null, stage.remarks]);
            }
        }

        await client.query('COMMIT');
        res.status(200).json({ message: "Project updated" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project (Stages will cascade delete automatically)
 */
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM project_registry WHERE project_id = $1', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Project not found" });
        res.status(200).json({ message: "Project deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;