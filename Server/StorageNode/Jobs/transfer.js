const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { pipeline } = require("stream/promises");

const { FOLDER_MIME_TYPE,
        getDrive,
        getRootFolderId,
        listChildren,
        isFolder,
        assertItemIsInsideRoot,
} = require ("../../Services/driveService");

const { STORAGE_ROOT, pathFromItemId, } = require("../storageItems");

const drive = getDrive();

function clientError(message){
    const error = new Error(message);
    error.status = 400;
    return error;
}

function safeLocalName(name, fallback = "unnamed"){
    return (name || fallback)
        .replace(/[<>:"/\\|?*\x00-\x1F]/g,"_")
        .trim() || fallback;
}

function nameWithSuffix(name, number, folder){
    if(folder){
        return `${name} (${number})`;
    }
    const extension = path.extname(name);
    const baseName = extension ? name.slice(0, -extension.length) : name;
    return `${baseName} (${number})${extension}`
}

async function pathExists(itemPath) {
    try {
        await fsp.access(itemPath);
        return true;
    }catch{
        return false;
    }
}

async function uniqueLocalPath(parentPath, desiredName, folder) {
    let attempt = 0;
    let candidateName = desiredName;

    while (await pathExists(path.join(parentPath, candidateName))){
        attempt +=1;
        candidateName = nameWithSuffix(desiredName, attempt, folder);
    }
    return path.join(parentPath,candidateName);
}

function escapeDriveQueryValue(value){
    return value.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
}

async function driveNameExists(parentId,name) {
    const response = await drive.files.list({
        q: [
            `'${parentId}' in parents`,
            "trashed = false",
            `name = '${escapeDriveQueryValue(name)}'`,
        ].join(" and "),
        fields: "files(id)",
        pageSize: 1,
    });
    return response.data.files.length > 0;
}

async function uniqueDriveName(parentId, desiredName, folder) {
    let attempt = 0;
    let candidateName = desiredName;

    while (await driveNameExists(parentId, candidateName)){
        attempt +=1;
        candidateName = nameWithSuffix(desiredName, attempt, folder);
    }
    return candidateName;
}

async function getDriveChildren(folderId) {
    const children = [];
    let pageToken;

    do {
        const data = await listChildren(folderId, pageToken);
        children.push(...(data.files || []));
        pageToken = data.nextPageToken;
    } while(pageToken);
    return children;
}

async function copyDriveFileToStorage(item, destinationFolderPath) {
    const googleWorkspaceFile = item.mimeType.startsWith("application/vnd.google-apps.");
    const originalName = googleWorkspaceFile ? `${item.name}.pdf` : item.name;

    const destinationPath = await uniqueLocalPath(
        destinationFolderPath,
        safeLocalName(originalName),
        false
    );
    const response = googleWorkspaceFile ? await drive.files.export(
        {
            fileId: item.id,
            mimeType: "application/pdf",
        },
        { responseType: "stream" }
    ) : await drive.files.get({
        fileId: item.id,
        alt: "media",
        }, {responseType: "stream"} );
    
    await pipeline(
        response.data,
        fs.createWriteStream(destinationPath)
    );
    
    return { destinationName: path.basename(destinationPath), };
}

async function copyDriveFolderToStorage(item, destinationFolderPath) {
    const folderPath = await uniqueLocalPath(
        destinationFolderPath,
        safeLocalName(item.name),
        true
    );

    await fsp.mkdir(folderPath);

    const children = await getDriveChildren(item.id);

    for (const child of children){
        await copyDriveEntryToStorage(child, folderPath);
    }
    return { destinationName: path.basename(folderPath),}
}

async function copyDriveEntryToStorage(item, destinationFolderPath) {
    if(item.mimeType === FOLDER_MIME_TYPE){
        return copyDriveFolderToStorage(item,destinationFolderPath);
    }
    return copyDriveFileToStorage(item, destinationFolderPath);
}

async function copySelectedDriveItemToStorage(itemId,destinationFolderPath) {
    const item = await assertItemIsInsideRoot(itemId);

    if(item.id === getRootFolderId()){
        throw clientError("The configured Drive root cannot be transferred");
    }

    return copyDriveEntryToStorage(item,destinationFolderPath);
}

async function createDriveFolder(parentId,name) {
    const response = await drive.files.create({
        requestBody: {
            name,
            mimeType: FOLDER_MIME_TYPE,
            parents: [parentId],
        },
        fields: "id,name",
    });
    return response.data;
}

async function uploadStorageFileToDrive(filePath, parentId, name) {
    const response = await drive.files.create({
    requestBody: {
      name,
      parents: [parentId],
    },
    media: {
      body: fs.createReadStream(filePath),
    },
    fields: "id,name",
    });
    return response.data;
}

async function copyStorageEntryToDrive(sourcePath,destinationFolderId) {
    const stats = await fsp.lstat(sourcePath);

    if(stats.isSymbolicLink()){
        throw clientError("Symbolic links cannot be transferred");
    }

    const sourceName = path.basename(sourcePath);

    if(stats.isDirectory()){
        const destinationName = await uniqueDriveName(
            destinationFolderId,sourceName,true
        );
        const destinationFolder = await createDriveFolder(
            destinationFolderId,destinationName
        );

        const children = await fsp.readdir(sourcePath);

        for (const childName of children){
            await copyStorageEntryToDrive(
                path.join(sourcePath,childName),destinationFolder.id
            );
        }

        return {destinationName: destinationFolder.name, };
    }
    if(!stats.isFile()){
        throw clientError("Only files and folders can be transferred");
    }
    const destinationName = await uniqueDriveName(
        destinationFolderId,
        sourceName,
        false 
    );

    const uploadFile = await uploadStorageFileToDrive(
        sourcePath,
        destinationFolderId,
        destinationName
    );
    return { destinationName: uploadFile.name };
}

async function transferItems(sourceIds, transferOne) {
    const transferred = [];
    const failed = [];
    for (const sourceId of sourceIds){
        try {
            const result = await transferOne(sourceId);

            transferred.push({
                sourceId,
                ...result,
            });
        } catch (error){
            failed.push({
                sourceId,
                error: error.message,
            });
        }
    }
    return {transferred, failed };
}

async function transferDriveToStorage(req,res) {
    try {
        const { driveItemIds, destinationStorageFolderId, } = req.body;

        if(!Array.isArray(driveItemIds) || driveItemIds.length === 0){
            throw clientError("Select at least one Drive item");
        }
        const destinationPath = pathFromItemId(destinationStorageFolderId);
        const destinationStats = await fsp.lstat(destinationPath);

        if(!destinationStats.isDirectory()){
            throw clientError("Storage destination must be a folder");
        }

        const result = await transferItems(
            driveItemIds,
            (itemId) => copySelectedDriveItemToStorage(itemId,destinationPath)
        );

        return res.json(result);
    } catch (error){
        console.error("Drive to storage transfer failed: ",error.message);
        return res.status(error.status || 500).json({
            error: error.message || "Could not transfer Drive items to Storage",
        });
    }
}

async function transferStorageToDrive(req,res){
    try{
        const { storageItemIds, destinationDriveFolderId, } = req.body;
        if(!Array.isArray(storageItemIds) || storageItemIds.length === 0){
            throw clientError("Select at least one Storage item");
        }

        const destinationDriveFolder = await assertItemIsInsideRoot(destinationDriveFolderId);

        if(!isFolder(destinationDriveFolder)){
            throw clientError("Drive destination must be a folder");
        }

        const result = await transferItems(
            storageItemIds,
            async (itemId) => {
                const sourcePath = pathFromItemId(itemId);

                if(path.resolve(sourcePath) === path.resolve(STORAGE_ROOT)){
                    throw clientError("The configured Storage root cannot be tranferred");
                }
                return copyStorageEntryToDrive(
                    sourcePath,
                    destinationDriveFolder.id 
                );
            }
        );

        return res.json(result);
    } catch (error){
        console.error("Storage to Drive transfer failed: ",error.message);
        return res.status(error.status || 500).json({
            error: error.message || "Could not transfer Storage items to Drive",
        });
    }
}

module.exports = { transferDriveToStorage, transferStorageToDrive };