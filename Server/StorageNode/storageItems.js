const path = require("path");
const crypto = require("crypto");

const STORAGE_ROOT = path.resolve(
    process.env.STORAGE_ROOT || "C:/Users/Udit/Storage"
);

const SECRET = process.env.STORAGE_DOWNLOAD_SECRET;

if(!SECRET){
    throw new Error("Storage_DOWNLOAD_SECRET must be set");
}

function makeItemId(absolutePath){
    const relativePath = path.relative(STORAGE_ROOT, absolutePath);
    const payload = Buffer.from(JSON.stringify({ relativePath}), "utf8").toString("base64url");

    const signature = crypto.createHmac("sha256",SECRET)
        .update(payload)
        .digest("base64url");

    return `${payload}.${signature}`;
}

function pathFromItemId(itemId){
    const [payload, signature] = String(itemId).split(".");

    if(!payload || !signature){
        throw new Error("Invalid storage item ID: Missing payload/signature");
    }

    const expected = crypto
        .createHmac("sha256",SECRET)
        .update(payload)
        .digest("base64url");
    
    if ( signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))){
        throw new Error("Invalid storage item ID: Path Authentication failed");
    }

    const { relativePath } = JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));

    const resolved = path.resolve(STORAGE_ROOT, relativePath);

    if(resolved !== STORAGE_ROOT && !resolved.startsWith(`${STORAGE_ROOT}${path.sep}`)){
        throw new Error("Path is outside configured storage root")
    }

    return resolved;
}

function safeDownloadName(name,fallback){
    return (name || fallback).replace(/[\r\n"]/g,"_");
}

module.exports = {
    STORAGE_ROOT,makeItemId,pathFromItemId,safeDownloadName
};

