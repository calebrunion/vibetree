import * as fs from 'fs';
import * as path from 'path';
import { ProjectSettings } from '../types';

const SETTINGS_DIR = '.trees';
const SETTINGS_FILE = 'settings.json';

export function getProjectSettingsPath(projectPath: string): string {
  return path.join(projectPath, SETTINGS_DIR, SETTINGS_FILE);
}

export function getProjectRoot(worktreePath: string): string | null {
  const treesIndex = worktreePath.indexOf('/.trees/');
  if (treesIndex !== -1) {
    return worktreePath.substring(0, treesIndex);
  }
  return worktreePath;
}

export function readProjectSettings(projectPath: string): ProjectSettings | null {
  const settingsPath = getProjectSettingsPath(projectPath);

  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content) as ProjectSettings;
  } catch (error) {
    console.error('Failed to read project settings:', error);
    return null;
  }
}

export function writeProjectSettings(projectPath: string, settings: ProjectSettings): boolean {
  const settingsDir = path.join(projectPath, SETTINGS_DIR);
  const settingsPath = getProjectSettingsPath(projectPath);

  try {
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to write project settings:', error);
    return false;
  }
}

export function getStartupCommands(worktreePath: string): string[] {
  const projectRoot = getProjectRoot(worktreePath);
  if (!projectRoot) return [];

  const settings = readProjectSettings(projectRoot);
  return settings?.startupCommands || [];
}
