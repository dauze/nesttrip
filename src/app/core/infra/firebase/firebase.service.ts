import { Injectable } from '@angular/core';
import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, initializeFirestore } from 'firebase/firestore';
import { environment } from '@environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app: FirebaseApp;
  readonly db: Firestore;

  constructor() {
    // Évite la double initialisation si l'auth l'a déjà fait
    this.app = getApps().length ? getApps()[0] : initializeApp(environment.firebase);
    // `ignoreUndefinedProperties` : de nombreux champs optionnels du domaine
    // (adresse/lat/lng d'une activité sans lieu Google, deadline de résa...)
    // valent `undefined` plutôt qu'être absents de l'objet (spread direct
    // dans les mappers `xToFb`) — sans ce flag, `setDoc`/`updateDoc` rejette
    // ces écritures avec une exception non rattrapée (ex. déplacer/dispatcher
    // une activité saisie en texte libre, sans lieu Google, faisait planter
    // l'app au premier `updateDoc` qui la touchait).
    this.db = initializeFirestore(this.app, { ignoreUndefinedProperties: true });
  }
}
