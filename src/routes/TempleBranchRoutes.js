const router = require("express").Router();
const {
  addBranch,
  getall,
  getbyId,
  updateBranch,
  deleteImg,
  AddImage
} = require("../controllers/TempleBranchController");
const upload = require("../middlewares/upload");
const {authenticate,isAdmin} = require('../middlewares/authMiddleware');

router.post("/addBranch",authenticate, upload.array("images"), addBranch);
router.get("/all",authenticate, getall);
router.get("/:id",authenticate, getbyId);
router.put("/:id",authenticate, updateBranch);
router.delete("/images/:id",authenticate, deleteImg);
router.post("/addImage/:id",authenticate,upload.array("images"),AddImage);

module.exports = router;
