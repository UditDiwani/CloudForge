(async () => {
  try {
    const response = await fetch("http://127.0.0.1:3000/Storage/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job: "uploadFile",localFilePath: "C:/Users/Udit/OneDrive/Pictures/AnimalsSymbolize-Freedom.png", driveParentID: null }),
    });

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Request failed:", error);
  }
})();