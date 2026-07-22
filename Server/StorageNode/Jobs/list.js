const fs = require('fs').promises;
const path = require('path'); 


const listDownloaded = async (localpath) => {
    try{
        const items = await fs.readdir(localpath);
        const result = {
            item_name: path.basename(localpath),
            children: {}
        };

        let fileNum=0;
        for(const item of items){
            const fullpath = path.join(localpath,item);
            const stats = await fs.stat(fullpath);
             
            if (stats.isDirectory()){
                result.children[item] = await listDownloaded(fullpath)
            }
            else{
                fileNum+=1;
                result.children[`file#${fileNum}`] = item;
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