import { Injectable, inject } from '@angular/core';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FirebaseService } from './firebase.service';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly storage = getStorage(inject(FirebaseService).app);

  async uploadFile(file: File, path: string): Promise<{ url: string; name: string }> {
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return { url, name: file.name };
  }

  async deleteFile(path: string): Promise<void> {
    await deleteObject(ref(this.storage, path));
  }
}