// 同步層：如果 firebase-config.js 已經填好真的金鑰，就用 Firebase Realtime
// Database 做跨裝置即時同步；否則自動退回「本機測試模式」
// （用 BroadcastChannel + localStorage，只能在同一台電腦的不同分頁間同步，
// 方便還沒設定 Firebase 前先測試畫面與流程）。
//
// 對外只提供這幾個方法，host.js / report.js 都透過這層操作資料，
// 不需要知道底層到底是 Firebase 還是本機模式：
//   Sync.init()
//   Sync.getMode()                       -> "firebase" | "local"
//   Sync.setValue(path, value)           -> 覆寫單一物件（例如目前任務）
//   Sync.onValue(path, cb)               -> 監聽單一物件
//   Sync.pushItem(path, value)           -> 新增一筆到清單（例如回報紀錄）
//   Sync.onList(path, cb)                -> 監聽清單，回傳陣列（依時間排序）
//   Sync.removeLastItem(path)            -> 撤銷清單最後一筆
//   Sync.clearList(path)                 -> 清空整個清單
window.Sync = (function () {
  var mode = "local";
  var db = null;
  var channel = null;
  var localListeners = {}; // path -> [callback]
  var STORAGE_PREFIX = "pikmin-draw:";
  var CHANNEL_NAME = "pikmin-draw-sync";

  function isFirebaseConfigured() {
    var cfg = window.firebaseConfig;
    return !!(cfg && cfg.apiKey && cfg.apiKey.indexOf("YOUR_") !== 0);
  }

  function init() {
    if (isFirebaseConfigured() && window.firebase) {
      firebase.initializeApp(window.firebaseConfig);
      db = firebase.database();
      mode = "firebase";
    } else {
      mode = "local";
      try {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = function (evt) {
          notifyLocal(evt.data.path, evt.data.value);
        };
      } catch (e) {
        // 瀏覽器不支援 BroadcastChannel 時，仍可在單一分頁內運作
        channel = null;
      }
    }
    console.log("[Sync] mode =", mode);
    return mode;
  }

  function getMode() {
    return mode;
  }

  function storageKey(path) {
    return STORAGE_PREFIX + path;
  }

  function notifyLocal(path, value) {
    (localListeners[path] || []).forEach(function (cb) {
      cb(value);
    });
  }

  function broadcastLocal(path, value) {
    if (channel) {
      channel.postMessage({ path: path, value: value });
    }
    notifyLocal(path, value);
  }

  // ---- 單一物件 ----

  function setValue(path, value) {
    if (mode === "firebase") {
      return db.ref(path).set(value);
    }
    localStorage.setItem(storageKey(path), JSON.stringify(value));
    broadcastLocal(path, value);
    return Promise.resolve();
  }

  function onValue(path, cb) {
    if (mode === "firebase") {
      db.ref(path).on("value", function (snap) {
        cb(snap.val());
      });
      return;
    }
    if (!localListeners[path]) localListeners[path] = [];
    localListeners[path].push(cb);
    var raw = localStorage.getItem(storageKey(path));
    cb(raw ? JSON.parse(raw) : null);
  }

  // ---- 清單（陣列）----

  function pushItem(path, value) {
    if (mode === "firebase") {
      var ref = db.ref(path).push();
      var val = Object.assign({}, value, { _id: ref.key });
      return ref.set(val).then(function () {
        return val;
      });
    }
    var key = storageKey(path);
    var arr = JSON.parse(localStorage.getItem(key) || "[]");
    var val2 = Object.assign({}, value, {
      _id: "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
    });
    arr.push(val2);
    localStorage.setItem(key, JSON.stringify(arr));
    broadcastLocal(path, arr);
    return Promise.resolve(val2);
  }

  function onList(path, cb) {
    if (mode === "firebase") {
      db.ref(path).on("value", function (snap) {
        var val = snap.val() || {};
        var arr = Object.keys(val)
          .map(function (k) {
            return val[k];
          })
          .sort(function (a, b) {
            return (a.timestamp || 0) - (b.timestamp || 0);
          });
        cb(arr);
      });
      return;
    }
    if (!localListeners[path]) localListeners[path] = [];
    localListeners[path].push(cb);
    var raw = localStorage.getItem(storageKey(path));
    cb(raw ? JSON.parse(raw) : []);
  }

  function removeLastItem(path) {
    if (mode === "firebase") {
      return db
        .ref(path)
        .orderByChild("timestamp")
        .limitToLast(1)
        .once("value")
        .then(function (snap) {
          var val = snap.val();
          if (!val) return null;
          var key = Object.keys(val)[0];
          return db
            .ref(path + "/" + key)
            .remove()
            .then(function () {
              return val[key];
            });
        });
    }
    var key2 = storageKey(path);
    var arr = JSON.parse(localStorage.getItem(key2) || "[]");
    if (arr.length === 0) return Promise.resolve(null);
    var removed = arr.pop();
    localStorage.setItem(key2, JSON.stringify(arr));
    broadcastLocal(path, arr);
    return Promise.resolve(removed);
  }

  function clearList(path) {
    if (mode === "firebase") {
      return db.ref(path).remove();
    }
    localStorage.setItem(storageKey(path), JSON.stringify([]));
    broadcastLocal(path, []);
    return Promise.resolve();
  }

  return {
    init: init,
    getMode: getMode,
    setValue: setValue,
    onValue: onValue,
    pushItem: pushItem,
    onList: onList,
    removeLastItem: removeLastItem,
    clearList: clearList
  };
})();
