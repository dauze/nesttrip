// src/@core/firebase.service.ts
import {Injectable} from '@angular/core';
import {initializeApp, getApps, FirebaseApp} from 'firebase/app';
import {getFirestore, Firestore} from 'firebase/firestore';
import {environment} from '@app/environnements/environnement';

@Injectable({providedIn: 'root'})
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly db: Firestore;

  constructor() {
    // Évite la double initialisation si l'auth l'a déjà fait
    this.app = getApps().length
      ? getApps()[0]
      : initializeApp(environment.firebase);
    this.db = getFirestore(this.app);
  }
}
