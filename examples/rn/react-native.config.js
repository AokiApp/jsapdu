const path = require("path");

module.exports = {
  project: {
    ios: {
      automaticPodsInstallation: true,
    },
  },
  dependencies: {
    "@aokiapp/jsapdu-rn": {
      root: path.join(__dirname, "../../packages/rn"),
      platforms: {
        // Codegen script incorrectly fails without this
        // So we explicitly specify the platforms with empty object
        ios: {},
        android: {},
      },
    },
  },
};
