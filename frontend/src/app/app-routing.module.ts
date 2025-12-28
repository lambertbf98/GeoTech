import { NgModule } from "@angular/core";
import { PreloadAllModules, RouterModule, Routes } from "@angular/router";

const routes: Routes = [
  { path: "", redirectTo: "login", pathMatch: "full" },
  { path: "login", loadChildren: () => import("./pages/login/login.module").then(m => m.LoginPageModule) },
  { path: "register", loadChildren: () => import("./pages/register/register.module").then(m => m.RegisterPageModule) },
  { path: "tabs", loadChildren: () => import("./pages/tabs/tabs.module").then(m => m.TabsPageModule) },
  { path: "project-detail/:id", loadChildren: () => import("./pages/project-detail/project-detail.module").then(m => m.ProjectDetailPageModule) },
  {
    path: 'mediciones',
    loadChildren: () => import('./pages/mediciones/mediciones.module').then( m => m.MedicionesPageModule)
  },
  {
    path: 'project-editor/:id',
    loadChildren: () => import('./pages/project-editor/project-editor.module').then( m => m.ProjectEditorPageModule)
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
