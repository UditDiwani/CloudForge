const fs = require('fs');
const path = require('path');
const { getGoogleDriveClient, getConfiguredDriveFolderId } = require('../../config/googleDrive');
const drive = getGoogleDriveClient();
const ROOT_FOLDER_ID = getConfiguredDriveFolderId();



// 1. Core recursive function (handles the actual downloading)
const downloadFolderRecursive = async (folderId, localPath) => {
    if (!fs.existsSync(localPath)) {
        fs.mkdirSync(localPath, { recursive: true });
    }

    const targetFolderId = folderId || ROOT_FOLDER_ID;

    const response = await drive.files.list({
        q: `'${targetFolderId}' in parents and trashed = false`,
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
        const { localPath } = req.body;

        if (!localPath) {
            return res.status(400).json({ error: "Missing localPath" });
        }

        // Kick off the recursion using the configured root folder
        await downloadFolderRecursive(ROOT_FOLDER_ID, localPath);

        return res.status(200).json({ message: "Folder downloaded successfully" });
    } catch (error) {
        console.error("Download failed:", error);
        return res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

module.exports = { downloadFolder };