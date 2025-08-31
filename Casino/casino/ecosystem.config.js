module.exports = {
  apps: [
    {
      name: "captain-cashout-arcade",
      script: "./PTWebSocket/Arcade.js",
      watch: true,
      env: {
        NODE_ENV: "development",
        PORT: 22154
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 22154
      }
    },
    {
      name: "captain-cashout-server", 
      script: "./PTWebSocket/Server.js",
      watch: true,
      env: {
        NODE_ENV: "development",
        PORT: 22188
      },
      env_production: {
        NODE_ENV: "production", 
        PORT: 22188
      }
    },
    {
      name: "captain-cashout-slots",
      script: "./PTWebSocket/Slots.js", 
      watch: true,
      env: {
        NODE_ENV: "development",
        PORT: 22197
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 22197
      }
    }
  ]
};