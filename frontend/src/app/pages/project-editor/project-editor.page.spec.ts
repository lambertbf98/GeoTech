import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectEditorPage } from './project-editor.page';

describe('ProjectEditorPage', () => {
  let component: ProjectEditorPage;
  let fixture: ComponentFixture<ProjectEditorPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ProjectEditorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
