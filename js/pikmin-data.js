// 皮克敏種類設定：之後要改名稱、顏色、種類數量都只需要改這裡
window.PIKMIN_TYPES = [
  { id: "red", name: "紅皮克敏", color: "#e53935", text: "#ffffff" },
  { id: "yellow", name: "黃皮克敏", color: "#fdd835", text: "#3a2d00" },
  { id: "blue", name: "藍皮克敏", color: "#1e88e5", text: "#ffffff" },
  { id: "white", name: "白皮克敏", color: "#f5f5f5", text: "#333333" },
  { id: "purple", name: "紫皮克敏", color: "#8e24aa", text: "#ffffff" },
  { id: "rock", name: "岩皮克敏", color: "#6d6d6d", text: "#ffffff" },
  { id: "wing", name: "羽皮克敏", color: "#ec407a", text: "#ffffff" }
];

window.PIKMIN_NUMBER_MIN = 1;
window.PIKMIN_NUMBER_MAX = 9;

window.getPikminType = function (id) {
  return window.PIKMIN_TYPES.find(function (t) { return t.id === id; });
};
