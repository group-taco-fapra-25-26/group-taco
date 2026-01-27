import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RgMarkingDialogComponent } from './rg-marking-dialog.component';

describe('RgMarkingDialogComponent', () => {
    let component: RgMarkingDialogComponent;
    let fixture: ComponentFixture<RgMarkingDialogComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [RgMarkingDialogComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(RgMarkingDialogComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
