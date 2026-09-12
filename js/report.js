(function () {
  // 兩種模式：
  // 1. 尚未發布任務 = 報到登記模式：按鍵永遠可以點，每點一次＝多登記一張這種卡
  //    （之後主持端「自動產生任務」就會用這些登記數量當卡池）
  // 2. 已發布任務 = 任務回報模式：按鍵依「剩餘張數」決定能不能點，
  //    剩餘張數＝（手動名單＋報到登記的張數）－（已經在任務輪次中回報掉的張數）
  var currentTask = null;
  var logList = [];
  var roster = [];
  var inventoryCount = {}; // 手動名單 + 報到登記（roundId === "none"）
  var usedInRoundCount = {}; // 已在正式任務輪次中回報掉的張數（roundId !== "none"）

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

  function isCheckinMode() {
    return !currentTask;
  }

  // 任務回報模式下，這張卡還剩幾張沒被叫過
  // 沒有在報到時登記過的卡（total === 0）代表根本沒有學生拿到這張卡，維持鎖住不能點。
  function remainingOf(key) {
    var total = inventoryCount[key] || 0;
    var used = usedInRoundCount[key] || 0;
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
    note.id = "legendNote";
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
            handleCardClick(t.id, num);
          });
          btnWrap.appendChild(btn);
        })(n);
      }

      row.appendChild(label);
      row.appendChild(btnWrap);
      pikminGrid.appendChild(row);
    });
    applyButtonState();
  }

  function applyButtonState() {
    var checkin = isCheckinMode();
    var buttons = pikminGrid.querySelectorAll(".pikmin-card-btn");
    buttons.forEach(function (btn) {
      var key = btn.dataset.key;
      var badge = btn.querySelector(".remain-badge");
      btn.classList.remove("used");

      if (checkin) {
        // 報到登記模式：永遠可以點，右上角顯示目前已登記幾張
        btn.disabled = false;
        var count = inventoryCount[key] || 0;
        badge.textContent = count > 0 ? "×" + count : "";
      } else {
        var remain = remainingOf(key);
        if (remain <= 0) {
          btn.classList.add("used");
          btn.disabled = true;
          badge.textContent = "";
        } else {
          btn.disabled = false;
          badge.textContent = remain > 1 ? "×" + remain : "";
        }
      }
    });

    var note = document.getElementById("legendNote");
    if (note) {
      note.textContent = checkin
        ? "目前是報到登記模式：點一次＝多登記一張這種卡，之後主持端出題會用這些卡"
        : "按鍵右上角＝這張卡還剩幾張沒被叫過（含報到時登記的張數）";
    }
  }

  function handleCardClick(typeId, number) {
    var key = cardKey(typeId, number);
    var checkin = isCheckinMode();

    if (!checkin && remainingOf(key) <= 0) return;

    // 樂觀更新，避免重複點擊造成的延遲感
    if (checkin) {
      inventoryCount[key] = (inventoryCount[key] || 0) + 1;
    } else {
      usedInRoundCount[key] = (usedInRoundCount[key] || 0) + 1;
    }
    applyButtonState();

    var entry = {
      typeId: typeId,
      number: number,
      roundId: currentTask ? currentTask.roundId : "none",
      sentence: currentTask ? currentTask.sentence : "",
      timestamp: Date.now()
    };
    Sync.pushItem("log", entry).then(function () {
      showToast((checkin ? "已登記：" : "已回報：") + typeNameOf(typeId) + " " + number + " 號");
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
    inventoryCount = {};
    roster.forEach(function (c) {
      var k = cardKey(c.typeId, c.number);
      inventoryCount[k] = (inventoryCount[k] || 0) + 1;
    });
    usedInRoundCount = {};
    logList.forEach(function (e) {
      var k = cardKey(e.typeId, e.number);
      if (e.roundId === "none") {
        inventoryCount[k] = (inventoryCount[k] || 0) + 1;
      } else {
        usedInRoundCount[k] = (usedInRoundCount[k] || 0) + 1;
      }
    });
  }

  function render() {
    if (!currentTask) {
      roundSentence.textContent = "📋 報到登記模式（尚未發布任務）";
      roundProgressText.textContent = "點擊卡片即可登記，之後主持端會自動出題";
    } else {
      roundSentence.textContent = currentTask.sentence;
      var thisRound = logList.filter(function (e) {
        return e.roundId === currentTask.roundId;
      });
      roundProgressText.textContent = thisRound.length + " / " + currentTask.maxPeople + " 人已上台";
    }
    recompute();
    applyButtonState();
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
