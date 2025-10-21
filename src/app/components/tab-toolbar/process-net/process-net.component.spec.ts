import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProcessNetComponent } from './process-net.component';

describe('ProcessNetComponent', () => {
  let component: ProcessNetComponent;
  let fixture: ComponentFixture<ProcessNetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProcessNetComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ProcessNetComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
