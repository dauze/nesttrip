// src/app/core/travel.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { Day } from '../models/travel.models';
import { FirebaseService } from './firebase.service';
import {
  collection,
  getDocs,
  query,
  setDoc
} from 'firebase/firestore';
import { doc, updateDoc } from 'firebase/firestore';


@Injectable({ providedIn: 'root' })
export class TabService {
  private readonly db = inject(FirebaseService).db;

  private readonly _days = signal<Day[]>([]);
  private readonly _activeDayId = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly error = signal<string | null>(null);

  readonly days = this._days.asReadonly();
  readonly activeDayId = this._activeDayId.asReadonly();

  readonly activeDay = computed(() =>
    this._days().find(d => d.id === this._activeDayId())
  );

  readonly isInfoTab = computed(() => this._activeDayId() === 'infos');

  constructor() {
    this.loadDays();
  }

  private async loadDays(): Promise<void> {
    try {
      // orderBy nécessite un index Firestore si tu l'utilises
      // Sinon retire la clause orderBy et trie côté client
      const q = query(collection(this.db, 'tabs'));
      const snapshot = await getDocs(q);

      const days: Day[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Day, 'id'>),
      }));

      // Tri côté client selon l'ordre voulu
      days.sort((a, b) => (a as any).order - (b as any).order);

      this._days.set(days);
      this._activeDayId.set(days[0]?.id ?? '');
    } catch (e) {
      this.error.set('Erreur de chargement des données');
      console.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  setActiveDay(id: string): void {
    this._activeDayId.set(id);
  }

  async updateActivityNotes(
    slotId: number,
    activityId: number,
    notes: string
  ): Promise<void> {
    const dayId = this._activeDayId();
    const days = this._days();
    const day = days.find(d => d.id === dayId);
    if (!day) return;

    // 1. Copie profonde du slot concerné
    const slot = day.content.slots?.find(s => s.id === slotId);
    const activity = slot?.activities?.find(a => a.id === activityId);
    if (!activity) return;

    // 2. Mise à jour locale du signal (UI réactive immédiatement)

    const newSlot = day.content?.slots?.map(s => s.id !== slotId ? s : {
          ...s,
          activities: s.activities?.map(a => a.id !== activityId ? a : {
            ...a,
            notes
          })
        })

    this._days.set(
    days.map(d => d.id !== dayId ? d : {
      ...d,
      content: {
        ...d.content,
        slots: newSlot
      }
    })
  );

    // 3. Écriture Firestore — on réécrit uniquement content.slots
    try {
      await updateDoc(
        doc(this.db, 'tabs', dayId),
        { 'content.slots': newSlot }
      );
    } catch (e) {
      console.error('Erreur mise à jour notes :', e);
      // Optionnel : rollback du signal si l'écriture échoue
    }
  }
}