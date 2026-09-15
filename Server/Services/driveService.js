const { getGoogleDriveClient, getConfiguredDriveFolderId } = require('../config/googleDrive');
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

function getDrive(){
    return getGoogleDriveClient();
}

function getRootFolderId(){
    return getConfiguredDriveFolderId();
}

function isFolder(item){
    return item.mimeType === FOLDER_MIME_TYPE;
}

async function getItem(fileId) {
    const response = await getDrive().files.get({
        fileId,
        fields: 'id,name,mimeType,parents,modifiedTime,size',
    });
    return response.data;
}

async function listChildren(parentId, pageToken) {
    const response = await getDrive().files.list({
        q:`'${parentId}' in parents and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size,parents)',
        orderBy: 'folder,name',
        pageSize: 100,
        pageToken: pageToken || undefined,
    });
    return response.data;
}

function toPublicItem(item){
    return {
        id: item.id,
        name: item.name,
        mimeType: item.mimeType,
        isFolder: isFolder(item),
        modifiedTime: item.modifiedTime,
        size: item.size || null,
    };
}

//preventing outside root access

async function assertItemIsInsideRoot(fileId){
    const rootId = getRootFolderId();
    if(fileId === rootId) return getItem(fileId);

    const visited = new Set();
    let item = await getItem(fileId);

    while(item.id !== rootId){
        if(visited.has(item.id)) throw new Error('Invalid Drive parent tree');
        visited.add(item.id);

        const parentId = item.parents && item.parents[0];
        if (!parentId) throw new Error('Item is outside the configured Drive root');
        if(parentId === rootId) return item;
        item = await getItem(parentId);
    }
    return item;
}

function safeDownloadName(name, fallback){
    return (name || fallback).replace(/[\r\n"]/g,'_')
}

module.exports = {
    FOLDER_MIME_TYPE, getDrive, getRootFolderId, getItem, listChildren,isFolder,toPublicItem,assertItemIsInsideRoot,safeDownloadName,
};
