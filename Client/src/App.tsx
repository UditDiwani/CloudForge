import { useEffect, useState, type FormEvent } from 'react';

import './App.css'

const API_BASE_MAIN = "http://127.0.0.1:3001"
const API_BASE = "http://127.0.0.1:3000";
const base_store_path='C:/Users/Udit/Storage';

async function callStorageApi(path: String, body: Object) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if(!response.ok) throw new Error(data.error ?? "Could not load drive files");
  // let data: unknown = rawText;
  // try {
  //   data = rawText? JSON.parse(rawText) : {message:"No response body"};
  // } catch {
  // }
  // if (!response.ok){
  //   const errorMessage = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : "Request failed";

  //   throw new Error(errorMessage);
  // }
  return data;
}

function App(){
  const [listPath, setListPath] = useState("C:/Users/Udit/Storage");
  const [downloadPath, setDownloadPath] = useState("");
  const [uploadJob, setUploadJob] = useState("uploadFile");
  const [uploadPath, setUploadPath] = useState("");
  const [folderName, setFolderName] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [status, setStatus] = useState("Ready");
  const [driveFiles, setDriveFiles] = useState<DriveItem[]>([]);
  const [driveError, setDriveError] = useState("");
  const [currentFolderId,setCurrentFolderId] = useState<string | undefined>();
  const [driveLoading,setDriveLoading] = useState(false);
  const [folderHistory, setFolderHistory] = useState<{id?: String;name: string}[]>([]);
  const [storageFiles, setStorageFiles] = useState<StorageItem[]>([]);
  const [storageLoading,setStorageLoading] = useState(false);
  const [currentStoreFolderPath,setCurrentStoreFolderPath] = useState<string | undefined>();


  type DriveItem = {
    id: string;
    name: string;
    mimeType: string;
    isFolder: boolean;
    modifiedTime?: string;
    size?: string;
  }

  type StorageItem = {
    id: string;
    name: string;
    isFolder: boolean;
    children?: StorageItem[];
  }

  async function loadDriveFiles(parentId?: string,folderName = 'My Drive') {
    try {
      setDriveLoading(true);
      const query = parentId ? `?${new URLSearchParams({parentId})}` : '';
      const response = await fetch(`${API_BASE_MAIN}/api/drive/items${query}`);
      const data = await response.json();

      if(!response.ok) throw new Error(data.error ?? "Could not load drive files");
      setDriveFiles(data.items);
      setCurrentFolderId(data.parentId);
      setDriveError("");
      setFolderHistory((oldHistory) => {
        const foundAt = oldHistory.findIndex((folder) => folder.id === data.parentId);
        return foundAt >=0 ? oldHistory.slice(0,foundAt+1) : 
                [...oldHistory,{id: data.parentId,name: folderName}];
      });
    }catch (error){
      setDriveError(error instanceof Error ? error.message : "Unknown error");
    }finally{
      setDriveLoading(false);
    }
  }

  function downloadUrl(item: DriveItem){
    const itemType = item.isFolder ? 'folders' : 'files';
    return `${API_BASE_MAIN}/api/drive/${itemType}/${encodeURIComponent(item.id)}/download`;
  }

  useEffect(() => {
    void loadDriveFiles();
    void loadStoreFiles();
  },[]);

  async function runRequest(action: string, request: () => Promise<unknown>) {
    try {
      setStatus(`${action}...`);
      const data = await request();
      setResult(data);
      setStatus(`${action} completed.`);
    }catch(error){
      const message = error instanceof Error ? error.message : "Unknown request error";
      setResult({error: message});
      setStatus(`${action} failed.`);
    }
  }
  function handleList(event: FormEvent<HTMLFormElement>){
    event.preventDefault();

    void runRequest("Listing storage",()=>
      callStorageApi("/Storage/list",{ localpath: listPath}),
    );
  }

  function handleUpload(event: FormEvent<HTMLFormElement>){
    event.preventDefault();

    const body = uploadJob === "createFolder" ? { job: "createFolder", folderName} : 
                 uploadJob === "uploadFolder" ? { job: "uploadFolder", localdirpath: uploadPath } :
                 { job: "uploadFile", localFilePath: uploadPath};
    void runRequest("Upload job", () => 
      callStorageApi("/Storage/upload",body)
    );
  }

  function handleDownload(event: FormEvent<HTMLFormElement>){
    event.preventDefault();

    void runRequest("Download job",() => 
      callStorageApi("/Storage/download",{ localPath: downloadPath}),
    );
  }

  async function loadStoreFiles(path?: String) {
    var loadPath = path ? path : base_store_path;
    var result1 = await callStorageApi('/Storage/list',{localpath : loadPath});
    setStorageFiles(result1.children);
  }

  return (
    <main>
      <h1> CloudForge Storage Console</h1>
      <p>{status}</p>

      <section>
        <h2>List laptop folder</h2>

        <form onSubmit={handleList}>
          <input 
            value={listPath}
            onChange={(event) => 
              setListPath(event.target.value)}
            placeholder='C:/Users/Udit/Storage'
            
            />
            <button type='submit'>List Files</button>
        </form>
        
      </section>

      <section>
        <h2>Google Drive upload</h2>

        <form onSubmit={handleUpload}>
          <select
            value={uploadJob}
            onChange={(event) => 
              setUploadJob(event.target.value)
            }>
              <option value="uploadFile">Upload One File</option>
              <option value="uploadFolder">Upload a Folder</option>
              <option value="createFolder">Create Drive Folder</option>
            </select>

            {uploadJob ==="createFolder" ? (
              <input 
                value={folderName}
                onChange={(event) => 
                  setFolderName(event.target.value)
                }
                placeholder='New Google Drive Folder name'
                required
              />
            ) : (
              <input 
                value={uploadPath}
                onChange={(event) => 
                  setUploadPath(event.target.value)
                }
                placeholder="C:/Users/Udit/Storage"
                required
              />
            )
            }

            <button type='submit'>Run Upload job</button>
        </form>
      </section>

      <section>
        <h2> Download Drive Backup to Laptop </h2>

        <form onSubmit={handleDownload}>
          <input 
            value={downloadPath}
            onChange={(event) => 
              setDownloadPath(event.target.value)
            }
            placeholder='C:/Users/Udit/storage'
            required
          />
        </form>
      </section>

      <section>
        <h2>Server response</h2>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </section>
      
      <section className="view_container_header">
        <div className='vc_2' style={{flexDirection:"column"}}>
          <h2>Google Drive contents</h2>
          <button type='button' onClick={() => void loadDriveFiles()}>Refresh Drive</button>
          <button type='button' onClick={()=> void loadDriveFiles(currentFolderId)}>Refresh folder</button>
          <p>
            {folderHistory.map((folder,index)=>(
              <span key={folder.id ?? 'root'}>
                {index > 0 && '>>'}
                <button className='bread_crumbs' type="button" onClick={() => void loadDriveFiles(folder.id,folder.name)}>
                  {folder.name}
                </button>
              </span>
            ))}
          </p>
          {driveLoading && <p>Loading files...</p>}
          {driveError && <p>{driveError}</p>}
        </div>
        <div>
          <h2>Laptop server contents</h2>
        </div>
      </section>
      <div className='view_container'>
        <h1></h1>
          <ul className='vc_2'>
            {driveFiles.map((item)=>(
              <li key={item.id}>
                {item.isFolder ? (
                  <>
                  <div className='folder' onClick={()=> void loadDriveFiles(item.id,item.name)}>
                    <div className="folder_logo" >
                    </div>
                    <h3>{item.name}</h3>
                    
                  </div>
                  </>
                ) : (
                  <>
                  <a className='file' href={downloadUrl(item)} aria-label={`Download ${item.name}`}>
                    <div className='file_logo' aria-hidden="true" />
                    <h3 title={item.name}>{item.name}</h3>
                  </a>
                  </>
                )}
                {item.isFolder && (
                  <a className='folder-download' href = {downloadUrl(item)} style={{marginLeft: '0.75rem'}}>Download</a>
                )}
                
                
              </li>
            ))}
          </ul>
          <ul className='vc_2'>
            {storageFiles.map((item)=>(
              <li key={item.id}>
                {item.isFolder ? (
                  <>
                  <div className='folder' onClick={()=> {
                    const newPath = `${listPath}/${item.name}`;
                    setListPath(newPath);

                    void loadStoreFiles(newPath);
                    
                    }}>
                    <div className="folder_logo" >
                    </div>
                    <h3>{item.name}</h3>
                    
                  </div>
                  </>
                ) : (
                  <>
                  <div className='file'>
                    <div className='file_logo' aria-hidden="true" />
                    <h3 title={item.name}>{item.name}</h3>
                  </div>
                  </>
                )}
                {/* {item.isFolder && (
                  <a className='folder-download' href = {downloadUrl(item)} style={{marginLeft: '0.75rem'}}>Download</a>
                )} */}
                
                
              </li>
            ))}
          </ul>
      </div>
    </main>
  )
}

export default App;
