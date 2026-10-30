const crypto = require("crypto");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const multer = require("multer");

const { 
    makeItemId,
    pathFromItemId,
} = require("../storageItems");

const MAX_FILES = 100;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const upload = multer({
    storage: multer.diskStorage({
        destination: os.tmpdir(),

        filename: (req, file, callback) => {
            callback(null, `cloudforge-upload-${crypto.randomUUID()}`);
        },
    }),

    limits: {
        files: MAX_FILES,
        fileSize: MAX_FILE_SIZE,
        field: 10,
    },
});

function clientError(message) {
    const error = new Error(message);
    error.status = 400;
    return error;
}

function safeStorageSegment(value) {
    const safeValue = String(value).replace(/[<>:"/\\|?*\x00-\x1F]/g,"_").trim();

    if(!safeValue || safeValue === "." || safeValue === ".."){
        throw clientError("Invalid file or folder name");
    }

    return safeValue;
}

function validateRelativePath(value){
    const normalized = String(value).replace(/\\/g,"/");

    if( !normalized || 
        normalized.startsWith("/") || 
        /^[A-Za-z]:\//.test(normalized)
    ){
        throw clientError("Upload path must be relative");
    }

    const segments = normalized.split("/");

    if(
        segments.some(
            (segment) => 
                !segment || 
                segment === "." ||
                segment === ".."
        )
    ){
        throw clientError("Upload path contains an invalid folder segment");
    }

    return segments.map(safeStorageSegment);
}

function nameWithSuffix(name, number, isFolder){
    if(isFolder){
        return `${name} (${number})`;
    }

    const extension = path.extname(name);
    const baseName = extension ? name.slice(0, -extension.length) : name;

    return `${baseName} (${number})${extension}`;
}

async function pathExists(itemPath) {
    try {
        await fs.access(itemPath);
        return true;
    }catch{
        return false;
    }
}

async function uniqueStoragePath(parentPath, desiredName, isFolder) {
    let number = 0;
    let candidateName = desiredName;

    while(await pathExists(path.join(parentPath, candidateName))){
        number +=1;
        candidateName = nameWithSuffix(desiredName, number, isFolder);
    }

    return path.join(parentPath, candidateName);
}

async function resolveStorageFolder(folderId) {
    const folderPath = pathFromItemId(folderId);
    const stats = await fs.lstat(folderPath);

    if(!stats.isDirectory() || stats.isSymbolicLink()){
        throw clientError("Storage destination must be a real folder");
    }

    return folderPath;
}

async function ensureChildFolders(parentPath, folderSegments) {
    let currentPath = parentPath;

    for (const segment of folderSegments){
        const nextPath = path.join(currentPath, segment);

        try{
            const stats = await fs.lstat(nextPath);

            if(!stats.isDirectory() || stats.isSymbolicLink()){
                throw clientError(`"${segment}" is not a usable destination folder`);
            }
        } catch(error) {
            if(error.code !== "ENOENT"){
                throw error;
            }

            await fs.mkdir(nextPath);
        }

        currentPath = nextPath;
    }

    return currentPath;
}

async function removeTemporaryFiles(files) {
    await Promise.all(
        files.map((file) => 
            fs.unlink(file.path).catch(() => {
                //temp files might already be gone
            })
        )
    );
}

function parseStorageUpload(req, res, next){
    upload.array("files",MAX_FILES)(req, res, (error) => {
        if(!error){
            return next();
        }

        if(error.code === "LIMIT_FILE_SIZE"){
            return res.status(413).json({
                error: "Each uploaded file must be 25 MB or smaller",
            });
        }

        return res.status(400).json({
            error: error.message || "Could not read uploaded files",
        });
    });
}

async function uploadStorageFiles(req,res) {
    const uploadedFiles = req.files || [];
    try {
        if(uploadedFiles.length === 0){
            throw clientError("Choose at lease one file");
        }

        const destinationFolderPath = await resolveStorageFolder(
            req.params.folderId
        );

        const uploaded = [];
        const failed = [];

        for (const file of uploadedFiles){
            try {
                const segments = validateRelativePath(file.originalname);
                const fileName = segments.pop();

                const nestedFolderPath = await ensureChildFolders(
                    destinationFolderPath,
                    segments
                );

                const destinationPath = await uniqueStoragePath(
                    nestedFolderPath,
                    fileName,
                    false
                );

                await fs.copyFile(file.path, destinationPath);

                uploaded.push({
                    name: fileName,
                    relativePath: segments.length ?
                        `${segments.join("/")}/${fileName}` :
                        fileName,
                    id: makeItemId(destinationPath),
                });
            } catch (error){
                failed.push({
                    name: file.originalname,
                    error:error.message,
                });
            }
        }

        return res.status(201).json({
            uploaded,
            failed,
        });
    } catch(error){
        console.error("Storage upload failed: ",error.message);

        return res.status(error.status || 500).json({
            error: error.message || "Could not upload files to Storage",
        });
    } finally{
        await removeTemporaryFiles(uploadedFiles);
    }
}

async function createStorageChildFolder(req,res) {
    try {
        const { name } = req.body || {};

        if(typeof name !== "string"){
            throw clientError("Folder name is required");
        }

        const segments = validateRelativePath(name);

        if(segments.length !== 1){
            throw clientError("Folder name cannot contain a path");
        }

        const destinationFolderPath = await resolveStorageFolder(req.params.folderId);

        const childFolderPath = await uniqueStoragePath(
            destinationFolderPath,
            segments[0],
            true
        );

        await fs.mkdir(childFolderPath);

        return res.status(201).json({
            id: makeItemId(childFolderPath),
            name: path.basename(childFolderPath),
            isFolder: true,
        });
    }catch(error){
        console.error("Storage folder creation failed: ",error.message);

        return res.status(error.status || 500).json({
            error: error.message || "Could not create Storage folder"
        });
    }
}

module.exports = {
    parseStorageUpload,
    uploadStorageFiles,
    createStorageChildFolder,
};