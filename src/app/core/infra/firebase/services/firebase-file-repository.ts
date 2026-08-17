import { inject, Injectable } from '@angular/core';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { from, Observable, map, switchMap } from 'rxjs';
import { FirebaseService } from '@core/infra/firebase/firebase.service';
import { FileRepository, UploadedFile } from './file-repository';

@Injectable()
export class FirebaseFileRepository extends FileRepository {
  private readonly storage = getStorage(inject(FirebaseService).app);

  uploadFile(file: File, path: string): Observable<UploadedFile> {
    const storageRef = ref(this.storage, path);
    return from(uploadBytes(storageRef, file)).pipe(
      switchMap(() => from(getDownloadURL(storageRef))),
      map((url: string) => ({
        url,
        name: file.name,
        path: path,
      })),
    );
  }

  deleteFile(path: string): Observable<void> {
    const storageRef = ref(this.storage, path);
    return from(deleteObject(storageRef));
  }
}
