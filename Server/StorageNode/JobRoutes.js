const express = require("express");

const { listDownload } = require("./Jobs/list");
const { downloadFolder } = require("./Jobs/download");

const router = express.Router();

router.post('/list',listDownload);
router.post('/download',downloadFolder);

module.exports = router;