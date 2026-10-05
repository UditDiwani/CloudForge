const fs = require("fs/promises");
const path = require("path");
const { STORAGE_ROOT, pathFromItemId } = require("../storageItems");

async function deleteStorageItem(req,res) {
    try{
        const itemPath = pathFromItemId(req.params.itemId);

        if(path.resolve(itemPath)===path.resolve(STORAGE_ROOT)){
            return res.status(400).json({error:"The Configured storage root cannot be deleted"});
        }
        const itemStats = await fs.lstat(itemPath);

        if(itemStats.isDirectory()){
            await fs.rm(itemPath,{
                recursive: true,
                force: false,
            })
        }else{
            await fs.unlink(itemPath);
        }

        return res.json({
            message: "Storage item deleted",
            id: req.params.itemId,
        });
    }catch(error){
        console.error("Storage delete failed:",error.message);

        if(error.code === "ENOENT"){
            return res.status(404).json({error:"Storage item was not found"});
        }

        return res.status(500).json({error: "Could not delete storage item"});
    }
}

module.exports = { deleteStorageItem };