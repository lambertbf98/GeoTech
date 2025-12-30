import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { LicenseGuard } from '../../guards/license.guard';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'projects',
        loadChildren: () => import('../projects/projects.module').then(m => m.ProjectsPageModule),
        canActivate: [LicenseGuard]
      },
      {
        path: 'camera',
        loadChildren: () => import('../camera/camera.module').then(m => m.CameraPageModule),
        canActivate: [LicenseGuard]
      },
      {
        path: 'catastro',
        loadChildren: () => import('../catastro/catastro.module').then(m => m.CatastroPageModule),
        canActivate: [LicenseGuard]
      },
      {
        path: 'settings',
        loadChildren: () => import('../settings/settings.module').then(m => m.SettingsPageModule)
      },
      {
        path: 'mediciones',
        loadChildren: () => import('../mediciones/mediciones.module').then(m => m.MedicionesPageModule),
        canActivate: [LicenseGuard]
      },
      {
        path: '',
        redirectTo: 'settings',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsPageRoutingModule {}
