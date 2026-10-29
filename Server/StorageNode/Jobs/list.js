const fs = require('fs/promises');
const path = require('path'); 

const { STORAGE_ROOT, makeItemId, pathFromItemId, } = require("../storageItems");

async function listStorageFolder(req,res) {
    try { 
        const { parentId } = req.body || {};

        const folderPath = parentId ? pathFromItemId(parentId) : STORAGE_ROOT;

        const folderStats = await fs.lstat(folderPath);

        if(!folderStats.isDirectory()){
            return res.status(400).json({
                error: "Storage parent must be a folder",
            });
        }

        const entries = await fs.readdir(folderPath, {
            withFileTypes: true,
        });

        const items = await Promise.all(
            entries.map(async (entry) => {
                const itemPath = path.join(folderPath,entry.name);
                const itemStats = await fs.lstat(itemPath);

                if(itemStats.isSymbolicLink()){
                    return null;
                }

                return {
                    id: makeItemId(itemPath),
                    name: entry.name,
                    isFolder: itemStats.isDirectory(),
                    size: itemStats.isFile() ? String(itemStats.size) : null,
                    modifiedTime: itemStats.mtime.toISOString(),
                };
            })
        );

        const visibleItems = items.filter(Boolean).sort((first, second) => {
            if(first.isFolder !== second.isFolder) {
                return first.isFolder ? -1 : 1;
            }

            return first.name.localeCompare(second.name);
        });

        return res.json({
            parentId: makeItemId(folderPath),
            items: visibleItems,
        })

    } catch (error){
        console.error("Storage listing failed: ", error.message);

        if(error.code === "ENOENT"){
            return res.status(404).json({
                error: "Storage folder was not found",
            });
        }

        return res.status(400).json({
            error: "Could not list storage folder",
        });
    }
}

module.exports = { listStorageFolder }