import { useEffect, useRef, useState, type FormEvent } from 'react';

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
  const [folderHistory, setFolderHistory] = useState<{id?: string;name: string}[]>([]);
  const [storageFiles, setStorageFiles] = useState<StorageItem[]>([]);
  const [storageLoading,setStorageLoading] = useState(false);
  const [currentStoreFolder,setCurrentStoreFolder] = useState<string>("Home");
  const [currentStorageFolderId,setCurrentStorageFolderId] = useState<string>();
  const [storageHistory, setStorageHistory] = useState<StorageFolder[]>([
    { path: "C:/Users/Udit/Storage",name:"Home"},
  ])
  const [selectedDriveItems, setSelectedDriveItems] = useState<Map<string, TransferSelection>>(() => new Map());
  const [selectedStorageItems, setSelectedStorageItems] = useState<Map<string, TransferSelection>>(() => new Map());
  const [transferReview, setTransferReview] = useState<TransferReview | null>(null);
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const folderClickTimers = useRef<Record<string,ReturnType<typeof setTimeout>>>({});

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

  type StorageFolder ={
    path: string;
    name: string;
  }

  type TransferSelection = {
    id: string;
    name: string;
    path: string;
    isFolder: boolean;
  };

  type TransferDirection = "drive-to-storage" | "storage-to-drive";

  type TransferReview = {
    direction: TransferDirection;
    items: TransferSelection[];
  }

  function toggleSelection(
    item: TransferSelection,
    setSelectedItems: React.Dispatch<React.SetStateAction<Map<string,TransferSelection>>>
  ){
    setSelectedItems((previous) => {
      const next = new Map(previous);
      if(next.has(item.id)){
        next.delete(item.id);
      }else{
        next.set(item.id,item);
      }
      return next;
    });
  }

  function scheduleFolderSelection(
    key: string,
    selectItem: () => void 
  ){
    const existingTimer = folderClickTimers.current[key];

    if (existingTimer){
      clearTimeout(existingTimer);
    }

    folderClickTimers.current[key] = setTimeout(() => {
      selectItem();
      delete folderClickTimers.current[key];
    }, 220);
  }

  function cancelFolderSelection(key: string){
    const timer = folderClickTimers.current[key];

    if(timer){
      clearTimeout(timer);
      delete folderClickTimers.current[key];
    }
  }

  function selectDriveItem(item: DriveItem){
    const folderPath = folderHistory.map((folder) => folder.name).join(" / ");
    toggleSelection(
      {
        id: item.id,
        name: item.name,
        path: `${folderPath} / ${item.name}`,
        isFolder: item.isFolder,
      },
      setSelectedDriveItems
    );
  }
  function handleDriveFolderClick(item: DriveItem){
    scheduleFolderSelection(`drive:${item.id}`, () => {
      selectDriveItem(item);
    });
  }
  function handleDriveFolderDoubleClick(item: DriveItem){
    cancelFolderSelection(`drive:${item.id}`);
    void loadDriveFiles(item.id, item.name);
  }
  function selectStorageItem(item: StorageItem){
    const folderPath = storageHistory.map((folder) => folder.name).join(" / ")
    toggleSelection(
      {
        id: item.id,
        name: item.name,
        path: `${folderPath} / ${item.name}`,
        isFolder: item.isFolder,
      },
      setSelectedStorageItems
    );
  }
  function handleStorageFolderClick(item: StorageItem){
    scheduleFolderSelection(`storage:${item.id}`,() => {
      selectStorageItem(item);
    });
  }
  function handleStorageFolderDoubleClick(item: StorageItem){
    cancelFolderSelection(`storage:${item.id}`);

    const newPath = `${listPath}/${item.name}`;
    openStorageFolder(newPath,item.name);
  }
  function handleDriveToStorageTransfer(){
    if(!currentStorageFolderId){
      setStatus("Storage destination is still loading.");
      return;
    }

    setDeleteAfterTransfer(false);

    setTransferReview({
      direction: "drive-to-storage", 
      items: [...selectedDriveItems.values()],
    });
  }
  function handleStorageToDriveTransfer(){
    if(!currentFolderId) {
      setStatus("Drive destination is still loading.");
      return;
    }

    setDeleteAfterTransfer(false);

    setTransferReview({
      direction: 'storage-to-drive',
      items: [...selectedStorageItems.values()],
    });
  }

  function removeItemFromTransferReview(itemId: string){
    if(!transferReview) return;

    if(transferReview.direction === "drive-to-storage"){
      setSelectedDriveItems((previous) => {
        const next = new Map(previous);
        next.delete(itemId);
        return next;
      });
    } else {
      setSelectedStorageItems((previous) => {
        const next = new Map(previous);
        next.delete(itemId);
        return next;
      });
    }

    setTransferReview((previous) => {
      if(!previous) return null;

      return {
        ...previous,
        items: previous.items.filter((item) => item.id !== itemId),
      };
    });
  }

  async function confirmTransfer() {
    if(!transferReview || transferReview.items.length === 0){
      return;
    }

    try {
      setTransferBusy(true);

      const isDriveToStorage = transferReview.direction === "drive-to-storage";

      const response = await fetch(
        isDriveToStorage ? 
          `${API_BASE}/Storage/transfers/drive-to-storage` :
          `${API_BASE}/Storage/transfers/storage-to-drive`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify(
              isDriveToStorage ? 
              {
                driveItemIds: transferReview.items.map((item) => item.id),
                destinationStorageFolderId: currentStorageFolderId,
              }
              : {
                storageItemIds: transferReview.items.map((item) => item.id),
                destinationDriveFolderId: currentFolderId,
              }
            ),
          }
      );

      const data = await response.json();

      if(!response.ok){
        throw new Error(data.error ?? "Transfer failed");
      }

      const transferredIds = new Set<string>(
        data.transferred.map((item: { sourceId: string}) => item.sourceId)
      )

      if(isDriveToStorage){
        setSelectedDriveItems((previous) => {
          const next = new Map(previous);

          for (const id of transferredIds){
            next.delete(id)
          }
          return next;
        });
      } else{
        setSelectedStorageItems((previous) =>{
          const next = new Map(previous);

          for (const id of transferredIds){
            next.delete(id);
          }
          return next;
        });
      }

      if(deleteAfterTransfer){
        const deleteRequests = data.transferred.map(
          async (item: { sourceId: string}) =>{
            const deleteUrl = isDriveToStorage ? 
              `${API_BASE_MAIN}/api/drive/items/${encodeURIComponent(item.sourceId)}` :
              `${API_BASE}/Storage/items/${encodeURIComponent(item.sourceId)}`;
            
            const deleteResponse = await fetch(deleteUrl, {
              method: "DELETE",
              credentials: "include",
            });

            const deleteData = await deleteResponse.json();

            if (!deleteResponse.ok){
              throw new Error(deleteData.error ?? "Could not delete transferred source item");
            }
          }
        );

        await Promise.all(deleteRequests);

        await Promise.all([
          loadDriveFiles(currentFolderId),
          loadStoreFiles(listPath),
        ]);
      } else if(isDriveToStorage){
        await loadStoreFiles(listPath);
      } else {
        await loadDriveFiles(currentFolderId);
      }

      const failedCount = data.failed.length;

      setStatus(
        `${data.transferred.length} item(s) tranferred successfully` + 
        (failedCount > 0 ? `; ${failedCount} item(s) failed.` : ".")
      );
      setTransferReview(null);
    } catch(error){
      const message = error instanceof Error ? error.message : "Transfer failed";
      setStatus(message);
    }finally{
      setTransferBusy(false);
    }
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

  async function downloadDriveItem(item: DriveItem){
    const itemType = item.isFolder ? 'folders' : 'files';
    const url = `${API_BASE_MAIN}/api/drive/${itemType}/${encodeURIComponent(item.id)}/download`;
    const response = await fetch(url, {
      credentials: "include",
    })
    if(!response.ok){
      throw new Error("Download failed");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = item.isFolder ? `${item.name}.zip` : item.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function deleteDriveItem(item:DriveItem) {
    const response = await fetch(
      `${API_BASE_MAIN}/api/drive/items/${encodeURIComponent(item.id)}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await response.json();

    if(!response.ok){
      throw new Error(data.error ?? "Could not delete Drive item");
    }

    await loadDriveFiles(currentFolderId);
  }

  async function downloadStorageItem(item:StorageItem) {
    const url = `${API_BASE}/Storage/items/${encodeURIComponent(item.id)}/download`;

    const response = await fetch(url, {credentials: 'include'});

    if (!response.ok){
      const data = await response.json().catch(()=>null);
      throw new Error(data?.error ?? "Storage download failed");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = item.isFolder ? `${item.name}.zip` : item.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function deleteStorageItem(item:StorageItem) {
    const response = await fetch(
      `${API_BASE}/Storage/items/${encodeURIComponent(item.id)}`,{
        method: "DELETE",
        credentials: "include",
      }
    );

    const data = await response.json();

    if(!response.ok){
      throw new Error(data.error ?? "Could not delete storage item");
    }

    await loadStoreFiles(listPath);
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

  async function loadStoreFiles(folderPath: string = base_store_path) {
    try {
      setStorageLoading(true);
      const data = await callStorageApi("/Storage/list",{localpath: folderPath,});
      if(!data.id){
        throw new Error("Storage folder did not return an ID");
      } 

      setStorageFiles(data.children ?? []);
      setCurrentStorageFolderId(data.id);
    }catch (error){
      const message = error instanceof Error ? error.message : "Could not load storage files";
      setStatus(message);
    }finally{
      setStorageLoading(false)
    }
  }

  function openStorageFolder(path: string, name: string){
    setListPath(path);
    setCurrentStoreFolder(name);
    setStorageHistory((previous) => {
      const existingIndex = previous.findIndex((folder) => folder.path === path);
      void loadStoreFiles(path);
      if (existingIndex >=0){
        return previous.slice(0,existingIndex+1);
      }
      return [...previous,{path: path, name: name}];
    });
    
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
        <div className="pane-header">
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

        <div className="header-transfer-spacer" aria-hidden="true" />

        <div className="pane-header">
          <h2>Storage Node contents</h2>
          <button type='button' onClick={()=> void openStorageFolder(listPath,currentStoreFolder)}>Refresh folder</button>
          <p>
            {storageHistory.map((folder,index)=>(
              <span key={folder.path ?? 'storage-root'}>
                {index > 0 && '>>'}
                <button className='bread_crumbs' type="button" onClick={() => void openStorageFolder(folder.path,folder.name)}>
                  {folder.name}
                </button>
              </span>
            ))}
          </p>
          {storageLoading && <p>Loading files...</p>}
        </div>
      </section>
      <div className='view_container'>
        
          <ul className='vc_2'>
            {driveFiles.map((item)=>(
              <li key={item.id}>
                {item.isFolder ? (
                  <>
                  <div className={`folder ${selectedDriveItems.has(item.id) ? "selected" : ""}`} onClick={()=> handleDriveFolderClick(item)} onDoubleClick={()=>handleDriveFolderDoubleClick(item)} aria-pressed={selectedDriveItems.has(item.id)}>
                  <div className="folder_logo" >
                  </div>
                  <h3>{item.name}</h3>
                  <div className='button-row'>
                    <button type="button" className='folder-download' onClick={(event)=>{
                      event.stopPropagation();
                      void downloadDriveItem(item)}} aria-label='download-folder'>
                      <div className='tactile-shape'>
                        <svg className="download-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://w3.org">
                          <path d="M12 15 V1 M12 15L8 11M12 15L16 11M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17" stroke="#2B6CB0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </button>
                    <button type="button" className='delete-icon' onClick={(event)=>{
                          event.stopPropagation();
                          void deleteDriveItem(item)}} aria-label='download-folder'>
                          <div className='tactile-shape'>
                            <svg className = "delete-shape" viewBox="0 0 250 250" fill="none" xmlns="http://w3.org">
                               
                              <rect x="40" y ="40" width="170" height="190" fill="none" stroke="red" strokeWidth="6"/>
                              <rect x="60" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                              <rect x="170" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                              <rect x="115" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                              <path d="M30 30 A 5 5 0 0 0 30 40 H220 A 5 5 0 0 0 220 30 Z M90 30 A 35 20 0 0 1 160 30 M150 30 A 30 25 0 0 0 100 30" stroke="red" fill="red" strokeWidth = "2"/>
                            </svg>
                          </div>
                        </button>
                    </div>
                  </div>
                  </>
                ) : (
                  <>
                  <div className={`file-card ${selectedDriveItems.has(item.id) ? "selected" : ""}`}>
                    <button type="button" className="file" aria-pressed={selectedDriveItems.has(item.id)} aria-label={`Select ${item.name}`} onClick={()=>selectDriveItem(item)}>
                      <div className='file_logo' aria-hidden="true" />
                      <h3 title={item.name}>{item.name}</h3>
                    </button>
                    <div className="button-row">
                      <button type="button" className="folder-download" aria-label={`Download ${item.name}`} onClick={(event) => {event.stopPropagation(); void downloadDriveItem(item);}}>
                        <div className="tactile-shape">
                          <svg className="download-arrow" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 15V3M12 15L8 11M12 15L16 11M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17"
                              stroke="#2B6CB0"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </button>
                      <button type="button" className='delete-icon' onClick={(event)=>{
                          event.stopPropagation();
                          void deleteDriveItem(item)}} aria-label='download-folder'>
                          <div className='tactile-shape'>
                            <svg className = "delete-shape" viewBox="0 0 250 250" fill="none" xmlns="http://w3.org">
                               
                              <rect x="40" y ="40" width="170" height="190" fill="none" stroke="red" strokeWidth="6"/>
                              <rect x="60" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                              <rect x="170" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                              <rect x="115" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                              <path d="M30 30 A 5 5 0 0 0 30 40 H220 A 5 5 0 0 0 220 30 Z M90 30 A 35 20 0 0 1 160 30 M150 30 A 30 25 0 0 0 100 30" stroke="red" fill="red" strokeWidth = "2"/>
                            </svg>
                          </div>
                      </button>
                    </div>
                  </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="transfer-controls">
            <button type="button" className="transfer-arrow" onClick={handleDriveToStorageTransfer} disabled={selectedDriveItems.size === 0} aria-label="Transfer selected Drive Items to Storage" title="Move selected Drive items to Storage">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12 H19 M13 6 L19 12 L13 18" />
              </svg>
            </button>
            <button type="button" className="transfer-arrow" onClick={handleStorageToDriveTransfer} disabled={selectedStorageItems.size === 0} aria-label="Transfer selected Storage items to Drive" title="Move selected Storage items to Drive">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 12 H5 M11 6 L5 12 L11 18" />
              </svg>
            </button>
          </div>

          <ul className='vc_2'>
            {storageFiles.map((item)=>(
              <li key={item.id}>
                {item.isFolder ? (
                  <>
                  <div className={`folder ${selectedStorageItems.has(item.id) ? "selected" : ""}`} onClick={()=> handleStorageFolderClick(item)} onDoubleClick={() => handleStorageFolderDoubleClick(item)} aria-pressed={selectedStorageItems.has(item.id)}>
                    <div className="folder_logo" >
                    </div>
                    <h3>{item.name}</h3>
                    <div className='button-row'>
                      <button type="button" className='folder-download' onClick={(event)=>{
                        event.stopPropagation();
                        void downloadStorageItem(item)}} aria-label='download-folder'>
                        <div className='tactile-shape'>
                          <svg className="download-arrow" viewBox="0 0 24 24" fill="none" xmlns="http://w3.org">
                            <path d="M12 15V3M12 15L8 11M12 15L16 11M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17" stroke="#2B6CB0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </button>
                      <button type="button" className='delete-icon' onClick={(event)=>{
                        event.stopPropagation();
                        void deleteStorageItem(item)}} aria-label='download-folder'>
                        <div className='tactile-shape'>
                          <svg className = "delete-shape" viewBox="0 0 250 250" fill="none" xmlns="http://w3.org">
                               
                              <rect x="40" y ="40" width="170" height="190" fill="none" stroke="red" strokeWidth="6"/>
                              <rect x="60" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                              <rect x="170" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                              <rect x="115" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                              <path d="M30 30 A 5 5 0 0 0 30 40 H220 A 5 5 0 0 0 220 30 Z M90 30 A 35 20 0 0 1 160 30 M150 30 A 30 25 0 0 0 100 30" stroke="red" fill="red" strokeWidth = "2"/>
                            </svg>
                        </div>
                      </button>
                    </div>
                  </div>
                  </>
                ) : (
                  <>
                  <div className={`file-card ${selectedStorageItems.has(item.id) ? "selected" : ""}`}>
                    <button type="button" className="file" aria-pressed={selectedStorageItems.has(item.id)} aria-label={`Select ${item.name}`} onClick={()=>selectStorageItem(item)}>
                      <div className='file_logo' aria-hidden="true" />
                      <h3 title={item.name}>{item.name}</h3>
                    </button>
                    <div className="button-row">
                      <button type="button" className="folder-download" aria-label={`Download ${item.name}`} onClick={(event) => {event.stopPropagation(); void downloadStorageItem(item);}}>
                        <div className="tactile-shape">
                          <svg className="download-arrow" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 15V3M12 15L8 11M12 15L16 11M4 17V19C4 20.1046 4.89543 21 6 21H18C19.1046 21 20 20.1046 20 19V17"
                              stroke="#2B6CB0"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </button>
                      <button type="button" className='delete-icon' onClick={(event)=>{
                          event.stopPropagation();
                          void deleteStorageItem(item)}} aria-label='download-folder'>
                          <div className='tactile-shape'>
                            <svg className = "delete-shape" viewBox="0 0 250 250" fill="none" xmlns="http://w3.org">
                                
                                <rect x="40" y ="40" width="170" height="190" fill="none" stroke="red" strokeWidth="6"/>
                                <rect x="60" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                                <rect x="170" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                                <rect x="115" y ="60" width="20" height="150" fill="red" stroke="red" strokeWidth="2"/>
                                <path d="M30 30 A 5 5 0 0 0 30 40 H220 A 5 5 0 0 0 220 30 Z M90 30 A 35 20 0 0 1 160 30 M150 30 A 30 25 0 0 0 100 30" stroke="red" fill="red" strokeWidth = "2"/>
                              </svg>
                          </div>
                        </button>
                    </div>
                  </div>
                  </>
                )}
                
                
              </li>
            ))}
          </ul>
      </div>
      {transferReview && (
        <div className="transfer-dialog-backdrop">
          <section className="transfer-dialog" role="dialog" aria-modal="true" aria-labelledby="transfer-dialog-title">
            <h2 id="transfer-dialog-title">Confirm Transfer</h2>
            
            <p>
              the following {transferReview.items.length} item(s) will be transferred 
              {transferReview.direction === 'drive-to-storage' 
                ? "from Google Drive to the current Storage folder."
                : "from Storage to the current Google Drive folder."}
            </p>

            <ul className="transfer-review-list">
              {transferReview.items.map((items) => (
                <li key = {items.id}>
                  <div>
                    <strong>{items.isFolder ? "Folder: " : "File:"}</strong>
                    {items.name}
                    <small>{items.path}</small>
                  </div>
                  <button type="button" className="remove-transfer-item" onClick={()=> removeItemFromTransferReview(items.id)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>

            <label className="delete-after-transfer">
              <input type="checkbox" checked={deleteAfterTransfer} onChange={(event) => setDeleteAfterTransfer(event.target.checked)} />
              Delete items from source after transfer 
            </label>

            <div className="transfer-dialog-actions">
              <button type="button" onClick={() => setTransferReview(null)} disabled={transferBusy}>
                Cancel
              </button>
              <button type="button" onClick={() => void confirmTransfer()} disabled={transferBusy || transferReview.items.length === 0}>
                {transferBusy ? "Transferring..." : "Confirm transfer"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App;
