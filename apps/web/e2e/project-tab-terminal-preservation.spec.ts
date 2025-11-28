import { test, expect, Page } from '@playwright/test';
import { createTestGitRepo, cleanupTestGitRepo } from './helpers/test-git-repo';

test.describe('Project Tab Terminal Preservation', () => {
  let repo1Path: string;
  let repo2Path: string;

  test.beforeEach(async () => {
    const { repoPath: path1 } = createTestGitRepo({ nameSuffix: 'project1' });
    const { repoPath: path2 } = createTestGitRepo({ nameSuffix: 'project2' });
    repo1Path = path1;
    repo2Path = path2;
  });

  test.afterEach(async () => {
    cleanupTestGitRepo(repo1Path);
    cleanupTestGitRepo(repo2Path);
  });

  async function addProject(page: Page, projectPath: string, isFirst: boolean = false) {
    if (!isFirst) {
      await page.getByRole('button', { name: 'Add project' }).click();
      await page.waitForTimeout(500);
    }

    const input = page.getByPlaceholder('~/project/path');
    await input.fill(projectPath);
    await page.getByRole('button', { name: 'Add Project' }).click();
    await page.waitForTimeout(2000);
  }

  async function selectWorktree(page: Page, branch: string = 'main') {
    const worktreeButton = page.locator(`button[data-worktree-branch="${branch}"]`);
    if (await worktreeButton.isVisible()) {
      await worktreeButton.click();
      await page.waitForTimeout(1000);
    }
  }

  async function switchToProject(page: Page, projectName: string) {
    const tab = page.locator(`[role="tab"]:has-text("${projectName}")`);
    await tab.click();
    await page.waitForTimeout(500);
  }

  async function getTerminalDimensions(page: Page): Promise<{ width: number; height: number } | null> {
    const terminal = page.locator('.xterm-screen').first();
    if (!await terminal.isVisible()) return null;

    const box = await terminal.boundingBox();
    return box ? { width: box.width, height: box.height } : null;
  }

  async function isTerminalFunctional(page: Page): Promise<boolean> {
    const terminalScreen = page.locator('.xterm-screen').first();
    if (!await terminalScreen.isVisible()) return false;

    const dimensions = await getTerminalDimensions(page);
    if (!dimensions || dimensions.width < 100 || dimensions.height < 50) {
      return false;
    }

    return true;
  }

  test('terminal should remain functional after switching project tabs multiple times', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addProject(page, repo1Path, true);
    await selectWorktree(page);

    await page.waitForTimeout(2000);
    const initialDimensions = await getTerminalDimensions(page);
    expect(initialDimensions).not.toBeNull();
    expect(initialDimensions!.width).toBeGreaterThan(100);
    expect(initialDimensions!.height).toBeGreaterThan(50);

    const terminalScreen = page.locator('.xterm-screen').first();
    await terminalScreen.click();
    await page.keyboard.type('echo "Project 1 Test"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    let terminalContent = await terminalScreen.textContent();
    expect(terminalContent).toContain('Project 1 Test');

    await addProject(page, repo2Path);
    await selectWorktree(page);

    await page.waitForTimeout(2000);
    const project2Dimensions = await getTerminalDimensions(page);
    expect(project2Dimensions).not.toBeNull();
    expect(project2Dimensions!.width).toBeGreaterThan(100);

    const project1Name = repo1Path.split('/').pop()!;
    const project2Name = repo2Path.split('/').pop()!;

    for (let i = 0; i < 3; i++) {
      await switchToProject(page, project1Name);
      await page.waitForTimeout(500);

      let functional = await isTerminalFunctional(page);
      expect(functional, `Terminal not functional after switching to project 1 (iteration ${i + 1})`).toBe(true);

      const dims1 = await getTerminalDimensions(page);
      expect(dims1).not.toBeNull();
      expect(dims1!.width, `Terminal width is 0 after switching to project 1 (iteration ${i + 1})`).toBeGreaterThan(100);
      expect(dims1!.height, `Terminal height is 0 after switching to project 1 (iteration ${i + 1})`).toBeGreaterThan(50);

      await switchToProject(page, project2Name);
      await page.waitForTimeout(500);

      functional = await isTerminalFunctional(page);
      expect(functional, `Terminal not functional after switching to project 2 (iteration ${i + 1})`).toBe(true);

      const dims2 = await getTerminalDimensions(page);
      expect(dims2).not.toBeNull();
      expect(dims2!.width, `Terminal width is 0 after switching to project 2 (iteration ${i + 1})`).toBeGreaterThan(100);
      expect(dims2!.height, `Terminal height is 0 after switching to project 2 (iteration ${i + 1})`).toBeGreaterThan(50);
    }

    await switchToProject(page, project1Name);
    await page.waitForTimeout(1000);

    const terminalAfterSwitches = page.locator('.xterm-screen').first();
    terminalContent = await terminalAfterSwitches.textContent();
    expect(terminalContent).toContain('Project 1 Test');
  });

  test('terminal should handle rapid tab switching without breaking', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addProject(page, repo1Path, true);
    await selectWorktree(page);
    await page.waitForTimeout(2000);

    await addProject(page, repo2Path);
    await selectWorktree(page);
    await page.waitForTimeout(2000);

    const project1Name = repo1Path.split('/').pop()!;
    const project2Name = repo2Path.split('/').pop()!;

    for (let i = 0; i < 10; i++) {
      await switchToProject(page, project1Name);
      await page.waitForTimeout(100);
      await switchToProject(page, project2Name);
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(2000);

    const functional = await isTerminalFunctional(page);
    expect(functional, 'Terminal should be functional after rapid tab switching').toBe(true);

    const dimensions = await getTerminalDimensions(page);
    expect(dimensions).not.toBeNull();
    expect(dimensions!.width).toBeGreaterThan(100);
    expect(dimensions!.height).toBeGreaterThan(50);

    const terminalScreen = page.locator('.xterm-screen').first();
    await terminalScreen.click();
    await page.keyboard.type('echo "Still working"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const content = await terminalScreen.textContent();
    expect(content).toContain('Still working');
  });

  test('terminal should preserve content across tab switches', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await addProject(page, repo1Path, true);
    await selectWorktree(page);
    await page.waitForTimeout(2000);

    const terminalScreen = page.locator('.xterm-screen').first();
    await terminalScreen.click();

    await page.keyboard.type('export MY_VAR="Hello from Project 1"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.keyboard.type('echo $MY_VAR');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    let content = await terminalScreen.textContent();
    expect(content).toContain('Hello from Project 1');

    await addProject(page, repo2Path);
    await selectWorktree(page);
    await page.waitForTimeout(2000);

    const project1Name = repo1Path.split('/').pop()!;
    await switchToProject(page, project1Name);
    await page.waitForTimeout(1000);

    const terminalAfterSwitch = page.locator('.xterm-screen').first();
    content = await terminalAfterSwitch.textContent();
    expect(content).toContain('Hello from Project 1');
  });
});
