// src/app/core/travel.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { Activity, Day, DayContent, Slot, TodoItem } from '../models/travel.models';
import { FirebaseService } from './firebase.service';
import {
  collection,
  FieldPath,
  getDocs,
  query,
  setDoc
} from 'firebase/firestore';
import { doc, updateDoc } from 'firebase/firestore';
import { StorageService } from './storage.service';



@Injectable({ providedIn: 'root' })
export class TabService {

  private readonly storageService = inject(StorageService);

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

  async uploadActivityFile(
    slotId: number,
    activityId: number,
    file: File
  ): Promise<void> {
    const dayId = this._activeDayId();
    // Chemin : tabs/day1/slot-id/activity-id/nom-du-fichier
    const path = `tabs/${dayId}/${slotId}/${activityId}/${file.name}`;

    const { url, name } = await this.storageService.uploadFile(file, path);
    await this.updateActivityField(slotId, activityId, { fileUrl: url, fileName: name });
  }

  async removeActivityFile(slotId: number, activityId: number, path: string): Promise<void> {
    await this.storageService.deleteFile(path);
    await this.updateActivityField(slotId, activityId, { fileUrl: '', fileName: '' });
  }

  async updateActivityField(
    slotId: number,
    activityId: number,
    patch: Partial<Activity>
  ): Promise<void> {
    const dayId = this._activeDayId();
    const days = this._days();
    const day = days.find(d => d.id === dayId);
    if (!day) return;

    const newSlots = day.content.slots?.map(s => s.id !== slotId ? s : {
      ...s,
      activities: s.activities?.map(a => a.id !== activityId ? a : { ...a, ...patch })
    });

    this._days.set(days.map(d => d.id !== dayId ? d : {
      ...d, content: { ...d.content, slots: newSlots }
    }));


  await updateDoc(doc(this.db, 'tabs', dayId),new FieldPath('content', 'slots'), newSlots);
  }

  async removeActivity(slotId: number,activityId: number){
  const dayId = this._activeDayId();
    const days = this._days();
    const day = days.find(d => d.id === dayId);
    if (!day) return;

    const newSlots = day.content.slots?.map(s => s.id !== slotId ? s : {
      ...s,
      activities: s.activities?.filter(a => a.id !== activityId)
    });

    this._days.set(days.map(d => d.id !== dayId ? d : {
      ...d, content: { ...d.content, slots: newSlots }
    }));

    await updateDoc(doc(this.db, 'tabs', dayId),new FieldPath('content', 'slots'), newSlots);
  }
  
async updateSlotField(
  slotId: number,
  patch: Partial<Slot>
): Promise<void> {
  const dayId = this._activeDayId();
  const days = this._days();
  const day = days.find(d => d.id === dayId);
  if (!day) return;

  const newSlots = day.content.slots?.map(s =>
    s.id !== slotId ? s : { ...s, ...patch }
  );

  this._days.set(days.map(d =>
    d.id !== dayId ? d : { ...d, content: { ...d.content, slots: newSlots } }
  ));

  await updateDoc(doc(this.db, 'tabs', dayId),new FieldPath('content', 'slots'), newSlots);
}

    async updateElement(
    items: TodoItem[],
  ): Promise<void> {
    const dayId = this._activeDayId();
    const days = this._days();
    const day = days.find(d => d.id === dayId);
    if (!day) return;

    const elements = day.content.elements?.map(e => e.id !== 1 ? e : {
      ...e,
      items
    });

    this._days.set(days.map(d => d.id !== dayId ? d : {
      ...d, content: { ...d.content, elements: elements }
    }));

    await setDoc(doc(this.db, 'tabs', dayId), { content: { elements: elements } }, { merge: true });
  }

  async updateDayField(patch: Partial<DayContent>): Promise<void> {
    const dayId = this._activeDayId();
    const days = this._days();

    this._days.set(days.map(d =>
      d.id !== dayId ? d : { ...d, content: { ...d.content, ...patch } }
    ));

    await updateDoc(doc(this.db, 'tabs', dayId), {
      content: { ...days.find(d => d.id === dayId)!.content, ...patch }
    });
  }
}