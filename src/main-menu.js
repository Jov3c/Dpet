function buildTrayMenu({ openSettings, quit }) {
  return [
    { label: "打开设置", click: openSettings },
    { type: "separator" },
    { label: "退出桌宠", click: quit }
  ];
}

module.exports = { buildTrayMenu };
