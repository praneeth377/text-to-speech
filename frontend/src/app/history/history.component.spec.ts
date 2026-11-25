import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API_URL } from '../config';
import { Transcription } from '../transcription.service';
import { HistoryComponent } from './history.component';

describe('HistoryComponent', () => {
  let fixture: ComponentFixture<HistoryComponent>;
  let component: HistoryComponent;
  let httpMock: HttpTestingController;

  const sample: Transcription = {
    id: 1,
    title: 'Meeting notes',
    text: 'Kal ki meeting at 10 AM hai.',
    duration_seconds: 12,
    created_at: '2026-11-25T10:00:00.000Z',
    updated_at: '2026-11-25T10:00:00.000Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoryComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoryComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create and load transcriptions on start', () => {
    fixture.detectChanges(); // runs ngOnInit
    const request = httpMock.expectOne(`${API_URL}/transcriptions`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
    expect(component).toBeTruthy();
  });

  it('should render the transcriptions returned by the API', async () => {
    fixture.detectChanges();
    httpMock.expectOne(`${API_URL}/transcriptions`).flush([sample]);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent;
    expect(component.items().length).toBe(1);
    expect(text).toContain('Meeting notes');
    expect(text).toContain('Kal ki meeting at 10 AM hai.');
  });

  it('should format durations as minutes:seconds', () => {
    expect(component.formatDuration(65)).toBe('1:05');
    expect(component.formatDuration(0)).toBe('0:00');
  });
});
