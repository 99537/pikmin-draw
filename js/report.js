(function () {
  var currentTask = null;
  var logList = [];
  var roster = [];
  var rosterCount = {};
  var usedCount = {};

  var pikminGrid = document.getElementById("pikminGrid");
  var roundSentence = document.getElementById("roundSentence");
  var roundProgressText = document.getElementById("roundProgressText");
  var legend = document.getElementById("legend");
  var undoBtn = document.getElementById("undoBtn");
  var modeBadge = document.getElementById("modeBadge");
  var toast = document.getElementById("toast");

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(function () {
      toast.classList.remove("show");
    }, 1800);
  }

  function cardKey(typeId, number) {
    return typeId + "_" + number;
  }

  function remainingOf(typeId, number) {
    var key = cardKey(typeId, number);
    var total = rosterCount[key] || 0;
    var used = usedCount[key] || 0;
    return Math.max(0, total - used);
  }

  function renderLegend() {
    legend.innerHTML = "";
    window.PIKMIN_TYPES.forEach(function (t) {
      var span = document.createElement("span");
      var box = document.createElement("span");
      box.className = "swatch-box";
      box.style.background = t.color;
      span.appendChild(box);
      span.appendChild(document.createTextNode(t.name));
      legend.appendChild(span);
    });
    var note = document.createElement("span");
    note.textContent = "按鍵右上角的數字＝這張卡還剩幾張沒被叫過；淺色虛線＝名單裡沒有登錄這張卡";
    legend.appendChild(note);
  }

  function renderGrid() {
    pikminGrid.innerHTML = "";
    window.PIKMIN_TYPES.forEach(function (t) {
      var row = document.createElement("div");
      row.className = "pikmin-row";

      var label = document.createElement("div");
      label.className = "row-label";
      var dot = document.createElement("span");
      dot.style.display = "inline-block";
      dot.style.width = "12px";
      dot.style.height = "12px";
      dot.style.borderRadius = "50%";
      dot.style.background = t.color;
      label.appendChild(dot);
      label.appendChild(document.createTextNode(t.name));

      var btnWrap = document.createElement("div");
      btnWrap.className = "pikmin-buttons";

      for (var n = window.PIKMIN_NUMBER_MIN; n <= window.PIKMIN_NUMBER_MAX; n++) {
        (function (num) {
          var btn = document.createElement("button");
          btn.className = "pikmin-card-btn";
          btn.style.position = "relative";
          btn.style.background = t.color;
          btn.style.color = t.text;
          btn.dataset.key = cardKey(t.id, num);

          var label2 = document.createElement("span");
          label2.textContent = num;
          btn.appendChild(label2);

          var badge = document.createElement("span");
          badge.className = "remain-badge";
          btn.appendChild(badge);

          btn.addEventListener("click", function () {
            handleCardClick(t.id, num, btn);
          });
          btnWrap.appendChild(btn);
        })(n);
      }

      row.appendChild(label);
      row.appendChild(btnWrap);
      pikminGrid.appendChild(row);
    });
    applyUsedState();
  }

  function applyUsedState() {
    var buttons = pikminGrid.querySelectorAll(".pikmin-card-btn");
    buttons.forEach(function (btn) {
      var key = btn.dataset.key;
      var lastUnderscore = key.lastIndexOf("_");
      var typeId = key.slice(0, lastUnderscore);
      var number = parseInt(key.slice(lastUnderscore + 1), 10);
      var total = rosterCount[key] || 0;
      var remain = remainingOf(typeId, number);
      var badge = btn.querySelector(".remain-badge");

      btn.classList.remove("used", "not-in-roster");
      if (total === 0) {
        btn.classList.add("not-in-roster");
        btn.disabled = true;
        badge.textContent = "";
      } else if (remain <= 0) {
        btn.classList.add("used");
        btn.disabled = true;
        badge.textContent = "";
      } else {
        btn.disabled = false;
        badge.textContent = total > 1 ? "×" + remain : "";
      }
    });
  }

  function handleCardClick(typeId, number, btn) {
    if (remainingOf(typeId, number) <= 0) return;

    // 樂觀更新：先在畫面上扣一張，避免重複點擊
    var key = cardKey(typeId, number);
    usedCount[key] = (usedCount[key] || 0) + 1;
    applyUsedState();

    var entry = {
      typeId: typeId,
      number: number,
      roundId: currentTask ? currentTask.roundId : "none",
      sentence: currentTask ? currentTask.sentence : "",
      timestamp: Date.now()
    };
    Sync.pushItem("log", entry).then(function () {
      showToast("已回報：" + typeNameOf(typeId) + " " + number + " 號");
    });
  }

  function typeNameOf(typeId) {
    var t = window.getPikminType(typeId);
    return t ? t.name : typeId;
  }

  undoBtn.addEventListener("click", function () {
    Sync.removeLastItem("log").then(function (removed) {
      if (removed) {
        showToast("已撤銷：" + typeNameOf(removed.typeId) + " " + removed.number + " 號");
      } else {
        showToast("目前沒有紀錄可以撤銷");
      }
    });
  });

  function recompute() {
    rosterCount = {};
    roster.forEach(function (c) {
      var k = cardKey(c.typeId, c.number);
      rosterCount[k] = (rosterCount[k] || 0) + 1;
    });
    usedCount = {};
    logList.forEach(function (e) {
      var k = cardKey(e.typeId, e.number);
      usedCount[k] = (usedCount[k] || 0) + 1;
    });
  }

  function render() {
    if (!currentTask) {
      roundSentence.textContent = "尚未發布任務";
      roundProgressText.textContent = "0 / 0 人已上台";
    } else {
      roundSentence.textContent = currentTask.sentence;
      var thisRound = logList.filter(function (e) {
        return e.roundId === currentTask.roundId;
      });
      roundProgressText.textContent = thisRound.length + " / " + currentTask.maxPeople + " 人已上台";
    }
    recompute();
    applyUsedState();
  }

  // ---- init ----
  renderLegend();
  renderGrid();

  var mode = Sync.init();
  modeBadge.textContent = "連線模式：" + (mode === "firebase" ? "Firebase（跨裝置）" : "本機測試（同瀏覽器分頁）");
  modeBadge.className = "mode-badge " + mode;

  Sync.onValue("task", function (val) {
    currentTask = val;
    render();
  });
  Sync.onList("log", function (arr) {
    logList = arr;
    render();
  });
  Sync.onList("roster", function (arr) {
    roster = arr;
    render();
  });
})();
