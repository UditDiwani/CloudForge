const fs = require('fs').promises;
const path = require('path');
const { drive } = require('../../config/googleDrive') 

const express = require('express');
const { file } = require('googleapis/build/src/apis/file');
const router = express.Router();

const listDownloaded = async (localpath) => {
    try{
        const items = await fs.readdir(localpath);
        console.log(items);

        for(const item of items){
            const fullpath = path.join(localpath,item);
            const stats = await fs.stat(fullpath);
            if (stats.isDirectory()){
                console.log(`Folder: ${item}`);
                await listDownloaded(fullpath);
            }
            else{
                const filesizeinmb = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`file : ${item} (${filesizeinmb} MB)`);
            }
        }
    }
    catch (error){
        console.error(`Error while reading directory : ${error}`)
    }
}

const listDownload = async (req,res) => {
    const { localpath } = req.body;

    await listDownloaded(localpath);
    res.status(200).json({status : 'Output complete'});
}

module.exports = { listDownload }