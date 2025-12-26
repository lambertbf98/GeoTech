import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ModalController } from '@ionic/angular';
import { StorageService } from '../../services/storage.service';
import { Project, Photo } from '../../models';

@Component({
  standalone: false,
  selector: 'app-project-detail',
  templateUrl: './project-detail.page.html',
  styleUrls: ['./project-detail.page.scss'],
})
export class ProjectDetailPage implements OnInit {
  project: Project | null = null;
  photos: Photo[] = [];

  // Photo viewer
  selectedPhoto: Photo | null = null;
  showPhotoViewer = false;

  constructor(
    private route: ActivatedRoute,
    private storageService: StorageService,
    private navCtrl: NavController
  ) {}

  async ngOnInit() {
    const projectId = this.route.snapshot.paramMap.get('id');
    if (projectId) {
      await this.loadProject(projectId);
    }
  }

  async loadProject(projectId: string) {
    const projects = await this.storageService.getProjects();
    this.project = projects.find(p => p.id === projectId) || null;

    if (this.project) {
      const allPhotos = await this.storageService.getPhotos();
      this.photos = allPhotos.filter(p => p.projectId === projectId);
    }
  }

  goBack() {
    this.navCtrl.navigateBack('/tabs/projects');
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  // Photo viewer methods
  openPhotoViewer(photo: Photo) {
    this.selectedPhoto = photo;
    this.showPhotoViewer = true;
  }

  closePhotoViewer() {
    this.showPhotoViewer = false;
    this.selectedPhoto = null;
  }
}
