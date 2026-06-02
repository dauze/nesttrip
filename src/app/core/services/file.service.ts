import { inject, Injectable } from '@angular/core';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { from, Observable, switchMap } from 'rxjs';
import { FirebaseService } from '@core/infra/firebase/firebase.service';

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly storage = getStorage(inject(FirebaseService).app);

  uploadFile(file: File, path: string): Observable<{ url: string; name: string }> {
    const storageRef = ref(this.storage, path);
    return from(uploadBytes(storageRef, file)).pipe(
      switchMap(() => from(getDownloadURL(storageRef))),
      switchMap((url) => [{ url, name: file.name }]),
    );
  }

  deleteFile(path: string): Observable<void> {
    return from(deleteObject(ref(this.storage, path)));
  }
}
