// src/app/core/travel.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { Activity, Day, DayContent, Slot, TodoItem } from '../models/travel.models';
import { FirebaseService } from './firebase.service';
import {
  collection,
  deleteField,
  DocumentReference,
  FieldPath,
  getDocs,
  query,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { doc } from 'firebase/firestore';
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

  // ─── Helpers privés ──────────────────────────────────────────────────────────

  private getActivity(slotId: number, activityId: number): Activity | undefined {
    const day = this._days().find(d => d.id === this._activeDayId());
    return day?.content.slots
      ?.find(s => s.id === slotId)
      ?.activities?.find(a => a.id === activityId);
  }

  /** Migration paresseuse : anciens champs scalaires → tableau files */
  private normalizeActivity(raw: any): Activity {
    if (!raw.files) {
      raw.files = raw.fileUrl
        ? [{ url: raw.fileUrl, name: raw.fileName ?? '', path: raw.filePath ?? '' }]
        : [];
    }
    return raw as Activity;
  }

  /** Migration paresseuse + réécriture Firestore si nécessaire */
  private async normalizeAndMigrate(
    raw: any,
    docRef: DocumentReference
  ): Promise<Activity> {
    const needsMigration = !raw.files && raw.fileUrl;
    const activity = this.normalizeActivity(raw);

    if (needsMigration) {
      // On ne peut pas cibler un sous-objet imbriqué précisément ici,
      // donc on laisse updateActivityField gérer la réécriture complète
      // au prochain save. Pour forcer immédiatement :
      await updateDoc(docRef, {
        fileUrl: deleteField(),
        fileName: deleteField(),
        filePath: deleteField(),
      });
    }

    return activity;
  }

  // ─── Chargement ──────────────────────────────────────────────────────────────

  private async loadDays(): Promise<void> {
    try {
      const q = query(collection(this.db, 'tabs'));
      const snapshot = await getDocs(q);

      const days: Day[] = snapshot.docs.map(docSnap => {
        const raw = docSnap.data() as any;

        // Normaliser toutes les activités au chargement
        if (raw.content?.slots) {
          raw.content.slots = raw.content.slots.map((slot: any) => ({
            ...slot,
            activities: slot.activities?.map((a: any) => this.normalizeActivity(a)) ?? [],
          }));
        }

        return { id: docSnap.id, ...raw } as Day;
      });

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

  // ─── Navigation ──────────────────────────────────────────────────────────────

  setActiveDay(id: string): void {
    this._activeDayId.set(id);
  }

  // ─── Fichiers ────────────────────────────────────────────────────────────────

  async uploadActivityFile(slotId: number, activityId: number, file: File): Promise<void> {
    const dayId = this._activeDayId();
    const path = `tabs/${dayId}/${slotId}/${activityId}/${Date.now()}_${file.name}`;

    const { url, name } = await this.storageService.uploadFile(file, path);
    await this.addActivityFile(slotId, activityId, { url, name, path });
  }

  async addActivityFile(
    slotId: number,
    activityId: number,
    newFile: { url: string; name: string; path: string }
  ): Promise<void> {
    const existing = this.getActivity(slotId, activityId)?.files ?? [];
    await this.updateActivityField(slotId, activityId, {
      files: [...existing, newFile],
    });
  }

  async removeActivityFile(
    slotId: number,
    activityId: number,
    path: string,
    index: number
  ): Promise<void> {
    await this.storageService.deleteFile(path);

    const existing = this.getActivity(slotId, activityId)?.files ?? [];
    const files = existing.filter((_, i) => i !== index);
    await this.updateActivityField(slotId, activityId, { files });
  }

  // ─── Mise à jour générique ────────────────────────────────────────────────────

  async updateActivityField(
    slotId: number,
    activityId: number,
    patch: Partial<Activity>
  ): Promise<void> {
    const dayId = this._activeDayId();
    const days = this._days();
    const day = days.find(d => d.id === dayId);
    if (!day) return;

    const newSlots = day.content.slots?.map(s =>
      s.id !== slotId ? s : {
        ...s,
        activities: s.activities?.map(a =>
          a.id !== activityId ? a : { ...a, ...patch }
        ),
      }
    );

    this._days.set(days.map(d =>
      d.id !== dayId ? d : { ...d, content: { ...d.content, slots: newSlots } }
    ));

    try {
      await updateDoc(
        doc(this.db, 'tabs', dayId),
        new FieldPath('content', 'slots'),
        newSlots
      );
    } catch {
      console.error('Erreur updateActivityField :', newSlots);
    }
  }

  async removeActivity(slotId: number, activityId: number): Promise<void> {
    const dayId = this._activeDayId();
    const days = this._days();
    const day = days.find(d => d.id === dayId);
    if (!day) return;

    const newSlots = day.content.slots?.map(s =>
      s.id !== slotId ? s : {
        ...s,
        activities: s.activities?.filter(a => a.id !== activityId),
      }
    );

    this._days.set(days.map(d =>
      d.id !== dayId ? d : { ...d, content: { ...d.content, slots: newSlots } }
    ));

    await updateDoc(
      doc(this.db, 'tabs', dayId),
      new FieldPath('content', 'slots'),
      newSlots
    );
  }

  async updateSlotField(slotId: number, patch: Partial<Slot>): Promise<void> {
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

    await updateDoc(
      doc(this.db, 'tabs', dayId),
      new FieldPath('content', 'slots'),
      newSlots
    );
  }

  async updateElement(items: TodoItem[] | string[], idEl: number): Promise<void> {
    const dayId = this._activeDayId();
    const days = this._days();
    const day = days.find(d => d.id === dayId);
    if (!day) return;

    const elements = day.content.elements?.map(e =>
      e.id !== idEl ? e : { ...e, items }
    );

    this._days.set(days.map(d =>
      d.id !== dayId ? d : { ...d, content: { ...d.content, elements } }
    ));

    await setDoc(doc(this.db, 'tabs', dayId), { content: { elements } }, { merge: true });
  }

  async updateDayField(patch: Partial<DayContent>): Promise<void> {
    const dayId = this._activeDayId();
    const days = this._days();

    this._days.set(days.map(d =>
      d.id !== dayId ? d : { ...d, content: { ...d.content, ...patch } }
    ));

    await updateDoc(doc(this.db, 'tabs', dayId), {
      content: { ...days.find(d => d.id === dayId)!.content, ...patch },
    });
  }

  async updateElementTitle(title: string, idEl: number): Promise<void> {
    const dayId = this._activeDayId();
    const days = this._days();
    const day = days.find(d => d.id === dayId);
    if (!day) return;

    const elements = day.content.elements?.map(e =>
      e.id !== idEl ? e : { ...e, title }
    );

    this._days.set(days.map(d =>
      d.id !== dayId ? d : { ...d, content: { ...d.content, elements } }
    ));

    await setDoc(doc(this.db, 'tabs', dayId), { content: { elements } }, { merge: true });
  }
}