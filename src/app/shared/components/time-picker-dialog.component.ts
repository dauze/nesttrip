import { Component, ElementRef, forwardRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-time-picker-dialog',
  standalone: true,
  imports: [CommonModule, ButtonModule, DialogModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerDialogComponent),
      multi: true
    }
  ],
  templateUrl: 'time-picker-dialog.component.html',
  styleUrls: ['time-picker-dialog.component.scss']
})
export class TimePickerDialogComponent implements ControlValueAccessor, OnDestroy {
  @ViewChild('hourCol') hourCol!: ElementRef<HTMLDivElement>;
  @ViewChild('minCol') minCol!: ElementRef<HTMLDivElement>;

  hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  currentDate: Date | null = null;
  displayText = '--:--';
  visible = false;

  tempHour = '00';
  tempMinute = '00';

  private hourObserver?: IntersectionObserver;
  private minObserver?: IntersectionObserver;

  onChange: any = () => {};
  onTouch: any = () => {};

  writeValue(value: Date | null): void {
    this.currentDate = value;
    if (value instanceof Date) {
      this.tempHour = String(value.getHours()).padStart(2, '0');
      this.tempMinute = String(value.getMinutes()).padStart(2, '0');
      this.displayText = `${this.tempHour}:${this.tempMinute}`;
    } else {
      this.displayText = '--:--';
    }
  }

  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouch = fn; }

  openDialog() {
    if (this.currentDate instanceof Date) {
      this.tempHour = String(this.currentDate.getHours()).padStart(2, '0');
      this.tempMinute = String(this.currentDate.getMinutes()).padStart(2, '0');
    } else {
      const now = new Date();
      this.tempHour = String(now.getHours()).padStart(2, '0');
      this.tempMinute = String(now.getMinutes()).padStart(2, '0');
    }
    
    this.visible = true;

    setTimeout(() => {
      this.setupObservers();
      this.scrollToValue('hour', this.tempHour);
      this.scrollToValue('minute', this.tempMinute);
    }, 60);
  }

  onItemClick(type: 'hour' | 'minute', value: string) {
    if (type === 'hour') {
      this.tempHour = value;
    } else {
      this.tempMinute = value;
    }
    // Dès qu'on clique, on centre la roue sur ce chiffre
    this.scrollToValue(type, value);
  }

  private setupObservers() {
    this.destroyObservers();

    // Configuration stricte de la zone de intersection
    const options = {
      rootMargin: '-80px 0px -80px 0px',
      threshold: 0.6
    };

    // On passe bien le conteneur natif en ROOT ici
    this.hourObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const val = entry.target.getAttribute('data-val');
          if (val) this.tempHour = val;
        }
      });
    }, { ...options, root: this.hourCol?.nativeElement });

    this.minObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const val = entry.target.getAttribute('data-val');
          if (val) this.tempMinute = val;
        }
      });
    }, { ...options, root: this.minCol?.nativeElement });

    this.hourCol?.nativeElement.querySelectorAll('.wheel-item').forEach(el => this.hourObserver?.observe(el));
    this.minCol?.nativeElement.querySelectorAll('.wheel-item').forEach(el => this.minObserver?.observe(el));
  }

  private scrollToValue(type: 'hour' | 'minute', value: string) {
    const element = type === 'hour' ? this.hourCol?.nativeElement : this.minCol?.nativeElement;

    if (element) {
      // On cherche l'élément HTML exact qui contient la valeur
      const target = Array.from(element.querySelectorAll('.wheel-item')).find(el => el.getAttribute('data-val') === value);
      
      if (target) {
        // Le navigateur s'occupe de tout aligner parfaitement au centre
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  validate() {
    const hourEl = this.hourCol?.nativeElement;
    const minEl = this.minCol?.nativeElement;
    
    // Convertir la hauteur en REM (16px par défaut) pour s'affranchir des zooms écrans et décimales de pixels
    const itemHeightInRem = 2.5; 
    const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

    if (hourEl && minEl) {
      // On convertit le scrollTop en rem avant de faire l'arrondi pour éviter le bug du -1
      const hourScrollTopInRem = hourEl.scrollTop / rootFontSize;
      const minScrollTopInRem = minEl.scrollTop / rootFontSize;

      const hourIndex = Math.round(hourScrollTopInRem / itemHeightInRem);
      const minIndex = Math.round(minScrollTopInRem / itemHeightInRem);

      if (this.hours[hourIndex]) this.tempHour = this.hours[hourIndex];
      if (this.minutes[minIndex]) this.tempMinute = this.minutes[minIndex];
    }

    // Sauvegarde standard
    const updatedDate = this.currentDate ? new Date(this.currentDate) : new Date();
    updatedDate.setHours(Number(this.tempHour), Number(this.tempMinute), 0, 0);
    
    this.currentDate = updatedDate;
    this.displayText = `${this.tempHour}:${this.tempMinute}`;
    
    this.onChange(this.currentDate);
    this.onTouch();
    this.close();
  }

  private destroyObservers() {
    if (this.hourObserver) this.hourObserver.disconnect();
    if (this.minObserver) this.minObserver.disconnect();
  }

  close() {
    this.visible = false;
    this.destroyObservers();
  }

  ngOnDestroy() {
    this.destroyObservers();
  }
}