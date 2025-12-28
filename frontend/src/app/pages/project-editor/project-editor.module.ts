import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ProjectEditorPageRoutingModule } from './project-editor-routing.module';

import { ProjectEditorPage } from './project-editor.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ProjectEditorPageRoutingModule
  ],
  declarations: [ProjectEditorPage]
})
export class ProjectEditorPageModule {}
