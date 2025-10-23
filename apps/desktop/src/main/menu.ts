import { Menu, BrowserWindow, MenuItemConstructorOptions, dialog, app, ipcMain } from 'electron';
import { recentProjectsManager } from './recent-projects';
import { shellProcessManager } from './shell-manager';
import path from 'path';

let statsDialogWindow: BrowserWindow | null = null;

function showStatsDialog(parentWindow: BrowserWindow, stats: any) {
  // Close existing stats dialog if open
  if (statsDialogWindow && !statsDialogWindow.isDestroyed()) {
    statsDialogWindow.close();
  }

  // Create new stats dialog window
  statsDialogWindow = new BrowserWindow({
    width: 600,
    height: 500,
    minWidth: 400,
    minHeight: 300,
    maxWidth: 800,
    maxHeight: 700,
    parent: parentWindow,
    modal: true,
    show: false,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Load the stats dialog HTML
  statsDialogWindow.loadFile(path.join(__dirname, 'stats-dialog.html'));

  // Send stats data once the window is ready
  statsDialogWindow.webContents.once('did-finish-load', () => {
    if (statsDialogWindow) {
      statsDialogWindow.webContents.send('stats-data', stats);
      statsDialogWindow.show();
    }
  });

  // Handle request-stats event
  ipcMain.once('request-stats', (event) => {
    if (statsDialogWindow && !statsDialogWindow.isDestroyed()) {
      event.sender.send('stats-data', stats);
    }
  });

  // Clean up when dialog is closed
  statsDialogWindow.on('closed', () => {
    statsDialogWindow = null;
  });
}

export function createMenu(mainWindow: BrowserWindow | null) {
  const recentProjects = recentProjectsManager.getRecentProjects();

  const recentProjectsMenu = recentProjects.map(project => ({
    label: `${project.name} (${project.path})`,
    click: () => {
      if (mainWindow) {
        mainWindow.webContents.send('project:open-recent', project.path);
      }
    }
  }));

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project Folder...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog({
              properties: ['openDirectory']
            });
            if (result.filePaths[0] && mainWindow) {
              mainWindow.webContents.send('project:open', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Recent Projects',
          submenu: recentProjects.length > 0
            ? [
                ...recentProjectsMenu,
                { type: 'separator' },
                {
                  label: 'Clear Recent Projects',
                  click: () => {
                    recentProjectsManager.clearRecentProjects();
                    createMenu(mainWindow); // Recreate menu to update the list
                  }
                }
              ]
            : [{ label: 'No recent projects', enabled: false }]
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Terminal Settings...',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu:open-terminal-settings');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Stats...',
          click: () => {
            if (mainWindow) {
              try {
                const stats = shellProcessManager.getStats();
                showStatsDialog(mainWindow, stats);
              } catch (error) {
                dialog.showErrorBox('Error', `Failed to fetch stats: ${error}`);
              }
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // Window menu - after adding the app menu, Window menu is now at index 4
    const windowMenu = template[4];
    if (windowMenu && windowMenu.submenu && Array.isArray(windowMenu.submenu)) {
      windowMenu.submenu.push(
        { type: 'separator' },
        { role: 'front' }
      );
    }
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}