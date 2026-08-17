import { Observable } from 'rxjs';

export interface UploadedFile {
  url: string;
  name: string;
  path: string;
}

export abstract class FileRepository {
  abstract uploadFile(file: File, path: string): Observable<UploadedFile>;
  abstract deleteFile(path: string): Observable<void>;
}
