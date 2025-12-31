import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    // Path alias configuration
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            '@core': resolve(__dirname, 'src/core'),
            '@ui': resolve(__dirname, 'src/ui'),
            '@components': resolve(__dirname, 'src/components'),
            '@utils': resolve(__dirname, 'src/utils'),
        },
    },

    // Development server configuration
    server: {
        port: 5173,
        open: true,
        cors: true,
    },

    // Build configuration
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                simulator: resolve(__dirname, 'simulator.html'),
                login: resolve(__dirname, 'login.html'),
                dashboard: resolve(__dirname, 'dashboard.html'),
                library: resolve(__dirname, 'library.html'),
                admin: resolve(__dirname, 'admin.html'),
                mobile: resolve(__dirname, 'mobile_simulator.html'),
            },
        },
    },

    // Optimization settings
    optimizeDeps: {
        include: ['lodash-es'],
    },
});
