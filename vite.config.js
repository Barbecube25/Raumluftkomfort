import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Raumluftkomfort',
        short_name: 'Klima',
        description: 'Raumklima Dashboard für Home Assistant',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        // Widget Definition für Android
        widgets: [
          {
            name: "Klima Status (Klein)",
            short_name: "Klima",
            description: "Zeigt Außentemperatur und offene Fenster",
            tag: "klima-status",
            template: "klima-template",
            ms_ac_template: "klima_template",
            data: {
              content: {
                src: "/?view=widget",
                type: "text/html"
              }
            },
            screenshots: [
              {
                src: "/pwa-512x512.png",
                sizes: "512x512",
                label: "Widget Vorschau"
              }
            ],
            icons: [
              {
                src: "/pwa-192x192.png",
                sizes: "192x192",
                type: "image/png"
              }
            ]
          },
          {
            name: "Gesamtstatus & Aufgaben",
            short_name: "Aufgaben",
            description: "Zeigt Score und Handlungsbedarf",
            tag: "klima-summary",
            template: "klima-summary-template",
            ms_ac_template: "klima_summary_template",
            data: {
              content: {
                src: "/?view=widget-summary",
                type: "text/html"
              }
            },
            screenshots: [
              {
                src: "/pwa-512x512.png",
                sizes: "512x512",
                label: "Widget Vorschau"
              }
            ],
            icons: [
              {
                src: "/pwa-192x192.png",
                sizes: "192x192",
                type: "image/png"
              }
            ]
          }
        ]
      }
    })
  ],
})
