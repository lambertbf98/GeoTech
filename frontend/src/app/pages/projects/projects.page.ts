import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { AlertController, LoadingController, ToastController, ActionSheetController } from "@ionic/angular";
import { ApiService } from "../../services/api.service";
import { StorageService } from "../../services/storage.service";
import { SyncService } from "../../services/sync.service";
import { Project } from "../../models";
import { firstValueFrom } from "rxjs";

@Component({
  standalone: false,
  selector: "app-projects",
  templateUrl: "./projects.page.html",
  styleUrls: ["./projects.page.scss"],
})
export class ProjectsPage implements OnInit {
  projects: Project[] = [];
  isLoading = true;
  isOnline = true;
  searchQuery = "";

  constructor(
    private apiService: ApiService,
    private storageService: StorageService,
    private syncService: SyncService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController
  ) {}

  async ngOnInit() { await this.loadProjects(); }
  async ionViewWillEnter() { await this.loadProjects(); }

  async loadProjects() {
    this.isLoading = true;
    try {
      const response = await firstValueFrom(this.apiService.get<{ projects: Project[] }>("/projects"));
      this.projects = response?.projects || [];
      await this.storageService.setProjects(this.projects);
      this.isOnline = true;
    } catch (error) {
      this.projects = await this.storageService.getProjects();
      this.isOnline = false;
    }
    this.isLoading = false;
  }

  async doRefresh(event: any) {
    await this.loadProjects();
    event.target.complete();
  }

  get filteredProjects(): Project[] {
    if (!this.searchQuery.trim()) return this.projects;
    const query = this.searchQuery.toLowerCase();
    return this.projects.filter(p => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query));
  }

  async createProject() {
    const alert = await this.alertCtrl.create({
      header: "Nuevo Proyecto",
      inputs: [
        { name: "name", type: "text", placeholder: "Nombre *" },
        { name: "description", type: "textarea", placeholder: "Descripcion" },
        { name: "location", type: "text", placeholder: "Ubicacion" }
      ],
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: "Crear", handler: (data) => { if (data.name?.trim()) { this.saveProject(data); return true; } return false; } }
      ]
    });
    await alert.present();
  }

  private async saveProject(data: any) {
    const loading = await this.loadingCtrl.create({ message: "Creando...", spinner: "crescent" });
    await loading.present();
    try {
      const newProject = { name: data.name.trim(), description: data.description, location: data.location };
      if (this.isOnline) {
        const response = await firstValueFrom(this.apiService.post<Project>("/projects", newProject));
        if (response) {
          this.projects.unshift(response);
        }
      } else {
        const tempProject: Project = {
          ...newProject,
          id: "temp_" + Date.now(),
          photoCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          synced: false
        };
        this.projects.unshift(tempProject);
      }
      await this.storageService.setProjects(this.projects);
    } catch (error) {
      console.error('Error creating project:', error);
    }
    await loading.dismiss();
  }

  openProject(project: Project) { this.router.navigate(["/project-detail", project.id]); }

  async showProjectOptions(project: Project, event: Event) {
    event.stopPropagation();
    const actionSheet = await this.actionSheetCtrl.create({
      header: project.name,
      buttons: [
        { text: "Ver", icon: "eye-outline", handler: () => this.openProject(project) },
        { text: "Eliminar", icon: "trash-outline", role: "destructive", handler: () => this.deleteProject(project) },
        { text: "Cancelar", role: "cancel" }
      ]
    });
    await actionSheet.present();
  }

  async deleteProject(project: Project) {
    this.projects = this.projects.filter(p => p.id !== project.id);
    await this.storageService.setProjects(this.projects);
  }

  formatDate(dateString: string | Date): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  }
}
