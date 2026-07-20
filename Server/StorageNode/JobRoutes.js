const express = require("express");

const { listDownload } = require("./Jobs/list")

const router = express.Router();

router.post('/list',listDownload);

module.exports = router;