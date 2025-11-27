import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

// Plugin to capture the actual port Vite uses
function portCapturePlugin() {
  return {
    name: 'port-capture',
    configureServer(server: any) {
      // Hook into the server listening event
      server.httpServer?.on('listening', () => {
        const address = server.httpServer.address();
        if (address && typeof address === 'object') {
          const actualPort = address.port;
          fs.writeFileSync('.web-port', actualPort.toString());
          console.log(`✓ Web server started on port ${actualPort}, saved to .web-port`);
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    portCapturePlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'VibeTree',
        short_name: 'VibeTree',
        description: 'Code with AI in parallel git worktrees',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  server: {
    port: 3000,
    host: '0.0.0.0', // Bind to all network interfaces for network access
    strictPort: false, // Allow Vite to find alternative ports
    // Note: Proxy configuration removed - apps will connect directly using environment variables
  }
});