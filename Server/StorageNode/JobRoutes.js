const express = require("express");

const { listDownload } = require("./Jobs/list");
const { downloadFolder,listDriveContents } = require("./Jobs/download");
const { uploadRoute } = require('./Jobs/upload');
const router = express.Router();

router.post('/list',listDownload);
router.post('/download',downloadFolder);
router.post('/upload',uploadRoute);
router.get("/drive-files",listDriveContents)
module.exports = router;