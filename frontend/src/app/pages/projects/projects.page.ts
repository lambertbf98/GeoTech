import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { AlertController, ToastController, ActionSheetController } from "@ionic/angular";
import { HttpClient } from "@angular/common/http";
import { ApiService } from "../../services/api.service";
import { StorageService } from "../../services/storage.service";
import { SyncService } from "../../services/sync.service";
import { GpsService } from "../../services/gps.service";
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
    private gpsService: GpsService,
    private router: Router,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private actionSheetCtrl: ActionSheetController,
    private http: HttpClient
  ) {}

  async ngOnInit() { await this.loadProjects(); }
  async ionViewWillEnter() { await this.loadProjects(); }

  async loadProjects() {
    this.isLoading = true;
    // Siempre cargar primero del almacenamiento local
    let localProjects = await this.storageService.getProjects();

    // Verificar conexión y sincronizar con el servidor
    try {
      await firstValueFrom(this.apiService.get<any>("/health"));
      this.isOnline = true;

      // Cargar proyectos del servidor
      try {
        const response: any = await firstValueFrom(this.apiService.get<any>("/projects"));
        const serverProjects = response?.projects || [];

        if (serverProjects.length > 0) {
          // Crear mapa de proyectos locales por serverId
          const localByServerId = new Map<string, Project>();
          localProjects.forEach(p => {
            if (p.serverId) localByServerId.set(p.serverId, p);
          });

          // Agregar proyectos del servidor que no están localmente
          for (const sp of serverProjects) {
            if (!localByServerId.has(sp.id)) {
              // Proyecto existe en servidor pero no localmente
              const newLocal: Project = {
                id: 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                serverId: sp.id,
                name: sp.name,
                description: sp.description || '',
                location: sp.location || '',
                photoCount: sp.photoCount || 0,
                createdAt: new Date(sp.createdAt),
                updatedAt: new Date(sp.updatedAt || sp.createdAt),
                synced: true
              };
              localProjects.push(newLocal);
              console.log('Proyecto descargado del servidor:', sp.name);
            }
          }

          // Guardar proyectos actualizados
          await this.storageService.setProjects(localProjects);
        }

        // Sincronizar proyectos pendientes
        await this.syncService.syncPending();
      } catch (e: any) {
        console.log('Error loading server projects:', e?.message || e);
      }
    } catch (error) {
      this.isOnline = false;
    }

    this.projects = localProjects;
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
    // Obtener ubicación actual automáticamente
    let currentLocation = '';
    try {
      const pos = await Promise.race([
        this.gpsService.getCurrentPosition(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
      ]);
      currentLocation = await this.getLocationName(pos.latitude, pos.longitude);
    } catch (e) {
      console.log('No se pudo obtener ubicación:', e);
    }

    const alert = await this.alertCtrl.create({
      header: "Nuevo Proyecto",
      inputs: [
        { name: "name", type: "text", placeholder: "Nombre *" },
        { name: "description", type: "textarea", placeholder: "Descripcion" },
        { name: "location", type: "text", placeholder: "Ubicacion", value: currentLocation }
      ],
      buttons: [
        { text: "Cancelar", role: "cancel" },
        { text: "Crear", handler: (data) => { if (data.name?.trim()) { this.saveProject(data); return true; } return false; } }
      ]
    });
    await alert.present();
  }

  private async getLocationName(lat: number, lon: number): Promise<string> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`;
      const result = await this.http.get<any>(url).toPromise();
      if (result?.display_name) {
        const parts = result.display_name.split(',').slice(0, 3);
        return parts.join(',').trim();
      }
    } catch (e) {
      console.log('Geocoding error:', e);
    }
    return '';
  }

  private async saveProject(data: any) {
    try {
      const localId = "proj_" + Date.now();
      const newProject: Project = {
        id: localId,
        name: data.name.trim(),
        description: data.description || '',
        location: data.location || '',
        photoCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        synced: false
      };

      if (this.isOnline) {
        try {
          const response: any = await firstValueFrom(this.apiService.post<any>("/projects", {
            name: newProject.name,
            description: newProject.description,
            location: newProject.location
          }));
          if (response && response.project) {
            // Guardar el serverId para sincronización
            newProject.serverId = response.project.id;
            newProject.synced = true;
            console.log('Proyecto creado en servidor con ID:', response.project.id);
          }
        } catch (e: any) {
          console.log('API error, saving locally:', e?.message || e);
          // Encolar para sincronización posterior
          await this.syncService.queueForSync('CREATE', 'project', localId, newProject);
        }
      } else {
        // Si está offline, encolar para sincronización
        await this.syncService.queueForSync('CREATE', 'project', localId, newProject);
      }

      this.projects.unshift(newProject);
      await this.storageService.setProjects(this.projects);
    } catch (error) {
      console.error('Error creating project:', error);
    }
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
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }) +
      ' - ' + date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
}
