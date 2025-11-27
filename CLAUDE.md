# Claude Instructions

## Electron App Startup Issues

If the Electron app fails to start with errors like:

- `icudtl.dat not found in bundle`
- `Library not loaded: @rpath/Electron Framework.framework/Electron Framework`
- `Invalid file descriptor to ICU data received`

Run the following command from the project root to fix the Electron installation:

```bash
pnpm fix:electron
```

## Launch with Project

`bin/launch-with-project [PATH] [--name NAME]` - Launch app with auto-opened project. The `--name` sets window title for easy identification.

- Only make updates to the web version of this app
- When asked to start the dev server, run `pnpm dev:all`
