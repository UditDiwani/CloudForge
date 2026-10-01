const fs = require('fs').promises;
const path = require('path'); 
const { isFolder } = require('../../Services/driveService');
const { makeItemId } = require('../storageItems');


const listDownloaded = async (localpath) => {
    try{
        const folderStats = await fs.stat(localpath);
        const items = await fs.readdir(localpath);
        const result = {
            id: makeItemId(localpath),
            name: path.basename(localpath),
            isFolder: true,
            children: [],
        };

        for(const item of items){
            const fullpath = path.join(localpath,item);
            const stats = await fs.stat(fullpath);
            
            if (stats.isDirectory()){
                result.children.push(await listDownloaded(fullpath));
            }
            else{
                result.children.push({
                    id: makeItemId(fullpath),
                    name: item,
                    isFolder: stats.isDirectory(),
                });
            }
        }
        return result;
    }
    catch (error){
        console.error(`Error while reading directory : ${error}`)
    }
}

const listDownload = async (req,res) => {
    const { localpath } = req.body;

    const result = await listDownloaded(localpath);
    res.status(200).json(result);
    console.log(JSON.stringify(result, null, 2));
}

module.exports = { listDownload }