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
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Controller } from '@models/controller';
import { Group } from '@models/groups/group';
import { LdapSection, LdapTestResult, ServerSettings } from '@models/server-settings/server-settings';
import { ControllerService } from '@services/controller.service';
import { GroupService } from '@services/group.service';
import { ServerSettingsService } from '@services/server-settings.service';
import { ToasterService } from '@services/toaster.service';
import { DirectoryManagementComponent } from './directory-management.component';

describe('DirectoryManagementComponent', () => {
  let component: DirectoryManagementComponent;
  let fixture: ComponentFixture<DirectoryManagementComponent>;
  let mockControllerService: any;
  let mockServerSettingsService: any;
  let mockGroupService: any;
  let mockToasterService: any;
  let mockActivatedRoute: any;

  const mockController: Controller = {
    id: 1,
    name: 'Test Controller',
    host: 'localhost',
    port: 3080,
    protocol: 'http:',
    authToken: 'token-123',
    tokenExpired: false,
  } as Controller;

  const mockGroups: Group[] = [
    {
      name: 'Administrators',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      user_group_id: 'grp-1',
      is_builtin: true,
    },
    {
      name: 'Users',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      user_group_id: 'grp-2',
      is_builtin: true,
    },
    {
      name: 'Guests',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      user_group_id: 'grp-3',
      is_builtin: false,
    },
  ];

  const mockLdapSettings: LdapSection = {
    enabled: true,
    uri: 'ldaps://dc1.example.com:636',
    bind_dn: 'svc-gns3@example.com',
    bind_password: '••••••••',
    base_dn: 'DC=example,DC=com',
    user_search_filter:
      '(&(objectClass=user)(|(sAMAccountName={username})(userPrincipalName={username})(mail={username})))',
    user_attr_username: 'sAMAccountName',
    user_attr_email: 'mail',
    user_attr_fullname: 'displayName',
    group_search_base: 'DC=example,DC=com',
    group_search_filter: '(&(objectClass=group)(member={user_dn}))',
    group_mapping: {
      'Domain Admins': 'Administrators',
      'Domain Users': 'Users',
    },
    default_group: 'Users',
    start_tls: false,
    verify_cert: true,
    ca_cert_file: null,
    fallback_to_local: true,
    timeout: 15,
  };

  const mockServerSettings: Partial<ServerSettings> = {
    LDAP: mockLdapSettings,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockControllerService = {
      get: vi.fn().mockResolvedValue(mockController),
    };

    mockServerSettingsService = {
      getServerSettings: vi.fn().mockReturnValue(of(mockServerSettings)),
      updateServerSettings: vi.fn().mockReturnValue(of(mockServerSettings)),
      testLdapConnection: vi.fn().mockReturnValue(
        of({
          status: 'success',
          bind_successful: true,
          user_search_successful: true,
          users_found: 42,
          latency_ms: 12.5,
          message: 'Successfully connected to LDAP server in 12.5ms. Found 42 sample user(s) in base DN.',
        } as LdapTestResult),
      ),
    };

    mockGroupService = {
      getGroups: vi.fn().mockReturnValue(of(mockGroups)),
    };

    mockToasterService = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: vi.fn().mockReturnValue('1'),
        },
      },
      parent: {
        snapshot: {
          paramMap: {
            get: vi.fn().mockReturnValue('1'),
          },
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [DirectoryManagementComponent],
      providers: [
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        { provide: ControllerService, useValue: mockControllerService },
        { provide: ServerSettingsService, useValue: mockServerSettingsService },
        { provide: GroupService, useValue: mockGroupService },
        { provide: ToasterService, useValue: mockToasterService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DirectoryManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load controller and directory settings', () => {
    expect(component).toBeTruthy();
    expect(mockControllerService.get).toHaveBeenCalledWith(1);
    expect(mockServerSettingsService.getServerSettings).toHaveBeenCalledWith(mockController);
    expect(mockGroupService.getGroups).toHaveBeenCalledWith(mockController);
    expect(component.isLoading()).toBe(false);
    expect(component.serverHost).toBe('dc1.example.com');
    expect(component.serverPort).toBe(636);
    expect(component.useLdaps).toBe(true);
    expect(component.availableGroups.length).toBe(3);
  });

  it('should display error when controller loading fails', async () => {
    vi.clearAllMocks();
    mockControllerService.get = vi.fn().mockRejectedValue({ error: { message: 'Controller not found' } });

    component.ngOnInit();
    await vi.runAllTimersAsync();

    expect(component.isLoading()).toBe(false);
    expect(mockToasterService.error).toHaveBeenCalledWith('Controller not found');
  });

  it('should display error when server settings loading fails', () => {
    vi.clearAllMocks();
    mockServerSettingsService.getServerSettings = vi
      .fn()
      .mockReturnValue(throwError(() => ({ error: { message: 'Failed to load settings' } })));

    component.loadData();

    expect(component.isLoading()).toBe(false);
    expect(mockToasterService.error).toHaveBeenCalledWith('Failed to load settings');
  });

  describe('Protocol and URI handling', () => {
    it('should parse ldaps URI and set useLdaps to true', () => {
      component.parseUri('ldaps://ad.example.com:636');
      expect(component.useLdaps).toBe(true);
      expect(component.serverHost).toBe('ad.example.com');
      expect(component.serverPort).toBe(636);
      expect(component.computeUri()).toBe('ldaps://ad.example.com:636');
    });

    it('should parse ldap URI and set useLdaps to false', () => {
      component.parseUri('ldap://openldap.example.com:389');
      expect(component.useLdaps).toBe(false);
      expect(component.serverHost).toBe('openldap.example.com');
      expect(component.serverPort).toBe(389);
      expect(component.computeUri()).toBe('ldap://openldap.example.com:389');
    });

    it('should toggle protocol and update default port', () => {
      component.useLdaps = false;
      component.serverPort = 389;
      component.useLdaps = true;
      component.onProtocolToggle();
      expect(component.serverPort).toBe(636);

      component.useLdaps = false;
      component.onProtocolToggle();
      expect(component.serverPort).toBe(389);
    });
  });

  describe('Directory Type Presets and Filter Generation', () => {
    it('should detect Active Directory from search filter', () => {
      expect(component.directoryType).toBe('active_directory');
    });

    it('should generate AD filter with short username, UPN, and email', () => {
      component.directoryType = 'active_directory';
      component.allowShortUsername = true;
      component.allowUpn = true;
      component.allowEmail = true;
      expect(component.generatedFilter).toBe(
        '(&(objectClass=user)(|(sAMAccountName={username})(userPrincipalName={username})(mail={username})))',
      );
    });

    it('should generate AD filter with only short username', () => {
      component.directoryType = 'active_directory';
      component.allowShortUsername = true;
      component.allowUpn = false;
      component.allowEmail = false;
      expect(component.generatedFilter).toBe('(&(objectClass=user)(sAMAccountName={username}))');
    });

    it('should generate AD filter with only UPN', () => {
      component.directoryType = 'active_directory';
      component.allowShortUsername = false;
      component.allowUpn = true;
      component.allowEmail = false;
      expect(component.generatedFilter).toBe('(&(objectClass=user)(userPrincipalName={username}))');
    });

    it('should generate AD filter with only email', () => {
      component.directoryType = 'active_directory';
      component.allowShortUsername = false;
      component.allowUpn = false;
      component.allowEmail = true;
      expect(component.generatedFilter).toBe('(&(objectClass=user)(mail={username}))');
    });

    it('should switch to OpenLDAP preset and update attributes and filters', () => {
      component.directoryType = 'openldap';
      component.onDirectoryTypeChange();

      expect(component.ldapSettings.user_attr_username).toBe('uid');
      expect(component.ldapSettings.user_attr_email).toBe('mail');
      expect(component.ldapSettings.user_attr_fullname).toBe('cn');
      expect(component.ldapSettings.group_search_filter).toBe('(&(objectClass=groupOfNames)(member={user_dn}))');

      component.allowShortUsername = true;
      component.allowEmail = true;
      expect(component.generatedFilter).toBe('(&(objectClass=person)(|(uid={username})(mail={username})))');

      component.allowShortUsername = true;
      component.allowEmail = false;
      expect(component.generatedFilter).toBe('(&(objectClass=person)(uid={username}))');

      component.allowShortUsername = false;
      component.allowEmail = true;
      expect(component.generatedFilter).toBe('(&(objectClass=person)(mail={username}))');
    });

    it('should return raw user_search_filter in custom mode', () => {
      component.directoryType = 'custom';
      component.ldapSettings.user_search_filter = '(&(customClass=account)(customUser={username}))';
      expect(component.generatedFilter).toBe('(&(customClass=account)(customUser={username}))');
    });
  });

  describe('Group Mapping Table', () => {
    it('should parse loaded group_mapping into table rows', () => {
      expect(component.groupMappings).toEqual([
        { directoryGroup: 'Domain Admins', targetGroup: 'Administrators' },
        { directoryGroup: 'Domain Users', targetGroup: 'Users' },
      ]);
    });

    it('should add a new group mapping row with default group', () => {
      component.addGroupMapping();
      expect(component.groupMappings.length).toBe(3);
      expect(component.groupMappings[2]).toEqual({
        directoryGroup: '',
        targetGroup: 'Administrators',
      });
    });

    it('should remove a group mapping row by index', () => {
      component.removeGroupMapping(0);
      expect(component.groupMappings.length).toBe(1);
      expect(component.groupMappings[0].directoryGroup).toBe('Domain Users');
    });

    it('should package group mappings into JSON object map on buildLdapPayload', () => {
      component.groupMappings = [
        { directoryGroup: 'Domain Admins', targetGroup: 'Administrators' },
        { directoryGroup: '  ', targetGroup: 'Users' },
        { directoryGroup: 'CN=Domain Users,CN=Users,DC=example,DC=com', targetGroup: 'Users' },
      ];

      const payload = component.buildLdapPayload();
      expect(payload.group_mapping).toEqual({
        'Domain Admins': 'Administrators',
        'CN=Domain Users,CN=Users,DC=example,DC=com': 'Users',
      });
    });
  });

  describe('Live Diagnostic Test Connection', () => {
    it('should test in-flight LDAP settings and toast result on success', () => {
      component.testConnection();

      expect(mockServerSettingsService.testLdapConnection).toHaveBeenCalledWith(
        mockController,
        expect.objectContaining({
          uri: 'ldaps://dc1.example.com:636',
          user_search_filter: component.generatedFilter,
        }),
      );
      expect(mockToasterService.success).toHaveBeenCalledWith(
        'Successfully connected to LDAP server in 12.5ms. Found 42 sample user(s) in base DN.',
      );
      expect(component.isTesting()).toBe(false);
    });

    it('should toast error message when test fails', () => {
      mockServerSettingsService.testLdapConnection.mockReturnValue(
        of({
          status: 'error',
          bind_successful: false,
          user_search_successful: false,
          users_found: 0,
          latency_ms: 5.0,
          message: 'LDAP protocol error: Invalid credentials',
        } as LdapTestResult),
      );

      component.testConnection();

      expect(mockToasterService.error).toHaveBeenCalledWith('LDAP protocol error: Invalid credentials');
      expect(component.isTesting()).toBe(false);
    });

    it('should toast error on test network failure', () => {
      mockServerSettingsService.testLdapConnection.mockReturnValue(
        throwError(() => ({ error: { message: 'Connection timed out' } })),
      );

      component.testConnection();

      expect(mockToasterService.error).toHaveBeenCalledWith('Connection timed out');
      expect(component.isTesting()).toBe(false);
    });
  });

  describe('Save and Discard Changes', () => {
    it('should call updateServerSettings with LDAP payload on save', () => {
      component.serverHost = 'new-dc.example.com';
      component.serverPort = 636;
      component.useLdaps = true;
      component.save();

      expect(mockServerSettingsService.updateServerSettings).toHaveBeenCalledWith(
        mockController,
        expect.objectContaining({
          LDAP: expect.objectContaining({
            uri: 'ldaps://new-dc.example.com:636',
          }),
        }),
      );
      expect(mockToasterService.success).toHaveBeenCalledWith('Directory settings saved successfully');
      expect(component.isSaving()).toBe(false);
    });

    it('should handle save error', () => {
      mockServerSettingsService.updateServerSettings.mockReturnValue(
        throwError(() => ({ error: { message: 'Permission denied' } })),
      );

      component.save();

      expect(mockToasterService.error).toHaveBeenCalledWith('Permission denied');
      expect(component.isSaving()).toBe(false);
    });

    it('should include bind_password only if password was changed', () => {
      const payloadUnchanged = component.buildLdapPayload();
      expect(payloadUnchanged.bind_password).toBeUndefined();

      component.bindPassword = 'NewSecretPassword123';
      component.onPasswordInput();

      const payloadChanged = component.buildLdapPayload();
      expect(payloadChanged.bind_password).toBe('NewSecretPassword123');
    });

    it('should discard edits and revert to initial settings', () => {
      component.serverHost = 'modified.example.com';
      component.discardChanges();

      expect(component.serverHost).toBe('dc1.example.com');
      expect(mockToasterService.info).toHaveBeenCalledWith('Changes discarded');
    });
  });
});
