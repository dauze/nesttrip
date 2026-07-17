import { inject, Injectable } from '@angular/core';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { from, Observable, map, switchMap } from 'rxjs';
import { FirebaseService } from '@core/infra/firebase/firebase.service';

export interface UploadedFile {
  url: string;
  name: string;
  path: string;
}

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly storage = getStorage(inject(FirebaseService).app);

  uploadFile(file: File, path: string): Observable<UploadedFile> {
    const storageRef = ref(this.storage, path);
    return from(uploadBytes(storageRef, file)).pipe(
      switchMap(() => from(getDownloadURL(storageRef))),
      map((url: string) => ({
        url,
        name: file.name,
        path: path
      }))
    );
  }

  deleteFile(path: string): Observable<void> {
    const storageRef = ref(this.storage, path);
    return from(deleteObject(storageRef));
  }
}