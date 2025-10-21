import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReachabilityGraphComponent } from './reachability-graph.component';

describe('ReachabilityGraphComponent', () => {
  let component: ReachabilityGraphComponent;
  let fixture: ComponentFixture<ReachabilityGraphComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReachabilityGraphComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ReachabilityGraphComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
