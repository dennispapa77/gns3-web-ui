/*
 * Software Name : GNS3 Web UI
 * Version: 3
 * SPDX-FileCopyrightText: Copyright (c) 2026 GNS3 Technologies Inc.
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * This software is distributed under the GPL-3.0 or any later version,
 * the text of which is available at https://www.gnu.org/licenses/gpl-3.0.txt
 * or see the "LICENSE" file for more details.
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Controller } from '@models/controller';
import { Group } from '@models/groups/group';
import { LdapSection } from '@models/server-settings/server-settings';
import { ControllerService } from '@services/controller.service';
import { GroupService } from '@services/group.service';
import { ServerSettingsService } from '@services/server-settings.service';
import { ToasterService } from '@services/toaster.service';

export type DirectoryType = 'active_directory' | 'openldap' | 'custom';

export interface GroupMappingRow {
  directoryGroup: string;
  targetGroup: string;
}

export const DEFAULT_LDAP_SETTINGS: LdapSection = {
  enabled: false,
  uri: 'ldaps://localhost:636',
  bind_dn: null,
  bind_password: null,
  base_dn: '',
  user_search_filter:
    '(&(objectClass=user)(|(sAMAccountName={username})(userPrincipalName={username})(mail={username})))',
  user_attr_username: 'sAMAccountName',
  user_attr_email: 'mail',
  user_attr_fullname: 'displayName',
  group_search_base: null,
  group_search_filter: '(&(objectClass=group)(member={user_dn}))',
  group_mapping: {},
  default_group: 'Users',
  start_tls: false,
  verify_cert: true,
  ca_cert_file: null,
  fallback_to_local: true,
  timeout: 10,
};

@Component({
  standalone: true,
  selector: 'app-directory-management',
  templateUrl: './directory-management.component.html',
  styleUrl: './directory-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTooltipModule,
  ],
})
export class DirectoryManagementComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private controllerService = inject(ControllerService);
  private serverSettingsService = inject(ServerSettingsService);
  private groupService = inject(GroupService);
  private toasterService = inject(ToasterService);
  public cd = inject(ChangeDetectorRef);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly isTesting = signal(false);

  controller: Controller | undefined;
  availableGroups: Group[] = [];
  groupMappings: GroupMappingRow[] = [];
  displayedMappingColumns: string[] = ['directoryGroup', 'targetGroup', 'actions'];

  // Host and port separation for protocol toggle
  serverHost = 'localhost';
  serverPort = 636;
  useLdaps = true;

  directoryType: DirectoryType = 'active_directory';
  allowShortUsername = true;
  allowUpn = true;
  allowEmail = true;

  hidePassword = true;
  bindPassword = '';
  passwordChanged = false;

  ldapSettings: LdapSection = { ...DEFAULT_LDAP_SETTINGS };
  private initialSettings: LdapSection | null = null;

  ngOnInit(): void {
    const controllerId =
      this.route.snapshot.paramMap.get('controller_id') ??
      this.route.parent?.snapshot.paramMap.get('controller_id') ??
      '';

    if (!controllerId) {
      this.isLoading.set(false);
      this.toasterService.error('Controller ID missing');
      return;
    }

    this.controllerService.get(Number.parseInt(controllerId, 10)).then(
      (controller: Controller) => {
        this.controller = controller;
        this.loadData();
      },
      (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || err.message || 'Failed to load controller';
        this.toasterService.error(msg);
        this.cd.markForCheck();
      },
    );
  }

  loadData(): void {
    if (!this.controller) {
      return;
    }
    this.isLoading.set(true);

    forkJoin({
      settings: this.serverSettingsService.getServerSettings(this.controller),
      groups: this.groupService.getGroups(this.controller).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ settings, groups }) => {
        this.availableGroups = groups || [];
        this.initForm(settings?.LDAP);
        this.isLoading.set(false);
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || err.message || 'Failed to load directory settings';
        this.toasterService.error(msg);
        this.cd.markForCheck();
      },
    });
  }

  parseUri(uri: string): void {
    if (!uri) {
      this.useLdaps = true;
      this.serverHost = 'localhost';
      this.serverPort = 636;
      return;
    }

    const isLdaps = uri.startsWith('ldaps://');
    this.useLdaps = isLdaps;

    const clean = uri.replace(/^ldaps?:\/\//, '');
    const parts = clean.split(':');
    this.serverHost = parts[0] || 'localhost';
    if (parts[1]) {
      const parsedPort = parseInt(parts[1], 10);
      this.serverPort = isNaN(parsedPort) ? (isLdaps ? 636 : 389) : parsedPort;
    } else {
      this.serverPort = isLdaps ? 636 : 389;
    }
  }

  computeUri(): string {
    const protocol = this.useLdaps ? 'ldaps://' : 'ldap://';
    const host = (this.serverHost || 'localhost').trim().replace(/^ldaps?:\/\//, '');
    const port = this.serverPort || (this.useLdaps ? 636 : 389);
    return `${protocol}${host}:${port}`;
  }

  onProtocolToggle(): void {
    if (this.useLdaps && this.serverPort === 389) {
      this.serverPort = 636;
    } else if (!this.useLdaps && this.serverPort === 636) {
      this.serverPort = 389;
    }
    this.cd.markForCheck();
  }

  initForm(ldap: LdapSection | undefined): void {
    const raw = ldap ? { ...ldap } : { ...DEFAULT_LDAP_SETTINGS };
    this.ldapSettings = {
      ...DEFAULT_LDAP_SETTINGS,
      ...raw,
      group_mapping: { ...(raw.group_mapping || {}) },
    };
    this.initialSettings = JSON.parse(JSON.stringify(this.ldapSettings));

    this.parseUri(this.ldapSettings.uri);

    this.directoryType = this.detectDirectoryType(this.ldapSettings);
    this.initFormatFlags(this.ldapSettings, this.directoryType);

    this.bindPassword = '';
    this.passwordChanged = false;

    this.groupMappings = Object.entries(this.ldapSettings.group_mapping || {}).map(([directoryGroup, targetGroup]) => ({
      directoryGroup,
      targetGroup,
    }));

    if (!this.ldapSettings.default_group) {
      this.ldapSettings.default_group = this.availableGroups[0]?.name || 'Users';
    }
  }

  detectDirectoryType(settings: LdapSection): DirectoryType {
    const filter = settings.user_search_filter || '';
    const userAttr = settings.user_attr_username || '';

    if (
      userAttr === 'sAMAccountName' ||
      filter.includes('sAMAccountName') ||
      filter.includes('userPrincipalName') ||
      filter.includes('objectClass=user')
    ) {
      return 'active_directory';
    }

    if (
      (userAttr === 'uid' || filter.includes('uid=')) &&
      (filter.includes('objectClass=person') || filter.includes('objectClass=inetOrgPerson'))
    ) {
      return 'openldap';
    }

    if (!filter) {
      return 'active_directory';
    }

    return 'custom';
  }

  initFormatFlags(settings: LdapSection, type: DirectoryType): void {
    const filter = settings.user_search_filter || '';
    if (type === 'active_directory') {
      this.allowShortUsername = !filter || filter.includes('sAMAccountName');
      this.allowUpn = filter.includes('userPrincipalName');
      this.allowEmail = filter.includes('mail=');
      if (!this.allowShortUsername && !this.allowUpn && !this.allowEmail) {
        this.allowShortUsername = true;
        this.allowUpn = true;
        this.allowEmail = true;
      }
    } else if (type === 'openldap') {
      this.allowShortUsername = !filter || filter.includes('uid=');
      this.allowUpn = false;
      this.allowEmail = filter.includes('mail=');
      if (!this.allowShortUsername && !this.allowEmail) {
        this.allowShortUsername = true;
        this.allowEmail = true;
      }
    } else {
      this.allowShortUsername = true;
      this.allowUpn = true;
      this.allowEmail = true;
    }
  }

  get generatedFilter(): string {
    if (this.directoryType === 'active_directory') {
      const criteria: string[] = [];
      if (this.allowShortUsername) {
        criteria.push('(sAMAccountName={username})');
      }
      if (this.allowUpn) {
        criteria.push('(userPrincipalName={username})');
      }
      if (this.allowEmail) {
        criteria.push('(mail={username})');
      }

      if (criteria.length === 0) {
        criteria.push('(sAMAccountName={username})');
      }

      const match = criteria.length === 1 ? criteria[0] : `(|${criteria.join('')})`;
      return `(&(objectClass=user)${match})`;
    } else if (this.directoryType === 'openldap') {
      const criteria: string[] = [];
      if (this.allowShortUsername) {
        criteria.push('(uid={username})');
      }
      if (this.allowEmail) {
        criteria.push('(mail={username})');
      }

      if (criteria.length === 0) {
        criteria.push('(uid={username})');
      }

      const match = criteria.length === 1 ? criteria[0] : `(|${criteria.join('')})`;
      return `(&(objectClass=person)${match})`;
    }
    return this.ldapSettings.user_search_filter;
  }

  onDirectoryTypeChange(): void {
    if (this.directoryType === 'active_directory') {
      this.ldapSettings.user_attr_username = 'sAMAccountName';
      this.ldapSettings.user_attr_email = 'mail';
      this.ldapSettings.user_attr_fullname = 'displayName';
      this.ldapSettings.group_search_filter = '(&(objectClass=group)(member={user_dn}))';
    } else if (this.directoryType === 'openldap') {
      this.ldapSettings.user_attr_username = 'uid';
      this.ldapSettings.user_attr_email = 'mail';
      this.ldapSettings.user_attr_fullname = 'cn';
      this.ldapSettings.group_search_filter = '(&(objectClass=groupOfNames)(member={user_dn}))';
    }
    this.cd.markForCheck();
  }

  onPasswordInput(): void {
    this.passwordChanged = true;
  }

  addGroupMapping(): void {
    const defaultTarget = this.availableGroups.length > 0 ? this.availableGroups[0].name : 'Users';
    this.groupMappings = [
      ...this.groupMappings,
      {
        directoryGroup: '',
        targetGroup: defaultTarget,
      },
    ];
    this.cd.markForCheck();
  }

  removeGroupMapping(index: number): void {
    this.groupMappings = this.groupMappings.filter((_, i) => i !== index);
    this.cd.markForCheck();
  }

  discardChanges(): void {
    if (this.initialSettings) {
      this.initForm(this.initialSettings);
      this.toasterService.info('Changes discarded');
      this.cd.markForCheck();
    }
  }

  buildLdapPayload(): Partial<LdapSection> {
    const mapping: Record<string, string> = {};
    for (const row of this.groupMappings) {
      const key = row.directoryGroup.trim();
      if (key && row.targetGroup) {
        mapping[key] = row.targetGroup;
      }
    }

    const filter = this.directoryType === 'custom' ? this.ldapSettings.user_search_filter : this.generatedFilter;
    const uri = this.computeUri();

    const payload: Partial<LdapSection> = {
      enabled: this.ldapSettings.enabled,
      uri: uri,
      bind_dn: this.ldapSettings.bind_dn?.trim() || null,
      base_dn: this.ldapSettings.base_dn.trim(),
      user_search_filter: filter,
      user_attr_username: this.ldapSettings.user_attr_username,
      user_attr_email: this.ldapSettings.user_attr_email,
      user_attr_fullname: this.ldapSettings.user_attr_fullname,
      group_search_base: this.ldapSettings.base_dn.trim(),
      group_search_filter: this.ldapSettings.group_search_filter,
      group_mapping: mapping,
      default_group: this.ldapSettings.default_group || 'Users',
      start_tls: this.ldapSettings.start_tls,
      verify_cert: this.ldapSettings.verify_cert,
      ca_cert_file: this.ldapSettings.ca_cert_file?.trim() || null,
      fallback_to_local: this.ldapSettings.fallback_to_local,
      timeout: this.ldapSettings.timeout,
    };

    if (this.passwordChanged) {
      payload.bind_password = this.bindPassword;
    }

    return payload;
  }

  save(): void {
    if (!this.controller) {
      return;
    }
    this.isSaving.set(true);
    const payload = this.buildLdapPayload();
    this.serverSettingsService.updateServerSettings(this.controller, { LDAP: payload }).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        this.toasterService.success('Directory settings saved successfully');
        this.initForm(res.LDAP);
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isSaving.set(false);
        const msg = err.error?.message || err.message || 'Failed to save directory settings';
        this.toasterService.error(msg);
        this.cd.markForCheck();
      },
    });
  }

  testConnection(): void {
    if (!this.controller) {
      return;
    }
    this.isTesting.set(true);
    const payload = this.buildLdapPayload();
    this.serverSettingsService.testLdapConnection(this.controller, payload).subscribe({
      next: (result) => {
        this.isTesting.set(false);
        if (result.status === 'success') {
          this.toasterService.success(result.message);
        } else {
          this.toasterService.error(result.message);
        }
        this.cd.markForCheck();
      },
      error: (err) => {
        this.isTesting.set(false);
        const msg = err.error?.message || err.message || 'Directory connection test failed';
        this.toasterService.error(msg);
        this.cd.markForCheck();
      },
    });
  }
}
