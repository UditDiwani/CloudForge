const express = require('express');
const archiver = require('archiver');
const {
    FOLDER_MIME_TYPE,getDrive,getRootFolderId,listChildren,isFolder,toPublicItem,assertItemIsInsideRoot,safeDownloadName
} = require('../Services/driveService');

const router = express.Router();

router.get('/items',async (req , res) => {
    try{
        const parentId = req.query.parentId || getRootFolderId();

        if (req.query.parentId){
            const parent = await assertItemIsInsideRoot(parentId);
            if(!isFolder(parent)){
                return res.status(400).json({error:'parentId must be a folder'});
            }
        }
        const data = await listChildren(parentId, req.query.pageToken);
        return res.json({
            parentId,
            items: (data.files || []).map(toPublicItem),
            nextPageToken: data.nextPageToken || null,
        });
    } catch(error){
        console.error('drive list failed: ',error.message);
        return res.status(500).json({error: 'Could not list Drive items'});
    }
});

router.get('/files/:fileId/download',async (req , res) => {
    try {
        const item = await assertItemIsInsideRoot(req.params.fileId);

        if(isFolder(item)){
            return res.status(400).json({error: 'Use the folder route for folders'});
        }
        if(item.mimeType.startsWith('application/vnd.google-apps.')){
            return res.status(422).json({error:'Google Docs Export is not added yet'});
        }

        const googleResponse = await getDrive().files.get(
            { fileId: item.id, alt: 'media' },
            { responseType: 'stream'},
        );
        res.setHeader('Content-Type',googleResponse.headers['content-type'] || 'application/octet-stream');
        res.setHeader('Content-Disposition',`attachment;filename=${safeDownloadName(item.name,'download')}`);
        googleResponse.data.on('error',(error)=>res.destroy(error));
        googleResponse.data.pipe(res);
    }catch(error){
        console.error('Filedownload failed: ',error.message);
        if(!res.headersSent) return res.status(500).json({error: 'Could not download file'});
        res.destroy(error);
    }
});

async function addFolderToZip(archive,folderId,zipPath) {
    archive.append('', {name: `${zipPath}/`});
    let pageToken;

    do {
        const data = await listChildren(folderId, pageToken);
        for (const item of data.files || []){
            const itemPath = `${zipPath}/${safeDownloadName(item.name,'unnamed')}`;

            if(item.mimeType === FOLDER_MIME_TYPE){
                await addFolderToZip(archive,item.id,itemPath);
            }else if(!item.mimeType.startsWith('application/vnd.google-apps.')){
                const googleResponse = await getDrive().files.get(
                    { fileId: item.id,alt:'media'},
                    {responseType: 'stream'},
                );
                archive.append(googleResponse.data,{name: itemPath});
            }
        }
        pageToken = data.nextPageToken;
    }while(pageToken);
}

router.get('/folders/:folderId/download',async (req , res) => {
    try {
        const folder = await assertItemIsInsideRoot(req.params.folderId);
        if(!isFolder(folder)){
            return res.status(400).json({error: 'This item is not a folder'});
        }
        const archive = archiver('zip',{zlib: {level: 9}});
        archive.on('error',(error) => res.destroy(error));

        res.setHeader('Content-Type','application/zip');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${safeDownloadName(folder.name,'folder')}.zip"`,
        );

        archive.pipe(res);
        await addFolderToZip(archive,folder.id,safeDownloadName(folder.name,'folder'));
        await archive.finalize();
    } catch(error){
        console.error('Folder ZIP failed: ',error.message);
        if(!res.headersSent) return res.status(500).json({error: 'Could not download folder'});
        res.destroy(error);
    }
});

module.exports = router;