import { Component, OnInit } from '@angular/core';
import { SyncService } from '../../services/sync.service';

@Component({
  standalone: false,
  selector: 'app-tabs',
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
})
export class TabsPage implements OnInit {
  pendingSync = 0;

  constructor(private syncService: SyncService) {}

  ngOnInit() {
    this.syncService.getPendingCount().then(count => {
      this.pendingSync = count;
    });
  }
}
