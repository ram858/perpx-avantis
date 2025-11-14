# Web Development Mode

This guide explains how to run PrepX locally in a regular web browser for development and debugging, without needing the Farcaster/Base app.

## Quick Start

1. **Create a `.env.local` file** in the root directory (if it doesn't exist)

2. **Add this line** to enable web development mode:
   ```bash
   NEXT_PUBLIC_ENABLE_WEB_DEV=true
   ```

3. **Start the development server**:
   ```bash
   pnpm dev
   ```

4. **Open your browser** to `http://localhost:3000` - the app will automatically redirect to `/home`

## What Web Dev Mode Does

When `NEXT_PUBLIC_ENABLE_WEB_DEV=true`:

- ✅ **Bypasses Base/Farcaster context checks** - App runs in regular browser
- ✅ **Creates mock authentication** - Uses a development user with mock FID and address
- ✅ **Allows full app access** - All features accessible for development
- ✅ **No Base SDK required** - Works without Farcaster/Base app
- ✅ **Preserves production behavior** - Farcaster/Base functionality unchanged when disabled

## Mock User Details

In web dev mode, the app uses:
- **FID**: `12345` (mock Farcaster ID)
- **Address**: `0x1234567890123456789012345678901234567890` (mock Base Account address)
- **Token**: `dev_token_mock_jwt_for_local_development` (mock JWT)

## Important Notes

⚠️ **Before deploying to production:**
- Set `NEXT_PUBLIC_ENABLE_WEB_DEV=false` or remove it from `.env.local`
- Ensure `.env.local` is in `.gitignore` (it already is)
- Test in Farcaster/Base app to verify production behavior

## Environment Variables

### `.env.local` (for local development)
```bash
# Enable web development mode
NEXT_PUBLIC_ENABLE_WEB_DEV=true

# Enable web preview mode (for non-Base contexts)
NEXT_PUBLIC_ENABLE_WEB_MODE=true
```

### Production (Farcaster/Base app)
```bash
# Web dev mode should NOT be set or should be 'false'
# NEXT_PUBLIC_ENABLE_WEB_DEV=false

# Web preview mode can be enabled for previews
NEXT_PUBLIC_ENABLE_WEB_MODE=true
```

## Troubleshooting

### App still shows "Base App Required"
- Make sure `.env.local` exists in the root directory
- Verify `NEXT_PUBLIC_ENABLE_WEB_DEV=true` is set
- Restart the dev server after adding the env variable
- Clear browser cache if needed

### Authentication not working
- Check browser console for errors
- Verify the mock user is being created (check console logs)
- Make sure you're accessing `/home` directly

### Features not working
- Some features require backend API calls that may need real FID
- Trading features may not work without real Base Account
- Balance fetching should work with mock data

## Development Workflow

1. **Local Development**: Use `NEXT_PUBLIC_ENABLE_WEB_DEV=true` for quick iteration
2. **Testing**: Test in Farcaster/Base app before pushing
3. **Production**: Ensure web dev mode is disabled

## Benefits

- 🚀 **Faster development** - No need to open Farcaster app for every change
- 🐛 **Easier debugging** - Full browser DevTools access
- 🔍 **Better testing** - Can test UI/UX without mobile app constraints
- 💻 **Desktop development** - Develop on desktop without mobile device

