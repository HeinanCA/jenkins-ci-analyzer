import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/jenkins-proxy": {
        target: "https://jenkins.neteera.com",
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/jenkins-proxy/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["access-control-allow-origin"] = "*";
            proxyRes.headers["access-control-allow-methods"] = "GET, OPTIONS";
            proxyRes.headers["access-control-allow-headers"] =
              "Authorization, Accept, Content-Type";
          });
        },
      },
    },
  },
});
