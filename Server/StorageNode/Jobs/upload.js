const express = require('express');
const router = express.Router();

const fs = require('fs');
const path = require('path');

const { getGoogleDriveClient, getConfiguredDriveFolderId } = require('../../config/googleDrive');
const drive = getGoogleDriveClient();
const ROOT_FOLDER_ID = getConfiguredDriveFolderId();


const createFolder = async (folderName,parentId=null) => {
    const metadata={
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
    }

    const targetParentId = parentId || ROOT_FOLDER_ID;

    if(targetParentId){
        metadata.parents = [targetParentId];
    }

    const response = await drive.files.create({
        requestBody: metadata,
        fields: 'id',
    });

    return response.data.id;
}

const uploadFile = async(localFilePath, parentId) => {
    console.log(localFilePath);
    const fileName = path.basename(localFilePath);
    const fileMetaData = {
        name: fileName,
        parents: [parentId || ROOT_FOLDER_ID],
    }

    const media = {
        body: fs.createReadStream(localFilePath)
    }

    try{
        const response = await drive.files.create({
            requestBody: fileMetaData,
            media: media,
            fields: 'id',
        });
        console.log(`Uploaded File : ${fileName} (id: ${response.data.id}`);
    }
    catch(error){
        console.error(`Failed to upload: ${fileName} because of ${error}`);
    }
}

const uploadFolderRec = async (localdirpath,driveParentId=null) => {
    const folderName = path.basename(localdirpath);
    
    const currentFolderId = await createFolder(folderName, driveParentId || ROOT_FOLDER_ID);

    const items = fs.readdirSync(localdirpath);

    for(const item of items){
        const localItemPath = path.join(localdirpath,item);
        const stat = fs.statSync(localItemPath);

        if(stat.isDirectory()){
            await uploadFolderRec(localItemPath,currentFolderId);
        }
        else if(stat.isFile()){
            await uploadFile(localItemPath,currentFolderId);
        }
    }
}

const uploadRoute = async (req,res) =>{
    try{
        const job = req.body.job;

        if (job=="uploadFolder"){
            const { job, localdirpath } = req.body;
            res.status(202).json({
                message: "Upload Folder Started",
                target: localdirpath,
            });
            console.log(`Starting background upload for ${localdirpath}`);
            await uploadFolderRec(localdirpath, ROOT_FOLDER_ID); 
            console.log(`${localdirpath} uploaded successfully`);
        }
        else if(job=="uploadFile"){
            const { job, localFilePath } = req.body;
            res.status(202).json({
                message: "Upload File Started",
                target: localFilePath,
            });
            console.log(`Starting background upload for ${localFilePath}`);
            await uploadFile(localFilePath, ROOT_FOLDER_ID);
            console.log(`${localFilePath} uploaded successfully`);
        }
        else if(job=="createFolder"){
            const { job, folderName } = req.body;
            await createFolder(folderName);
            console.log(`${folderName} created on drive`);
        }
    }
    catch(error){
        console.log(`Error : ${error}`);
    }
}

module.exports = { uploadRoute };