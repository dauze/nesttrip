// init-content.directive.ts
import { Directive, ElementRef, inject, input, OnInit } from '@angular/core';

@Directive({
  selector: '[initContent]',
  standalone: true,
})
export class InitContentDirective implements OnInit {
  readonly initContent = input<string>('');
  private el = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    this.el.nativeElement.textContent = this.initContent();
  }
}