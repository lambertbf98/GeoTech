import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CatastroPage } from './catastro.page';

const routes: Routes = [
  {
    path: '',
    component: CatastroPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CatastroPageRoutingModule {}
