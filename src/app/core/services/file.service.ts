import { Injectable, inject } from '@angular/core';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FirebaseService } from './firebase.service';
import { from, Observable, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly storage = getStorage(inject(FirebaseService).app);

  uploadFile(file: File, path: string): Observable<{ url: string; name: string }> {
    const storageRef = ref(this.storage, path);
    return from(uploadBytes(storageRef, file)).pipe(
      switchMap(() => from(getDownloadURL(storageRef))),
      switchMap(url => [{ url, name: file.name }])
    );
  }

  deleteFile(path: string): Observable<void> {
    return from(deleteObject(ref(this.storage, path)));
  }
}