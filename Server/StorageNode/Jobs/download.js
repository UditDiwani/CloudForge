const fs = require('fs');
const path = require('path');
const { getGoogleDriveClient } = require('../../config/googleDrive');
const drive = getGoogleDriveClient();



// 1. Core recursive function (handles the actual downloading)
const downloadFolderRecursive = async (folderId, localPath) => {
    if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
    }

    const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: "files(id,name,mimeType)"
    });
    console.log(response.data.files);
    for (const item of response.data.files) {
        if (item.mimeType === "application/vnd.google-apps.folder") {
            // Recursion works perfectly now using strings
            await downloadFolderRecursive(
                item.id,
                path.join(localPath, item.name)
            );
        } else {
            const filePath = path.join(localPath, item.name);
            const dest = fs.createWriteStream(filePath);

            const fileRes = await drive.files.get(
                { fileId: item.id, alt: "media" },
                { responseType: "stream" }
            );

            await new Promise((resolve, reject) => {
                fileRes.data
                    .pipe(dest)
                    .on("finish", resolve)
                    .on("error", reject);
            });
        }
    }
};

// 2. API Endpoint Controller (handles the req/res lifecycle)
const downloadFolder = async (req, res) => {
    try {
        const { folderId, localPath } = req.body;

        if (!folderId || !localPath) {
            return res.status(400).json({ error: "Missing folderId or localPath" });
        }

        // Kick off the recursion using the extracted values
        await downloadFolderRecursive(folderId, localPath);

        return res.status(200).json({ message: "Folder downloaded successfully" });
    } catch (error) {
        console.error("Download failed:", error);
        return res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

module.exports = { downloadFolder };