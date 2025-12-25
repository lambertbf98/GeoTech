import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatastroPage } from './catastro.page';

describe('CatastroPage', () => {
  let component: CatastroPage;
  let fixture: ComponentFixture<CatastroPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CatastroPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
