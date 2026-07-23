(async () => {
  try {
    const response = await fetch("http://127.0.0.1:3000/Storage/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ folderId: `${process.env.GOOGLE_DRIVE_FOLDER_ID}`,localPath: "C:/Users/Udit/OneDrive/Desktop/CloudForge/Server/TestRoutes" }),
    });

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Request failed:", error);
  }
})();