const router = require('express').Router();
const upload = require("../middlewares/upload");
const { getAllAssets, getAssetById, updateAsset,postAssets,deleteImg,AddImage} = require('../controllers/assetController');
const {authenticate,isAdmin} = require('../middlewares/authMiddleware');

router.post('/',authenticate, upload.array('images'), postAssets);

router.get('/',authenticate, getAllAssets);
router.get('/:id',authenticate, getAssetById);
router.put('/:id',authenticate, upload.array('images'), updateAsset);
router.delete('/images/:id',authenticate,deleteImg);
router.post('/:id',authenticate,upload.array('images'),AddImage);



module.exports = router;