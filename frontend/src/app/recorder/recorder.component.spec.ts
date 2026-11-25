import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecorderComponent } from './recorder.component';

describe('RecorderComponent', () => {
  let fixture: ComponentFixture<RecorderComponent>;
  let component: RecorderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecorderComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RecorderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start idle with a start button', () => {
    expect(component.status()).toBe('idle');
    const button = fixture.nativeElement.querySelector('button[aria-label="Start recording"]');
    expect(button).toBeTruthy();
  });

  it('should format the timer as minutes:seconds', () => {
    component.seconds.set(75);
    expect(component.timer()).toBe('1:15');
  });

  it('should clear the text and title on discard', () => {
    component.finalText.set('Namaste, how are you?');
    component.title.set('Greeting');

    component.discard();

    expect(component.finalText()).toBe('');
    expect(component.title()).toBe('');
    expect(component.hasText()).toBeFalse();
  });
});
