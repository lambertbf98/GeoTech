import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";
import { CatastroPageRoutingModule } from "./catastro-routing.module";
import { CatastroPage } from "./catastro.page";

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, CatastroPageRoutingModule],
  declarations: [CatastroPage]
})
export class CatastroPageModule {}
