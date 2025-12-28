import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ProjectEditorPage } from './project-editor.page';

const routes: Routes = [
  {
    path: '',
    component: ProjectEditorPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ProjectEditorPageRoutingModule {}
