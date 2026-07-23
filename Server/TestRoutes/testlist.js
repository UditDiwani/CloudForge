(async () => {
  try {
    const response = await fetch("http://127.0.0.1:3000/Storage/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ localpath: "C:/Users/Udit/OneDrive/Desktop/DevopsScreenshots" }),
    });

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Request failed:", error);
  }
})();