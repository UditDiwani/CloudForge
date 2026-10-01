const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { ZipArchive } = require("archiver");
const { pathFromItemId, safeDownloadName, } = require("../storageItems");

async function addFolderToZip(archive, folderPath, zipPath) {
    const entries = await fsp.readdir(folderPath, { withFileTypes: true});

    if (entries.length === 0){
        archive.append("", { name: `${zipPath}`});
    }

    for (const entry of entries){
        const fullPath = path.join(folderPath,entry.name);
        const archivePath = `${zipPath}/${safeDownloadName(entry.name,"unnamed")}`;

        if(entry.isDirectory()){
            await addFolderToZip(archive, fullPath, archivePath);
        }else if(entry.isFile()){
            archive.file(fullPath, {name: archivePath});
        }
    }
}

async function downloadStorageItem(req,res) {
    try{
        const itemPath = pathFromItemId(req.params.itemId);
        const stats = await fsp.stat(itemPath);
        const itemName = path.basename(itemPath);

        if(stats.isFile()){
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Disposition",`attachment; filename="${safeDownloadName(itemName,"download")}"`);

            return fs.createReadStream(itemPath)
                .on("error", error => res.destroy(error))
                .pipe(res);
        }

        if(!stats.isDirectory()){
            return res.status(400).json({ error: "Unsupported storage item"});
        }

        res.setHeader("Content-Type","application/zip");
        res.setHeader("Content-Disposition",`attachment; filename="${safeDownloadName(itemName,"folder")}.zip"`);

        const archive = new ZipArchive("zip",{ zlib: { level: 9 } });
        archive.on("error",error => res.destroy(error));
        archive.pipe(res);

        await addFolderToZip(archive, itemPath, safeDownloadName(itemName,"folder"));
        await archive.finalize();
    }catch(error){
        console.error("Storage download failed:",error.message);

        if(!res.headerSent){
            return res.status(404).json({ error: "Storage item was not found"});
        }
        res.destroy(error);
    }
}

module.exports = { downloadStorageItem };

