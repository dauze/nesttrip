import { Directive, ElementRef, inject, OnDestroy, OnInit } from '@angular/core';

@Directive({
  selector: 'textarea[pTextarea][autoResize]',
  standalone: true
})
export class AutoResizeFixDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLTextAreaElement>);

  private readonly observer = new ResizeObserver(() => this.resize());

  ngOnInit(): void {
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer.disconnect();
  }

  private resize(): void {
    const el = this.el.nativeElement;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
}