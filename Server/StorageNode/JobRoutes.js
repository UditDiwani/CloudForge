const express = require("express");

const { listDownload } = require("./Jobs/list");
const { downloadFolder,listDriveContents } = require("./Jobs/download");
const { uploadRoute } = require('./Jobs/upload');
const { downloadStorageItem } = require("./Jobs/browserDownload");
const { deleteStorageItem } = require("./Jobs/delete");
const { transferDriveToStorage, transferStorageToDrive } = require("./Jobs/transfer");
const router = express.Router();

router.post('/list',listDownload);
router.post('/download',downloadFolder);
router.post('/upload',uploadRoute);
router.get("/drive-files",listDriveContents)
router.get("/items/:itemId/download",downloadStorageItem);
router.delete("/items/:itemId", deleteStorageItem);
router.post("/transfers/drive-to-storage", transferDriveToStorage);
router.post("/transfers/storage-to-drive",transferStorageToDrive);
module.exports = router;