# Buddy Monorepo Structure

This repository has been restructured as a monorepo to support multiple platforms (desktop, web, mobile) while sharing core functionality.

## Architecture Overview

```
buddy/
├── packages/
│   ├── core/       # Shared business logic and types
│   ├── desktop/    # Electron desktop application
│   ├── server/     # Backend service for web/mobile
│   └── web/        # Mobile-friendly web client
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### Installation

```bash
# Install dependencies for all packages
pnpm install
```

### Development

#### Run all services (desktop, server, web)

```bash
pnpm dev
```

#### Run specific services

```bash
# Desktop app only
pnpm dev:desktop

# Server only
pnpm dev:server

# Web client only
pnpm dev:web
```

### Building

```bash
# Build all packages
pnpm build

# Package desktop app for distribution
pnpm package:desktop
```

## Package Details

### @buddy/core

Shared TypeScript types and interfaces used across all packages:

- Communication adapter interfaces (IPC/WebSocket abstraction)
- Common types (Worktree, GitStatus, ShellSession, etc.)
- Business logic that can be shared

### @buddy/desktop

The original Electron desktop application with:

- Native terminal integration via node-pty
- Direct git operations
- IPC communication
- IDE integration (VS Code, Cursor)

### @buddy/server

Backend service that enables web/mobile access:

- Express + WebSocket server
- Terminal session management
- Git operations API
- QR code authentication for device pairing
- JWT-based authentication

### @buddy/web

Mobile-friendly Progressive Web App:

- Touch-optimized terminal interface
- WebSocket communication with server
- Responsive design for mobile devices
- PWA capabilities for offline access

## Communication Architecture

### Desktop App

```
Desktop UI <-> IPC <-> Electron Main Process <-> Native APIs (git, pty, fs)
```

### Web/Mobile App

```
Web UI <-> WebSocket <-> Server <-> Native APIs (git, pty, fs)
```

Both use the same `CommunicationAdapter` interface from `@buddy/core`, allowing code reuse and consistent behavior across platforms.

## QR Code Connection (Future Feature)

The server can generate QR codes that allow mobile devices to connect:

1. Desktop app starts embedded server
2. Server generates QR code with connection token
3. Mobile device scans QR code
4. Establishes WebSocket connection
5. Gains access to same worktrees and terminals

## Security Considerations

- QR tokens expire after 5 minutes
- JWT tokens for persistent sessions
- Local network only (no internet exposure by default)
- Device fingerprinting for session management

## Development Workflow

1. Make changes in respective packages
2. Core changes automatically rebuild and are available to other packages
3. Use Turborepo for efficient builds (only rebuilds what changed)
4. Test across platforms to ensure consistency

## Future Enhancements

- [ ] React Native mobile app in `packages/mobile`
- [ ] Shared UI components library
- [ ] Cloud sync capabilities
- [ ] Collaborative features
- [ ] Enhanced security with TLS certificates
