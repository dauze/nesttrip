import { Directive, ElementRef, OnDestroy, OnInit } from '@angular/core';

@Directive({
  selector: 'textarea[pTextarea][autoResize]',
  standalone: true
})
export class AutoResizeFixDirective implements OnInit, OnDestroy {
  private readonly observer = new ResizeObserver(() => this.resize());

  constructor(private readonly el: ElementRef<HTMLTextAreaElement>) {}

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