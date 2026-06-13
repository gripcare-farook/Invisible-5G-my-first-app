const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Prevent Metro from watching node_modules that cause ENOENT errors
// (e.g. react-router temp dirs created during build and then deleted)
const { watchFolders } = config;
const blockList = config.resolver?.blockList ?? [];

config.resolver = {
  ...config.resolver,
  blockList: Array.isArray(blockList)
    ? [...blockList, /node_modules\/.*react-router.*_tmp.*/]
    : blockList,
};

module.exports = config;
