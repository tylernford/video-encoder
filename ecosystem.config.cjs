module.exports = {
  apps: [
    {
      name: "video-encoder",
      script: "pnpm",
      args: "start",
      env: {
        PORT: 3000,
        ENCODE_PARALLEL: "false",
      },
    },
  ],
};
