import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiProfileDialogComponent, PROVIDER_PRESETS } from './ai-profile-dialog.component';

describe('AiProfileDialogComponent', () => {
  let component: AiProfileDialogComponent;
  let fixture: ComponentFixture<AiProfileDialogComponent>;

  const mockDialogRef = {
    close: vi.fn(),
  };

  const mockDialog = {
    open: vi.fn(),
  };

  const defaultData = {
    mode: 'create' as const,
    config: null,
    existingNames: ['existing-profile'],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AiProfileDialogComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MAT_DIALOG_DATA, useValue: defaultData },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AiProfileDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('PROVIDER_PRESETS', () => {
    it('should include native anthropic, openai, google_genai, and ollama presets (Issue #2936)', () => {
      const anthropic = PROVIDER_PRESETS.find((p) => p.id === 'anthropic');
      expect(anthropic).toBeDefined();
      expect(anthropic?.provider).toBe('anthropic');
      expect(anthropic?.baseUrl).toBe('');
      expect(anthropic?.models).toContain('claude-3-5-sonnet-latest');

      const openai = PROVIDER_PRESETS.find((p) => p.id === 'openai');
      expect(openai).toBeDefined();
      expect(openai?.provider).toBe('openai');
      expect(openai?.baseUrl).toBe('https://api.openai.com/v1');
      expect(openai?.models).toContain('gpt-4o');

      const google = PROVIDER_PRESETS.find((p) => p.id === 'google_genai');
      expect(google).toBeDefined();
      expect(google?.provider).toBe('google_genai');
      expect(google?.baseUrl).toBe('');
      expect(google?.models).toContain('gemini-2.5-flash');

      const ollama = PROVIDER_PRESETS.find((p) => p.id === 'ollama');
      expect(ollama).toBeDefined();
      expect(ollama?.provider).toBe('ollama');
      expect(ollama?.baseUrl).toBe('http://localhost:11434');
      expect(ollama?.models).toContain('llama3.3');
    });
  });

  describe('onPresetChange', () => {
    it('should configure form correctly when selecting anthropic preset', () => {
      component.onPresetChange('anthropic');

      expect(component.form.get('provider')?.value).toBe('anthropic');
      expect(component.form.get('base_url')?.value).toBe('');
      expect(component.form.get('model')?.value).toBe('claude-3-7-sonnet-latest');
      expect(component.apiKeyPlaceholder).toContain('platform.claude.com');
      expect(component.apiKeyHint).toContain('sk-ant-');
    });

    it('should configure form correctly when selecting openai preset', () => {
      component.onPresetChange('openai');

      expect(component.form.get('provider')?.value).toBe('openai');
      expect(component.form.get('base_url')?.value).toBe('https://api.openai.com/v1');
      expect(component.form.get('model')?.value).toBe('gpt-4o');
      expect(component.apiKeyPlaceholder).toContain('platform.openai.com');
      expect(component.apiKeyHint).toContain('sk-');
    });

    it('should configure form correctly when selecting google_genai preset', () => {
      component.onPresetChange('google_genai');

      expect(component.form.get('provider')?.value).toBe('google_genai');
      expect(component.form.get('base_url')?.value).toBe('');
      expect(component.form.get('model')?.value).toBe('gemini-2.5-flash');
      expect(component.apiKeyPlaceholder).toContain('aistudio.google.com');
      expect(component.apiKeyHint).toContain('aistudio.google.com');
    });

    it('should configure form correctly when selecting ollama preset and make apiKey optional', () => {
      component.onPresetChange('ollama');

      expect(component.form.get('provider')?.value).toBe('ollama');
      expect(component.form.get('base_url')?.value).toBe('http://localhost:11434');
      expect(component.form.get('model')?.value).toBe('llama3.3');
      expect(component.apiKeyPlaceholder).toContain('not required');
      expect(component.apiKeyHint).toContain('does not require an API key');

      // Verify api_key is valid even when empty
      const apiKeyControl = component.form.get('api_key');
      apiKeyControl?.setValue('');
      expect(apiKeyControl?.valid).toBe(true);
    });

    it('should configure form correctly when selecting openrouter preset', () => {
      component.onPresetChange('openrouter');

      expect(component.form.get('provider')?.value).toBe('openai');
      expect(component.form.get('base_url')?.value).toBe('https://openrouter.ai/api/v1');
      expect(component.apiKeyPlaceholder).toContain('openrouter.ai');
      expect(component.apiKeyHint).toContain('sk-or-');
    });
  });
});
